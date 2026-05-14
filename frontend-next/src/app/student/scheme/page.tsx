"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronDown,
  FlaskConical,
  MessageSquare,
  Pencil,
  Save,
  Syringe,
  Trash2,
  X,
} from "lucide-react";
import { getMyScheme, updateDose } from "@/lib/api/scheme";
import { StudentDose, StudentVaccine } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { VaccineDueBadge } from "@/components/vaccine-due-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EmptyState,
  LoadingState,
  PageHeader,
} from "@/components/page-header";

export default function StudentSchemePage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["scheme", "me"],
    queryFn: getMyScheme,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Mi esquema de vacunación"
          description="Estado actual de cada vacuna y sus dosis."
        />
        <LoadingState />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Mi esquema de vacunación" />
        <EmptyState
          icon={<Syringe className="h-7 w-7" />}
          title="No se pudo cargar el esquema"
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Mi esquema de vacunación"
        description="Estado actual de cada vacuna y sus dosis."
      />

      <OverviewBox
        total={data.total_vaccines}
        approved={data.approved_vaccines}
        pending={data.pending_vaccines}
        denied={data.denied_vaccines}
        inReview={data.in_review_vaccines}
      />

      {data.vaccines.length === 0 ? (
        <EmptyState
          icon={<Syringe className="h-7 w-7" />}
          title="Sin vacunas asignadas"
          description="Tu esquema aún no tiene vacunas."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.vaccines.map((sv) => (
            <li key={sv.id}>
              <VaccineBox vaccine={sv} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Overview sobrio ──────────────────────────────────────────────────

function OverviewBox({
  total,
  approved,
  pending,
  denied,
  inReview,
}: {
  total: number;
  approved: number;
  pending: number;
  denied: number;
  inReview: number;
}) {
  const items: Array<{ label: string; value: number }> = [
    { label: "Total", value: total },
    { label: "Aprobadas", value: approved },
    { label: "Pendientes", value: pending },
    { label: "Denegadas", value: denied },
    { label: "En revisión", value: inReview },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[color:var(--divider)] bg-card p-4 sm:grid-cols-5">
      {items.map((it) => (
        <div key={it.label} className="text-center">
          <p className="text-2xl font-extrabold leading-none">{it.value}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            {it.label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Caja por vacuna (acordeón) ───────────────────────────────────────

function VaccineBox({ vaccine }: { vaccine: StudentVaccine }) {
  const [open, setOpen] = useState(false);
  const name = vaccine.vaccine?.name ?? "Vacuna";
  const code = vaccine.vaccine?.code;
  const status = vaccine.status as DoseOrVaccineStatus;
  const tone = statusTone(status);
  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--divider)] bg-card">
      <button
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span
          className="h-10 w-1.5 shrink-0 rounded-full"
          style={{ background: tone }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusPill status={status} />
            <span className="text-xs text-muted-foreground">
              {vaccine.doses.length} dosis
            </span>
            {code && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {code}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="border-t border-[color:var(--divider)]">
          {vaccine.admin_notes && (
            <div className="border-b border-[color:var(--divider)] p-3">
              <AdminNote text={vaccine.admin_notes} />
            </div>
          )}
          {vaccine.doses.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Sin dosis configuradas.
            </p>
          ) : (
            <ul>
              {vaccine.doses
                .slice()
                .sort((a, b) => a.dose_number - b.dose_number)
                .map((dose) => (
                  <li
                    key={dose.id}
                    className="border-b border-[color:var(--divider)] last:border-0"
                  >
                    <DoseRow dose={dose} />
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Fila de dosis ────────────────────────────────────────────────────

function DoseRow({ dose }: { dose: StudentDose }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [appliedDate, setAppliedDate] = useState(dose.applied_date ?? "");
  const [titerValue, setTiterValue] = useState(dose.titer_value ?? "");

  const isTiter = dose.dose_config?.dose_type === "titer";
  const editable =
    dose.status === "pending" ||
    dose.status === "denied" ||
    dose.status === "in_review";
  const hasRecord = isTiter
    ? Boolean(dose.applied_date) || Boolean(dose.titer_value)
    : Boolean(dose.applied_date);

  const save = useMutation({
    mutationFn: () =>
      updateDose(dose.id, {
        applied_date: appliedDate || null,
        titer_value: titerValue || null,
      }),
    onSuccess: () => {
      toast.success(isTiter ? "Titulación actualizada" : "Fecha actualizada");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["scheme", "me"] });
    },
    onError: () => toast.error("No se pudo actualizar"),
  });

  const remove = useMutation({
    mutationFn: () =>
      updateDose(dose.id, {
        applied_date: null,
        titer_value: isTiter ? null : undefined,
      }),
    onSuccess: () => {
      toast.success("Registro eliminado");
      queryClient.invalidateQueries({ queryKey: ["scheme", "me"] });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const label = dose.dose_config?.label ?? `Dosis ${dose.dose_number}`;

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{label}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: statusTone(dose.status) }}
              />
              <span style={{ color: statusTone(dose.status) }} className="font-semibold">
                {statusLabel(dose.status)}
              </span>
            </span>
            {dose.applied_date && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(dose.applied_date)}
              </span>
            )}
            {isTiter && dose.titer_value && (
              <span className="inline-flex items-center gap-1">
                <FlaskConical className="h-3.5 w-3.5" />
                {dose.titer_value}
              </span>
            )}
            {dose.due_date && dose.status !== "approved" && (
              <VaccineDueBadge
                dueDate={dose.due_date}
                days={dose.days_until_due ?? null}
              />
            )}
          </div>
        </div>

        {editable && !editing && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
              title={hasRecord ? "Editar" : "Registrar"}
            >
              <Pencil className="h-3.5 w-3.5" />
              {hasRecord ? "Editar" : "Registrar"}
            </Button>
            {hasRecord && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                title="Eliminar registro"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {dose.admin_notes && (
        <div className="mt-3">
          <AdminNote text={dose.admin_notes} />
        </div>
      )}

      {editing && (
        <div className="mt-3 rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-variant)]/50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`d-${dose.id}`} className="text-xs">
                Fecha de aplicación
              </Label>
              <Input
                id={`d-${dose.id}`}
                type="date"
                value={appliedDate}
                onChange={(e) => setAppliedDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>
            {isTiter && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`t-${dose.id}`} className="text-xs">
                  Valor de titulación
                </Label>
                <Input
                  id={`t-${dose.id}`}
                  placeholder="Ej. 10 mUI/mL"
                  value={titerValue}
                  onChange={(e) => setTiterValue(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={save.isPending}
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? (
                "Guardando…"
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Guardar
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers visuales ─────────────────────────────────────────────────

type DoseOrVaccineStatus = "approved" | "pending" | "denied" | "in_review";

function statusTone(status: DoseOrVaccineStatus | string): string {
  switch (status) {
    case "approved":
      return "var(--success)";
    case "denied":
      return "var(--destructive)";
    case "in_review":
      return "var(--warning)";
    default:
      return "var(--brand-gray)";
  }
}

function statusLabel(status: string): string {
  return (
    {
      approved: "Aprobada",
      denied: "Denegada",
      in_review: "En revisión",
      pending: "Pendiente",
    } as Record<string, string>
  )[status] ?? status;
}

function StatusPill({ status }: { status: DoseOrVaccineStatus }) {
  const tone = statusTone(status);
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold"
      style={{
        color: tone,
        borderColor: `color-mix(in srgb, ${tone} 30%, transparent)`,
        background: `color-mix(in srgb, ${tone} 8%, transparent)`,
      }}
    >
      {statusLabel(status)}
    </span>
  );
}

function AdminNote({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--divider)] bg-[color:var(--surface-variant)]/60 p-2.5 text-sm">
      <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[color:var(--info)]">
        <MessageSquare className="h-3 w-3" />
        Comentario del administrador
      </p>
      <p className="text-foreground/90">{text}</p>
    </div>
  );
}
