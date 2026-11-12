import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../middleware/asyncHandler";
import { listAuditLogs } from "./audit.service";

export const auditRouter = Router();

auditRouter.use(requireAuth);

auditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const fileId = typeof req.query.fileId === "string" ? req.query.fileId : undefined;
    const { from, to } = req.query;
    const parseDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value ? new Date(value) : undefined;
    const start = parseDate(from);
    const end = parseDate(to);
    if ((from !== undefined || to !== undefined) && (!start || !end || start >= end)) {
      return res.status(400).json({ error: "Informe um intervalo de datas válido." });
    }
    const logs = await listAuditLogs({ fileId, from: start, to: end });
    res.json(logs);
  })
);
