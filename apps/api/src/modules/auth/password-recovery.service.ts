import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { HttpError } from "../../middleware/HttpError";
import bcrypt from "bcryptjs";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const recoveryMessage = "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha. Verifique também o spam.";

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  await prisma.passwordReset.create({ data: {
    tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  } });
  // The configured origin is trusted; never build recovery URLs from a request's Host header.
  const url = new URL("/reset-password", env.webUrl);
  url.hash = new URLSearchParams({ token }).toString();
  try {
    const transport = nodemailer.createTransport({
      host: env.smtpHost, port: env.smtpPort, secure: env.smtpSecure,
      ...(env.smtpUser ? { auth: { user: env.smtpUser, pass: env.smtpPassword } } : {}),
      connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
    });
    await transport.sendMail({ from: env.mailFrom, to: user.email,
      subject: "Redefina sua senha — ITNEXT",
      text: `Recebemos uma solicitação para redefinir sua senha.\n\nAcesse: ${url.toString()}\n\nO link expira em 30 minutos e só pode ser usado uma vez. Se não foi você, ignore esta mensagem.`,
    });
  } catch {
    await prisma.passwordReset.deleteMany({ where: { tokenHash } });
    // Keep the public response identical for existing and unknown accounts.
    console.error("Não foi possível enviar a recuperação de senha. Verifique a configuração SMTP.");
  }
}

export async function resetPassword(token: string, password: string) {
  const tokenHash = hashToken(token);
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash } });
  const invalid = () => new HttpError(400, "Link inválido ou expirado. Solicite uma nova recuperação.");
  if (!reset || reset.expiresAt <= new Date()) throw invalid();
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction(async tx => {
    // Lock the user first: concurrent resets for the same account must serialize.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${reset.userId} FOR UPDATE`;
    const claimed = await tx.passwordReset.deleteMany({ where: { tokenHash, expiresAt: { gt: new Date() } } });
    if (claimed.count !== 1) throw invalid();
    await tx.user.update({ where: { id: reset.userId }, data: {
      passwordHash, sessionVersion: { increment: 1 },
    } });
    await tx.passwordReset.deleteMany({ where: { userId: reset.userId } });
  });
}
