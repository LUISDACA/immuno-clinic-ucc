"use client";
import { useSafeMutation as useMutation } from "@/lib/query/safe-mutation";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, MessageSquare, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { safeCommunicationReturn } from "@/lib/navigation";
import { toast } from "sonner";
import { addMessage, getThread, updateThreadStatus } from "@/lib/api/communications";
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
import { EmptyState, LoadingState } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { communicationPeer } from "@/lib/ui/communication-peer";
import { useCommunicationReadSync } from "@/lib/query/communication-read-sync";

export function ThreadDetail({ threadId }: { threadId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params=useSearchParams();
  const { userId, role } = useAuthStore();
  const [confirmStatus, setConfirmStatus] = useState<"open" | "closed" | null>(null);
  const [message, setMessage] = useState("");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => getThread(threadId),
    refetchInterval: 5000,
  });

  const readSync = useCommunicationReadSync(data?.id, data?.last_message_at);
  const statusChange = useMutation({
    affectedQueries: [["thread",threadId],["threads"],["notifications"]],
    mutationFn: (status: "open" | "closed") => updateThreadStatus(threadId, status),
    onSuccess: () => { setConfirmStatus(null); void queryClient.invalidateQueries({queryKey:["thread", threadId]}); void queryClient.invalidateQueries({queryKey:["threads"]}); },
  });
  const send = useMutation({
    affectedQueries: [["thread",threadId],["threads"],["notifications"]],
    mutationFn: () => addMessage(threadId, message.trim()),
    onSuccess: () => {
      toast.success("Mensaje enviado");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
    onError: () => toast.error("No se pudo enviar"),
  });

  const baseList = safeCommunicationReturn(params.get("returnTo"),isAdminRole(role)?"/admin":"/student");

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
        <QueryError error={error} retry={() => refetch({ cancelRefetch: false })} retrying={isFetching} />
      </div>
    );
  }

  const peer = communicationPeer(data, userId);

  return (
    <div className="flex flex-col gap-4">
      <BackBar baseList={baseList} onBack={() => router.push(baseList)} />

      {!!readSync.error && <QueryError error={readSync.error} retry={readSync.retry} retrying={readSync.pending} />}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--primary)]/12 text-[color:var(--primary)]">
                <MessageSquare className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold">{data.subject}</h2>
                {peer && <p className="mt-0.5 text-sm text-muted-foreground">{peer.name ?? peer.email}</p>}
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

      <div>
        <Button variant="outline" onClick={() => setConfirmStatus(data.status === "open" ? "closed" : "open")}>
          {data.status === "open" ? "Cerrar conversación" : "Reabrir conversación"}
        </Button>
        {confirmStatus && <div role="alert"><p>¿Confirmar {confirmStatus === "closed" ? "cierre" : "reapertura"} de la conversación?</p>
          <Button disabled={statusChange.isPending} onClick={() => statusChange.mutate(confirmStatus)}>Confirmar estado</Button>
          <Button variant="ghost" onClick={() => setConfirmStatus(null)}>Cancelar</Button>
        </div>}
        {statusChange.error && <QueryError error={statusChange.error} retry={() => statusChange.reset()} />}
        {data.status === "closed" && <p>Responder reabrirá la conversación.</p>}
      </div>
      {data.messages.length === 0 ? <EmptyState icon={null} title="No hay mensajes" /> : <ul className="flex flex-col gap-3">
        {data.messages.map((m) => (
          <li key={m.id}>
            <Bubble message={m} mine={m.sender?.id === userId} />
          </li>
        ))}
      </ul>}

      {(

        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <label htmlFor="thread-reply">Respuesta</label>
            <Textarea
              id="thread-reply"
              disabled={send.isPending}
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
              ? "rounded-br-sm bg-[color:var(--primary)] text-black"
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
