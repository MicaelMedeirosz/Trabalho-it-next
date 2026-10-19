import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { createSession, runStep, finishSession } from "./steps.service";
import { computeSha256, findDuplicateByHash, uploadToStorage, createFileRecord } from "../files/files.service";
import { parseCsv } from "../catalog/csv.parser";
import { parseTxt } from "../catalog/txt.parser";
import { parseSql } from "../catalog/sql.parser";
import { persistCatalog } from "../catalog/catalog.service";
import { runValidationRules, persistValidationResults, RuleCheckResult } from "../validation/validation.engine";
import { ParseResult } from "../catalog/types";
import { logAudit } from "../audit/audit.service";

export interface ProcessUploadInput {
  originalName: string;
  buffer: Buffer;
  mimeType: string;
  uploadedById: string;
}

export interface ProcessUploadResult {
  fileId: string;
  sessionId: string;
  status: string;
  objectCount: number;
  validation: RuleCheckResult[];
}

function detectEncoding(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return "UTF-8 (BOM)";
  }
  try {
    const text = buffer.toString("utf-8");
    if (text.includes("\uFFFD")) return "ISO-8859-1 (provável)";
    return "UTF-8";
  } catch {
    return "DESCONHECIDA";
  }
}

export async function processUpload(input: ProcessUploadInput): Promise<ProcessUploadResult> {
  const extension = resolveExtension(input.originalName);

  // ETP-001: Recebimento do arquivo
  await logAudit({ event: "UPLOAD_RECEIVED", status: "SUCCESS", message: input.originalName, userId: input.uploadedById });

  // ETP-002: Validação de extensão
  if (!extension) {
    throw new UploadError("Extensão não suportada. Use .csv, .txt ou .sql.");
  }

  // ETP-003: Validação de tamanho
  if (input.buffer.length > env.maxFileSizeBytes) {
    throw new UploadError(`Arquivo excede o tamanho máximo permitido (${env.maxFileSizeBytes} bytes).`);
  }

  // ETP-004: Verificação de integridade/legibilidade
  const isReadable = input.buffer.length > 0;
  if (!isReadable) {
    throw new UploadError("Arquivo vazio ou ilegível.");
  }

  // ETP-005: Codificação
  const encoding = detectEncoding(input.buffer);

  // ETP-006: Hash SHA-256
  const hash = computeSha256(input.buffer);
  const duplicate = await findDuplicateByHash(hash);

  // Grava registro do arquivo (metadados iniciais - ETP-007 parcial)
  const storagePath = `${Date.now()}-${input.originalName}`;
  if (!duplicate) {
    await uploadToStorage(input.buffer, storagePath, input.mimeType);
  }

  const file = await createFileRecord({
    originalName: input.originalName,
    extension,
    sizeBytes: input.buffer.length,
    storagePath: duplicate ? duplicate.storagePath : storagePath,
    sha256Hash: duplicate ? `${hash}-dup-${Date.now()}` : hash,
    uploadedById: input.uploadedById,
    isDuplicate: !!duplicate,
    duplicateOfId: duplicate?.id,
  });

  await prisma.file.update({ where: { id: file.id }, data: { encoding, status: "PROCESSING" } });

  // ETP-008: Criação da sessão de processamento
  const session = await createSession(file.id);

  try {
    // ETP-007: Registro de metadados iniciais (já persistido acima, log formal aqui)
    await runStep(session.id, "ETP-007", () => `Metadados iniciais registrados para ${input.originalName}`);

    await runStep(session.id, "ETP-008", () => `Sessão ${session.id} criada`);

    // ETP-009: Análise estrutural do conteúdo
    const content = input.buffer.toString("utf-8");
    let parsed: ParseResult;
    let isStructureValid = true;

    await runStep(session.id, "ETP-009", () => {
      if (content.trim().length === 0) {
        isStructureValid = false;
        throw new Error("Conteúdo vazio, estrutura inválida.");
      }
      return "Conteúdo validado estruturalmente.";
    });

    // ETP-010: Identificação automática de objetos
    parsed = await runStep(session.id, "ETP-010", () => {
      switch (extension) {
        case "CSV":
          return parseCsv(content);
        case "TXT":
          return parseTxt(content);
        case "SQL":
          return parseSql(content);
      }
    });

    // ETP-011: Quantificação estatística
    const objectStats = await runStep(session.id, "ETP-011", () => {
      const totalColumns = parsed.tables.reduce((a, t) => a + t.columns.length, 0);
      const totalConstraints = parsed.tables.reduce((a, t) => a + t.constraints.length, 0);
      return `Schemas:${parsed.schemas.length} Tabelas:${parsed.tables.length} Colunas:${totalColumns} Views:${parsed.views.length} Procedures:${parsed.procedures.length} Sequences:${parsed.sequences.length} Constraints:${totalConstraints} Relacionamentos:${parsed.relationships.length}`;
    });

    // ETP-012: Classificação do SGBD de origem
    const dbms = await runStep(session.id, "ETP-012", () => parsed.dbmsGuess ?? "Não identificado");
    await prisma.file.update({ where: { id: file.id }, data: { identifiedDbms: dbms === "Não identificado" ? null : dbms } });

    // Persiste catálogo extraído
    const { objectCount } = await persistCatalog(session.id, parsed);

    // ETP-013: Persistência de logs detalhados (steps já persistidos continuamente)
    await runStep(session.id, "ETP-013", () => "Logs detalhados persistidos.");

    // ETP-014: Atualização do dashboard em tempo real (via polling - status refletido no banco)
    await runStep(session.id, "ETP-014", () => "Status disponível para o dashboard via polling.");

    // ETP-015: Aplicação das regras de aprovação RV001-RV016
    const validationResults = await runStep(session.id, "ETP-015", () => {
      return runValidationRules({ isReadable, isStructureValid, parsed });
    });
    await persistValidationResults(session.id, validationResults);

    const hasBlockerFailure = validationResults.some(
      (r) => !r.passed && ["RV001", "RV002", "RV004", "RV005", "RV011", "RV016"].includes(r.code)
    );

    // ETP-016: Direcionamento para fila de homologação
    await runStep(session.id, "ETP-016", () => "Arquivo direcionado para fila de homologação.");
    await prisma.approvalQueue.create({
      data: { fileId: file.id, sessionId: session.id, status: "PENDING" },
    });

    await prisma.file.update({ where: { id: file.id }, data: { status: "PENDING_APPROVAL" } });

    // ETP-017 a ETP-020 ocorrem no momento da decisão humana (ver approval.service.ts)
    // Aqui são pré-registradas como PENDING (já criadas em createSession) e serão
    // concluídas/skipadas quando o administrador decidir.

    await finishSession(session.id, "PENDING_APPROVAL");

    await logAudit({
      event: "FILE_PROCESSED",
      status: "SUCCESS",
      message: `Arquivo ${input.originalName} processado. ${objectCount} objeto(s) identificado(s). Bloqueios: ${hasBlockerFailure}`,
      userId: input.uploadedById,
      fileId: file.id,
    });

    return {
      fileId: file.id,
      sessionId: session.id,
      status: "PENDING_APPROVAL",
      objectCount,
      validation: validationResults,
    };
  } catch (err: any) {
    await finishSession(session.id, "FAILED");
    await prisma.file.update({ where: { id: file.id }, data: { status: "FAILED" } });
    await logAudit({
      event: "FILE_PROCESSING_FAILED",
      status: "FAILED",
      message: err.message,
      userId: input.uploadedById,
      fileId: file.id,
    });
    throw err;
  }
}

export class UploadError extends Error {}

function resolveExtension(originalName: string): "CSV" | "TXT" | "SQL" | null {
  const ext = originalName.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "CSV";
  if (ext === "txt") return "TXT";
  if (ext === "sql") return "SQL";
  return null;
}
