import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthGate } from "@/components/auth-gate";
import { useAuthStore } from "@/lib/auth/store";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), path: "/admin" }));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => navigation.path,
}));
beforeEach(() => {
  navigation.replace.mockReset();
  navigation.path = "/admin";
  useAuthStore.setState({ isAuthenticated: true, isHydrated: true, role: "student", mustChangePassword: false, checkSession: vi.fn().mockResolvedValue(undefined) });
});
afterEach(cleanup);

it("does not mount admin content while redirecting a student", () => {
  render(<AuthGate requireRole="admin"><div>Protected data</div></AuthGate>);
  expect(screen.queryByText("Protected data")).toBeNull();
  expect(navigation.replace).toHaveBeenCalledWith("/student");
});
it("hides normal pages until the required password change", () => {
  navigation.path = "/student";
  useAuthStore.setState({ mustChangePassword: true });
  render(<AuthGate requireRole="student"><div>Protected data</div></AuthGate>);
  expect(screen.queryByText("Protected data")).toBeNull();
  expect(navigation.replace).toHaveBeenCalledWith("/student/change-password");
});
it("allows the forced password change page", () => {
  navigation.path = "/student/change-password";
  useAuthStore.setState({ mustChangePassword: true });
  render(<AuthGate requireRole="student"><div>Change password</div></AuthGate>);
  expect(screen.getByText("Change password")).toBeInTheDocument();
});
it("renders content for an allowed app administrator", () => {
  useAuthStore.setState({ role: "app_admin" });
  render(<AuthGate requireRole="app_admin"><div>Protected data</div></AuthGate>);
  expect(screen.getByText("Protected data")).toBeInTheDocument();
});
