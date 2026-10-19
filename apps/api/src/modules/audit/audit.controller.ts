import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { listAuditLogs } from "./audit.service";

export const auditRouter = Router();

auditRouter.use(requireAuth);

auditRouter.get("/", async (req, res) => {
  const fileId = typeof req.query.fileId === "string" ? req.query.fileId : undefined;
  const logs = await listAuditLogs({ fileId });
  res.json(logs);
});
