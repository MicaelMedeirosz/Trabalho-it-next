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
    { label: "Arquivos reenviados", value: report.summary.duplicateFiles, color: "text-slate-500" },
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
        <p className="text-sm text-slate-600 mb-4">
          Os indicadores de RV contam avaliações com falha em todo o histórico, incluindo arquivos aprovados, rejeitados e pendentes. Não representam a quantidade individual de objetos com problema. Aprovar um arquivo com justificativa não elimina suas falhas de validação.
        </p>
        <dl className="text-sm space-y-4 text-slate-600">
          <div>
            <dt className="font-semibold text-slate-900">Arquivos reenviados: {report.summary.duplicateFiles}</dt>
            <dd className="mt-1">Envios cujo conteúdo é idêntico ao de um arquivo anterior, identificados pelo hash SHA-256. Cada reenvio é contado, mesmo que o nome do arquivo seja diferente. Essa contagem é independente da RV010.</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Nomes fora do padrão (RV012): {report.conformity.namingFailures}</dt>
            <dd className="mt-1">Avaliações em que ao menos uma tabela ou coluna não segue o padrão snake_case: começa com letra minúscula e usa apenas letras minúsculas, números e sublinhados. Exemplo válido: data_cadastro. Vários nomes inválidos em uma avaliação contam como uma falha.</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Estruturas com tabelas duplicadas (RV010): {report.conformity.duplicateObjectFailures}</dt>
            <dd className="mt-1">Avaliações em que o importador identifica mais de uma tabela com o mesmo nome dentro da estrutura do arquivo. A comparação ignora maiúsculas e minúsculas e, atualmente, também considera iguais nomes em schemas diferentes. Essa regra não verifica reenvios de arquivos.</dd>
            <dd className="mt-1">Exemplo: enviar o mesmo SQL três vezes gera dois arquivos reenviados, mas nenhuma falha na RV010 se cada estrutura tiver nomes de tabelas distintos.</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Tabelas sem descrição (RV015): {report.conformity.descriptionGaps}</dt>
            <dd className="mt-1">Avaliações em que ao menos uma tabela identificada não possui descrição reconhecida pelo importador. Várias tabelas sem descrição na mesma avaliação contam como uma falha. No SQL, use COMMENT ON TABLE; no CSV, use uma linha da tabela sem coluna preenchida e com o campo description informado.</dd>
          </div>
        </dl>
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
