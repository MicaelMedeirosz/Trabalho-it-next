import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/auth.controller";
import { filesRouter } from "./modules/files/files.controller";
import { approvalRouter } from "./modules/approval/approval.controller";
import { auditRouter } from "./modules/audit/audit.controller";
import { reportsRouter } from "./modules/reports/reports.controller";
import { dashboardRouter } from "./modules/dashboard/dashboard.controller";

export const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);
app.use("/files", filesRouter);
app.use("/approvals", approvalRouter);
app.use("/audit", auditRouter);
app.use("/reports", reportsRouter);
app.use("/dashboard", dashboardRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor" });
});
