"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Plus, Search, Send } from "lucide-react";
import { toast } from "sonner";
import {
  createThread,
  listThreads,
  searchRecipients,
} from "@/lib/api/communications";
import { ConversationUser } from "@/lib/api/types";
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
import { ThreadRow } from "@/app/student/communications/page";
import {
  EmptyState,
  LoadingState,
  PageHeader,
} from "@/components/page-header";

function PageInner() {
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const initialStudentId = params.get("studentId") ?? "";
  const initialStudentName = params.get("studentName") ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["threads"],
    queryFn: listThreads,
    refetchInterval: 30_000,
  });

  const [showNew, setShowNew] = useState(Boolean(initialStudentId));
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState(initialStudentName);
  const [selected, setSelected] = useState<ConversationUser | null>(
    initialStudentId
      ? {
          id: initialStudentId,
          email: initialStudentName,
          name: initialStudentName,
          role: "student",
        }
      : null,
  );

  const recipients = useQuery({
    queryKey: ["recipients", "students", search],
    queryFn: () => searchRecipients("students", search),
    enabled: showNew && search.length >= 2 && !selected,
  });

  const create = useMutation({
    mutationFn: () =>
      createThread({
        subject,
        message,
        student_id: selected?.id,
      }),
    onSuccess: () => {
      toast.success("Mensaje enviado");
      setSubject("");
      setMessage("");
      setSearch("");
      setSelected(null);
      setShowNew(false);
      queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
    onError: () => toast.error("No se pudo enviar"),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Comunicaciones"
        description="Conversaciones con estudiantes."
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
            <CardDescription>
              Selecciona un estudiante destinatario.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="search">Estudiante</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--primary)]" />
                <Input
                  id="search"
                  className="pl-10"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelected(null);
                  }}
                  placeholder="Buscar por nombre o correo (mín. 2 caracteres)"
                />
              </div>
              {recipients.data && recipients.data.length > 0 && !selected && (
                <ul className="overflow-hidden rounded-xl border border-[color:var(--divider)] bg-card text-sm shadow-sm">
                  {recipients.data.map((u) => (
                    <li key={u.id} className="border-b last:border-0">
                      <button
                        className="flex w-full flex-col px-3 py-2 text-left hover:bg-[color:var(--primary)]/8"
                        onClick={() => {
                          setSelected(u);
                          setSearch(u.name ?? u.email);
                        }}
                      >
                        <span className="font-semibold">
                          {u.name ?? u.email}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {u.email}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selected && (
                <p className="text-xs text-[color:var(--success)]">
                  ✓ Seleccionado: {selected.name ?? selected.email}
                </p>
              )}
            </div>
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
                  create.isPending ||
                  !selected ||
                  subject.length < 3 ||
                  message.length === 0
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
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((t) => (
            <ThreadRow key={t.id} basePath="/admin" thread={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminCommunicationsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <PageInner />
    </Suspense>
  );
}
