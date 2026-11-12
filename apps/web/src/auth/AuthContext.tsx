import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, adminCode?: string) => Promise<void>;
  promoteToAdmin: (code: string) => Promise<void>;
  logout: () => void;
  updateProfile: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    const initialToken = localStorage.getItem("token");
    if (!initialToken) return;
    let active = true;
    api.get<User>("/auth/me").then(({ data }) => {
      if (!active || localStorage.getItem("token") !== initialToken) return;
      localStorage.setItem("user", JSON.stringify(data));
      setUser(data);
    }).catch(() => {
      // O interceptor trata sessões expiradas; falhas temporárias preservam a sessão.
    });
    return () => { active = false; };
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  }

  async function register(name: string, email: string, password: string, adminCode?: string) {
    const body: { name: string; email: string; password: string; adminCode?: string } = { name, email, password };
    if (adminCode) body.adminCode = adminCode;
    await api.post("/auth/register", body);
    await login(email, password);
  }

  async function promoteToAdmin(code: string) {
    const { data } = await api.post<{ role: string }>("/auth/me/promote-to-admin", { code });
    const next = { ...user!, role: data.role } as User;
    localStorage.setItem("user", JSON.stringify(next));
    setUser(next);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  function updateProfile(profile: User) {
    localStorage.setItem("user", JSON.stringify(profile));
    setUser(profile);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, promoteToAdmin, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
