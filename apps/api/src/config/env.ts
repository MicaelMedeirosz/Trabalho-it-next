import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseBucket: process.env.SUPABASE_BUCKET ?? "uploads",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_BYTES ?? 20 * 1024 * 1024),
  maxFilesPerUpload: Number(process.env.MAX_FILES_PER_UPLOAD ?? 10),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
};
