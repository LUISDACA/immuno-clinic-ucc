"use client";

import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  FileText,
  Info,
  MessageSquare,
  Stethoscope,
  Syringe,
} from "lucide-react";
import { NotificationItem } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/page-header";

export function NotificationsList({
  notifications,
  loading,
  onMarkRead,
}: {
  notifications: NotificationItem[];
  loading?: boolean;
  onMarkRead?: (id: string) => void;
}) {
  const router = useRouter();

  if (loading) return <LoadingState />;
  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={<BellOff className="h-7 w-7" />}
        title="No tienes notificaciones"
        description="Aquí aparecerán los recordatorios y avisos del equipo."
      />
    );
  }

  function open(n: NotificationItem) {
    if (!n.is_read && onMarkRead) onMarkRead(n.id);
    if (n.action_path) router.push(n.action_path);
  }

  return (
    <ul className="flex flex-col gap-2">
      {notifications.map((n) => {
        const icon = categoryIcon(n.category);
        const unread = !n.is_read;
        return (
          <li key={n.id}>
            <button
              onClick={() => open(n)}
              className="block w-full text-left"
              aria-label={`Notificación ${n.title}`}
            >
              <Card
                className={cn(
                  "transition-colors hover:border-[color:var(--primary)]/60",
                  unread && "bg-[color:var(--primary)]/[0.06]",
                )}
              >
                <div className="flex items-start gap-3 p-4">
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                      unread
                        ? "bg-[color:var(--primary)] text-white"
                        : "bg-[color:var(--surface-variant)] text-[color:var(--brand-gray)]",
                    )}
                  >
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "truncate text-sm",
                          unread ? "font-bold" : "font-medium",
                        )}
                      >
                        {n.title}
                      </p>
                      {unread && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--primary)]" />
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {n.message}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(n.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {unread && onMarkRead && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkRead(n.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            onMarkRead(n.id);
                          }
                        }}
                        className="rounded-md p-1.5 text-[color:var(--primary)] hover:bg-[color:var(--primary)]/10"
                        title="Marcar como leída"
                      >
                        <CheckCheck className="h-4 w-4" />
                      </span>
                    )}
                    {n.action_path && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </Card>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function categoryIcon(category: string | null): React.ReactNode {
  const cls = "h-5 w-5";
  switch (category) {
    case "scheme":
      return <Syringe className={cls} />;
    case "review":
      return <Stethoscope className={cls} />;
    case "evidence":
      return <FileText className={cls} />;
    case "communication":
      return <MessageSquare className={cls} />;
    case "system":
      return <Info className={cls} />;
    default:
      return <Bell className={cls} />;
  }
}
