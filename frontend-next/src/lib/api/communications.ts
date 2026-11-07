import { apiClient } from "@/lib/api/client";
import {
  CommunicationThread,
  CommunicationThreadListItem,
  ConversationStatus,
  ConversationUser,
} from "@/lib/api/types";

export async function listThreads(): Promise<CommunicationThreadListItem[]> {
  const { data } = await apiClient.get<CommunicationThreadListItem[]>(
    "/communications/threads",
  );
  return data;
}

export async function getThread(threadId: string): Promise<CommunicationThread> {
  const { data } = await apiClient.get<CommunicationThread>(
    `/communications/threads/${threadId}`,
  );
  return data;
}

export async function createThread(payload: {
  subject: string;
  message: string;
  category?: string | null;
  student_id?: string | null;
  admin_id?: string | null;
}): Promise<CommunicationThread> {
  const { data } = await apiClient.post<CommunicationThread>(
    "/communications/threads",
    payload,
  );
  return data;
}

export async function addMessage(
  threadId: string,
  message: string,
): Promise<CommunicationThread> {
  const { data } = await apiClient.post<CommunicationThread>(
    `/communications/threads/${threadId}/messages`,
    { message },
  );
  return data;
}

export async function updateThreadStatus(
  threadId: string,
  status: ConversationStatus,
): Promise<CommunicationThread> {
  const { data } = await apiClient.put<CommunicationThread>(
    `/communications/threads/${threadId}/status`,
    { status },
  );
  return data;
}

export async function searchRecipients(
  target: "admins" | "students",
  search: string,
): Promise<ConversationUser[]> {
  const { data } = await apiClient.post<ConversationUser[]>(
    "/communications/recipients/search",
    { target, search },
  );
  return data;
}
