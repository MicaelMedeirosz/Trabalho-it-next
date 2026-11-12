import { Router } from "express";
import { requireAuth, requireRole, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../middleware/asyncHandler";
import { listPendingApprovals, decideApproval } from "./approval.service";

export const approvalRouter = Router();

approvalRouter.use(requireAuth);
approvalRouter.use(requireRole("ADMIN"));

approvalRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await listPendingApprovals();
    res.json(items);
  })
);

approvalRouter.post(
  "/:id/decide",
  requireRole("ADMIN"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { decision, rejectionReason, confirmAlerts, approvalReason } = req.body ?? {};
    if (confirmAlerts !== undefined && typeof confirmAlerts !== "boolean") {
      return res.status(400).json({ error: "A confirmação de alertas deve ser um booleano." });
    }
    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return res.status(400).json({ error: "decision deve ser APPROVED ou REJECTED" });
    }
    if (rejectionReason !== undefined && (typeof rejectionReason !== "string" || rejectionReason.length > 2000)) {
      return res.status(400).json({ error: "A justificativa deve ser um texto de até 2000 caracteres." });
    }
    if (approvalReason !== undefined && (typeof approvalReason !== "string" || approvalReason.length > 2000)) {
      return res.status(400).json({ error: "A justificativa de aprovação deve ser um texto de até 2000 caracteres." });
    }
    const result = await decideApproval({
      approvalId: req.params.id,
      decidedById: req.user!.id,
      decision,
      rejectionReason,
      confirmAlerts,
      approvalReason,
    });
    res.json(result);
  })
);
