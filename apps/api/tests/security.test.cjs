const { test, before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const jwt = require("jsonwebtoken");

// An isolated HTTP server with mocked persistence; never touches the user's DB.
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/security_tests";
process.env.JWT_SECRET = "security-tests-only-".padEnd(64, "x");
process.env.MAX_FILE_SIZE_BYTES = "1024";
process.env.MAX_FILES_PER_UPLOAD = "2";
const persistence = require("../dist/config/prisma");
const realPrisma = persistence.prisma;
const unexpectedQuery = async () => assert.fail("Unexpected database access");
const prisma = {
  user: { findUnique: unexpectedQuery, create: unexpectedQuery, update: unexpectedQuery },
  approvalQueue: { findMany: unexpectedQuery },
  $transaction: unexpectedQuery,
};
persistence.prisma = prisma;
const { app } = require("../dist/app");
const { uploadToStorage } = require("../dist/modules/files/files.service");
let server, base;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(() => mock.restoreAll());
after(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await realPrisma.$disconnect();
});

function token(claims = {}, options = {}) {
  return jwt.sign({ sub: "test-user", role: "ADMIN", ...claims }, process.env.JWT_SECRET,
    { expiresIn: "1m", ...options });
}
function currentUser(role = "ADMIN") {
  mock.method(prisma.user, "findUnique", async () => ({ id: "test-user", name: "Test", email: "test@example.com", role }));
}
function request(route, body, bearer) {
  const headers = {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(base + route, { method: body === undefined ? "GET" : "POST", headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}

test("all data endpoints require authentication", async () => {
  for (const route of ["/auth/me", "/files", "/approvals", "/audit", "/reports/consolidated", "/dashboard/summary"]) {
    assert.equal((await request(route)).status, 401, route);
  }
});

test("forged, expired, wrong-algorithm and missing-subject JWTs are rejected", async () => {
  const wrongKey = jwt.sign({ sub: "test-user" }, "untrusted-key");
  for (const value of [wrongKey, token({}, { expiresIn: -1 }), token({}, { algorithm: "HS384" }),
    jwt.sign({ role: "ADMIN" }, process.env.JWT_SECRET)]) {
    assert.equal((await request("/auth/me", undefined, value)).status, 401);
  }
});

test("a deleted user cannot use a previously signed token", async () => {
  mock.method(prisma.user, "findUnique", async () => null);
  assert.equal((await request("/auth/me", undefined, token())).status, 401);
});

test("ADMIN claim cannot override the user's current ANALYST role", async () => {
  currentUser("ANALYST");
  assert.equal((await request("/approvals", undefined, token())).status, 403);
  assert.equal((await request("/approvals/id/decide", {decision: "APPROVED"}, token())).status, 403);
});

test("promoted account refreshes to ADMIN and can read approvals", async () => {
  currentUser("ADMIN");
  mock.method(prisma.approvalQueue, "findMany", async () => []);
  const response = await request("/auth/me", undefined, token({role: "ANALYST"}));
  assert.equal(response.status, 200);
  const user = await response.json();
  assert.equal(user.role, "ADMIN");
  assert.equal(user.passwordHash, undefined);
  assert.equal((await request("/approvals", undefined, token({role: "ANALYST"}))).status, 200);
});

test("VIEWER cannot upload", async () => {
  currentUser("VIEWER");
  assert.equal((await request("/files/upload", {}, token())).status, 403);
});

test("registration rejects objects, invalid email, short and oversized passwords", async () => {
  for (const body of [{name:{},email:[],password:{}},
    {name:"Test",email:"invalid",password:"123456"},
    {name:"Test",email:"test@example.com",password:"123"},
    {name:"Test",email:"test@example.com",password:"é".repeat(37)}]) {
    assert.equal((await request("/auth/register", body)).status, 400);
  }
});

test("duplicate registration is 409 and never overwrites an existing account", async () => {
  currentUser();
  const create = mock.method(prisma.user, "create", async () => { throw new Error("Must not overwrite account"); });
  const response = await request("/auth/register", {name:"Test",email:"test@example.com",password:"test-password-long"});
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /já está cadastrado/);
  assert.equal(create.mock.callCount(), 0);
});

test("nonexistent login is 401 without exposing internals", async () => {
  mock.method(prisma.user, "findUnique", async () => null);
  const response = await request("/auth/login", {email:"nobody@example.com",password:"invalid"});
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {error:"E-mail ou senha incorretos."});
});

test("registration hashes passwords, ignores supplied ADMIN role and returns no hash", async () => {
  mock.method(prisma.user, "findUnique", async () => null);
  const password = "test-password-long";
  const bcrypt = require("bcryptjs");
  mock.method(prisma.user, "create", async ({data}) => {
    assert.equal(data.role, undefined);
    assert.notEqual(data.passwordHash,password);
    assert.equal(await bcrypt.compare(password,data.passwordHash),true);
    return {id:"new-user",...data,role:"ANALYST"};
  });
  const response = await request("/auth/register", {name:"Test",email:"new@example.com",password,role:"ADMIN"});
  assert.equal(response.status,201);
  const result = await response.json();
  assert.equal(result.role,"ANALYST");
  assert.equal(result.passwordHash,undefined);
});

test("approval validates justification type and bounds", async () => {
  currentUser();
  for (const rejectionReason of [{}, "x".repeat(2001)]) {
    assert.equal((await request("/approvals/id/decide", {decision:"REJECTED",rejectionReason},token())).status,400);
  }
});

test("already claimed approval rejects a second decision before other writes", async () => {
  currentUser();
  const updateSteps = mock.fn(async () => assert.fail("Must not update steps"));
  mock.method(prisma, "$transaction", async callback => callback({
    approvalQueue: { findUnique: async () => ({id:"id",sessionId:"session",fileId:"file"}), updateMany: async () => ({count:0}) },
    processingStep: {updateMany:updateSteps},
  }));
  const response = await request("/approvals/id/decide", {decision:"APPROVED"}, token());
  assert.equal(response.status,409);
  assert.equal(updateSteps.mock.callCount(),0);
});

test("uploads reject unsupported extensions and files above the configured limit", async () => {
  currentUser();
  for (const [name, content, status] of [["payload.exe","invalid",400],["large.csv","x".repeat(2048),413]]) {
    const body = new FormData();
    body.append("files", new Blob([content]), name);
    const response = await fetch(base+"/files/upload", {method:"POST",headers:{Authorization:`Bearer ${token()}`},body});
    assert.equal(response.status,status,name);
  }
});

test("valid multipart files reach the pipeline up to the configured file count", async () => {
  currentUser();
  const pipeline = require("../dist/modules/processing/pipeline.service");
  const processUpload = mock.method(pipeline, "processUpload", async input => {
    assert.equal(input.uploadedById,"test-user");
    assert.equal(input.buffer.toString(),"test");
    return {fileId:"file",status:"PENDING_APPROVAL"};
  });
  const body = new FormData();
  body.append("files",new Blob(["test"]),"first.csv");
  body.append("files",new Blob(["test"]),"second.sql");
  const response = await fetch(base+"/files/upload",{method:"POST",headers:{Authorization:`Bearer ${token()}`},body});
  assert.equal(response.status,201);
  assert.equal(processUpload.mock.callCount(),2);
});

test("storage rejects path traversal and absolute paths outside its directory", async () => {
  for (const name of ["../outside.txt", "../../outside.txt", "/outside.txt"]) {
    await assert.rejects(uploadToStorage(Buffer.from("test"), name, "text/plain"), /Caminho de armazenamento inválido/);
  }
});

test("malformed, compressed and excessive JSON bodies receive controlled errors", async () => {
  const invalid = await fetch(base+"/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:"{"});
  assert.equal(invalid.status,400);
  const compressed = await fetch(base+"/auth/login",{method:"POST",headers:{"Content-Type":"application/json","Content-Encoding":"gzip"},body:"invalid"});
  assert.equal(compressed.status,415);
  const large = await request("/auth/login", {data:"x".repeat(20000)});
  assert.equal(large.status,413);
});

test("API applies security headers and limits CORS to the configured origin", async () => {
  const response = await fetch(base+"/health", {headers:{Origin:"https://untrusted.example"}});
  assert.equal(response.headers.get("x-powered-by"), null);
  assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  assert.equal(response.headers.get("cache-control"),"no-store");
  assert.notEqual(response.headers.get("access-control-allow-origin"),"https://untrusted.example");
});

test("weak JWT secret prevents startup", () => {
  const child = spawnSync(process.execPath, ["-e", "require('./dist/config/env')"], {
    cwd:path.resolve(__dirname,".."), env:{...process.env,JWT_SECRET:"dev-secret-change-me"}, encoding:"utf8",
  });
  assert.notEqual(child.status,0);
  assert.match(child.stderr,/JWT_SECRET/);
});

test("repeated authentication attempts are rate limited", async () => {
  let response;
  for (let i=0; i<31; i++) {
    response=await request("/auth/login", {});
    if (response.status===429) break;
  }
  assert.equal(response.status,429);
  assert.ok(response.headers.get("retry-after"));
});

test("profile photo endpoints require authentication", async () => {
  for (const method of ["PUT","DELETE"]) {
    const response = await fetch(base+"/auth/me/avatar",{method});
    assert.equal(response.status,401);
  }
});

test("photo upload decodes and re-encodes only the current user's image", async () => {
  currentUser("VIEWER");
  const sharp = require("sharp");
  const png = await sharp({create:{width:400,height:200,channels:3,background:"#3e4095"}}).png().toBuffer();
  mock.method(prisma.user,"update",async ({where,data,select}) => {
    assert.equal(where.id,"test-user");
    assert.deepEqual(Object.keys(data),["avatarData"]);
    assert.equal(select.passwordHash,undefined);
    assert.match(data.avatarData,/^data:image\/jpeg;base64,/);
    const image = Buffer.from(data.avatarData.split(",")[1],"base64");
    const info = await sharp(image).metadata();
    assert.equal(info.width,256); assert.equal(info.height,256); assert.equal(info.format,"jpeg");
    assert.equal(info.exif,undefined);
    return {id:"test-user",name:"Test",email:"test@example.com",role:"VIEWER",createdAt:new Date(),...data};
  });
  const body = new FormData(); body.append("photo",new Blob([png]),"photo.png");
  const response=await fetch(base+"/auth/me/avatar",{method:"PUT",headers:{Authorization:`Bearer ${token()}`},body});
  assert.equal(response.status,200);
  const profile=await response.json();
  assert.equal(profile.role,"VIEWER"); assert.equal(profile.avatarData,undefined);
  assert.match(profile.avatarUrl,/^data:image\/jpeg;base64,/);
});

test("photo upload rejects SVG, false image content, extra fields and oversized files", async () => {
  currentUser();
  const update = mock.method(prisma.user,"update",async () => assert.fail("Must not save invalid photo"));
  for (const [content,extra,status] of [["<svg xmlns='http://www.w3.org/2000/svg'></svg>",false,400],
    ["not a picture",false,400],["invalid",true,400],["x".repeat(2*1024*1024+1),false,413]]) {
    const body=new FormData(); body.append("photo",new Blob([content],{type:"image/png"}),"photo.png");
    if (extra) body.append("role","ADMIN");
    const response=await fetch(base+"/auth/me/avatar",{method:"PUT",headers:{Authorization:`Bearer ${token()}`},body});
    assert.equal(response.status,status);
  }
  assert.equal(update.mock.callCount(),0);
});

test("removing a profile photo clears only the current user's avatar", async () => {
  currentUser("ANALYST");
  mock.method(prisma.user,"update",async ({where,data}) => {
    assert.equal(where.id,"test-user"); assert.deepEqual(data,{avatarData:null});
    return {id:"test-user",name:"Test",email:"test@example.com",role:"ANALYST",createdAt:new Date(),avatarData:null};
  });
  const response=await fetch(base+"/auth/me/avatar",{method:"DELETE",headers:{Authorization:`Bearer ${token()}`}});
  assert.equal(response.status,200); assert.equal((await response.json()).avatarUrl,null);
});
