import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/lib/auth/store";
import * as auth from "@/lib/auth/api";
import { getMe, getMeWithTimeout } from "@/lib/api/users";

import { getQueryClient } from "@/lib/query/provider";
import { validateStrongPassword } from "@/lib/password";
import { isAdminRole, isAppAdminRole } from "@/lib/config";

vi.mock("@/lib/auth/api", () => ({ login: vi.fn(), logout: vi.fn() }));
vi.mock("@/lib/api/users", () => ({ getMe: vi.fn(), getMeWithTimeout: vi.fn() }));
const user = { id: "synthetic", email: "student@example.invalid", role: "student" as const, is_active: true, must_change_password: true, created_at: "2026-01-01", profile: null };

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(auth.logout).mockResolvedValue();
  vi.mocked(getMeWithTimeout).mockResolvedValue(user);
  await useAuthStore.getState().logout();
  localStorage.clear();
});
describe("session contract", () => {
  it("loads identity from the API and preserves forced password change", async () => {
    vi.mocked(auth.login).mockResolvedValue({ must_change_password: true });
    vi.mocked(getMe).mockResolvedValue(user);
    await useAuthStore.getState().login(user.email, "SyntheticOnly123!");
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, role: "student", userId: user.id, mustChangePassword: true });
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });
  it("clears tokens when profile validation fails", async () => {
    vi.mocked(auth.login).mockResolvedValue({ must_change_password: true });
    vi.mocked(getMe).mockRejectedValue(new Error("Unavailable"));
    await useAuthStore.getState().login(user.email, "SyntheticOnly123!");
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
  it("maps the backend 401 login detail to the same safe Spanish message as Flutter", async () => {
    vi.mocked(auth.login).mockRejectedValue(Object.assign(new Error("private diagnostic"), {
      isAxiosError: true,
      response: { status: 401, data: { detail: "Invalid email or password" } },
    }));

    await useAuthStore.getState().login(user.email, "SyntheticOnly123!");

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      errorMessage: "Correo o contraseña incorrectos",
    });
    expect(useAuthStore.getState().errorMessage).not.toContain("Invalid email");
  });
  it("validates restored sessions instead of trusting a stored role", async () => {
    localStorage.setItem("user_role", "app_admin");
    vi.mocked(getMe).mockResolvedValue(user);
    await useAuthStore.getState().checkSession();
    expect(useAuthStore.getState().role).toBe("student");
  });
  it("bounds startup session restoration to match Flutter's four-second profile timeout", async () => {
    vi.mocked(getMeWithTimeout).mockRejectedValue(new Error("timeout"));
    await useAuthStore.getState().checkSession();
    expect(getMeWithTimeout).toHaveBeenCalledWith(4_000);
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      isHydrated: true,
      isLoading: false,
    });
  });
  it("clears cached credentials and clinical data when restored profile lookup fails", async () => {
    localStorage.setItem("access_token", "synthetic-access");
    localStorage.setItem("refresh_token", "synthetic-refresh");
    getQueryClient().setQueryData(["scheme", "me"], { synthetic: true });
    vi.mocked(getMeWithTimeout).mockRejectedValue(new Error("synthetic unavailable"));

    await useAuthStore.getState().checkSession();

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      isHydrated: true,
      role: null,
      userId: null,
    });
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
    expect(getQueryClient().getQueryData(["scheme", "me"])).toBeUndefined();
  });
  it("clears clinical query data and revokes refresh on logout", async () => {
    getQueryClient().setQueryData(["scheme", "me"], { synthetic: true });
    await useAuthStore.getState().logout();
    expect(auth.logout).toHaveBeenCalledWith();
    expect(getQueryClient().getQueryData(["scheme", "me"])).toBeUndefined();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });
  it("does not restore a session after logout races with profile loading", async () => {
    let finish!: (value: typeof user) => void;
    vi.mocked(getMe).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const restoring = useAuthStore.getState().checkSession();
    await useAuthStore.getState().logout();
    finish(user);
    await restoring;
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
it("validates password and role helpers against supported contracts", () => {
  expect(validateStrongPassword("Weakpass")).not.toBeNull();
  expect(validateStrongPassword("SyntheticOnly123!")).toBeNull();
  expect(validateStrongPassword("SyntheticOnly²!")).toBeNull();
  expect(validateStrongPassword("SyntheticOnly½!")).not.toBeNull();
  expect(isAdminRole("student")).toBe(false);
  expect(isAdminRole("admin")).toBe(true);
  expect(isAppAdminRole("admin")).toBe(false);
});
