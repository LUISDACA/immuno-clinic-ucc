"use client";

import Link from "next/link";
import { CommunicationThreadListItem } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { listNotifications } from "@/lib/api/notifications";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth/store";
import { communicationPeer } from "@/lib/ui/communication-peer";

export function ThreadRow({
  thread,
  basePath,
}: {
  thread: CommunicationThreadListItem;
  basePath: string;
}) {
  const {data:notifications=[]}=useQuery({queryKey:["notifications"],queryFn:listNotifications,refetchInterval:30000});
  const userId = useAuthStore(state => state.userId);
  const peer = communicationPeer(thread, userId);
  const peerName = peer?.name ?? peer?.email;
  const initials = (peerName?.match(/\b[A-ZÁÉÍÓÚ]/gi) ?? [])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hasNewMessage = notifications.some(n=>!n.is_read && n.category==='communication' && n.action_path?.split('?')[0].endsWith('/'+thread.id));

  return (
    <li>
      <Link href={`${basePath}/communications/${thread.id}`} className="block">
        <Card
          className={cn(
            "transition-all hover:-translate-y-0.5 hover:border-[color:var(--primary)] hover:shadow-md",
            hasNewMessage &&
              "border-[color:var(--primary)] bg-[color:var(--primary)]/[0.06]",
          )}
        >
          <div className="flex items-start gap-3 p-4">
            {peer && <span
              className={cn(
                "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                hasNewMessage
                  ? "bg-[color:var(--primary)] text-white"
                  : "bg-[color:var(--accent)]/20 text-[color:var(--accent)]",
              )}
            >
              {initials || "·"}
              {hasNewMessage && (
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-[color:var(--destructive)]" />
              )}
            </span>}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {thread.subject}
                    {hasNewMessage && (
                      <span className="ml-2 rounded-full bg-[color:var(--destructive)] px-2 py-0.5 text-[10px] uppercase text-white">
                        Nuevo
                      </span>
                    )}
                  </p>
                  {(peerName || thread.category) && <p className="text-xs text-muted-foreground">
                    {peerName}
                    {thread.category && (
                      <>
                        {peerName ? " · " : ""}
                        <span className="capitalize">{thread.category}</span>
                      </>
                    )}
                  </p>}
                </div>
                <Badge
                  variant={
                    thread.status === "open"
                      ? "info"
                      : thread.status === "closed"
                        ? "muted"
                        : "warning"
                  }
                >
                  {threadStatusLabel(thread.status)}
                </Badge>
              </div>
              {thread.last_message && (
                <p
                  className={cn(
                    "mt-1 line-clamp-1 text-sm",
                    hasNewMessage
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {thread.last_message}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(thread.last_message_at)}
              </p>
            </div>
          </div>
        </Card>
      </Link>
    </li>
  );
}

function threadStatusLabel(status: string) {
  return (
    {
      open: "Abierto",
      closed: "Cerrado",
      archived: "Archivado",
    } as Record<string, string>
  )[status] ?? status;
}
