import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Props {
  fileId: string;
  onClose: () => void;
}

const STEP_STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-500",
  RUNNING: "bg-blue-100 text-blue-700",
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  SKIPPED: "bg-slate-100 text-slate-400",
};

export function FileDetailModal({ fileId, onClose }: Props) {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<"steps" | "validation" | "catalog">("steps");

  useEffect(() => {
    api.get(`/files/${fileId}`).then((res) => setData(res.data));
  }, [fileId]);

  if (!data) return null;

  const session = data.processingSessions?.[0];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-semibold text-slate-900">{data.originalName}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <div className="px-4 pt-3 flex gap-2 border-b">
          {(["steps", "validation", "catalog"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm ${
                tab === t ? "border-b-2 border-slate-900 font-medium" : "text-slate-500"
              }`}
            >
              {t === "steps" ? "Etapas (ETP)" : t === "validation" ? "Validação (RV)" : "Catálogo"}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === "steps" && (
            <ul className="space-y-1 text-sm">
              {session?.steps?.map((s: any) => (
                <li key={s.id} className="flex items-center gap-2 py-1 border-b last:border-0">
                  <span className="font-mono text-xs text-slate-400 w-16">{s.stepCode}</span>
                  <span className="flex-1">{s.stepName}</span>
                  {s.durationMs != null && (
                    <span className="text-xs text-slate-400">{s.durationMs}ms</span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STEP_STATUS_COLOR[s.status]}`}>
                    {s.status}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {tab === "validation" && (
            <ul className="space-y-1 text-sm">
              {session?.validationResults?.map((v: any) => (
                <li key={v.id} className="flex items-start gap-2 py-1 border-b last:border-0">
                  <span className="font-mono text-xs text-slate-400 w-16">{v.ruleCode}</span>
                  <div className="flex-1">
                    <p>{v.rule?.description}</p>
                    {v.details && <p className="text-xs text-slate-500">{v.details}</p>}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      v.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {v.passed ? "OK" : "Falha"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {tab === "catalog" && (
            <div className="space-y-4 text-sm">
              <CatalogSection title="Schemas" items={session?.schemas} render={(s: any) => s.name} />
              <CatalogSection
                title="Tabelas"
                items={session?.tables}
                render={(t: any) => `${t.name} (${t.columns?.length ?? 0} colunas)`}
              />
              <CatalogSection title="Views" items={session?.views} render={(v: any) => v.name} />
              <CatalogSection
                title="Procedures"
                items={session?.procedures}
                render={(p: any) => p.name}
              />
              <CatalogSection
                title="Sequences"
                items={session?.sequences}
                render={(s: any) => s.name}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CatalogSection({ title, items, render }: { title: string; items: any[]; render: (i: any) => string }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className="font-medium text-slate-700 mb-1">{title} ({items.length})</h4>
      <ul className="list-disc list-inside text-slate-600 space-y-0.5">
        {items.map((item, i) => (
          <li key={i}>{render(item)}</li>
        ))}
      </ul>
    </div>
  );
}
