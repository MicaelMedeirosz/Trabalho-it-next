import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Icon } from "../components/Brand";
import { api } from "../api/client";
import { statusColors } from "../statusColors";

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "QUEUED" | "UPLOADING" | "PROCESSING" | "DONE" | "ERROR";
  resultMessage?: string;
  controller: AbortController;
}

const STATUS_LABEL: Record<UploadItem["status"], string> = {
  QUEUED: "Aguardando confirmação",
  UPLOADING: "Enviando...",
  PROCESSING: "Processando no servidor (validação, catalogação)...",
  DONE: "Concluído",
  ERROR: "Falha",
};

const ACCEPTED = {
  "text/csv": [".csv"],
  "text/plain": [".txt"],
  "application/sql": [".sql"],
  "text/x-sql": [".sql"],
};

export function UploadPage() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const startedUploads = useRef(new Set<string>());

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newItems: UploadItem[] = acceptedFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: "QUEUED",
      controller: new AbortController(),
    }));
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: true,
  });

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  }

  async function uploadFile(item: UploadItem) {
    if (item.status !== "QUEUED" || startedUploads.current.has(item.id)) return;
    startedUploads.current.add(item.id);
    updateItem(item.id, { status: "UPLOADING" });
    const formData = new FormData();
    formData.append("files", item.file);
    try {
      const { data } = await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        signal: item.controller.signal,
        onUploadProgress: (evt) => {
          const progress = evt.total
            ? Math.round((evt.loaded / evt.total) * 100)
            : 0;
          // Ao atingir 100% do envio, o arquivo já chegou ao servidor mas o
          // pipeline (validação/catalogação) ainda está rodando — sinaliza
          // "processando" em vez de deixar a barra parada em 100% sem feedback.
          updateItem(item.id, {
            progress,
            status: progress >= 100 ? "PROCESSING" : "UPLOADING",
          });
        },
      });
      const hasError = data.errors?.length > 0;
      updateItem(item.id, {
        status: hasError && data.results.length === 0 ? "ERROR" : "DONE",
        progress: 100,
        resultMessage: hasError
          ? data.errors[0].error
          : `${data.results[0]?.objectCount ?? 0} objeto(s) identificado(s). Status: ${data.results[0]?.status}`,
      });
    } catch (err: any) {
      if (err.code === "ERR_CANCELED") {
        updateItem(item.id, {
          status: "ERROR",
          resultMessage: "Upload cancelado.",
        });
        return;
      }
      updateItem(item.id, {
        status: "ERROR",
        resultMessage: err.response?.data?.error ?? "Falha no upload.",
      });
    }
  }

  function cancelUpload(id: string) {
    const item = items.find((i) => i.id === id);
    item?.controller.abort();
  }

  function removeItem(id: string) {
    startedUploads.current.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <span className="section-kicker">COMECE PELOS SEUS DADOS</span>
          <h2 className="mt-2 font-semibold">Importar arquivos</h2>
          <p>O primeiro passo para um catálogo organizado e confiável.</p>
        </div>
        <span className="text-xs text-slate-500">CSV, TXT ou SQL</span>
      </div>
      <div className="import-layout">
        <section className="panel p-5 sm:p-7">
          <div className="flex items-center gap-2 mb-5 text-sm font-semibold">
            <Icon name="upload" /> Nova importação
          </div>
          <div
            {...getRootProps({
              role: "button",
              "aria-label": "Selecionar arquivos para importar",
            })}
            className={`upload-zone ${isDragActive ? "drag-active" : ""}`}
          >
            <input {...getInputProps()} />
            <div className="upload-symbol">
              <Icon name="upload" />
            </div>
            <h3>
              {isDragActive
                ? "Solte seus arquivos aqui"
                : "Dê um novo destino aos seus dados"}
            </h3>
            <p>
              Arraste e solte seus arquivos aqui ou selecione no computador.
            </p>
            <span className="primary-button">
              Selecionar arquivos <Icon name="arrow" />
            </span>
            <div className="format-tags">
              <span>.CSV</span>
              <span>.TXT</span>
              <span>.SQL</span>
            </div>
          </div>
        </section>
        <aside className="panel process-guide">
          <h3>Como funciona</h3>
          {[
            {
              title: "Importe suas estruturas",
              text: "Selecione os arquivos, confira os nomes e confirme o processamento.",
            },
            {
              title: "Valide e catalogue",
              text: "O sistema identifica objetos e verifica as regras de qualidade.",
            },
            {
              title: "Acompanhe os resultados",
              text: "Consulte o catálogo e os alertas na visão geral.",
            },
          ].map((step, i) => (
            <div key={step.title} className="process-step">
              <span>0{i + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </div>
            </div>
          ))}
        </aside>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Importações desta sessão</h3>
        <span className="text-xs text-slate-500">
          {items.length} arquivo(s)
        </span>
      </div>
      {items.length === 0 && (
        <div className="panel empty-uploads">
          <Icon name="file" />
          <div>
            <strong>Seu próximo catálogo começa aqui.</strong>Selecione um
            arquivo para acompanhar o envio e o processamento.
          </div>
        </div>
      )}
      {items.length > 0 && (
        <div className="bg-white rounded-lg border divide-y">
          {items.map((item) => (
            <div key={item.id} className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {item.file.name}
                </p>
                <p className="text-xs text-slate-500">
                  {(item.file.size / 1024).toFixed(1)} KB ·{" "}
                  <span className={statusColors(item.status).text}>{STATUS_LABEL[item.status]}</span>
                </p>
                <div className="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden">
                  {item.status === "PROCESSING" ? (
                    <div className="h-2 rounded-full bg-amber-500 animate-pulse w-full" />
                  ) : (
                    <div
                      className={`h-2 rounded-full transition-all ${
                        item.status === "ERROR" ? "bg-red-500" : item.status === "DONE" ? "bg-green-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  )}
                </div>
                {item.resultMessage && (
                  <p
                    className={`text-xs mt-1 ${
                      item.status === "ERROR"
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {item.resultMessage}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {item.status === "QUEUED" && (
                  <>
                    <button type="button" onClick={() => uploadFile(item)}
                      aria-label={`Confirmar e processar ${item.file.name}`}
                      className="primary-button text-xs">
                      Confirmar e processar
                    </button>
                    <button type="button" onClick={() => removeItem(item.id)}
                      aria-label={`Remover ${item.file.name} da seleção`}
                      className="text-xs text-slate-500 hover:underline">
                      Remover
                    </button>
                  </>
                )}
                {item.status === "UPLOADING" && (
                  <button
                    onClick={() => cancelUpload(item.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Cancelar
                  </button>
                )}
                {(item.status === "DONE" || item.status === "ERROR") && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
