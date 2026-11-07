import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import fixture from "../../../../docs/ui/fixtures/phase5b-communications-peer.json";
import { ThreadRow } from "../thread-row";
import { ThreadDetail } from "../thread-detail";
import { useAuthStore } from "@/lib/auth/store";
import { getThread, addMessage, updateThreadStatus } from "@/lib/api/communications";
import { markCategoryRead } from "@/lib/api/notifications";
import type { CommunicationThread, ConversationUser, Role } from "@/lib/api/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/api/communications", () => ({
  getThread: vi.fn(), addMessage: vi.fn(), updateThreadStatus: vi.fn(),
}));
vi.mock("@/lib/api/notifications", () => ({
  listNotifications: vi.fn().mockResolvedValue([]),
  markCategoryRead: vi.fn().mockResolvedValue(undefined),
}));
const clients: QueryClient[] = [];
beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

function mount(component: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}>{component}</QueryClientProvider>);
}
function user(key: string | null): ConversationUser | null {
  return key ? fixture.users[key as keyof typeof fixture.users] : null;
}
function thread(test: typeof fixture.cases[number]): CommunicationThread {
  return {
    id: "synthetic-thread", subject: "Synthetic subject", status: "open", category: "general",
    student: user(test.student)!, created_by: user(test.created_by), recipient: user(test.recipient),
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    last_message_at: "2026-01-01T00:00:00Z", last_message: null, last_message_sender: null, messages: [],
  };
}

it.each(fixture.cases)("list identifies the counterpart: $name", async test => {
  const viewer = user(test.viewer)!;
  useAuthStore.setState({ userId: viewer.id, role: viewer.role as Role });
  mount(<ul><ThreadRow thread={thread(test)} basePath={viewer.role === "student" ? "/student" : "/admin"} /></ul>);
  const row = screen.getByRole("link");
  expect(row).toHaveTextContent(user(test.peer)!.name!);
  expect(row).not.toHaveTextContent(viewer.name!);
  expect(row.getAttribute("href")).toBe(`${viewer.role === "student" ? "/student" : "/admin"}/communications/synthetic-thread`);
  expect(addMessage).not.toHaveBeenCalled();
  expect(updateThreadStatus).not.toHaveBeenCalled();
});

it('limits the last-message preview to the same single line as Flutter', async () => {
  const test = fixture.cases[0];
  const viewer = user(test.viewer)!;
  const longMessage = 'Synthetic conversation preview that continues beyond one line '.repeat(3).trim();
  useAuthStore.setState({ userId: viewer.id, role: viewer.role as Role });
  mount(<ul><ThreadRow thread={{ ...thread(test), last_message: longMessage }} basePath="/student" /></ul>);

  const preview = await screen.findByText(longMessage);
  expect(preview).toHaveClass('line-clamp-1');
  expect(preview).not.toHaveClass('line-clamp-2');
});

it.each(fixture.cases)("detail identifies the same counterpart: $name", async test => {
  const viewer = user(test.viewer)!;
  useAuthStore.setState({ userId: viewer.id, role: viewer.role as Role });
  vi.mocked(getThread).mockResolvedValue(thread(test));
  mount(<ThreadDetail threadId="synthetic-thread" />);
  const heading = await screen.findByRole("heading", { name: "Synthetic subject" });
  expect(heading.parentElement).toHaveTextContent(user(test.peer)!.name!);
  expect(heading.parentElement).not.toHaveTextContent(viewer.name!);
  expect(addMessage).not.toHaveBeenCalled();
  expect(updateThreadStatus).not.toHaveBeenCalled();
  expect(markCategoryRead).toHaveBeenCalledWith("communication");
});

it.each(["list", "detail"] as const)("%s hides a recipient when no other participant is identifiable", async view => {
  const viewer = user("student")!;
  const ownOnlyThread = {
    ...thread(fixture.cases[0]),
    student: viewer,
    created_by: viewer,
    recipient: null,
  };
  useAuthStore.setState({ userId: viewer.id, role: viewer.role as Role });

  if (view === "list") {
    mount(<ul><ThreadRow thread={ownOnlyThread} basePath="/student" /></ul>);
    expect(screen.getByRole("link")).toHaveTextContent("Synthetic subject");
    expect(screen.queryByText(viewer.name!)).not.toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  } else {
    vi.mocked(getThread).mockResolvedValue(ownOnlyThread);
    mount(<ThreadDetail threadId="synthetic-thread" />);
    const heading = await screen.findByRole("heading", { name: "Synthetic subject" });
    expect(heading.parentElement).not.toHaveTextContent(viewer.name!);
    expect(heading.parentElement).not.toHaveTextContent("—");
  }
});

it.each(["list", "detail"] as const)("%s hides participant identity when viewer id is unavailable", async view => {
  const test = fixture.cases[0];
  const viewer = user(test.viewer)!;
  useAuthStore.setState({ userId: null, role: viewer.role as Role });
  const threadData = thread(test);

  if (view === "list") {
    mount(<ul><ThreadRow thread={threadData} basePath="/student" /></ul>);
    const row = screen.getByRole("link");
    expect(row).toHaveTextContent("Synthetic subject");
    expect(row).not.toHaveTextContent(viewer.name!);
    expect(row).not.toHaveTextContent(user(test.peer)!.name!);
  } else {
    vi.mocked(getThread).mockResolvedValue(threadData);
    mount(<ThreadDetail threadId="synthetic-thread" />);
    const heading = await screen.findByRole("heading", { name: "Synthetic subject" });
    expect(heading.parentElement).not.toHaveTextContent(viewer.name!);
    expect(heading.parentElement).not.toHaveTextContent(user(test.peer)!.name!);
  }
});
