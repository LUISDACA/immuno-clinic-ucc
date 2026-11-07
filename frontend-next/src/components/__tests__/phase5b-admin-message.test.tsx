import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import Admins from "@/app/admin/admins/page";
import { createAdmin, deleteAdmin, getAcademicOptions, listAdmins } from "@/lib/api/admin";
import { createThread } from "@/lib/api/communications";
import { useAuthStore } from "@/lib/auth/store";
import type { User } from "@/lib/api/types";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/lib/api/admin", () => ({ createAdmin: vi.fn(), deleteAdmin: vi.fn(), getAcademicOptions: vi.fn(), listAdmins: vi.fn() }));
vi.mock("@/lib/api/communications", () => ({ createThread: vi.fn() }));

const prototype = HTMLDialogElement.prototype;
const originalShow = Object.getOwnPropertyDescriptor(prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(prototype, "close");
Object.defineProperty(prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
Object.defineProperty(prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
afterAll(() => {
  if (originalShow) Object.defineProperty(prototype, "showModal", originalShow); else Reflect.deleteProperty(prototype, "showModal");
  if (originalClose) Object.defineProperty(prototype, "close", originalClose); else Reflect.deleteProperty(prototype, "close");
});

const admin = { id: "synthetic-admin-id", email: "admin@example.invalid", role: "admin", is_active: true, profile: { first_name: "Synthetic", last_name: "Admin", program: "Programa de prueba", campus: "Sede de prueba" } } as User;
const clients: QueryClient[] = [];
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><Admins /></QueryClientProvider>);
  await screen.findByText(admin.email);
  await userEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
  return client;
}
async function fill() {
  await userEvent.type(screen.getByLabelText("Asunto"), "Consulta de prueba");
  await userEvent.type(screen.getByLabelText("Mensaje"), "Contenido sintético");
}
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ userId: "synthetic-app-admin", role: "app_admin", isAuthenticated: true });
  vi.mocked(listAdmins).mockResolvedValue([admin]);
  vi.mocked(getAcademicOptions).mockResolvedValue({ programs: ["Medicina"], campuses: ["Bogotá"], semesters: Array.from({ length: 10 }, (_, i) => i + 1) });
  vi.mocked(createAdmin).mockResolvedValue(admin);
  vi.mocked(deleteAdmin).mockResolvedValue(undefined);
  vi.mocked(createThread).mockResolvedValue({ id: "synthetic-thread-id" } as never);
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

it("opens a labeled dialog for the selected administrator and validates without writing", async () => {
  await mount();
  expect(screen.getByRole("dialog", { name: "Mensaje a Synthetic Admin" })).toBeVisible();
  expect(screen.getByLabelText("Asunto")).toBeVisible();
  expect(screen.getByLabelText("Mensaje")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Escribe un asunto y un mensaje.");
  expect(createThread).not.toHaveBeenCalled();
});

it("creates the existing admin thread contract and returns to the thread", async () => {
  await mount(); await fill();
  await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
  await waitFor(() => expect(createThread).toHaveBeenCalledTimes(1));
  expect(createThread).toHaveBeenCalledWith({ subject: "Consulta de prueba", message: "Contenido sintético", category: "admin", admin_id: admin.id }, expect.any(Object));
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/admin/communications/synthetic-thread-id?returnTo=%2Fadmin%2Fadmins"));
});

it("coalesces duplicate submit while the request is pending", async () => {
  const write = deferred<{ id: string }>();
  vi.mocked(createThread).mockReturnValue(write.promise as never);
  await mount(); await fill();
  const submit = screen.getByRole("button", { name: "Enviar" });
  act(() => { fireEvent.submit(screen.getByRole("form", { name: "Enviar mensaje a administrador" })); fireEvent.submit(screen.getByRole("form", { name: "Enviar mensaje a administrador" })); });
  await waitFor(() => expect(createThread).toHaveBeenCalledTimes(1));
  expect(submit).toBeDisabled();
  await act(async () => { write.resolve({ id: "synthetic-thread-id" }); });
});

it("shows a safe error and retains the draft when thread creation fails", async () => {
  vi.mocked(createThread).mockRejectedValue(new Error("synthetic transport diagnostic"));
  await mount(); await fill();
  await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo enviar el mensaje.");
  expect(screen.getByLabelText("Asunto")).toHaveValue("Consulta de prueba");
  expect(screen.getByLabelText("Mensaje")).toHaveValue("Contenido sintético");
  expect(screen.queryByText("synthetic transport diagnostic")).not.toBeInTheDocument();
  expect(navigation.push).not.toHaveBeenCalled();
});
