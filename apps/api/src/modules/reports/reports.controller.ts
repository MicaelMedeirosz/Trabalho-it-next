import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../middleware/asyncHandler";
import { getConsolidatedReport } from "./reports.service";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

reportsRouter.get(
  "/consolidated",
  asyncHandler(async (_req, res) => {
    const report = await getConsolidatedReport();
    res.json(report);
  })
);
