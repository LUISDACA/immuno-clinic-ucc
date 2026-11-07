"use client";
import { QueryError } from "@/components/query-error";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { markNotificationRead } from "@/lib/api/notifications";
import { NotificationsList } from "@/components/notifications-list";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { canRetainNotificationData, loadNotificationsWithRetention } from "@/lib/ui/notification-query";

export default function AdminNotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, error, failureReason, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => loadNotificationsWithRetention(queryClient),
    refetchInterval: 30_000,
  });
  const loadError = error ?? (failureReason && !canRetainNotificationData(queryClient, failureReason) ? failureReason : null);
  const canRetainData = canRetainNotificationData(queryClient, loadError);
  const unreadCount = data?.filter((item) => !item.is_read).length ?? 0;
  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: () => toast.error("No se pudo marcar como leída. Inténtalo de nuevo."),
  });
  const markBeforeOpen = async (id: string) => {
    try {
      await markRead.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  };

  const retry = () => refetch({ cancelRefetch: false });
  if (loadError && (data === undefined || !canRetainData)) {
    return <QueryError error={loadError} retry={retry} retrying={isFetching} />;
  }

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
      {loadError && (
        <div className="flex flex-col gap-2">
          <QueryError error={loadError} retry={retry} retrying={isFetching} />
          <p className="text-sm text-muted-foreground">Se muestran las últimas notificaciones cargadas.</p>
        </div>
      )}
      <NotificationsList
        notifications={data ?? []}
        loading={isLoading}
        onMarkRead={markBeforeOpen}
      />
    </div>
  );
}
