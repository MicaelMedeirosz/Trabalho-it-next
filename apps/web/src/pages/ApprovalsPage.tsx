import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ApprovalItem } from "../types";
import { useAuth } from "../auth/AuthContext";

interface DecidingState {
  id: string;
  decision: "APPROVED" | "REJECTED";
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function ApprovalsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<DecidingState | null>(null);

  async function load() {
    const { data } = await api.get("/approvals");
    setItems(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, decision: "APPROVED" | "REJECTED") {
    if (decision === "REJECTED" && !reason.trim()) {
      setError("Justificativa é obrigatória para rejeição.");
      return;
    }
    setError(null);
    setDeciding({ id, decision });
    try {
      await api.post(`/approvals/${id}/decide`, {
        decision,
        ...(decision === "REJECTED" ? { rejectionReason: reason } : {}),
      });
      if (decision === "REJECTED") {
        setRejectingId(null);
        setReason("");
      }
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Erro ao processar decisão");
    } finally {
      setDeciding(null);
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
            const isDeciding = deciding?.id === item.id;
            const decidingApprove = isDeciding && deciding.decision === "APPROVED";
            const decidingReject = isDeciding && deciding.decision === "REJECTED";

            return (
              <div
                key={item.id}
                className={`bg-white border rounded-lg p-4 space-y-2 transition ${
                  isDeciding ? "border-slate-900 animate-pulse" : ""
                }`}
              >
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
                      onClick={() => decide(item.id, "APPROVED")}
                      disabled={isDeciding}
                      className="bg-green-600 text-white text-sm px-3 py-1.5 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {decidingApprove && <Spinner className="h-4 w-4" />}
                      {decidingApprove ? "Aprovando..." : "Aprovar"}
                    </button>
                    <button
                      onClick={() => setRejectingId(rejectingId === item.id ? null : item.id)}
                      disabled={isDeciding}
                      className="bg-red-600 text-white text-sm px-3 py-1.5 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                      disabled={isDeciding}
                    />
                    <button
                      onClick={() => decide(item.id, "REJECTED")}
                      disabled={isDeciding}
                      className="bg-slate-900 text-white text-sm px-3 py-1.5 rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {decidingReject && <Spinner className="h-4 w-4" />}
                      {decidingReject ? "Rejeitando..." : "Confirmar rejeição"}
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
