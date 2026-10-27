import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, authToken, setAuthToken } from "@/lib/api";
import type { User } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  register: (input: { name: string; email?: string; phone?: string; password: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authToken()) {
      setReady(true);
      return;
    }
    api
      .me()
      .then((result) => setUser(result.user))
      .catch((error) => {
        console.error("Failed to restore session", error);
        setAuthToken(null);
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      async register(input) {
        const result = await api.register(input);
        setAuthToken(result.token);
        setUser(result.user);
      },
      async login(input) {
        const result = await api.login(input);
        setAuthToken(result.token);
        setUser(result.user);
      },
      async logout() {
        try {
          await api.logout();
        } catch (error) {
          console.error("Logout request failed", error);
        }
        setAuthToken(null);
        setUser(null);
      },
      refresh(next) {
        setUser(next);
      },
    }),
    [ready, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
