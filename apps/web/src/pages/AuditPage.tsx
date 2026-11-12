import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AuditLogEntry } from "../types";
import { statusColors } from "../statusColors";
import { FileDetailModal } from "../components/FileDetailModal";

type Period = "all" | "year" | "month" | "week" | "day";
function localDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function dateRange(period: Period, reference: string) {
  if (period === "all" || !/^\d{4}-\d{2}-\d{2}$/.test(reference)) return undefined;
  const [year, month, day] = reference.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  if (!Number.isFinite(start.getTime())) return undefined;
  if (period === "year") start.setMonth(0, 1);
  if (period === "month") start.setDate(1);
  if (period === "week") start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(start);
  if (period === "year") end.setFullYear(end.getFullYear() + 1);
  else if (period === "month") end.setMonth(end.getMonth() + 1);
  else end.setDate(end.getDate() + (period === "week" ? 7 : 1));
  return { from: start.toISOString(), to: end.toISOString(), start, end };
}

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [catalogFileId, setCatalogFileId] = useState<string | null>(null);

  const [period, setPeriod] = useState<Period>("all");
  const [reference, setReference] = useState(() => localDateValue(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const range = dateRange(period, reference);
  const from = range?.from;
  const to = range?.to;

  useEffect(() => {
    if (period !== "all" && !from) { setLogs([]); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError(""); setLogs([]);
    api.get("/audit", { params: from && to ? { from, to } : {}, signal: controller.signal })
      .then(res => { if (!controller.signal.aborted) setLogs(res.data); })
      .catch(err => { if (!controller.signal.aborted) setError(err.response?.data?.error ?? "Não foi possível carregar a auditoria."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, from, to]);

  return (
    <div className="space-y-4">
      {catalogFileId && (
        <FileDetailModal key={catalogFileId} fileId={catalogFileId} initialTab="steps" onClose={() => setCatalogFileId(null)} />
      )}
      <h2 className="text-xl font-semibold text-slate-900">Trilha de Auditoria</h2>

      <div className="panel p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="audit-period" className="block text-sm font-medium mb-1">Filtrar por período</label>
            <select id="audit-period" value={period} onChange={event => setPeriod(event.target.value as Period)} className="border rounded px-3 py-2 text-sm bg-white">
              <option value="all">Todos os períodos</option>
              <option value="year">Ano</option>
              <option value="month">Mês</option>
              <option value="week">Semana</option>
              <option value="day">Dia</option>
            </select>
          </div>
          {period !== "all" && <div>
            <label htmlFor="audit-reference" className="block text-sm font-medium mb-1">Data de referência</label>
            <input id="audit-reference" type="date" min="1900-01-01" max="9998-12-31" required value={reference} onChange={event => setReference(event.target.value)} className="border rounded px-3 py-2 text-sm" />
          </div>}
          {period !== "all" && <button type="button" onClick={() => setPeriod("all")} className="text-sm text-purple-700 underline py-2">Limpar filtro</button>}
        </div>
        <p className="text-xs text-slate-500">
          {range ? `Período: ${range.start.toLocaleDateString("pt-BR")} a ${new Date(range.end.getTime() - 1).toLocaleDateString("pt-BR")}. ` : period !== "all" ? "Selecione uma data de referência. " : ""}
          {period === "week" ? "Semana de segunda a domingo. " : ""}Até 200 eventos mais recentes do período.
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-2">Data/Hora</th>
              <th className="px-3 py-2">Usuário</th>
              <th className="px-3 py-2">Arquivo</th>
              <th className="px-3 py-2">Evento</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Mensagem</th>
              <th className="px-3 py-2">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(loading || (!error && logs.length === 0)) && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500" role="status">{loading ? "Carregando..." : "Nenhum evento encontrado no período selecionado."}</td></tr>}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("pt-BR")}
                </td>
                <td className="px-3 py-2">{log.user?.name ?? "-"}</td>
                <td className="px-3 py-2">{log.file?.originalName ?? "-"}</td>
                <td className={`px-3 py-2 font-mono text-xs font-semibold ${statusColors(log.status).text}`}>{log.event}</td>
                <td className="px-3 py-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      statusColors(log.status).badge
                    }`}
                  >
                    {log.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600 max-w-xs truncate" title={log.message ?? ""}>
                  {log.message ?? "-"}
                </td>
                <td className="px-3 py-2">
                  {log.fileId && log.file && ["FILE_APPROVED", "FILE_REJECTED"].includes(log.event) ? (
                    <button type="button" onClick={() => setCatalogFileId(log.fileId)}
                      aria-label={`Ver detalhes de ${log.file.originalName}`}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap">
                      Ver detalhes
                    </button>
                  ) : <span className="text-slate-400">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
