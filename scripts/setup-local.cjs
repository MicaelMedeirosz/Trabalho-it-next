const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const target = path.join(__dirname, "..", ".env");
let content = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
const match = content.match(/^JWT_SECRET\s*=\s*["']?([^\r\n"']*)/m);
// Only preserve locally generated 256-bit secrets; replace legacy demo values.
if (!match || !/^[a-f0-9]{64}$/i.test(match[1])) {
  const line = `JWT_SECRET=${crypto.randomBytes(32).toString("hex")}`;
  content = match ? content.replace(/^JWT_SECRET\s*=.*$/m, line) : `${content.trimEnd()}\n${line}\n`;
  fs.writeFileSync(target, content, { mode: 0o600 });
  console.log("Segredo local gerado em .env (ignorado pelo Git).");
} else {
  console.log("Configuração local já existe; segredo preservado.");
}
