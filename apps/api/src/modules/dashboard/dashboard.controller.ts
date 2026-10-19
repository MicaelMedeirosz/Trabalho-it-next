import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { prisma } from "../../config/prisma";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

// Polling: frontend consulta periodicamente o status atualizado da sessão
dashboardRouter.get("/sessions/:sessionId/status", async (req, res) => {
  const session = await prisma.processingSession.findUnique({
    where: { id: req.params.sessionId },
    include: { steps: { orderBy: { stepCode: "asc" } }, file: { select: { status: true, originalName: true } } },
  });
  if (!session) return res.status(404).json({ error: "Sessão não encontrada." });
  res.json(session);
});

dashboardRouter.get("/summary", async (_req, res) => {
  const [total, processing, pending, approved, rejected, failed] = await Promise.all([
    prisma.file.count(),
    prisma.file.count({ where: { status: "PROCESSING" } }),
    prisma.file.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.file.count({ where: { status: "APPROVED" } }),
    prisma.file.count({ where: { status: "REJECTED" } }),
    prisma.file.count({ where: { status: "FAILED" } }),
  ]);
  res.json({ total, processing, pending, approved, rejected, failed });
});
