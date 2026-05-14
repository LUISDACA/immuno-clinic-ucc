import { apiClient } from "@/lib/api/client";
import { NotificationItem } from "@/lib/api/types";

export async function listNotifications(): Promise<NotificationItem[]> {
  const { data } = await apiClient.get<NotificationItem[]>("/notifications/");
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.put(`/notifications/${id}/read`);
}

export async function markCategoryRead(category: string): Promise<void> {
  await apiClient.put(`/notifications/category/${category}/read`);
}
