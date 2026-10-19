import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const links = [
  { to: "/", label: "Upload" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/approvals", label: "Homologação" },
  { to: "/audit", label: "Auditoria" },
  { to: "/reports", label: "Relatórios" },
];

export function Layout() {
  const { user, logout } = useAuth();

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
                `px-4 py-2 text-sm ${
                  isActive
                    ? "bg-slate-50 text-slate-900 font-medium rounded-t"
                    : "text-slate-300 hover:text-white"
                }`
              }
            >
              {link.label}
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
