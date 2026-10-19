import { prisma } from "../../config/prisma";

export async function getConsolidatedReport() {
  const [totalFiles, approved, rejected, pending, failed] = await Promise.all([
    prisma.file.count(),
    prisma.file.count({ where: { status: "APPROVED" } }),
    prisma.file.count({ where: { status: "REJECTED" } }),
    prisma.file.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.file.count({ where: { status: "FAILED" } }),
  ]);

  const duplicateFiles = await prisma.file.count({ where: { isDuplicate: true } });

  const validationResults = await prisma.validationResult.findMany({
    include: { rule: true },
  });

  const ruleStats = new Map<string, { description: string; passed: number; failed: number }>();
  for (const vr of validationResults) {
    const key = vr.ruleCode;
    if (!ruleStats.has(key)) {
      ruleStats.set(key, { description: vr.rule.description, passed: 0, failed: 0 });
    }
    const entry = ruleStats.get(key)!;
    if (vr.passed) entry.passed++;
    else entry.failed++;
  }

  const namingFailures = validationResults.filter((v) => v.ruleCode === "RV012" && !v.passed).length;
  const duplicateObjectFailures = validationResults.filter((v) => v.ruleCode === "RV010" && !v.passed).length;
  const descriptionGaps = validationResults.filter((v) => v.ruleCode === "RV015" && !v.passed).length;

  return {
    summary: { totalFiles, approved, rejected, pending, failed, duplicateFiles },
    conformity: {
      namingFailures,
      duplicateObjectFailures,
      descriptionGaps,
    },
    ruleStats: Array.from(ruleStats.entries()).map(([code, stat]) => ({ code, ...stat })),
  };
}
