import { prisma } from "../../config/prisma";
import { PROCESSING_STEPS, StepCode } from "@trabalho/shared-types";

export async function createSession(fileId: string) {
  const session = await prisma.processingSession.create({
    data: { fileId },
  });
  // Pré-cria todas as 20 etapas como PENDING para rastreabilidade total
  await prisma.processingStep.createMany({
    data: PROCESSING_STEPS.map((s) => ({
      sessionId: session.id,
      stepCode: s.code,
      stepName: s.name,
      status: "PENDING" as const,
    })),
  });
  return session;
}

export async function runStep<T>(
  sessionId: string,
  code: StepCode,
  fn: () => Promise<T> | T
): Promise<T> {
  const startedAt = new Date();
  await prisma.processingStep.updateMany({
    where: { sessionId, stepCode: code },
    data: { status: "RUNNING", startedAt },
  });
  try {
    const result = await fn();
    const finishedAt = new Date();
    await prisma.processingStep.updateMany({
      where: { sessionId, stepCode: code },
      data: {
        status: "SUCCESS",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        message: typeof result === "string" ? result : undefined,
      },
    });
    return result;
  } catch (err: any) {
    const finishedAt = new Date();
    await prisma.processingStep.updateMany({
      where: { sessionId, stepCode: code },
      data: {
        status: "FAILED",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        message: err.message,
      },
    });
    throw err;
  }
}

export async function skipStep(sessionId: string, code: StepCode, message: string) {
  await prisma.processingStep.updateMany({
    where: { sessionId, stepCode: code },
    data: { status: "SKIPPED", message, finishedAt: new Date() },
  });
}

export async function finishSession(sessionId: string, finalStatus: string) {
  const session = await prisma.processingSession.findUniqueOrThrow({ where: { id: sessionId } });
  const finishedAt = new Date();
  await prisma.processingSession.update({
    where: { id: sessionId },
    data: {
      finishedAt,
      finalStatus,
      totalDurationMs: finishedAt.getTime() - session.startedAt.getTime(),
    },
  });
}
