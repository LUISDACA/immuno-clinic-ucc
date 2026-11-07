"use client";
import { useSafeMutation as useMutation } from "@/lib/query/safe-mutation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { reviewDose, updateDoseComment } from "@/lib/api/scheme";
import { StudentDose } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/store";
import { isAdminRole } from "@/lib/config";
import { doseStatusLabel, formatDate, statusVariant } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VaccineDueBadge } from "@/components/vaccine-due-badge";

function statusColor(status: string): string {
  return ({ approved: "var(--success)", denied: "var(--destructive)", in_review: "var(--warning)" } as Record<string, string>)[status] ?? "#829196";
}

export function AdminDoseRow({
  dose,
  studentId,
}: {
  dose: StudentDose;
  studentId: string;
}) {
  const queryClient = useQueryClient();
  const [reviewAction, setReviewAction] = useState<null | "approved" | "denied" | "in_review">(
    null,
  );
  const allowed = isAdminRole(useAuthStore((state) => state.role));
  const [notes, setNotes] = useState(dose.admin_notes ?? "");

  const review = useMutation({
    affectedQueries: [["admin", "student", studentId],["admin", "students"],["audit"]],
    mutationFn: (payload: {
      status: "approved" | "denied" | "in_review";
    }) =>
      reviewDose(dose.id, {
        status: payload.status,
        admin_notes: notes || null,
      }),
    onSuccess: (_, payload) => {
      toast.success(
        payload.status === "approved" ? "Dosis aprobada" : payload.status === "denied" ? "Dosis denegada" : "Dosis en revisión",
      );
      setReviewAction(null);
      queryClient.invalidateQueries({
        queryKey: ["admin", "student", studentId, "scheme"],
      });
    },
    onError: () => toast.error("No se pudo guardar"),
  });

  const isApproved = dose.status === "approved";
  const isDenied = dose.status === "denied";
  const tone = statusColor(dose.status);
  const label = dose.dose_config?.label ?? `Dosis ${dose.dose_number}`;

  const beginReview = (action: "approved" | "denied" | "in_review") => {
    setNotes(dose.admin_notes ?? "");
    setReviewAction(action);
  };

  const cancel = () => {
    setReviewAction(null);
    setNotes(dose.admin_notes ?? "");
  };

  return (
    <div className="relative">
      <div className="flex flex-col items-start gap-3 md:flex-row md:flex-wrap md:justify-between">
        <div className="w-full min-w-0 md:flex-1">
          <p className="break-words text-base font-semibold leading-tight text-foreground">
            {label}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: tone }}
          />
          <span className="hidden">
            {dose.dose_config?.label ?? `Dosis ${dose.dose_number}`}
          </span>
          <Badge variant={statusVariant(dose.status)} className="text-xs">
            {doseStatusLabel(dose.status)}
          </Badge>
          {dose.applied_date && (
            <>
              <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">{dose.applied_date}</span>
            </>
          )}
          {dose.due_date && (
            <VaccineDueBadge
              dueDate={dose.due_date}
              days={dose.days_until_due ?? null}
              isOverdue={dose.is_overdue}
              isDueToday={dose.is_due_today}
            />
          )}
          {dose.titer_value && (
            <span className="text-muted-foreground">Titulacion: {dose.titer_value}</span>
          )}
        </div>
        </div>
        {allowed && !reviewAction && (
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 md:w-auto">
            {!isApproved && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 rounded-full bg-[color:var(--success-light)] px-2.5 text-[color:var(--success-text)] hover:bg-success/20 [&>span:first-child]:hidden"
                onClick={() => beginReview("approved")}
                title="Aprobar dosis"
              >
                <span aria-hidden className="text-base leading-none">✓</span>
                <span className="ml-1">Aprobar</span>
              </Button>
            )}
            {dose.status !== "in_review" && (
              <Button size="sm" variant="ghost" onClick={() => beginReview("in_review")}>
                Enviar a revisión
              </Button>
            )}
            {!isDenied && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 rounded-full bg-[color:var(--destructive-light)] px-2.5 text-[color:var(--destructive-text)] hover:bg-destructive/20 [&>span:first-child]:hidden"
                onClick={() => beginReview("denied")}
                title="Rechazar dosis"
              >
                <span aria-hidden className="text-base leading-none">✗</span>
                <span className="ml-1">Denegar</span>
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="hidden">
        {dose.applied_date && <span>{formatDate(dose.applied_date)}</span>}
        {dose.due_date && (
          <VaccineDueBadge
            dueDate={dose.due_date}
            days={dose.days_until_due ?? null}
            isOverdue={dose.is_overdue}
            isDueToday={dose.is_due_today}
          />
        )}
        {dose.titer_value && (
          <span>
            <span className="text-muted-foreground">Titulación: </span>
            {dose.titer_value}
          </span>
        )}
      </div>

      {allowed && !reviewAction ? (
        <DoseCommentEditor doseId={dose.id} initialNotes={dose.admin_notes ?? ""}
          onSaved={() => { void queryClient.invalidateQueries({ queryKey: ["admin", "student", studentId, "scheme"] }); }} />
      ) : dose.admin_notes ? <p className="mt-3 text-sm">{dose.admin_notes}</p> : null}

      {allowed && reviewAction && (
        <div
          className={cn(
            "mt-3 flex flex-col gap-3 rounded-lg border-l-4 p-3",
            reviewAction === "approved"
              ? "border-success bg-[color:var(--success-light)]"
              : "border-destructive bg-[color:var(--destructive-light)]",
          )}
        >
          <p className="text-sm font-medium">
            {reviewAction === "approved"
              ? "¿Confirmar aprobación de esta dosis?"
              : reviewAction === "denied" ? "¿Confirmar rechazo de esta dosis?" : "¿Enviar esta dosis a revisión?"}
          </p>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Nota (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={
                reviewAction === "approved"
                  ? "Ej: Evidencia válida, dosis aplicada correctamente."
                  : "Ej: Documento ilegible, fecha incorrecta…"
              }
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={reviewAction === "approved" ? "default" : "destructive"}
              onClick={() => review.mutate({ status: reviewAction })}
              disabled={review.isPending}
            >
              {review.isPending
                ? "Guardando…"
                : reviewAction === "approved"
                  ? "Aprobar"
                  : reviewAction === "denied" ? "Denegar" : "Confirmar revisión"}
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DoseCommentEditor({ doseId, initialNotes, onSaved }: { doseId: string; initialNotes: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [deleting, setDeleting] = useState(false);
  const comment = useMutation({
    affectedQueries: [["admin", "student"],["audit"]],
    mutationFn: (value: string | null) => updateDoseComment(doseId, value),
    onSuccess: () => { setEditing(false); setDeleting(false); toast.success("Comentario actualizado"); onSaved(); },
    onError: () => toast.error("No se pudo actualizar el comentario"),
  });
  return <div className="mt-3 rounded-lg border border-[color:var(--divider)] bg-[color:var(--info-light)] p-3 text-[color:var(--info-text)]">
    <p className="text-sm font-bold">Comentario del administrador</p>
    {editing ? <>
      <Label htmlFor={`comment-${doseId}`}>Comentario (sin cambiar el estado de la dosis)</Label>
      <Textarea id={`comment-${doseId}`} value={notes} onChange={e => setNotes(e.target.value)} />
      <Button disabled={comment.isPending} onClick={() => comment.mutate(notes.trim() || null)}>Guardar comentario</Button>
      <Button variant="ghost" disabled={comment.isPending} onClick={() => setEditing(false)}>Cancelar comentario</Button>
    </> : <>
      <p className="text-sm">{initialNotes || "Sin comentario"}</p>
      <Button variant="ghost" onClick={() => { setNotes(initialNotes); setEditing(true); }}>Editar comentario</Button>
      {initialNotes && <Button variant="ghost" onClick={() => setDeleting(true)}>Eliminar comentario</Button>}
    </>}
    {deleting && <div role="alert">
      <p>¿Eliminar únicamente el comentario? El estado de la dosis no cambiará.</p>
      <Button disabled={comment.isPending} onClick={() => comment.mutate(null)}>Confirmar eliminación del comentario</Button>
      <Button variant="ghost" disabled={comment.isPending} onClick={() => setDeleting(false)}>Cancelar eliminación</Button>
    </div>}
  </div>;
}
