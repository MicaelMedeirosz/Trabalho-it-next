import { prisma } from "../../config/prisma";
import { logAudit } from "../audit/audit.service";

export async function listPendingApprovals() {
  // select explícito: evita carregar sizeBytes (BigInt), que o res.json()
  // do Express não sabe serializar e derrubava o processo (unhandled
  // rejection em handler async no Node 20+).
  return prisma.approvalQueue.findMany({
    where: { status: "PENDING" },
    select: {
      id: true,
      fileId: true,
      sessionId: true,
      status: true,
      createdAt: true,
      file: {
        select: {
          id: true,
          originalName: true,
          identifiedDbms: true,
          uploadedBy: { select: { name: true } },
        },
      },
      session: {
        select: {
          id: true,
          totalDurationMs: true,
          validationResults: { select: { id: true, ruleCode: true, passed: true, details: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function decideApproval(params: {
  approvalId: string;
  decidedById: string;
  decision: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}) {
  const { approvalId, decidedById, decision, rejectionReason } = params;

  if (decision === "REJECTED" && !rejectionReason?.trim()) {
    throw new Error("Justificativa obrigatória para rejeição.");
  }

  const approval = await prisma.approvalQueue.findUniqueOrThrow({
    where: { id: approvalId },
    include: { session: true, file: true },
  });

  const now = new Date();

  // ETP-017: Aprovação ou rejeição formal do arquivo
  await prisma.processingStep.updateMany({
    where: { sessionId: approval.sessionId, stepCode: "ETP-017" },
    data: {
      status: "SUCCESS",
      startedAt: now,
      finishedAt: now,
      message: `Decisão: ${decision}`,
    },
  });

  // ETP-018: Exigência de justificativa em caso de rejeição
  await prisma.processingStep.updateMany({
    where: { sessionId: approval.sessionId, stepCode: "ETP-018" },
    data: {
      status: decision === "REJECTED" ? "SUCCESS" : "SKIPPED",
      startedAt: now,
      finishedAt: now,
      message: decision === "REJECTED" ? rejectionReason : "Não aplicável (arquivo aprovado).",
    },
  });

  await prisma.approvalQueue.update({
    where: { id: approvalId },
    data: {
      status: decision,
      decidedById,
      decidedAt: now,
      rejectionReason: decision === "REJECTED" ? rejectionReason : undefined,
    },
  });

  await prisma.file.update({
    where: { id: approval.fileId },
    data: { status: decision },
  });

  // ETP-019: Registro de auditoria da decisão
  await prisma.processingStep.updateMany({
    where: { sessionId: approval.sessionId, stepCode: "ETP-019" },
    data: { status: "SUCCESS", startedAt: now, finishedAt: now, message: "Auditoria registrada." },
  });
  await logAudit({
    event: decision === "APPROVED" ? "FILE_APPROVED" : "FILE_REJECTED",
    status: "SUCCESS",
    message: decision === "REJECTED" ? rejectionReason : "Arquivo aprovado e liberado.",
    userId: decidedById,
    fileId: approval.fileId,
  });

  // ETP-020: Liberação dos dados aprovados para consulta
  await prisma.processingStep.updateMany({
    where: { sessionId: approval.sessionId, stepCode: "ETP-020" },
    data: {
      status: decision === "APPROVED" ? "SUCCESS" : "SKIPPED",
      startedAt: now,
      finishedAt: now,
      message: decision === "APPROVED" ? "Dados liberados para consulta." : "Não aplicável (arquivo rejeitado).",
    },
  });

  return prisma.approvalQueue.findUnique({ where: { id: approvalId } });
}
