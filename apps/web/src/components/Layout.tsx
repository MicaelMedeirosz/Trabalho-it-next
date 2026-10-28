import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";

const links = [
  { to: "/", label: "Upload" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/approvals", label: "Homologação" },
  { to: "/audit", label: "Auditoria" },
  { to: "/reports", label: "Relatórios" },
];

const APPROVALS_POLL_INTERVAL_MS = 30000;

export function Layout() {
  const { user, logout } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;

    let active = true;

    async function fetchPendingCount() {
      try {
        const { data } = await api.get("/approvals");
        if (active) setPendingCount(data.length);
      } catch {
        // falha silenciosa: badge não é crítico para o fluxo principal
      }
    }

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, APPROVALS_POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user?.role]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">ITNEXT — Catalogação de Estruturas de BD</h1>
          <div className="flex items-center gap-4 text-sm">
            <span>{user?.name} ({user?.role})</span>
            <button
              onClick={logout}
              className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded"
            >
              Sair
            </button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 border-t border-slate-800">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `relative px-4 py-2 text-sm flex items-center gap-1.5 ${
                  isActive
                    ? "bg-slate-50 text-slate-900 font-medium rounded-t"
                    : "text-slate-300 hover:text-white"
                }`
              }
            >
              {link.label}
              {link.to === "/approvals" && pendingCount > 0 && (
                <span className="bg-red-600 text-white text-[10px] font-semibold leading-none rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
