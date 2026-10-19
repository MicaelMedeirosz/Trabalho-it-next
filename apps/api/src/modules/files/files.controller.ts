import { Router } from "express";
import multer from "multer";
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../middleware/asyncHandler";
import { env } from "../../config/env";
import { processUpload, UploadError } from "../processing/pipeline.service";
import { listFiles, getFileDetail } from "./files.service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSizeBytes, files: env.maxFilesPerUpload },
});

export const filesRouter = Router();

filesRouter.use(requireAuth);

filesRouter.post(
  "/upload",
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
        errors.push({ fileName: file.originalname, error: err.message, isUploadError: err instanceof UploadError });
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
