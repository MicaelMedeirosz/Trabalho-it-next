import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { getConsolidatedReport } from "./reports.service";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

reportsRouter.get("/consolidated", async (_req, res) => {
  const report = await getConsolidatedReport();
  res.json(report);
});
