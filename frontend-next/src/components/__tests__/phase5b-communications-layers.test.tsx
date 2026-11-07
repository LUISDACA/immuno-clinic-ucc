import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { AppShell } from "../app-shell";

const nav = vi.hoisted(() => ({ pathname: "/student/communications" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("@/components/user-menu", () => ({ UserMenu: () => null }));
vi.mock("@/components/theme-toggle", () => ({ ThemeModeToggle: () => null }));
vi.mock("@/lib/api/notifications", () => ({ listNotifications: vi.fn().mockResolvedValue([]) }));
const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

function mount(path: string, content: React.ReactNode = <p>Contenido sintético</p>) {
  nav.pathname = path;
  const client = new QueryClient(); clients.push(client);
  render(<QueryClientProvider client={client}><AppShell title="Synthetic" nav={[]}>{content}</AppShell></QueryClientProvider>);
  return screen.getByRole("banner").parentElement!;
}

it.each([
  "/student/communications", "/student/communications/synthetic-thread", "/student/communications/",
  "/admin/communications", "/admin/communications/synthetic-thread", "/admin/communications/",
  "/admin", "/student/notifications", "/admin/notifications", "/student/profile",
  "/student/change-password", "/admin/change-password", "/admin/students/create", "/admin/profile",
])("places %s above the decoration without clipping its content", path => {
  const root = mount(path);
  expect(root).toHaveClass("relative", "z-0");
  expect(root).not.toHaveClass("overflow-hidden");
  expect(screen.getByRole("main").closest('[aria-hidden="true"]')).toBeNull();
  expect(screen.getByRole("main").closest(".overflow-hidden")).toBeNull();
});

it.each([
  "/student", "/admin/history", "/admin/profile-old", "/admin/profile/extra", "/student/profile-old",
  "/student/communications-old", "/admin/communications-extra", "/admin/students/synthetic-thread",
  "/student/change-password-old", "/admin/change-password-extra", "/admin/students/create-old", "/admin/students/create/extra",
])("preserves the existing layer policy outside scoped routes: %s", path => {
  expect(mount(path)).not.toHaveClass("z-0");
});

it("keeps the composer and feedback outside the hidden decoration and keyboard accessible", async () => {
  const send = vi.fn(), user = userEvent.setup();
  mount("/student/communications/synthetic-thread", <>
    <p role="alert">Mensaje sintético de prueba.</p>
    <label htmlFor="synthetic-reply">Respuesta</label>
    <textarea id="synthetic-reply" />
    <button onClick={send}>Enviar</button>
  </>);
  const reply = screen.getByRole("textbox", { name: "Respuesta" });
  expect(screen.getByRole("alert").closest('[aria-hidden="true"]')).toBeNull();
  await user.click(reply);
  await user.keyboard("Synthetic reply{Tab}{Enter}");
  expect(reply).toHaveValue("Synthetic reply");
  expect(send).toHaveBeenCalledOnce();
});
