import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";
import { asyncHandler } from "./asyncHandler";
import { env } from "../config/env";

export interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string };
}

export const requireAuth = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token ausente" });
    }
    const token = header.replace("Bearer ", "");
    let payload: { sub: string; role: string; sessionVersion?: number };
    try {
      const decoded = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
      if (typeof decoded === "string" || typeof decoded.sub !== "string" || !decoded.sub) {
        return res.status(401).json({ error: "Token inválido ou expirado" });
      }
      payload = decoded as { sub: string; role: string; sessionVersion?: number };
    } catch {
      return res.status(401).json({ error: "Token inválido ou expirado" });
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, sessionVersion: true },
    });
    if (!user) {
      // Token assinado corretamente mas o usuário não existe mais no banco
      // (ex.: banco recriado) — invalida sessão do lado do cliente.
      return res.status(401).json({ error: "Usuário não encontrado. Faça login novamente." });
    }
    if ((payload.sessionVersion ?? 0) !== (user.sessionVersion ?? 0)) {
      return res.status(401).json({ error: "Senha alterada. Faça login novamente." });
    }
    req.user = user;
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
