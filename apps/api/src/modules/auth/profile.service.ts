import sharp from "sharp";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../middleware/HttpError";

const profileSelect = { id: true, name: true, email: true, role: true, avatarData: true, createdAt: true } as const;

function publicProfile(user: { id: string; name: string; email: string; role: string; avatarData: string | null; createdAt: Date }) {
  const { avatarData, ...profile } = user;
  return { ...profile, avatarUrl: avatarData ?? null };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
  if (!user) throw new HttpError(401, "Usuário não encontrado. Faça login novamente.");
  return publicProfile(user);
}

export async function saveAvatar(userId: string, input: Buffer) {
  let image: Buffer;
  try {
    const source = sharp(input, { limitInputPixels: 16_000_000, failOn: "warning" });
    const metadata = await source.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) !== 1) {
      throw new Error("Unsupported image");
    }
    // Decode and re-encode: the original payload and metadata are never stored.
    image = await source.rotate().resize(256, 256, { fit: "cover" })
      .flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer();
  } catch {
    throw new HttpError(400, "Imagem inválida. Use JPG, PNG ou WebP estático com até 16 megapixels.");
  }
  const user = await prisma.user.update({ where: { id: userId },
    data: { avatarData: `data:image/jpeg;base64,${image.toString("base64")}` }, select: profileSelect });
  return publicProfile(user);
}

export async function removeAvatar(userId: string) {
  const user = await prisma.user.update({ where: { id: userId }, data: { avatarData: null }, select: profileSelect });
  return publicProfile(user);
}
