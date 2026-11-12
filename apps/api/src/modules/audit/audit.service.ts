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

export async function listAuditLogs(filters: { fileId?: string; from?: Date; to?: Date }) {
  return prisma.auditLog.findMany({
    where: {
      ...(filters.fileId ? { fileId: filters.fileId } : {}),
      ...(filters.from && filters.to ? { createdAt: { gte: filters.from, lt: filters.to } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { name: true, email: true } },
      file: { select: { originalName: true } },
    },
  });
}
