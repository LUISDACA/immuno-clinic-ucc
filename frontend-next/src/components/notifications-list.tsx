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
import styles from "./notifications-list.module.css";

export function NotificationsList({
  notifications,
  loading,
  onMarkRead,
}: {
  notifications: NotificationItem[];
  loading?: boolean;
  onMarkRead?: (id: string) => Promise<boolean> | boolean | void;
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

  async function open(n: NotificationItem) {
    if (!n.is_read && onMarkRead) {
      const marked = await onMarkRead(n.id);
      if (marked === false) return;
    }
    if (n.action_path) router.push(n.action_path);
  }

  return (
    <ul className="flex flex-col gap-2">
      {notifications.map((n) => {
        const icon = categoryIcon(n.category);
        const unread = !n.is_read;
        return (
          <li key={n.id} className={styles.item}>
            <Card
              className={cn(
                "flex items-start gap-1 p-4 transition-colors hover:border-[color:var(--primary)]/60",
                styles.card,
                unread && "bg-[color:var(--primary)]/[0.06]",
              )}
            >
              <button
                type="button"
                onClick={() => open(n)}
                className={cn("flex min-w-0 flex-1 items-start gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", styles.open)}
                aria-label={`Notificación ${n.title}`}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                    unread
                      ? "bg-[color:var(--primary)] text-primary-foreground"
                      : "bg-[color:var(--surface-variant)] text-muted-foreground",
                  )}
                >
                  {icon}
                </span>
                <div className={cn("min-w-0 flex-1", styles.copy)}>
                  <div className="flex items-start gap-2">
                    <p className={cn("min-w-0 text-sm [overflow-wrap:anywhere]", unread ? "font-bold" : "font-medium")}>
                      {n.title}
                    </p>
                    {unread && <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[color:var(--primary)]" />}
                  </div>
                  <p className={cn("mt-1 line-clamp-2 text-sm text-muted-foreground [overflow-wrap:anywhere]", styles.message)}>{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(n.created_at)} · {unread ? "No leída" : "Leída"}
                  </p>
                </div>
                {n.action_path && <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>
              {unread && onMarkRead && (
                <button
                  type="button"
                  onClick={() => { void onMarkRead(n.id); }}
                  aria-label={`Marcar como leída: ${n.title}`}
                  className={cn("shrink-0 rounded-md p-1.5 text-[color:var(--interactive-foreground)] hover:bg-[color:var(--primary)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", styles.mark)}
                  title="Marcar como leída"
                >
                  <CheckCheck aria-hidden="true" className="h-4 w-4" />
                </button>
              )}
            </Card>
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
