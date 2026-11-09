import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { registerUser, loginUser } from "./auth.service";
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { prisma } from "../../config/prisma";
import { rateLimit } from "express-rate-limit";

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
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, name: true, email: true, role: true },
  });
  res.json(user);
}));

authRouter.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body ?? {};
    if (typeof name !== "string" || !name.trim() || name.trim().length > 120 ||
        typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof password !== "string" || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ error: "Informe nome, e-mail válido e senha de pelo menos 12 caracteres (máximo de 72 bytes)." });
    }
    const user = await registerUser(name.trim(), email, password);
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
