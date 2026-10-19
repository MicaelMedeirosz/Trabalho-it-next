import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { api } from "../api/client";

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "QUEUED" | "UPLOADING" | "PROCESSING" | "DONE" | "ERROR";
  resultMessage?: string;
  controller: AbortController;
}

const STATUS_LABEL: Record<UploadItem["status"], string> = {
  QUEUED: "Na fila",
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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newItems: UploadItem[] = acceptedFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: "QUEUED",
      controller: new AbortController(),
    }));
    setItems((prev) => [...prev, ...newItems]);
    newItems.forEach(uploadFile);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: true,
  });

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function uploadFile(item: UploadItem) {
    updateItem(item.id, { status: "UPLOADING" });
    const formData = new FormData();
    formData.append("files", item.file);
    try {
      const { data } = await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        signal: item.controller.signal,
        onUploadProgress: (evt) => {
          const progress = evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0;
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
        updateItem(item.id, { status: "ERROR", resultMessage: "Upload cancelado." });
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
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Upload de Arquivos</h2>
        <p className="text-sm text-slate-500">
          Formatos suportados: .csv, .txt, .sql — arraste e solte ou selecione múltiplos arquivos.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition ${
          isDragActive ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-white"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-slate-600">
          {isDragActive ? "Solte os arquivos aqui..." : "Arraste arquivos aqui ou clique para selecionar"}
        </p>
      </div>

      {items.length > 0 && (
        <div className="bg-white rounded-lg border divide-y">
          {items.map((item) => (
            <div key={item.id} className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{item.file.name}</p>
                <p className="text-xs text-slate-500">
                  {(item.file.size / 1024).toFixed(1)} KB · {STATUS_LABEL[item.status]}
                </p>
                <div className="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden">
                  {item.status === "PROCESSING" ? (
                    <div className="h-2 rounded-full bg-amber-500 animate-pulse w-full" />
                  ) : (
                    <div
                      className={`h-2 rounded-full transition-all ${
                        item.status === "ERROR" ? "bg-red-500" : "bg-slate-900"
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  )}
                </div>
                {item.resultMessage && (
                  <p
                    className={`text-xs mt-1 ${
                      item.status === "ERROR" ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {item.resultMessage}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
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
