import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

const jwtSecret = required("JWT_SECRET");
if (Buffer.byteLength(jwtSecret) < 32 || /^(dev-secret|troque-|replace-|it-next-)/i.test(jwtSecret)) {
  throw new Error("JWT_SECRET deve ser um segredo aleatório com pelo menos 32 bytes. Execute npm run setup:local.");
}

export const env = {
  webUrl: process.env.WEB_URL ?? "http://localhost:5173",
  smtpHost: process.env.SMTP_HOST ?? "localhost",
  smtpPort: Number(process.env.SMTP_PORT ?? 1025),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
  mailFrom: process.env.MAIL_FROM ?? "ITNEXT <nao-responda@itnext.local>",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  storageDir: process.env.STORAGE_DIR ?? "./storage",
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_BYTES ?? 20 * 1024 * 1024),
  maxFilesPerUpload: Number(process.env.MAX_FILES_PER_UPLOAD ?? 10),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};
