import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ConsolidatedReport } from "../types";

export function ReportsPage() {
  const [report, setReport] = useState<ConsolidatedReport | null>(null);

  useEffect(() => {
    api.get("/reports/consolidated").then((res) => setReport(res.data));
  }, []);

  if (!report) return <p className="text-sm text-slate-500">Carregando...</p>;

  const cards = [
    { label: "Total de arquivos", value: report.summary.totalFiles },
    { label: "Aprovados", value: report.summary.approved, color: "text-green-600" },
    { label: "Rejeitados", value: report.summary.rejected, color: "text-red-600" },
    { label: "Pendentes", value: report.summary.pending, color: "text-amber-600" },
    { label: "Falhas", value: report.summary.failed, color: "text-red-600" },
    { label: "Duplicados", value: report.summary.duplicateFiles, color: "text-slate-500" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">Relatório Consolidado</h2>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border rounded-lg p-4 text-center">
            <p className={`text-2xl font-semibold ${c.color ?? "text-slate-900"}`}>{c.value}</p>
            <p className="text-xs text-slate-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-medium text-slate-900 mb-3">Indicadores de Conformidade</h3>
        <ul className="text-sm space-y-1 text-slate-600">
          <li>Falhas de nomenclatura corporativa (RV012): {report.conformity.namingFailures}</li>
          <li>Objetos duplicados detectados (RV010): {report.conformity.duplicateObjectFailures}</li>
          <li>Lacunas de descrição/metadados (RV015): {report.conformity.descriptionGaps}</li>
        </ul>
      </div>

      <div className="bg-white border rounded-lg overflow-x-auto">
        <h3 className="font-medium text-slate-900 p-4 pb-0">Resultado por Regra de Validação</h3>
        <table className="w-full text-sm mt-2">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-2">Regra</th>
              <th className="px-3 py-2">Descrição</th>
              <th className="px-3 py-2">Aprovações</th>
              <th className="px-3 py-2">Falhas</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {report.ruleStats.map((r) => (
              <tr key={r.code}>
                <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-2">{r.description}</td>
                <td className="px-3 py-2 text-green-600">{r.passed}</td>
                <td className="px-3 py-2 text-red-600">{r.failed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
