import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

import { api, setToken, setUnauthorizedHandler } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "session_token";
const sentIds = new Set<string>();

export type User = {
  user_id: string;
  email: string;
  name?: string;
  picture?: string;
  role: "DEVELOPER" | "OWNER" | "EMPLOYEE" | null;
  employee_type: "FIELD_AGENT" | "ACCOUNTANT" | null;
  org_id: string | null;
  org: any;
};

type Ctx = {
  user: User | null | undefined;
  error: string | null;
  busy: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<Ctx>(null as any);
export const useAuth = () => useContext(AuthContext);

const extractSessionId = (url?: string | null) => {
  const m = url?.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clear = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setToken(null);
    queryClient.clear();
    setUserState(null);
  }, []);

  const exchange = useCallback(async (sid: string) => {
    if (sentIds.has(sid)) return false;
    sentIds.add(sid);
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ session_token: string; user: User }>("/auth/session", {
        method: "POST",
        body: { session_id: sid },
      });
      setToken(r.session_token);
      await storage.secureSet(TOKEN_KEY, r.session_token);
      setUserState(r.user);
      return true;
    } catch (e: any) {
      setError(e.message);
      setUserState(null);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clear();
    });
    (async () => {
      let sid: string | null = null;
      if (Platform.OS === "web") {
        sid = extractSessionId(window.location.href);
      } else {
        sid = extractSessionId(await Linking.getInitialURL());
      }
      if (sid) {
        const ok = await exchange(sid);
        if (ok && Platform.OS === "web") {
          const url = new URL(window.location.href);
          url.searchParams.delete("session_id");
          const hash = url.hash.replace(/^#/, "").split("&").filter((p) => !p.startsWith("session_id=")).join("&");
          url.hash = hash;
          window.history.replaceState(window.history.state, "", url.toString());
        }
        if (ok) return;
      }
      const t = await storage.secureGet(TOKEN_KEY, null);
      if (!t) return setUserState(null);
      setToken(String(t));
      try {
        setUserState(await api<User>("/auth/me"));
      } catch {
        await clear();
      }
    })();
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      const s = extractSessionId(url);
      if (s) exchange(s);
    });
    return () => sub.remove();
  }, [clear, exchange]);

  const login = useCallback(async () => {
    setError(null);
    const redirectUrl = Platform.OS === "web" ? window.location.origin + "/" : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    let captured: string | null = null;
    const sub = Linking.addEventListener("url", ({ url }) => {
      captured = url;
    });
    try {
      const res = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      const url = (res.type === "success" ? res.url : null) ?? captured ?? (await Linking.getInitialURL());
      const sid = extractSessionId(url);
      if (sid) await exchange(sid);
    } catch (e: any) {
      setError(e.message ?? "فشل تسجيل الدخول");
    } finally {
      sub.remove();
    }
  }, [exchange]);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    await clear();
  }, [clear]);

  const refresh = useCallback(async () => {
    try {
      setUserState(await api<User>("/auth/me"));
    } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{ user, error, busy, login, logout, setUser: setUserState, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function homeFor(u: User | null | undefined): string {
  if (!u) return "login";
  if (!u.role) return "activate";
  if (u.role === "DEVELOPER") return "dev";
  const org = u.org;
  if (!org || org.status !== "ACTIVE" || new Date(org.expires_at) < new Date()) return "blocked";
  if (u.role === "OWNER") return "owner";
  return u.employee_type === "ACCOUNTANT" ? "acct" : "dist";
}
