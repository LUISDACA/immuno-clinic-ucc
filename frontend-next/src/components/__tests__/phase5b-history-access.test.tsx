import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AdminLayout from "@/app/admin/layout";
import HistoryLayout from "@/app/admin/history/layout";
import { useAuthStore } from "@/lib/auth/store";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), path: "/admin/history" }));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => navigation.path,
}));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ nav, children }: { nav: Array<{ href: string; label: string }>; children: ReactNode }) => (
    <div>
      <nav>{nav.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
      {children}
    </div>
  ),
}));

beforeEach(() => {
  navigation.replace.mockReset();
  navigation.path = "/admin/history";
  useAuthStore.setState({
    isAuthenticated: true,
    isHydrated: true,
    role: "app_admin",
    mustChangePassword: false,
    checkSession: vi.fn().mockResolvedValue(undefined),
  });
});
afterEach(cleanup);

it("allows app_admin to open history and exposes the history navigation link", () => {
  render(<AdminLayout><HistoryLayout><p>Authorized synthetic history</p></HistoryLayout></AdminLayout>);
  expect(screen.getByText("Authorized synthetic history")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Historial" })).toHaveAttribute("href", "/admin/history");
  expect(navigation.replace).not.toHaveBeenCalled();
});

it("keeps history unavailable to students", () => {
  useAuthStore.setState({ role: "student" });
  render(<HistoryLayout><p>Authorized synthetic history</p></HistoryLayout>);
  expect(screen.queryByText("Authorized synthetic history")).not.toBeInTheDocument();
  expect(navigation.replace).toHaveBeenCalledWith("/admin");
});
