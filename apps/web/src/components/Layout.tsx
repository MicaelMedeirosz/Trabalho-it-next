import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { Brand, Icon } from "./Brand";
const links = [
  { to: "/", label: "Importar arquivos", icon: "upload" },
  { to: "/dashboard", label: "Visão geral", icon: "grid" },
  { to: "/approvals", label: "Homologação", icon: "shield" },
  { to: "/audit", label: "Auditoria", icon: "clock" },
  { to: "/reports", label: "Relatórios", icon: "chart" },
];
export function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    let active = true;
    async function refresh() {
      try {
        const { data } = await api.get("/approvals");
        if (active) setPendingCount(data.length);
      } catch {
        /* O badge não bloqueia a navegação. */
      }
    }
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user?.role]);
  return (
    <div className="workspace">
      <a href="#main-content" className="skip-link">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">
          <span className="workspace-mark">
            <Icon name="database" />
          </span>
          <div>
            <strong>Catálogo de dados</strong>
            <small>Seu ambiente de trabalho</small>
          </div>
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Navegação principal">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon name={link.icon} />
              <span>{link.label}</span>
              {link.to === "/approvals" && pendingCount > 0 && (
                <span className="notification-count">{pendingCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Icon name="shield" />
            <strong>Do arquivo à confiança.</strong>
            <p>Estruturas organizadas, validadas e prontas para análise.</p>
          </div>
          <a href="https://itnext.com.br/" target="_blank" rel="noreferrer">
            Conheça a ITNEXT <Icon name="arrow" />
          </a>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>
            <strong>
              {links.find((link) => link.to === pathname)?.label ?? "Catálogo"}
            </strong>
          </div>
          <div className="user-menu">
            <div className="avatar">
              {user?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className="user-description">
              <strong>{user?.name}</strong>
              <small>
                {user?.role === "ADMIN"
                  ? "Administrador"
                  : user?.role === "ANALYST"
                    ? "Analista"
                    : "Visualizador"}
              </small>
            </div>
            <button
              onClick={logout}
              className="logout-button"
              aria-label="Sair da conta"
              title="Sair da conta"
            >
              <Icon name="exit" />
            </button>
          </div>
        </header>
        <main id="main-content" className="workspace-main">
          <Outlet />
        </main>
        <footer className="workspace-footer">
          <span>ITNEXT · Inteligência em cada estrutura.</span>
          <span>Catálogo de estruturas de dados</span>
        </footer>
      </div>
    </div>
  );
}
