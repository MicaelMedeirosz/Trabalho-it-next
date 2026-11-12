-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "FileExtension" AS ENUM ('CSV', 'TXT', 'SQL');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RuleSeverity" AS ENUM ('BLOCKER', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConstraintType" AS ENUM ('PK', 'FK', 'UNIQUE', 'CHECK', 'NOT_NULL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ANALYST',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "extension" "FileExtension" NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "sha256_hash" TEXT NOT NULL,
    "encoding" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "FileStatus" NOT NULL DEFAULT 'RECEIVED',
    "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicate_of" TEXT,
    "identified_dbms" TEXT,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_sessions" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "total_duration_ms" INTEGER,
    "final_status" TEXT,

    CONSTRAINT "processing_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_steps" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "step_code" TEXT NOT NULL,
    "step_name" TEXT NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,

    CONSTRAINT "processing_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_rules" (
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "RuleSeverity" NOT NULL,

    CONSTRAINT "validation_rules_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "validation_results" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "rule_code" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_queue" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "file_id" TEXT,
    "user_id" TEXT,
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "execution_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_schemas" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "catalog_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_tables" (
    "id" TEXT NOT NULL,
    "schema_id" TEXT,
    "session_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "row_count_estimate" BIGINT,

    CONSTRAINT "catalog_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_columns" (
    "id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data_type" TEXT,
    "nullable" BOOLEAN,
    "is_primary_key" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "ordinal_position" INTEGER,

    CONSTRAINT "catalog_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_views" (
    "id" TEXT NOT NULL,
    "schema_id" TEXT,
    "session_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition" TEXT,

    CONSTRAINT "catalog_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_procedures" (
    "id" TEXT NOT NULL,
    "schema_id" TEXT,
    "session_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parameters" JSONB,
    "body" TEXT,

    CONSTRAINT "catalog_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_sequences" (
    "id" TEXT NOT NULL,
    "schema_id" TEXT,
    "session_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_value" BIGINT,
    "increment_by" BIGINT,

    CONSTRAINT "catalog_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_constraints" (
    "id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ConstraintType" NOT NULL,
    "definition" TEXT,

    CONSTRAINT "catalog_constraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_relationships" (
    "id" TEXT NOT NULL,
    "source_table_id" TEXT NOT NULL,
    "target_table_id" TEXT NOT NULL,
    "constraint_id" TEXT,
    "relationship_type" TEXT,

    CONSTRAINT "catalog_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "files_sha256_hash_key" ON "files"("sha256_hash");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_sessions" ADD CONSTRAINT "processing_sessions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_steps" ADD CONSTRAINT "processing_steps_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "processing_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "processing_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_rule_code_fkey" FOREIGN KEY ("rule_code") REFERENCES "validation_rules"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_queue" ADD CONSTRAINT "approval_queue_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_queue" ADD CONSTRAINT "approval_queue_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "processing_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_queue" ADD CONSTRAINT "approval_queue_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_schemas" ADD CONSTRAINT "catalog_schemas_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "processing_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_tables" ADD CONSTRAINT "catalog_tables_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "catalog_schemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_tables" ADD CONSTRAINT "catalog_tables_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "processing_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_columns" ADD CONSTRAINT "catalog_columns_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "catalog_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_views" ADD CONSTRAINT "catalog_views_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "catalog_schemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_views" ADD CONSTRAINT "catalog_views_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "processing_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_procedures" ADD CONSTRAINT "catalog_procedures_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "catalog_schemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_procedures" ADD CONSTRAINT "catalog_procedures_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "processing_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_sequences" ADD CONSTRAINT "catalog_sequences_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "catalog_schemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_sequences" ADD CONSTRAINT "catalog_sequences_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "processing_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_constraints" ADD CONSTRAINT "catalog_constraints_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "catalog_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_relationships" ADD CONSTRAINT "catalog_relationships_source_table_id_fkey" FOREIGN KEY ("source_table_id") REFERENCES "catalog_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_relationships" ADD CONSTRAINT "catalog_relationships_target_table_id_fkey" FOREIGN KEY ("target_table_id") REFERENCES "catalog_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_relationships" ADD CONSTRAINT "catalog_relationships_constraint_id_fkey" FOREIGN KEY ("constraint_id") REFERENCES "catalog_constraints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
