import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";
import { asyncHandler } from "./asyncHandler";
import { env } from "../config/env";

export interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string };
}

// Cache em memória de userIds válidos: valida que o subject do JWT ainda
// existe no banco (ex.: banco recriado do zero com mesmas credenciais de
// login — token criptograficamente válido, mas apontando pra usuário que
// não existe) sem pagar uma query de rede a cada request.
const validUserIds = new Map<string, number>(); // userId -> timestamp validado (ms)
const USER_CACHE_TTL_MS = 5 * 60 * 1000;

async function isUserValid(userId: string): Promise<boolean> {
  const now = Date.now();
  const cachedAt = validUserIds.get(userId);
  if (cachedAt !== undefined && now - cachedAt < USER_CACHE_TTL_MS) {
    return true;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (user) {
    validUserIds.set(userId, now);
    return true;
  }
  return false;
}

export const requireAuth = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token ausente" });
    }
    const token = header.replace("Bearer ", "");
    let payload: { sub: string; role: string };
    try {
      payload = jwt.verify(token, env.jwtSecret) as { sub: string; role: string };
    } catch {
      return res.status(401).json({ error: "Token inválido ou expirado" });
    }
    if (!(await isUserValid(payload.sub))) {
      // Token assinado corretamente mas o usuário não existe mais no banco
      // (ex.: banco recriado) — invalida sessão do lado do cliente.
      return res.status(401).json({ error: "Usuário não encontrado. Faça login novamente." });
    }
    req.user = { id: payload.sub, role: payload.role };
    _next();
  }
);

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    next();
  };
}
