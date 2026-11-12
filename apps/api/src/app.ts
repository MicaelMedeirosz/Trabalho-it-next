import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/auth.controller";
import { filesRouter } from "./modules/files/files.controller";
import { approvalRouter } from "./modules/approval/approval.controller";
import { auditRouter } from "./modules/audit/audit.controller";
import { reportsRouter } from "./modules/reports/reports.controller";
import { dashboardRouter } from "./modules/dashboard/dashboard.controller";
import { HttpError } from "./middleware/HttpError";
import helmet from "helmet";
import multer from "multer";

export const app = express();

app.disable("x-powered-by");
app.use(helmet({ strictTransportSecurity: false, contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "16kb", inflate: false }));
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);
app.use("/files", filesRouter);
app.use("/approvals", approvalRouter);
app.use("/audit", auditRouter);
app.use("/reports", reportsRouter);
app.use("/dashboard", dashboardRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err instanceof multer.MulterError) {
    return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: "Upload excede os limites permitidos ou contém campos inválidos." });
  }
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Requisição muito grande." });
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "JSON inválido." });
  if (err?.type === "encoding.unsupported") return res.status(415).json({ error: "Codificação de requisição não suportada." });
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor" });
});
