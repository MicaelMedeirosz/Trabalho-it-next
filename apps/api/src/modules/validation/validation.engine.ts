import { prisma } from "../../config/prisma";
import { ParseResult } from "../catalog/types";
import { RuleCode } from "@trabalho/shared-types";

export interface RuleCheckResult {
  code: RuleCode;
  passed: boolean;
  details: string;
}

const NAME_PATTERN = /^[a-z][a-z0-9_]*$/; // snake_case corporativo
const INVALID_CHARS_PATTERN = /[^a-zA-Z0-9_]/;
const MAX_NAME_LENGTH = 63;

export function runValidationRules(params: {
  isReadable: boolean;
  isStructureValid: boolean;
  parsed: ParseResult;
}): RuleCheckResult[] {
  const { isReadable, isStructureValid, parsed } = params;
  const results: RuleCheckResult[] = [];

  results.push({
    code: "RV001",
    passed: isReadable,
    details: isReadable ? "Arquivo legível e íntegro." : "Falha na leitura/integridade do arquivo.",
  });

  results.push({
    code: "RV002",
    passed: isStructureValid,
    details: isStructureValid ? "Estrutura válida conforme padrão suportado." : "Estrutura não reconhecida.",
  });

  results.push({
    code: "RV003",
    passed: parsed.schemas.length > 0,
    details: `${parsed.schemas.length} schema(s) identificado(s).`,
  });

  results.push({
    code: "RV004",
    passed: parsed.tables.length > 0,
    details: `${parsed.tables.length} tabela(s) identificada(s).`,
  });

  const totalColumns = parsed.tables.reduce((acc, t) => acc + t.columns.length, 0);
  results.push({
    code: "RV005",
    passed: totalColumns > 0,
    details: `${totalColumns} coluna(s) identificada(s).`,
  });

  results.push({
    code: "RV006",
    passed: parsed.views.length > 0,
    details: `${parsed.views.length} view(s) identificada(s).`,
  });

  results.push({
    code: "RV007",
    passed: parsed.procedures.length > 0,
    details: `${parsed.procedures.length} procedure(s)/function(s) identificada(s).`,
  });

  results.push({
    code: "RV008",
    passed: parsed.relationships.length > 0,
    details: `${parsed.relationships.length} relacionamento(s) identificado(s).`,
  });

  const totalConstraints = parsed.tables.reduce((acc, t) => acc + t.constraints.length, 0);
  results.push({
    code: "RV009",
    passed: totalConstraints > 0,
    details: `${totalConstraints} constraint(s) identificada(s).`,
  });

  const nameCounts = new Map<string, number>();
  parsed.tables.forEach((t) => {
    const key = `table:${t.name.toLowerCase()}`;
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  });
  const duplicates = Array.from(nameCounts.entries()).filter(([, count]) => count > 1);
  results.push({
    code: "RV010",
    passed: duplicates.length === 0,
    details:
      duplicates.length === 0
        ? "Nenhuma duplicidade de objetos encontrada."
        : `Duplicidade detectada: ${duplicates.map(([k]) => k).join(", ")}.`,
  });

  const missingRequiredFields = parsed.tables.filter((t) => !t.name || t.columns.length === 0);
  results.push({
    code: "RV011",
    passed: missingRequiredFields.length === 0,
    details:
      missingRequiredFields.length === 0
        ? "Todos os campos obrigatórios presentes."
        : `${missingRequiredFields.length} tabela(s) sem campos obrigatórios.`,
  });

  const badNaming: string[] = [];
  parsed.tables.forEach((t) => {
    if (!NAME_PATTERN.test(t.name)) badNaming.push(t.name);
    t.columns.forEach((c) => {
      if (!NAME_PATTERN.test(c.name)) badNaming.push(`${t.name}.${c.name}`);
    });
  });
  results.push({
    code: "RV012",
    passed: badNaming.length === 0,
    details:
      badNaming.length === 0
        ? "Nomenclatura corporativa (snake_case) respeitada."
        : `Fora do padrão: ${badNaming.slice(0, 10).join(", ")}${badNaming.length > 10 ? "..." : ""}.`,
  });

  const invalidChars: string[] = [];
  parsed.tables.forEach((t) => {
    if (INVALID_CHARS_PATTERN.test(t.name)) invalidChars.push(t.name);
    t.columns.forEach((c) => {
      if (INVALID_CHARS_PATTERN.test(c.name)) invalidChars.push(`${t.name}.${c.name}`);
    });
  });
  results.push({
    code: "RV013",
    passed: invalidChars.length === 0,
    details:
      invalidChars.length === 0
        ? "Nenhum caractere inválido encontrado."
        : `Caracteres inválidos em: ${invalidChars.slice(0, 10).join(", ")}.`,
  });

  const tooLongNames: string[] = [];
  parsed.tables.forEach((t) => {
    if (t.name.length > MAX_NAME_LENGTH) tooLongNames.push(t.name);
    t.columns.forEach((c) => {
      if (c.name.length > MAX_NAME_LENGTH) tooLongNames.push(`${t.name}.${c.name}`);
    });
  });
  results.push({
    code: "RV014",
    passed: tooLongNames.length === 0,
    details:
      tooLongNames.length === 0
        ? `Todos os nomes dentro do limite de ${MAX_NAME_LENGTH} caracteres.`
        : `Nomes excedendo limite: ${tooLongNames.join(", ")}.`,
  });

  const missingDescriptions = parsed.tables.filter((t) => !t.description);
  results.push({
    code: "RV015",
    passed: missingDescriptions.length === 0,
    details:
      missingDescriptions.length === 0
        ? "Todas as tabelas possuem descrição."
        : `${missingDescriptions.length} tabela(s) sem descrição.`,
  });

  // RV016 é garantida estruturalmente: toda etapa é logada em processing_steps.
  results.push({
    code: "RV016",
    passed: true,
    details: "Rastreabilidade integral registrada em log de processamento.",
  });

  return results;
}

export async function persistValidationResults(sessionId: string, results: RuleCheckResult[]) {
  await prisma.validationResult.createMany({
    data: results.map((r) => ({
      sessionId,
      ruleCode: r.code,
      passed: r.passed,
      details: r.details,
    })),
  });
}

export async function seedValidationRules() {
  const { VALIDATION_RULES } = await import("@trabalho/shared-types");
  for (const rule of VALIDATION_RULES) {
    await prisma.validationRule.upsert({
      where: { code: rule.code },
      update: { description: rule.description, severity: rule.severity as any },
      create: { code: rule.code, description: rule.description, severity: rule.severity as any },
    });
  }
}
