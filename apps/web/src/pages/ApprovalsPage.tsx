import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ApprovalItem } from "../types";
import { useAuth } from "../auth/AuthContext";

export function ApprovalsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await api.get("/approvals");
    setItems(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: string) {
    try {
      await api.post(`/approvals/${id}/decide`, { decision: "APPROVED" });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Erro ao aprovar");
    }
  }

  async function reject(id: string) {
    if (!reason.trim()) {
      setError("Justificativa é obrigatória para rejeição.");
      return;
    }
    try {
      await api.post(`/approvals/${id}/decide`, { decision: "REJECTED", rejectionReason: reason });
      setRejectingId(null);
      setReason("");
      setError(null);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Erro ao rejeitar");
    }
  }

  if (user?.role !== "ADMIN") {
    return (
      <p className="text-sm text-slate-500">
        Apenas usuários com papel ADMIN podem homologar arquivos.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Fila de Homologação</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum arquivo pendente de homologação.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const failedRules = item.session.validationResults.filter((v) => !v.passed);
            return (
              <div key={item.id} className="bg-white border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{item.file.originalName}</p>
                    <p className="text-xs text-slate-500">
                      Enviado por {item.file.uploadedBy.name} em{" "}
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => approve(item.id)}
                      className="bg-green-600 text-white text-sm px-3 py-1.5 rounded hover:bg-green-700"
                    >
                      Aprovar
                    </button>
                    <button
                      onClick={() => setRejectingId(rejectingId === item.id ? null : item.id)}
                      className="bg-red-600 text-white text-sm px-3 py-1.5 rounded hover:bg-red-700"
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>

                {failedRules.length > 0 && (
                  <div className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                    {failedRules.length} regra(s) com alerta: {failedRules.map((r) => r.ruleCode).join(", ")}
                  </div>
                )}

                {rejectingId === item.id && (
                  <div className="flex gap-2 pt-2">
                    <input
                      className="flex-1 border rounded px-3 py-1.5 text-sm"
                      placeholder="Justificativa da rejeição (obrigatória)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <button
                      onClick={() => reject(item.id)}
                      className="bg-slate-900 text-white text-sm px-3 py-1.5 rounded"
                    >
                      Confirmar rejeição
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
