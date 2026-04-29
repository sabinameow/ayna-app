import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { api } from "@/api/client";
import type { User } from "@/types/api";

type SessionState = {
  accessToken: string;
  refreshToken: string;
};

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    full_name: string;
    email: string;
    phone?: string;
    password: string;
    password_confirm: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const STORAGE_KEY = "ayna.session";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setLoading(false);
        return;
      }
      const parsed = JSON.parse(raw) as SessionState;
      setSession(parsed);
      const me = await api.me(parsed.accessToken);
      setUser(me);
    } catch {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setSession(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function persist(next: SessionState | null) {
    setSession(next);
    if (next) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }

  async function login(email: string, password: string) {
    const tokens = await api.login(email, password);
    const next = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
    await persist(next);
    const me = await api.me(next.accessToken);
    setUser(me);
  }

  async function register(payload: {
    full_name: string;
    email: string;
    phone?: string;
    password: string;
    password_confirm: string;
  }) {
    await api.register(payload);
    await login(payload.email, payload.password);
  }

  async function logout() {
    await persist(null);
    setUser(null);
  }

  async function refreshUser() {
    if (!session?.accessToken) return;
    const me = await api.me(session.accessToken);
    setUser(me);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken: session?.accessToken ?? null,
      loading,
      login,
      register,
      logout,
      refreshUser,
    }),
    [loading, session?.accessToken, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
