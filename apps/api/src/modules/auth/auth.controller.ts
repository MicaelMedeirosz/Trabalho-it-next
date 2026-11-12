import { requestPasswordReset, resetPassword, recoveryMessage } from "./password-recovery.service";
import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { registerUser, loginUser, promoteToAdmin } from "./auth.service";
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { getProfile, saveAvatar, removeAvatar } from "./profile.service";

export const authRouter = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { error: "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente." },
});

authRouter.get("/me", requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  res.json(await getProfile(req.user!.id));
}));

const avatarLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Muitas alterações de foto. Aguarde 15 minutos." } });
const avatarUpload = multer({ storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 2 } });

authRouter.put("/me/avatar", requireAuth, avatarLimiter, avatarUpload.single("photo"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "Selecione uma foto." });
    res.json(await saveAvatar(req.user!.id, req.file.buffer));
  }));

authRouter.delete("/me/avatar", requireAuth, avatarLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    res.json(await removeAvatar(req.user!.id));
  }));

authRouter.post(
  "/me/promote-to-admin",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { code } = req.body ?? {};
    if (typeof code !== "string" || !code) {
      return res.status(400).json({ error: "Informe o código de administrador." });
    }
    const result = await promoteToAdmin(req.user!.id, code);
    res.json(result);
  })
);

authRouter.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, password, adminCode } = req.body ?? {};
    if (typeof name !== "string" || !name.trim() || name.trim().length > 120 ||
        typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof password !== "string" || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ error: "Informe nome, e-mail válido e senha de pelo menos 12 caracteres (máximo de 72 bytes)." });
    }
    const user = await registerUser(name.trim(), email, password, typeof adminCode === "string" ? adminCode : undefined);
    res.status(201).json(user);
  })
);

authRouter.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || !email || email.length > 254 ||
        typeof password !== "string" || !password || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ error: "Informe e-mail e senha válidos." });
    }
    const result = await loginUser(email, password);
    res.json(result);
  })
);

const recoveryLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Muitas solicitações. Aguarde 15 minutos antes de tentar novamente." } });
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente." } });

authRouter.post("/forgot-password", recoveryLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body ?? {};
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: "Informe um e-mail válido." });
  }
  await requestPasswordReset(email.trim());
  res.json({ message: recoveryMessage });
}));

authRouter.post("/reset-password", resetLimiter, asyncHandler(async (req, res) => {
  const { token, password } = req.body ?? {};
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) ||
      typeof password !== "string" || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({ error: "Informe um link válido e uma senha de pelo menos 12 caracteres (máximo de 72 bytes)." });
  }
  await resetPassword(token, password);
  res.json({ message: "Senha redefinida. Entre com sua nova senha." });
}));
