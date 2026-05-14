"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { listNotifications, markNotificationRead } from "@/lib/api/notifications";
import { NotificationsList } from "@/components/notifications-list";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

export default function AdminNotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
    refetchInterval: 30_000,
  });
  const unreadCount = data?.filter((item) => !item.is_read).length ?? 0;
  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Notificaciones"
        description="Notificaciones de la cuenta administrativa."
        actions={
          unreadCount > 0 ? (
            <Badge variant="warning">
              <Bell className="mr-1 h-3.5 w-3.5" />
              {unreadCount} nueva(s)
            </Badge>
          ) : null
        }
      />
      <NotificationsList
        notifications={data ?? []}
        loading={isLoading}
        onMarkRead={(id) => markRead.mutate(id)}
      />
    </div>
  );
}
