import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ApprovalItem } from "../types";
import { useAuth } from "../auth/AuthContext";
import { FileDetailModal } from "../components/FileDetailModal";

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
  const [detailsFileId, setDetailsFileId] = useState<string | null>(null);
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approvalReason, setApprovalReason] = useState("");
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

  async function decide(id: string, decision: "APPROVED" | "REJECTED", confirmAlerts = false) {
    if (deciding) return;
    if (decision === "REJECTED" && !reason.trim()) {
      setError("Justificativa é obrigatória para rejeição.");
      return;
    }
    if (decision === "APPROVED" && confirmAlerts && !approvalReason.trim()) {
      setError("Justificativa obrigatória para aprovar um arquivo com alertas.");
      return;
    }
    setError(null);
    setDeciding({ id, decision });
    try {
      await api.post(`/approvals/${id}/decide`, {
        decision,
        ...(decision === "APPROVED" ? { confirmAlerts, ...(confirmAlerts ? { approvalReason: approvalReason.trim() } : {}) } : {}),
        ...(decision === "REJECTED" ? { rejectionReason: reason } : {}),
      });
      if (decision === "REJECTED") {
        setRejectingId(null);
        setReason("");
      }
      setConfirmingId(null);
      setApprovalReason("");
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
      {detailsFileId && (
        <FileDetailModal
          key={detailsFileId}
          fileId={detailsFileId}
          initialTab="validation"
          onClose={() => setDetailsFileId(null)}
        />
      )}
      <h2 className="text-xl font-semibold text-slate-900">Fila de Homologação</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum arquivo pendente de homologação.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const failedRules = item.session.validationResults.filter((v) => !v.passed);
            const allRulesPassed = failedRules.length === 0 && Array.from({ length: 16 }, (_, index) =>
              `RV${String(index + 1).padStart(3, "0")}`
            ).every(code => item.session.validationResults.some(rule => rule.ruleCode === code && rule.passed === true));
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
                      onClick={() => {
                        setError(null);
                        setRejectingId(null);
                        if (failedRules.length > 0) {
                          if (confirmingId !== item.id) setApprovalReason("");
                          setConfirmingId(item.id);
                        }
                        else void decide(item.id, "APPROVED");
                      }}
                      disabled={deciding !== null}
                      className="bg-green-600 text-white text-sm px-3 py-1.5 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {decidingApprove && <Spinner className="h-4 w-4" />}
                      {decidingApprove ? "Aprovando..." : "Aprovar"}
                    </button>
                    <button
                      onClick={() => { setConfirmingId(null); setRejectingId(rejectingId === item.id ? null : item.id); }}
                      disabled={deciding !== null}
                      className="bg-red-600 text-white text-sm px-3 py-1.5 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>

                <div className={`flex flex-wrap items-center justify-between gap-2 text-xs rounded p-2 ${
                  failedRules.length > 0 ? "text-amber-700 bg-amber-50" : allRulesPassed ? "text-green-800 bg-green-50" : "text-slate-600 bg-slate-50"
                }`}>
                  <span>
                    {failedRules.length > 0
                      ? `${failedRules.length} regra(s) com alerta: ${failedRules.map(rule => rule.ruleCode).join(", ")}`
                      : allRulesPassed
                        ? "Arquivo passou em todas as 16 regras de validação."
                        : "Validação incompleta. Consulte os detalhes do arquivo."}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDetailsFileId(item.fileId)}
                    aria-label={`Ver detalhes de ${item.file.originalName}: validação, etapas e catálogo`}
                    className={`rounded border bg-white px-3 py-1.5 font-semibold ${failedRules.length > 0 ? "border-amber-300 hover:bg-amber-100" : allRulesPassed ? "border-green-300 hover:bg-green-100" : "border-slate-300 hover:bg-slate-100"}`}
                  >
                    Ver detalhes
                  </button>
                </div>

                {confirmingId === item.id && (
                  <section role="region" aria-labelledby={`confirm-title-${item.id}`} className="rounded-lg border border-red-300 bg-red-50 p-4 space-y-3">
                    <h3 id={`confirm-title-${item.id}`} className="font-semibold text-red-900">Aprovar arquivo com alertas?</h3>
                    <p className="text-sm text-red-800">
                      {item.file.originalName} possui {failedRules.length} regra(s) com falha. A aprovação liberará os dados mesmo com esses alertas.
                    </p>
                    <ul className="list-disc pl-5 text-sm text-red-800">
                      {failedRules.map(rule => <li key={rule.id}><strong>{rule.ruleCode}</strong>: {rule.details}</li>)}
                    </ul>
                    <div>
                      <label htmlFor={`approval-reason-${item.id}`} className="block text-sm font-medium text-red-900">Justificativa da aprovação (obrigatória)</label>
                      <textarea id={`approval-reason-${item.id}`} value={approvalReason} onChange={event => setApprovalReason(event.target.value)} required maxLength={2000} rows={3} disabled={deciding !== null} placeholder="Explique por que o arquivo pode ser aprovado apesar dos alertas." className="mt-1 w-full rounded border border-red-300 bg-white px-3 py-2 text-sm" />
                      <p className="text-xs text-red-800">A justificativa será registrada na auditoria. Máximo de 2000 caracteres.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={deciding !== null} onClick={() => setConfirmingId(null)} className="border rounded px-3 py-2 text-sm bg-white disabled:opacity-50">Cancelar</button>
                      <button type="button" disabled={deciding !== null || !approvalReason.trim()} onClick={() => decide(item.id, "APPROVED", true)} className="bg-red-700 text-white rounded px-3 py-2 text-sm hover:bg-red-800 disabled:opacity-50">
                        {decidingApprove ? "Aprovando..." : "Confirmar aprovação com alertas"}
                      </button>
                    </div>
                  </section>
                )}

                {rejectingId === item.id && (
                  <div className="flex gap-2 pt-2">
                    <input
                      className="flex-1 border rounded px-3 py-1.5 text-sm"
                      placeholder="Justificativa da rejeição (obrigatória)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      disabled={deciding !== null}
                    />
                    <button
                      onClick={() => decide(item.id, "REJECTED")}
                      disabled={deciding !== null}
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
