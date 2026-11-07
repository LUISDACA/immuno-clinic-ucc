import type { CommunicationThreadListItem, ConversationUser } from "@/lib/api/types";

// Presentation only: show a counterpart only when FastAPI identifies someone
// other than the viewer. A missing counterpart stays hidden.
export function communicationPeer(
  thread: Pick<CommunicationThreadListItem, "recipient" | "created_by" | "student">,
  currentUserId: string | null,
): ConversationUser | null {
  // Without an authenticated viewer id, the client cannot safely tell who is
  // the counterpart. Fail closed instead of treating every participant as one.
  if (!currentUserId) return null;

  return [thread.recipient, thread.created_by, thread.student].find(
    user => user != null && user.id !== currentUserId,
  ) ?? null;
}
