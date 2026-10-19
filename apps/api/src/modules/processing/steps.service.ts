import { prisma } from "../../config/prisma";
import { PROCESSING_STEPS, StepCode } from "@trabalho/shared-types";

export interface SessionHandle {
  id: string;
  startedAt: Date;
}

export interface StepRecord {
  stepCode: StepCode;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  message?: string;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
}

export async function createSession(fileId: string): Promise<SessionHandle> {
  const session = await prisma.processingSession.create({
    data: { fileId },
  });
  // Pré-cria todas as 20 etapas como PENDING para rastreabilidade total
  // (apenas 1 round-trip via createMany, não é um loop).
  await prisma.processingStep.createMany({
    data: PROCESSING_STEPS.map((s) => ({
      sessionId: session.id,
      stepCode: s.code,
      stepName: s.name,
      status: "PENDING" as const,
    })),
  });
  return { id: session.id, startedAt: session.startedAt };
}

/**
 * Executa uma etapa do pipeline e registra o resultado em memória (sem
 * round-trip ao banco). O custo de rede do Supabase pooler é o gargalo real
 * do pipeline síncrono — gravar a cada etapa individualmente multiplicava
 * a latência por etapa. Os registros coletados aqui são persistidos de uma
 * vez, em paralelo, por `flushSteps`.
 */
export async function runStep<T>(
  records: StepRecord[],
  code: StepCode,
  fn: () => Promise<T> | T
): Promise<T> {
  const startedAt = new Date();
  try {
    const result = await fn();
    const finishedAt = new Date();
    records.push({
      stepCode: code,
      status: "SUCCESS",
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      message: typeof result === "string" ? result : undefined,
    });
    return result;
  } catch (err: any) {
    const finishedAt = new Date();
    records.push({
      stepCode: code,
      status: "FAILED",
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      message: err.message,
    });
    throw err;
  }
}

export function createStepRecorder(): StepRecord[] {
  return [];
}

/** Persiste todos os resultados de etapas coletados em memória, em paralelo. */
export async function flushSteps(sessionId: string, records: StepRecord[]) {
  await Promise.all(
    records.map((r) =>
      prisma.processingStep.updateMany({
        where: { sessionId, stepCode: r.stepCode },
        data: {
          status: r.status,
          startedAt: r.startedAt,
          finishedAt: r.finishedAt,
          durationMs: r.durationMs,
          message: r.message,
        },
      })
    )
  );
}

export async function skipStep(sessionId: string, code: StepCode, message: string) {
  await prisma.processingStep.updateMany({
    where: { sessionId, stepCode: code },
    data: { status: "SKIPPED", message, finishedAt: new Date() },
  });
}

export async function finishSession(session: SessionHandle, finalStatus: string, objectCount?: number) {
  const finishedAt = new Date();
  await prisma.processingSession.update({
    where: { id: session.id },
    data: {
      finishedAt,
      finalStatus,
      totalDurationMs: finishedAt.getTime() - session.startedAt.getTime(),
      ...(objectCount !== undefined ? { objectCount } : {}),
    },
  });
}
