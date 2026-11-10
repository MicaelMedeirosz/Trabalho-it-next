import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { UserAvatar } from "../components/UserAvatar";
import { Icon } from "../components/Brand";
import type { User } from "../types";

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [cropScale, setCropScale] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [flipped, setFlipped] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const CROP_BOX = 256;

  function getCoverScale(natural: { w: number; h: number } | null) {
    if (!natural) return 1;
    return Math.max(CROP_BOX / natural.w, CROP_BOX / natural.h);
  }

  function clampOffset(offset: { x: number; y: number }, scale: number, natural: { w: number; h: number } | null) {
    if (!natural) return offset;
    const dispW = natural.w * scale;
    const dispH = natural.h * scale;
    const maxX = Math.max(0, (dispW - CROP_BOX) / 2);
    const maxY = Math.max(0, (dispH - CROP_BOX) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, offset.x)),
      y: Math.min(maxY, Math.max(-maxY, offset.y)),
    };
  }

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!cameraOpen) return;
    let active = true;
    let localStream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (!active) { s.getTracks().forEach((t) => t.stop()); return; }
        localStream = s;
        setStream(s);
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
          setCameraOpen(false);
        }
      });
    return () => {
      active = false;
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOpen]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      if (stream) videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [capturedUrl]);

  function selectPhoto(selected: File | undefined) {
    setError(""); setMessage("");
    if (!selected) return;
    setFile(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setError("Selecione uma imagem JPG, PNG ou WebP."); return;
    }
    if (selected.size > 2 * 1024 * 1024) {
      setError("A foto deve ter no máximo 2 MB."); return;
    }
    setFile(selected);
  }

  function openCamera() {
    setError("");
    setCameraOpen(true);
  }

  function closeCamera() {
    setCameraOpen(false);
    setStream(null);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setCapturedUrl(url);
      setImgNatural({ w, h });
      setCropScale(getCoverScale({ w, h }));
      setCropOffset({ x: 0, y: 0 });
      setFlipped(false);
      closeCamera();
      setAdjustOpen(true);
    }, "image/jpeg", 0.92);
  }

  function cancelAdjust() {
    setAdjustOpen(false);
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl);
      setCapturedUrl(null);
    }
    setImgNatural(null);
  }

  function toggleFlip() {
    setFlipped((prev) => !prev);
  }

  function handleZoomChange(value: number) {
    setCropScale(value);
    setCropOffset((prev) => clampOffset(prev, value, imgNatural));
  }

  function handleDragStart(clientX: number, clientY: number) {
    dragRef.current = { startX: clientX, startY: clientY, offsetX: cropOffset.x, offsetY: cropOffset.y };
  }

  function handleDragMove(clientX: number, clientY: number) {
    if (!dragRef.current) return;
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;
    const next = { x: dragRef.current.offsetX + dx, y: dragRef.current.offsetY + dy };
    setCropOffset(clampOffset(next, cropScale, imgNatural));
  }

  function handleDragEnd() {
    dragRef.current = null;
  }

  function confirmAdjust() {
    if (!capturedUrl || !imgNatural) return;
    const img = new Image();
    img.src = capturedUrl;
    img.onload = () => {
      let source: CanvasImageSource = img;
      if (flipped) {
        const flipCanvas = document.createElement("canvas");
        flipCanvas.width = imgNatural.w;
        flipCanvas.height = imgNatural.h;
        const flipCtx = flipCanvas.getContext("2d");
        if (!flipCtx) return;
        flipCtx.translate(imgNatural.w, 0);
        flipCtx.scale(-1, 1);
        flipCtx.drawImage(img, 0, 0);
        source = flipCanvas;
      }

      const outSize = 800;
      const canvas = document.createElement("canvas");
      canvas.width = outSize;
      canvas.height = outSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const outScale = outSize / CROP_BOX;
      const drawW = imgNatural.w * cropScale * outScale;
      const drawH = imgNatural.h * cropScale * outScale;
      const dx = (outSize - drawW) / 2 + cropOffset.x * outScale;
      const dy = (outSize - drawH) / 2 + cropOffset.y * outScale;
      ctx.drawImage(source, dx, dy, drawW, drawH);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const f = new File([blob], "foto-perfil.jpg", { type: "image/jpeg" });
        const url = URL.createObjectURL(f);
        setFile(f);
        setPreview(url);
        URL.revokeObjectURL(capturedUrl);
        setCapturedUrl(null);
        setImgNatural(null);
        setAdjustOpen(false);
      }, "image/jpeg", 0.92);
    };
  }

  async function savePhoto(remove = false) {
    if (!remove && !file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      let profile: User;
      if (remove) {
        const { data } = await api.delete<User>("/auth/me/avatar");
        profile = data;
      } else {
        const body = new FormData();
        body.append("photo", file!);
        const { data } = await api.put<User>("/auth/me/avatar", body);
        profile = data;
      }
      updateProfile(profile);
      setFile(null);
      setMessage(remove ? "Foto removida." : "Foto de perfil atualizada.");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Não foi possível atualizar a foto. Tente novamente.");
    } finally { setBusy(false); }
  }

  if (!user) return null;
  const admin = user.role === "ADMIN";
  const role = admin ? "Administrador" : user.role === "ANALYST" ? "Analista" : "Visualizador";

  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div><p className="section-kicker">SUA CONTA</p><h2>Meu perfil</h2>
          <p>Personalize sua foto e consulte suas permissões no workspace.</p></div>
      </div>
      <div className="profile-grid">
        <section className="panel profile-photo-card" aria-labelledby="profile-photo-heading">
          <UserAvatar user={user} large imageUrl={preview} />
          <h3 id="profile-photo-heading">Foto de perfil</h3>
          <p id="profile-photo-help">JPG, PNG ou WebP de até 2 MB.<br />A foto será ajustada para o formato quadrado.</p>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden
            disabled={busy} aria-label="Escolher foto de perfil" aria-describedby="profile-photo-help"
            onChange={event => { selectPhoto(event.target.files?.[0]); event.target.value = ""; }} />
          <div className="flex items-center gap-2">
            <button type="button" className="profile-secondary-button" disabled={busy}
              onClick={() => input.current?.click()}>{file ? "Escolher outra foto" : "Selecionar foto"}</button>
            <button type="button" className="profile-secondary-button" disabled={busy}
              onClick={openCamera}>{busy ? "..." : "Tirar foto"}</button>
          </div>
          {file && <>
            <button type="button" className="primary-button" disabled={busy} onClick={() => savePhoto()}>
              {busy ? "Salvando..." : "Salvar foto"}
            </button>
            <button type="button" className="text-sm text-slate-500" disabled={busy} onClick={() => setFile(null)}>Cancelar seleção</button>
          </>}
          {user.avatarUrl && !file && <button type="button" className="text-sm text-red-700" disabled={busy}
            onClick={() => savePhoto(true)}>{busy ? "Removendo..." : "Remover foto"}</button>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {message && <p role="status" className="text-sm text-green-700">{message}</p>}
        </section>

        {cameraOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
            role="dialog" aria-modal="true" aria-label="Câmera" onClick={closeCamera}>
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Tirar foto</h3>
                <button type="button" className="text-slate-400 hover:text-slate-700" onClick={closeCamera}>
                  <span className="sr-only">Fechar câmera</span>
                  <Icon name="x" className="w-5 h-5" />
                </button>
              </div>
              <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-100">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 gap-0 p-[1px]">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="border border-white/40" />
                  ))}
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500 text-center">Aponte e toque no botão para capturar</p>
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" className="profile-secondary-button" onClick={closeCamera}>Cancelar</button>
                <button type="button" className="primary-button" onClick={capturePhoto}>
                  <Icon name="camera" className="w-4 h-4" />
                  Capturar
                </button>
              </div>
            </div>
          </div>
        )}

        {adjustOpen && capturedUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
            role="dialog" aria-modal="true" aria-label="Ajustar foto" onClick={cancelAdjust}>
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Ajustar foto</h3>
                <button type="button" className="text-slate-400 hover:text-slate-700" onClick={cancelAdjust}>
                  <span className="sr-only">Fechar ajuste</span>
                  <Icon name="x" className="w-5 h-5" />
                </button>
              </div>
              <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-100 touch-none select-none cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); handleDragStart(e.clientX, e.clientY); }}
                onPointerMove={(e) => handleDragMove(e.clientX, e.clientY)}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragEnd}>
                {imgNatural && (
                  <img src={capturedUrl} alt="Pré-visualização" draggable={false}
                    className="absolute top-1/2 left-1/2 max-w-none pointer-events-none"
                    style={{
                      width: imgNatural.w * cropScale,
                      height: imgNatural.h * cropScale,
                      transform: `translate(-50%, -50%) translate(${cropOffset.x}px, ${cropOffset.y}px)${flipped ? " scaleX(-1)" : ""}`,
                    }} />
                )}
                <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 gap-0 p-[1px]">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="border border-white/40" />
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <label className="text-xs text-slate-500 mb-1">Zoom</label>
                <input type="range"
                  min={getCoverScale(imgNatural)}
                  max={getCoverScale(imgNatural) * 3}
                  step="0.01"
                  value={cropScale}
                  onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                  className="w-full accent-[#3e4095]" />
              </div>
              <div className="mt-5 flex items-center justify-between">
                <button type="button" className="profile-secondary-button" onClick={toggleFlip}>
                  <Icon name="flip" className="w-4 h-4" />
                </button>
                <div className="flex gap-3">
                  <button type="button" className="profile-secondary-button" onClick={cancelAdjust}>Cancelar</button>
                  <button type="button" className="primary-button" onClick={confirmAdjust}>Confirmar</button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="space-y-5">
          <section className="panel profile-info-card" aria-labelledby="profile-info-heading">
            <h3 id="profile-info-heading">Informações da conta</h3>
            <dl className="profile-details">
              <div><dt>Nome completo</dt><dd>{user.name}</dd></div>
              <div><dt>E-mail</dt><dd>{user.email}</dd></div>
              <div><dt>Tipo de conta</dt><dd>{role}</dd></div>
              {user.createdAt && <div><dt>Membro desde</dt><dd>{new Date(user.createdAt).toLocaleDateString("pt-BR")}</dd></div>}
            </dl>
          </section>
          <section className="panel profile-info-card" aria-labelledby="profile-permissions-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 id="profile-permissions-heading">Permissões de acesso</h3>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${admin ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                <Icon name="shield" />{admin ? "Administrador ativo" : "Sem acesso de administrador"}
              </span>
            </div>
            <p className="mt-4 text-sm text-slate-500">{admin
              ? "Você pode aprovar e rejeitar arquivos na Homologação, além de importar e consultar dados."
              : user.role === "ANALYST"
                ? "Você pode importar e consultar dados. Aprovar ou rejeitar arquivos exige uma conta de administrador."
                : "Você pode consultar dados, auditoria e relatórios. Importar e homologar arquivos exige permissões adicionais."}</p>
            <p className="mt-3 text-xs text-slate-500">As permissões são definidas pela administração e não podem ser alteradas no perfil.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
