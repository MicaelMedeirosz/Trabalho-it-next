import crypto from "crypto";
import { prisma } from "../../config/prisma";
import { supabase } from "../../config/supabase";
import { env } from "../../config/env";

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function resolveExtension(originalName: string): "CSV" | "TXT" | "SQL" | null {
  const ext = originalName.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "CSV";
  if (ext === "txt") return "TXT";
  if (ext === "sql") return "SQL";
  return null;
}

export async function findDuplicateByHash(hash: string) {
  return prisma.file.findUnique({ where: { sha256Hash: hash } });
}

export async function uploadToStorage(buffer: Buffer, storagePath: string, contentType: string) {
  const { error } = await supabase.storage
    .from(env.supabaseBucket)
    .upload(storagePath, buffer, { contentType, upsert: false });
  if (error) {
    throw new Error(`Falha ao enviar para Supabase Storage: ${error.message}`);
  }
}

export async function createFileRecord(params: {
  originalName: string;
  extension: "CSV" | "TXT" | "SQL";
  sizeBytes: number;
  storagePath: string;
  sha256Hash: string;
  uploadedById: string;
  isDuplicate: boolean;
  duplicateOfId?: string;
}) {
  return prisma.file.create({
    data: {
      originalName: params.originalName,
      extension: params.extension,
      sizeBytes: BigInt(params.sizeBytes),
      storagePath: params.storagePath,
      sha256Hash: params.sha256Hash,
      uploadedById: params.uploadedById,
      isDuplicate: params.isDuplicate,
      duplicateOfId: params.duplicateOfId,
      status: "RECEIVED",
    },
  });
}

export async function listFiles() {
  const files = await prisma.file.findMany({
    orderBy: { uploadedAt: "desc" },
    include: {
      uploadedBy: { select: { name: true, email: true } },
      processingSessions: {
        orderBy: { startedAt: "desc" },
        take: 1,
        include: {
          validationResults: true,
          _count: {
            select: {
              schemas: true,
              tables: true,
              views: true,
              procedures: true,
              sequences: true,
            },
          },
          tables: { select: { _count: { select: { columns: true, constraints: true } } } },
        },
      },
    },
  });
  return files.map((f) => {
    const session = f.processingSessions[0];
    const columnCount =
      session?.tables.reduce((acc, t) => acc + t._count.columns, 0) ?? 0;
    const constraintCount =
      session?.tables.reduce((acc, t) => acc + t._count.constraints, 0) ?? 0;
    const objectCount = session
      ? session._count.schemas +
        session._count.tables +
        session._count.views +
        session._count.procedures +
        session._count.sequences +
        columnCount +
        constraintCount
      : 0;
    return {
      id: f.id,
      originalName: f.originalName,
      extension: f.extension,
      uploadedAt: f.uploadedAt,
      uploadedBy: f.uploadedBy.name,
      sizeBytes: f.sizeBytes.toString(),
      status: f.status,
      identifiedDbms: f.identifiedDbms,
      isDuplicate: f.isDuplicate,
      processingDurationMs: session?.totalDurationMs ?? null,
      validationPassed: session?.validationResults.every((v) => v.passed) ?? null,
      objectCount,
    };
  });
}

export async function getFileDetail(fileId: string) {
  return prisma.file.findUnique({
    where: { id: fileId },
    include: {
      uploadedBy: { select: { name: true, email: true } },
      processingSessions: {
        orderBy: { startedAt: "desc" },
        include: {
          steps: { orderBy: { stepCode: "asc" } },
          validationResults: { include: { rule: true } },
          schemas: true,
          tables: { include: { columns: true, constraints: true } },
          views: true,
          procedures: true,
          sequences: true,
        },
      },
      approvalQueue: true,
    },
  });
}
