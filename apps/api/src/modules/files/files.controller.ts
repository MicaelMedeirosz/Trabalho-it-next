import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../middleware/asyncHandler";
import { env } from "../../config/env";
import { processUpload, UploadError } from "../processing/pipeline.service";
import { listFiles, getFileDetail } from "./files.service";
import { HttpError } from "../../middleware/HttpError";
import { resolveExtension } from "./files.service";
import { rateLimit } from "express-rate-limit";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSizeBytes, files: env.maxFilesPerUpload, fields: 0, parts: env.maxFilesPerUpload + 1 },
  fileFilter: (_req, file, callback) => {
    if (!resolveExtension(file.originalname)) {
      return callback(new HttpError(400, "Extensão não suportada. Use .csv, .txt ou .sql."));
    }
    callback(null, true);
  },
});

export const filesRouter = Router();

filesRouter.use(requireAuth);

filesRouter.post(
  "/upload",
  requireRole("ADMIN", "ANALYST"),
  rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
    message: { error: "Muitos uploads. Aguarde um minuto." } }),
  upload.array("files", env.maxFilesPerUpload),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    const results = [];
    const errors = [];

    for (const file of files) {
      try {
        const result = await processUpload({
          originalName: file.originalname,
          buffer: file.buffer,
          mimeType: file.mimetype || "application/octet-stream",
          uploadedById: req.user!.id,
        });
        results.push(result);
      } catch (err: any) {
        const expected = err instanceof UploadError;
        if (!expected) console.error("Falha no processamento do upload:", err);
        errors.push({ fileName: file.originalname, error: expected ? err.message : "Falha interna ao processar o arquivo.", isUploadError: expected });
      }
    }

    res.status(errors.length > 0 && results.length === 0 ? 400 : 201).json({ results, errors });
  })
);

filesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const files = await listFiles();
    res.json(files);
  })
);

filesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const file = await getFileDetail(req.params.id);
    if (!file) return res.status(404).json({ error: "Arquivo não encontrado." });
    res.json(serializeBigInt(file));
  })
);

function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}
