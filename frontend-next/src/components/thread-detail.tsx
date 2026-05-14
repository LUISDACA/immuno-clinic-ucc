"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageSquare, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addMessage, getThread } from "@/lib/api/communications";
import { useAuthStore } from "@/lib/auth/store";
import { isAdminRole } from "@/lib/config";
import { CommunicationMessage } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";

export function ThreadDetail({ threadId }: { threadId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { userId, role } = useAuthStore();
  const [message, setMessage] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => getThread(threadId),
  });

  useEffect(() => {
    if (!data || typeof window === "undefined") return;
    window.localStorage.setItem(
      `ic_thread_seen_${data.id}`,
      String(new Date(data.last_message_at).getTime()),
    );
  }, [data]);

  const send = useMutation({
    mutationFn: () => addMessage(threadId, message.trim()),
    onSuccess: () => {
      toast.success("Mensaje enviado");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
    onError: () => toast.error("No se pudo enviar"),
  });

  const baseList = isAdminRole(role) ? "/admin/communications" : "/student/communications";

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <BackBar baseList={baseList} />
        <LoadingState />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex flex-col gap-5">
        <BackBar baseList={baseList} />
        <Alert tone="error">No se pudo cargar el hilo.</Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BackBar baseList={baseList} onBack={() => router.push(baseList)} />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--primary)]/12 text-[color:var(--primary)]">
                <MessageSquare className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold">{data.subject}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {data.student.name ?? data.student.email}
                  {data.recipient && (
                    <> · con {data.recipient.name ?? data.recipient.email}</>
                  )}
                </p>
              </div>
            </div>
            <Badge
              variant={
                data.status === "open"
                  ? "info"
                  : data.status === "closed"
                    ? "muted"
                    : "warning"
              }
            >
              {statusLabel(data.status)}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <ul className="flex flex-col gap-3">
        {data.messages.map((m) => (
          <li key={m.id}>
            <Bubble message={m} mine={m.sender?.id === userId} />
          </li>
        ))}
      </ul>

      {data.status === "open" && (
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Escribe tu respuesta…"
              maxLength={4000}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {message.length}/4000
              </span>
              <Button
                onClick={() => send.mutate()}
                disabled={send.isPending || message.trim().length === 0}
              >
                {send.isPending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Enviando…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BackBar({
  baseList,
  onBack,
}: {
  baseList: string;
  onBack?: () => void;
}) {
  if (onBack) {
    return (
      <button
        onClick={onBack}
        className="flex w-fit items-center gap-2 rounded-md px-2 py-1 text-sm font-bold text-[color:var(--primary)] hover:bg-[color:var(--primary)]/10"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a comunicaciones
      </button>
    );
  }
  return (
    <Link
      href={baseList}
      className="flex w-fit items-center gap-2 rounded-md px-2 py-1 text-sm font-bold text-[color:var(--primary)] hover:bg-[color:var(--primary)]/10"
    >
      <ArrowLeft className="h-4 w-4" />
      Volver a comunicaciones
    </Link>
  );
}

function Bubble({
  message,
  mine,
}: {
  message: CommunicationMessage;
  mine: boolean;
}) {
  const senderName =
    message.sender?.name ?? message.sender?.email ?? "Usuario";
  return (
    <div
      className={cn(
        "flex items-end gap-2",
        mine ? "flex-row-reverse" : "flex-row",
      )}
    >
      <Avatar name={senderName} mine={mine} />
      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-1",
          mine ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
            mine
              ? "rounded-br-sm bg-[color:var(--primary)] text-white"
              : "rounded-bl-sm bg-card text-foreground border border-[color:var(--divider)]",
          )}
        >
          <p className="whitespace-pre-wrap">{message.body}</p>
        </div>
        <p className="px-1 text-[11px] text-muted-foreground">
          {senderName} · {formatDateTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}

function Avatar({ name, mine }: { name: string; mine: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        mine
          ? "bg-[color:var(--primary)]/15 text-[color:var(--primary-dark)]"
          : "bg-[color:var(--accent)]/20 text-[color:var(--accent)]",
      )}
    >
      {initials || "?"}
    </span>
  );
}

function statusLabel(s: string) {
  return (
    {
      open: "Abierto",
      closed: "Cerrado",
      archived: "Archivado",
    } as Record<string, string>
  )[s] ?? s;
}
