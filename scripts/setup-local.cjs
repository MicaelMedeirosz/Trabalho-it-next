const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const rootEnv = path.join(__dirname, "..", ".env");
let rootContent = fs.existsSync(rootEnv) ? fs.readFileSync(rootEnv, "utf8") : "";
const jwtMatch = rootContent.match(/^JWT_SECRET\s*=\s*["']?([^\r\n"']*)/m);
if (!jwtMatch || !/^[a-f0-9]{64}$/i.test(jwtMatch[1])) {
  const line = `JWT_SECRET=${crypto.randomBytes(32).toString("hex")}`;
  rootContent = jwtMatch ? rootContent.replace(/^JWT_SECRET\s*=.*$/m, line) : `${rootContent.trimEnd()}\n${line}\n`;
  fs.writeFileSync(rootEnv, rootContent, { mode: 0o600 });
  console.log("Segredo local gerado em .env (ignorado pelo Git).");
} else {
  console.log("Configuração local já existe; segredo preservado.");
}

// Garante o código de administrador padrão no .env raiz (usado pelo docker-compose).
const adminRootMatch = rootContent.match(/^ADMIN_REGISTER_CODE\s*=\s*["']?([^\r\n"']*)/m);
if (!adminRootMatch) {
  rootContent = rootContent.trimEnd() ? `${rootContent.trimEnd()}\nADMIN_REGISTER_CODE=ADMIN2026@\n` : `ADMIN_REGISTER_CODE=ADMIN2026@\n`;
  fs.writeFileSync(rootEnv, rootContent, { mode: 0o600 });
  console.log("Código de administrador padrão definido em .env (raiz).");
}

// Garante o .env da API (copia do exemplo se faltar) e o código de administrador padrão (MVP).
const apiEnv = path.join(__dirname, "..", "apps", "api", ".env");
const apiEnvExample = path.join(__dirname, "..", "apps", "api", ".env.example");
if (!fs.existsSync(apiEnv) && fs.existsSync(apiEnvExample)) {
  fs.copyFileSync(apiEnvExample, apiEnv);
  console.log("Arquivo apps/api/.env criado a partir do exemplo.");
}
let apiContent = fs.existsSync(apiEnv) ? fs.readFileSync(apiEnv, "utf8") : "";
const adminMatch = apiContent.match(/^ADMIN_REGISTER_CODE\s*=\s*["']?([^\r\n"']*)/m);
if (!adminMatch) {
  const line = `ADMIN_REGISTER_CODE=ADMIN2026@`;
  apiContent = apiContent.trimEnd() ? `${apiContent.trimEnd()}\n${line}\n` : `${line}\n`;
  fs.writeFileSync(apiEnv, apiContent, { mode: 0o600 });
  console.log("Código de administrador padrão definido em apps/api/.env.");
} else {
  console.log("Código de administrador já presente em apps/api/.env.");
}
