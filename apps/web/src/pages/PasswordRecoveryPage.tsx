import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Brand } from "../components/Brand";

export function PasswordRecoveryPage({ reset = false }: { reset?: boolean }) {
  // Keep the token out of query strings, referrers and browser history.
  const [token] = useState(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    return value;
  });
  useEffect(() => {
    if (reset) window.history.replaceState(null, "", window.location.pathname);
  }, [reset]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const invalidToken = reset && !/^[a-f0-9]{64}$/.test(token);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (reset && password !== confirmation) return setError("As senhas não coincidem.");
    if (reset && new TextEncoder().encode(password).length > 72) return setError("A senha deve ter no máximo 72 bytes.");
    setLoading(true);
    try {
      const response = await api.post(reset ? "/auth/reset-password" : "/auth/forgot-password",
        reset ? { token, password } : { email: email.trim() });
      setMessage(response.data.message);
      setPassword(""); setConfirmation("");
      if (reset) { localStorage.removeItem("token"); localStorage.removeItem("user"); }
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Não foi possível concluir. Tente novamente.");
    } finally { setLoading(false); }
  }
  return <div className="recovery-page">
    <main className="recovery-card">
      <Brand />
      <h1>{reset ? "Crie uma nova senha" : "Esqueceu sua senha?"}</h1>
      <p className="auth-description">{reset ? "Escolha uma senha de pelo menos 12 caracteres." : "Informe o e-mail da sua conta para receber o link de recuperação."}</p>
      {message ? <p role="status" className="recovery-success">{message}</p> : invalidToken ?
        <p role="alert" className="form-error">Link inválido ou ausente. Solicite uma nova recuperação.</p> :
        <form onSubmit={submit} className="space-y-5">
          {reset ? <>
            <div><label htmlFor="new-password">Nova senha</label><input id="new-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} disabled={loading} /></div>
            <div><label htmlFor="confirm-password">Confirme a nova senha</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={loading} /></div>
            <p className="field-help">Use pelo menos 12 caracteres (máximo de 72 bytes).</p>
          </> : <div><label htmlFor="recovery-email">E-mail</label><input id="recovery-email" type="email" autoComplete="email" required maxLength={254} placeholder="voce@empresa.com.br" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} /></div>}
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="primary-button auth-submit" disabled={loading} type="submit">{loading ? "Aguarde..." : reset ? "Salvar nova senha" : "Enviar link de recuperação"}</button>
        </form>}
      <div className="recovery-links">
        <Link to="/login">Voltar para entrar</Link>
        {reset && !message && <Link to="/forgot-password">Solicitar novo link</Link>}
      </div>
    </main>
  </div>;
}
