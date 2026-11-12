export type FileExtension = "CSV" | "TXT" | "SQL";

export type FileStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "FAILED";

export type StepStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Role = "ADMIN" | "ANALYST" | "VIEWER";

export type ConstraintType = "PK" | "FK" | "UNIQUE" | "CHECK" | "NOT_NULL";
