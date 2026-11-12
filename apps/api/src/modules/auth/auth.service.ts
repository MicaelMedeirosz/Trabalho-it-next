import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { Prisma } from "@prisma/client";
import { HttpError } from "../../middleware/HttpError";

export interface LoginResult {
  token: string;
  user: { id: string; name: string; email: string; role: string; avatarUrl: string | null; createdAt: Date };
}

export async function registerUser(name: string, email: string, password: string, adminCode?: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "Este e-mail já está cadastrado. Clique em Entrar para acessar sua conta.");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const role = env.adminRegisterCode && adminCode === env.adminRegisterCode ? "ADMIN" : "ANALYST";
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role },
  }).catch((err: unknown) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "Este e-mail já está cadastrado. Clique em Entrar para acessar sua conta.");
    }
    throw err;
  });
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function loginUser(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpError(401, "E-mail ou senha incorretos.");
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, "E-mail ou senha incorretos.");
  }
  const token = jwt.sign({ sub: user.id, role: user.role, sessionVersion: user.sessionVersion }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role,
      avatarUrl: user.avatarData ?? null, createdAt: user.createdAt },
  };
}

export async function promoteToAdmin(userId: string, code: string) {
  if (!env.adminRegisterCode || code !== env.adminRegisterCode) {
    throw new HttpError(403, "Código de administrador inválido.");
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role: "ADMIN" },
  });
  return { id: user.id, role: user.role };
}
