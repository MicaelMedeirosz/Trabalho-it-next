import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AuditLogEntry } from "../types";

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    api.get("/audit").then((res) => setLogs(res.data));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Trilha de Auditoria</h2>

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
              <th className="px-3 py-2">Tempo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("pt-BR")}
                </td>
                <td className="px-3 py-2">{log.user?.name ?? "-"}</td>
                <td className="px-3 py-2">{log.file?.originalName ?? "-"}</td>
                <td className="px-3 py-2 font-mono text-xs">{log.event}</td>
                <td className="px-3 py-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      log.status === "SUCCESS"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {log.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600 max-w-xs truncate" title={log.message ?? ""}>
                  {log.message ?? "-"}
                </td>
                <td className="px-3 py-2">{log.executionTimeMs ? `${log.executionTimeMs}ms` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
