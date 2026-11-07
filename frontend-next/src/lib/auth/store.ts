"use client";

import { create } from "zustand";
import { isAxiosError } from "axios";
import * as auth from "@/lib/auth/api";
import { getMe, getMeWithTimeout } from "@/lib/api/users";
import { clearSession } from "@/lib/api/client";
import { clearQueryCache } from "@/lib/query/provider";
import type { Role, User } from "@/lib/api/types";

const anonymous = { isAuthenticated: false, role: null, userId: null, email: null, mustChangePassword: false };
function identity(user: User) {
  if (!user.is_active || !["student", "admin", "app_admin"].includes(user.role)) throw new Error("Cuenta no disponible");
  return { isAuthenticated: true, role: user.role, userId: user.id, email: user.email, mustChangePassword: user.must_change_password };
}
interface AuthState {
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  role: Role | null;
  userId: string | null;
  email: string | null;
  mustChangePassword: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  expire: () => void;
  checkSession: () => Promise<void>;
  markPasswordChanged: () => void;
}
let sessionRequest: Promise<void> | undefined;
let generation = 0;
export const useAuthStore = create<AuthState>((set) => ({
  ...anonymous, isHydrated: false, isLoading: false, errorMessage: null,
  async login(email, password) {
    const current = ++generation;
    clearSession();
    clearQueryCache();
    set({ ...anonymous, isLoading: true, errorMessage: null });
    try {
      const tokens = await auth.login(email, password);
      if (current !== generation) return;
      const user = await getMe();
      if (current !== generation) return;
      set({ ...identity(user), mustChangePassword: tokens.must_change_password || user.must_change_password });
    } catch (error) {
      if (current !== generation) return;
      clearSession();
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const detail = isAxiosError(error) ? error.response?.data?.detail : undefined;
      const errorMessage = status === 401
        ? "Correo o contraseña incorrectos"
        : typeof detail === "string" ? detail : "No se pudo iniciar sesión";
      set({ ...anonymous, errorMessage });
    } finally {
      if (current === generation) set({ isLoading: false, isHydrated: true });
    }
  },
  expire() {
    ++generation;
    clearSession();
    clearQueryCache();
    set({ ...anonymous, isHydrated: true, isLoading: false, errorMessage: "Tu sesión expiró. Inicia sesión nuevamente." });
  },
  async logout() {
    ++generation;
    clearSession();
    clearQueryCache();
    set({ ...anonymous, isHydrated: true, isLoading: false, errorMessage: null });
    await auth.logout().catch(() => undefined);
  },
  checkSession() {
    if (sessionRequest) return sessionRequest;
    const current = generation;
    sessionRequest = (async () => {
      try {
        // Keep startup restoration bounded like the Flutter splash flow.
        const user = await getMeWithTimeout(4_000);
        if (current === generation) set(identity(user));
      } catch {
        if (current === generation) {
          clearSession();
          clearQueryCache();
          set(anonymous);
        }
      } finally {
        if (current === generation) set({ isHydrated: true });
      }
    })().finally(() => { sessionRequest = undefined; });
    return sessionRequest;
  },
  markPasswordChanged() { set({ mustChangePassword: false }); },
}));
