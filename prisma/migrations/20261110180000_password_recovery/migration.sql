ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "password_resets" (
  "token_hash" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");
