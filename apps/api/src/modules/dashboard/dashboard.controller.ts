import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../middleware/asyncHandler";
import { prisma } from "../../config/prisma";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

// Polling: frontend consulta periodicamente o status atualizado da sessão
dashboardRouter.get(
  "/sessions/:sessionId/status",
  asyncHandler(async (req, res) => {
    const session = await prisma.processingSession.findUnique({
      where: { id: req.params.sessionId },
      include: { steps: { orderBy: { stepCode: "asc" } }, file: { select: { status: true, originalName: true } } },
    });
    if (!session) return res.status(404).json({ error: "Sessão não encontrada." });
    res.json(session);
  })
);

dashboardRouter.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    // 1 groupBy no lugar de 6 counts — 1 round-trip só
    const grouped = await prisma.file.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const g of grouped) {
      counts[g.status] = g._count._all;
    }
    res.json({
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      processing: counts["PROCESSING"] ?? 0,
      pending: counts["PENDING_APPROVAL"] ?? 0,
      approved: counts["APPROVED"] ?? 0,
      rejected: counts["REJECTED"] ?? 0,
      failed: counts["FAILED"] ?? 0,
    });
  })
);
