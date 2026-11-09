import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { UserAvatar } from "../components/UserAvatar";
import { Icon } from "../components/Brand";
import type { User } from "../types";

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

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
          <button type="button" className="profile-secondary-button" disabled={busy}
            onClick={() => input.current?.click()}>{file ? "Escolher outra foto" : "Selecionar foto"}</button>
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
