import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Brand, Icon } from "../components/Brand";
export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
      navigate("/");
    } catch (err: any) {
      setError(
        err.response?.data?.error ??
          "Não foi possível entrar. Verifique seus dados e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Brand light />
        <div className="auth-story-content">
          <p className="eyebrow">DADOS COM DIREÇÃO</p>
          <h1>
            Organize estruturas.
            <br />
            Conecte possibilidades<span>.</span>
          </h1>
          <p className="auth-intro">
            Transforme arquivos em um catálogo de dados confiável. Da primeira
            importação à aprovação final, tudo em um só lugar.
          </p>
          <div className="data-illustration" aria-hidden="true">
            <div className="data-source">
              <span>.csv</span>
              <span>.sql</span>
              <span>.txt</span>
            </div>
            <div className="flow-line" />
            <div className="data-core">
              <Icon name="database" />
              <span>Seu catálogo</span>
              <small>Estruturado. Conectado.</small>
            </div>
            <div className="data-check">
              <Icon name="shield" />
              <span>Qualidade em cada etapa</span>
            </div>
          </div>
          <div className="auth-benefits">
            <span>
              <Icon name="upload" />
              Importe
            </span>
            <span>
              <Icon name="shield" />
              Valide
            </span>
            <span>
              <Icon name="chart" />
              Analise
            </span>
          </div>
        </div>
        <div className="auth-story-footer">
          ENGENHARIA DE DADOS · METADADOS · GOVERNANÇA · INTELIGÊNCIA
        </div>
      </section>
      <section className="auth-form-panel">
        <a
          className="auth-site"
          href="https://itnext.com.br/"
          target="_blank"
          rel="noreferrer"
        >
          Conheça a ITNEXT <Icon name="arrow" />
        </a>
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <span className="section-kicker">SEU DATA WORKSPACE</span>
          <h2>
            {mode === "login"
              ? "Bem-vindo de volta."
              : "Seu próximo passo começa aqui."}
          </h2>
          <p className="auth-description">
            {mode === "login"
              ? "Acesse sua conta e dê continuidade aos seus dados."
              : "Crie sua conta para organizar e analisar suas estruturas."}
          </p>
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "register" && (
              <div>
                <label htmlFor="name">Nome completo</label>
                <input
                  id="name"
                  autoComplete="name"
                  placeholder="Como podemos chamar você?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            )}
            <div>
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password">Senha</label>
              <div className="password-field">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === "register" ? 12 : 1}
                  disabled={loading}
                />
                <button
                  type="button"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              {mode === "register" && (
                <p className="field-help">Use pelo menos 12 caracteres (máximo de 72 bytes).</p>
              )}
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="primary-button auth-submit"
            >
              {loading
                ? "Aguarde..."
                : mode === "login"
                  ? "Acessar workspace"
                  : "Criar minha conta"}
              <Icon name="arrow" />
            </button>
          </form>
          <div className="auth-switch">
            {mode === "login"
              ? "Ainda não tem uma conta?"
              : "Já faz parte do workspace?"}{" "}
            <button
              disabled={loading}
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
            >
              {mode === "login" ? "Cadastre-se" : "Entrar"}
            </button>
          </div>
          <div className="auth-caption">
            <Icon name="database" />
            <span>Um lugar para transformar estruturas em conhecimento.</span>
          </div>
        </div>
        <footer className="auth-footer">
          ITNEXT · Dados que impulsionam negócios.
        </footer>
      </section>
    </div>
  );
}
