import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { FileListItem } from "../types";
import { FileDetailModal } from "../components/FileDetailModal";

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: "Recebido",
  PROCESSING: "Em processamento",
  PENDING_APPROVAL: "Aguardando homologação",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  FAILED: "Falhou",
};

const STATUS_COLOR: Record<string, string> = {
  RECEIVED: "bg-slate-100 text-slate-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  FAILED: "bg-red-100 text-red-700",
};

const ICONS: Record<string, string> = { CSV: "📊", TXT: "📄", SQL: "🗄️" };

function formatBytes(bytes: string): string {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function DashboardPage() {
  const [files, setFiles] = useState<FileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function load() {
    const { data } = await api.get("/files");
    setFiles(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Pausa o polling quando a aba está oculta (document.visibilityState)
    // e retoma ao voltar — evita requests inúteis em background.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        load();
      }
    }, 10000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Dashboard de Arquivos</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Atualização automática a cada 10s</span>
          <button
            onClick={() => load()}
            className="text-xs bg-slate-900 text-white px-3 py-1 rounded hover:bg-slate-800"
          >
            Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Carregando...</p>
      ) : files.length === 0 ? (
        <p className="text-slate-500 text-sm">Nenhum arquivo enviado ainda.</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-3 py-2">Arquivo</th>
                <th className="px-3 py-2">Data/Hora</th>
                <th className="px-3 py-2">Usuário</th>
                <th className="px-3 py-2">Tamanho</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Objetos</th>
                <th className="px-3 py-2">Tempo</th>
                <th className="px-3 py-2">SGBD</th>
                <th className="px-3 py-2">Validação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {files.map((f) => (
                <tr
                  key={f.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelectedId(f.id)}
                >
                  <td className="px-3 py-2">
                    <span className="mr-2">{ICONS[f.extension]}</span>
                    {f.originalName}
                    {f.isDuplicate && (
                      <span className="ml-2 text-xs text-amber-600">(duplicado)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(f.uploadedAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2">{f.uploadedBy}</td>
                  <td className="px-3 py-2">{formatBytes(f.sizeBytes)}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[f.status]}`}>
                      {STATUS_LABEL[f.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">{f.objectCount}</td>
                  <td className="px-3 py-2">
                    {f.processingDurationMs ? `${f.processingDurationMs}ms` : "-"}
                  </td>
                  <td className="px-3 py-2">{f.identifiedDbms ?? "-"}</td>
                  <td className="px-3 py-2">
                    {f.validationPassed === null ? (
                      "-"
                    ) : f.validationPassed ? (
                      <span className="text-green-600">OK</span>
                    ) : (
                      <span className="text-red-600">Alertas</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <FileDetailModal fileId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
