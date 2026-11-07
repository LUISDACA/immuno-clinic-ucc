import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CommunicationsPage } from "../communications-page";
import { ThreadDetail } from "../thread-detail";
import { useAuthStore } from "@/lib/auth/store";
import { getThread, listThreads, addMessage, updateThreadStatus } from "@/lib/api/communications";
import { markCategoryRead } from "@/lib/api/notifications";
import type { CommunicationThread, CommunicationThreadListItem } from "@/lib/api/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/api/communications", () => ({ getThread: vi.fn(), listThreads: vi.fn(), searchRecipients: vi.fn(), createThread: vi.fn(), addMessage: vi.fn(), updateThreadStatus: vi.fn() }));
vi.mock("@/lib/api/notifications", () => ({ markCategoryRead: vi.fn(), listNotifications: vi.fn().mockResolvedValue([]) }));
const student = { id: "synthetic-student", name: "Synthetic student", email: "student@example.invalid", role: "student" };
const admin = { id: "synthetic-admin", name: "Synthetic admin", email: "admin@example.invalid", role: "admin" };
const thread: CommunicationThread = { id: "synthetic-thread", subject: "Synthetic subject", status: "open", category: "general", student, created_by: admin, recipient: student, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", last_message_at: "2026-10-01T00:00:00Z", last_message: "Synthetic own body", last_message_sender: student, messages: [{ id: "synthetic-message", body: "Synthetic own body", sender: student, created_at: "2026-10-01T00:00:00Z" }] };
const clients: QueryClient[] = [];
function failure(status: number) { return new AxiosError("Synthetic unsafe diagnostic", undefined, undefined, undefined, { status } as never); }
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({ userId: student.id, role: "student" });
  vi.mocked(getThread).mockResolvedValue(thread);
  vi.mocked(listThreads).mockResolvedValue([]);
  vi.mocked(markCategoryRead).mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });
function mount(component: React.ReactNode, strict = false, cached?: CommunicationThread) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); clients.push(client);
  if (cached) client.setQueryData(["thread", cached.id], cached);
  const tree = (child: React.ReactNode) => <QueryClientProvider client={client}>{strict ? <StrictMode>{child}</StrictMode> : child}</QueryClientProvider>;
  const result = render(tree(component));
  return { client, ...result, change: (child: React.ReactNode) => result.rerender(tree(child)) };
}

it.each(["student", "admin", "app_admin"] as const)("%s: deduplicates read retries, retains draft/error until success and never reviews or sends", async role => {
  useAuthStore.setState({ userId: role, role });
  const pending = deferred<void>();
  vi.mocked(markCategoryRead).mockRejectedValueOnce(failure(503)).mockReturnValueOnce(pending.promise).mockResolvedValue(undefined);
  mount(<ThreadDetail threadId={thread.id} />);
  const retry = await screen.findByRole("button", { name: "Reintentar" });
  fireEvent.change(screen.getByLabelText("Respuesta"), { target: { value: "Synthetic unsent draft" } });
  fireEvent.click(retry); fireEvent.click(retry);
  await waitFor(() => expect(markCategoryRead).toHaveBeenCalledTimes(2));
  expect(retry).toBeDisabled(); expect(retry).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.getByLabelText("Respuesta")).toHaveValue("Synthetic unsent draft");
  await act(async () => pending.reject(failure(503)));
  await waitFor(() => expect(retry).toBeEnabled());
  expect(screen.getByRole("alert")).toBeVisible();
  fireEvent.click(retry);
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(markCategoryRead).toHaveBeenCalledTimes(3);
  expect(markCategoryRead).toHaveBeenLastCalledWith("communication");
  expect(addMessage).not.toHaveBeenCalled(); expect(updateThreadStatus).not.toHaveBeenCalled();
});

it.each(["automatic", "manual"] as const)("ignores late %s read success after a new message fails synchronization", async mode => {
  const old = deferred<void>();
  if (mode === "manual") vi.mocked(markCategoryRead).mockRejectedValueOnce(failure(503));
  vi.mocked(markCategoryRead).mockReturnValueOnce(old.promise).mockRejectedValueOnce(failure(403));
  const { client } = mount(<ThreadDetail threadId={thread.id} />);
  if (mode === "manual") fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
  await waitFor(() => expect(markCategoryRead).toHaveBeenCalledTimes(mode === "manual" ? 2 : 1));
  const invalidate = vi.spyOn(client, "invalidateQueries");
  act(() => client.setQueryData(["thread", thread.id], { ...thread, last_message_at: "2026-10-01T00:01:00Z" }));
  await screen.findByText("No tienes permiso para consultar esta información.");
  await act(async () => old.resolve(undefined));
  expect(screen.getByText("No tienes permiso para consultar esta información.")).toBeVisible();
  expect(invalidate).not.toHaveBeenCalled();
});

it.each(["thread", "owner", "unmount"] as const)("a pending read retry cannot invalidate a later scope: %s", async scope => {
  const old = deferred<void>();
  vi.mocked(markCategoryRead).mockRejectedValueOnce(failure(503)).mockReturnValueOnce(old.promise).mockRejectedValue(failure(404));
  const { client, change, unmount } = mount(<ThreadDetail threadId={thread.id} />);
  fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
  await waitFor(() => expect(markCategoryRead).toHaveBeenCalledTimes(2));
  const invalidate = vi.spyOn(client, "invalidateQueries");
  if (scope === "thread") { vi.mocked(getThread).mockResolvedValue({ ...thread, id: "synthetic-next" }); change(<ThreadDetail threadId="synthetic-next" />); await screen.findByText("No se encontró la información solicitada."); }
  if (scope === "owner") { act(() => useAuthStore.setState({ userId: "synthetic-next-owner" })); await waitFor(() => expect(markCategoryRead).toHaveBeenCalledTimes(3)); }
  if (scope === "unmount") unmount();
  await act(async () => old.resolve(undefined));
  expect(invalidate).not.toHaveBeenCalled();
  if (scope === "thread") expect(screen.getByText("No se encontró la información solicitada.")).toBeVisible();
});

it("StrictMode does not issue an obsolete automatic read write", async () => {
  const { client } = mount(<ThreadDetail threadId={thread.id} />, true, thread);
  const invalidate = vi.spyOn(client, "invalidateQueries");
  await screen.findByLabelText("Respuesta");
  await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
  expect(markCategoryRead).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["notifications"] });
});

for (const page of ["list", "detail"] as const) {
  it(`${page}: loading is not empty or error`, () => {
    if (page === "list") vi.mocked(listThreads).mockReturnValue(new Promise(() => {}));
    else vi.mocked(getThread).mockReturnValue(new Promise(() => {}));
    mount(page === "list" ? <CommunicationsPage /> : <ThreadDetail threadId={thread.id} />);
    expect(screen.getByText("Cargando...")).toBeVisible(); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("No hay conversaciones")).not.toBeInTheDocument(); expect(markCategoryRead).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404, 429, 500, 503])(`${page}: HTTP %s has safe error and a deduplicated loading retry`, async status => {
    const listPending = deferred<CommunicationThreadListItem[]>(), detailPending = deferred<CommunicationThread>();
    if (page === "list") vi.mocked(listThreads).mockRejectedValueOnce(failure(status)).mockReturnValue(listPending.promise);
    else vi.mocked(getThread).mockRejectedValueOnce(failure(status)).mockReturnValue(detailPending.promise);
    mount(page === "list" ? <CommunicationsPage /> : <ThreadDetail threadId={thread.id} />);
    const retry = await screen.findByRole("button", { name: "Reintentar" });
    expect(screen.getByRole("alert")).toBeVisible(); expect(screen.queryByText("Synthetic unsafe diagnostic")).not.toBeInTheDocument();
    expect(screen.queryByText("No hay conversaciones")).not.toBeInTheDocument();
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(page === "list" ? listThreads : getThread).toHaveBeenCalledTimes(2));
    // Without cached data, React Query returns to initial loading on retry.
    expect(await screen.findByText("Cargando...")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    await act(async () => { if (page === "list") listPending.resolve([]); else detailPending.resolve(thread); });
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    if (page === "list") expect(screen.getByText("No hay conversaciones")).toBeVisible();
    else expect(screen.getByRole("heading", { name: thread.subject })).toBeVisible();
  });
  it(`${page}: a retry after cached-data failure keeps its error control busy`, async () => {
    const listPending = deferred<CommunicationThreadListItem[]>(), detailPending = deferred<CommunicationThread>();
    vi.mocked(listThreads).mockResolvedValue([thread]);
    const { client } = mount(page === "list" ? <CommunicationsPage /> : <ThreadDetail threadId={thread.id} />);
    await screen.findByText(thread.subject);
    if (page === "list") vi.mocked(listThreads).mockRejectedValueOnce(failure(503)).mockReturnValue(listPending.promise);
    else vi.mocked(getThread).mockRejectedValueOnce(failure(503)).mockReturnValue(detailPending.promise);
    await act(() => client.invalidateQueries({ queryKey: page === "list" ? ["threads"] : ["thread", thread.id] }));
    const retry = await screen.findByRole("button", { name: "Reintentar" });
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(retry).toBeDisabled());
    expect(retry).toHaveAttribute("aria-busy", "true");
    expect(page === "list" ? listThreads : getThread).toHaveBeenCalledTimes(3);
    await act(async () => { if (page === "list") listPending.resolve([thread]); else detailPending.resolve(thread); });
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
}

it("empty messages remain distinct from a failed thread and retain the reply action", async () => {
  vi.mocked(getThread).mockResolvedValue({ ...thread, messages: [] });
  mount(<ThreadDetail threadId={thread.id} />);
  expect(await screen.findByText("No hay mensajes")).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument(); expect(screen.getByLabelText("Respuesta")).toBeEnabled();
});
it("list refresh failure does not erase an unsent create form", async () => {
  const { client } = mount(<CommunicationsPage />);
  await screen.findByText("No hay conversaciones"); fireEvent.click(screen.getByRole("button", { name: "Nuevo mensaje" }));
  fireEvent.change(screen.getByLabelText("Asunto"), { target: { value: "Synthetic unsent subject" } });
  fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "Synthetic unsent body" } });
  vi.mocked(listThreads).mockRejectedValue(failure(503));
  await act(() => client.invalidateQueries({ queryKey: ["threads"] }));
  expect(await screen.findByRole("alert")).toBeVisible(); expect(screen.getByLabelText("Asunto")).toHaveValue("Synthetic unsent subject");
  expect(screen.getByLabelText("Mensaje")).toHaveValue("Synthetic unsent body");
});
