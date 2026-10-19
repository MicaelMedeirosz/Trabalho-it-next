export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
}

export interface FileListItem {
  id: string;
  originalName: string;
  extension: "CSV" | "TXT" | "SQL";
  uploadedAt: string;
  uploadedBy: string;
  sizeBytes: string;
  status: "RECEIVED" | "PROCESSING" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "FAILED";
  identifiedDbms: string | null;
  isDuplicate: boolean;
  processingDurationMs: number | null;
  validationPassed: boolean | null;
  objectCount: number;
}

export interface ProcessingStep {
  id: string;
  stepCode: string;
  stepName: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
}

export interface ValidationResult {
  id: string;
  ruleCode: string;
  passed: boolean;
  details: string | null;
  rule: { code: string; description: string; severity: string };
}

export interface ApprovalItem {
  id: string;
  fileId: string;
  sessionId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  file: { originalName: string; uploadedBy: { name: string } };
  session: { validationResults: ValidationResult[] };
}

export interface AuditLogEntry {
  id: string;
  event: string;
  status: string;
  message: string | null;
  executionTimeMs: number | null;
  createdAt: string;
  user: { name: string; email: string } | null;
  file: { originalName: string } | null;
}

export interface ConsolidatedReport {
  summary: {
    totalFiles: number;
    approved: number;
    rejected: number;
    pending: number;
    failed: number;
    duplicateFiles: number;
  };
  conformity: {
    namingFailures: number;
    duplicateObjectFailures: number;
    descriptionGaps: number;
  };
  ruleStats: { code: string; description: string; passed: number; failed: number }[];
}
