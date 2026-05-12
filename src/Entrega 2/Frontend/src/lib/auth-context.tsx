import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@/lib/api";
import { api } from "@/lib/api";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<User>;
  register: (nome: string, sobrenome: string, email: string, senha: string) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const persist = (u: User | null) => {
    setUser(u);
    if (typeof window === "undefined") return;
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
  };

  const value: AuthContextValue = {
    user,
    loading,
    async login(email, senha) {
      const { user } = await api.auth.login({ email, senha });
      persist(user);
      return user;
    },
    async register(nome, sobrenome, email, senha) {
      const { user } = await api.auth.register({ nome, sobrenome, email, senha });
      persist(user);
      return user;
    },
    logout() {
      persist(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
