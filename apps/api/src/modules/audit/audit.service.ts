import { prisma } from "../../config/prisma";

export interface LogAuditParams {
  event: string;
  status: string;
  message?: string;
  userId?: string;
  fileId?: string;
  executionTimeMs?: number;
}

export async function logAudit(params: LogAuditParams) {
  return prisma.auditLog.create({
    data: {
      event: params.event,
      status: params.status,
      message: params.message,
      userId: params.userId,
      fileId: params.fileId,
      executionTimeMs: params.executionTimeMs,
    },
  });
}

export async function listAuditLogs(filters: { fileId?: string }) {
  return prisma.auditLog.findMany({
    where: filters.fileId ? { fileId: filters.fileId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { name: true, email: true } },
      file: { select: { originalName: true } },
    },
  });
}
