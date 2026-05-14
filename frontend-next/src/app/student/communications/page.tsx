"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { MessageSquare, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { createThread, listThreads } from "@/lib/api/communications";
import { useAuthStore } from "@/lib/auth/store";
import { CommunicationThreadListItem } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EmptyState,
  LoadingState,
  PageHeader,
} from "@/components/page-header";

export default function StudentCommunicationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["threads"],
    queryFn: listThreads,
    refetchInterval: 30_000,
  });

  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const create = useMutation({
    mutationFn: () => createThread({ subject, message }),
    onSuccess: () => {
      toast.success("Mensaje enviado");
      setSubject("");
      setMessage("");
      setShowNew(false);
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
    onError: () => toast.error("No se pudo enviar"),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Comunicaciones"
        description="Conversaciones con el equipo administrativo."
        actions={
          <Button onClick={() => setShowNew((s) => !s)}>
            {showNew ? (
              "Cancelar"
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Nuevo mensaje
              </>
            )}
          </Button>
        }
      />

      {showNew && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nuevo mensaje</CardTitle>
            <CardDescription>Llegará a un administrador.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subject">Asunto</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                minLength={3}
                maxLength={200}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="message">Mensaje</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={4000}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => create.mutate()}
                disabled={
                  create.isPending || subject.length < 3 || message.length === 0
                }
              >
                {create.isPending ? (
                  "Enviando…"
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

      {isLoading ? (
        <LoadingState />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-7 w-7" />}
          title="No hay conversaciones"
          description="Cuando inicies o recibas un mensaje aparecerá aquí."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((t) => (
            <ThreadRow key={t.id} basePath="/student" thread={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function ThreadRow({
  thread,
  basePath,
}: {
  thread: CommunicationThreadListItem;
  basePath: string;
}) {
  const { userId } = useAuthStore();
  const peer = thread.recipient ?? thread.created_by ?? thread.student;
  const peerName = peer?.name ?? peer?.email ?? "—";
  const initials = (peerName.match(/\b[A-ZÁÉÍÓÚ]/gi) ?? [])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const lastSenderId = thread.last_message_sender?.id;
  const seenAt = getSeenThreadAt(thread.id);
  const hasNewMessage =
    Boolean(lastSenderId && lastSenderId !== userId) &&
    new Date(thread.last_message_at).getTime() > seenAt;
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
            <span
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
            </span>
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
                  <p className="text-xs text-muted-foreground">
                    {peerName}
                    {thread.category && (
                      <>
                        {" · "}
                        <span className="capitalize">{thread.category}</span>
                      </>
                    )}
                  </p>
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
                    "mt-1 line-clamp-2 text-sm",
                    hasNewMessage
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {thread.last_message}
                </p>
              )}
              <p
                className={cn("mt-1 text-xs text-muted-foreground")}
              >
                {formatDateTime(thread.last_message_at)}
              </p>
            </div>
          </div>
        </Card>
      </Link>
    </li>
  );
}

function getSeenThreadAt(threadId: string) {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(`ic_thread_seen_${threadId}`);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

function threadStatusLabel(s: string) {
  return (
    {
      open: "Abierto",
      closed: "Cerrado",
      archived: "Archivado",
    } as Record<string, string>
  )[s] ?? s;
}
