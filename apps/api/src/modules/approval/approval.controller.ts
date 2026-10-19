import { Router } from "express";
import { requireAuth, requireRole, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { listPendingApprovals, decideApproval } from "./approval.service";

export const approvalRouter = Router();

approvalRouter.use(requireAuth);

approvalRouter.get("/", async (_req, res) => {
  const items = await listPendingApprovals();
  res.json(items);
});

approvalRouter.post("/:id/decide", requireRole("ADMIN"), async (req: AuthenticatedRequest, res) => {
  try {
    const { decision, rejectionReason } = req.body;
    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return res.status(400).json({ error: "decision deve ser APPROVED ou REJECTED" });
    }
    const result = await decideApproval({
      approvalId: req.params.id,
      decidedById: req.user!.id,
      decision,
      rejectionReason,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
