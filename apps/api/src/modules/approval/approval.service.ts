import { prisma } from "../../config/prisma";
import { HttpError } from "../../middleware/HttpError";

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
  confirmAlerts?: boolean;
  approvalReason?: string;
}) {
  const { approvalId, decidedById, decision, rejectionReason, confirmAlerts, approvalReason } = params;

  if (decision === "REJECTED" && !rejectionReason?.trim()) {
    throw new HttpError(400, "Justificativa obrigatória para rejeição.");
  }

  return prisma.$transaction(async (tx) => {
    const approval = await tx.approvalQueue.findUnique({
      where: { id: approvalId },
      include: { session: true, file: true },
    });

    if (!approval) throw new HttpError(404, "Homologação não encontrada.");
    if (approval.status !== undefined && approval.status !== "PENDING") throw new HttpError(409, "Este arquivo já foi homologado.");
    const failedRules = decision === "APPROVED" ? await tx.validationResult.findMany({
      where: { sessionId: approval.sessionId, passed: false },
      select: { ruleCode: true },
      orderBy: { ruleCode: "asc" },
    }) : [];
    if (failedRules.length > 0 && confirmAlerts !== true) {
      throw new HttpError(409, "O arquivo possui regras com falha. Revise os alertas e confirme a aprovação com alertas.");
    }
    if (failedRules.length > 0 && !approvalReason?.trim()) {
      throw new HttpError(400, "Justificativa obrigatória para aprovar um arquivo com alertas.");
    }
    const approvalMessage = failedRules.length > 0
      ? `Arquivo aprovado com confirmação explícita dos alertas: ${failedRules.map(rule => rule.ruleCode).join(", ")}. Justificativa: ${approvalReason!.trim()}`
      : "Arquivo aprovado e liberado.";
    const now = new Date();
    const claimed = await tx.approvalQueue.updateMany({
      where: { id: approvalId, status: "PENDING" },
      data: { status: decision, decidedById, decidedAt: now,
        rejectionReason: decision === "REJECTED" ? rejectionReason : null },
    });
    if (claimed.count !== 1) throw new HttpError(409, "Este arquivo já foi homologado.");

    // ETP-017: Aprovação ou rejeição formal do arquivo
    await tx.processingStep.updateMany({
      where: { sessionId: approval.sessionId, stepCode: "ETP-017" },
      data: {
        status: "SUCCESS",
        startedAt: now,
        finishedAt: now,
        message: decision === "APPROVED" ? approvalMessage : `Decisão: ${decision}`,
      },
    });

    // ETP-018: Exigência de justificativa em caso de rejeição
    await tx.processingStep.updateMany({
      where: { sessionId: approval.sessionId, stepCode: "ETP-018" },
      data: {
        status: decision === "REJECTED" ? "SUCCESS" : "SKIPPED",
        startedAt: now,
        finishedAt: now,
        message: decision === "REJECTED" ? rejectionReason : "Não aplicável (arquivo aprovado).",
      },
    });

    await tx.file.update({
      where: { id: approval.fileId },
      data: { status: decision },
    });

    // ETP-019: Registro de auditoria da decisão
    await tx.processingStep.updateMany({
      where: { sessionId: approval.sessionId, stepCode: "ETP-019" },
      data: { status: "SUCCESS", startedAt: now, finishedAt: now, message: "Auditoria registrada." },
    });
    await tx.auditLog.create({ data: {
      event: decision === "APPROVED" ? "FILE_APPROVED" : "FILE_REJECTED",
      status: "SUCCESS",
      message: decision === "REJECTED" ? rejectionReason : approvalMessage,
      userId: decidedById,
      fileId: approval.fileId,
    } });

    // ETP-020: Liberação dos dados aprovados para consulta
    await tx.processingStep.updateMany({
      where: { sessionId: approval.sessionId, stepCode: "ETP-020" },
      data: {
        status: decision === "APPROVED" ? "SUCCESS" : "SKIPPED",
        startedAt: now,
        finishedAt: now,
        message: decision === "APPROVED" ? "Dados liberados para consulta." : "Não aplicável (arquivo rejeitado).",
      },
    });

    return tx.approvalQueue.findUnique({ where: { id: approvalId } });
  });
}
