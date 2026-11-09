import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { Prisma } from "@prisma/client";
import { HttpError } from "../../middleware/HttpError";

export interface LoginResult {
  token: string;
  user: { id: string; name: string; email: string; role: string };
}

export async function registerUser(name: string, email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "Este e-mail já está cadastrado. Clique em Entrar para acessar sua conta.");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
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
  const token = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}
