import { prisma } from "../../config/prisma";

export async function getConsolidatedReport() {
  // Agregação no banco (groupBy) em vez de carregar todas as rows de
  // validationResults na memória — o volume cresce a cada upload.
  const [duplicateFiles, fileStatusCounts, ruleStatsRaw] = await Promise.all([
    prisma.file.count({ where: { isDuplicate: true } }),
    prisma.file.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.validationResult.groupBy({
      by: ["ruleCode", "passed"],
      _count: { _all: true },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const g of fileStatusCounts) counts[g.status] = g._count._all;

  const summary = {
    totalFiles: Object.values(counts).reduce((a, b) => a + b, 0),
    approved: counts["APPROVED"] ?? 0,
    rejected: counts["REJECTED"] ?? 0,
    pending: counts["PENDING_APPROVAL"] ?? 0,
    failed: counts["FAILED"] ?? 0,
    duplicateFiles,
  };

  const ruleAcc = new Map<string, { passed: number; failed: number }>();
  for (const row of ruleStatsRaw) {
    const entry = ruleAcc.get(row.ruleCode) ?? { passed: 0, failed: 0 };
    if (row.passed) entry.passed += row._count._all;
    else entry.failed += row._count._all;
    ruleAcc.set(row.ruleCode, entry);
  }

  const rules = await prisma.validationRule.findMany({
    select: { code: true, description: true },
    orderBy: { code: "asc" },
  });

  const ruleStats = rules.map((r) => ({
    code: r.code,
    description: r.description,
    passed: ruleAcc.get(r.code)?.passed ?? 0,
    failed: ruleAcc.get(r.code)?.failed ?? 0,
  }));

  const getFailed = (code: string) => ruleAcc.get(code)?.failed ?? 0;

  return {
    summary,
    conformity: {
      namingFailures: getFailed("RV012"),
      duplicateObjectFailures: getFailed("RV010"),
      descriptionGaps: getFailed("RV015"),
    },
    ruleStats,
  };
}
