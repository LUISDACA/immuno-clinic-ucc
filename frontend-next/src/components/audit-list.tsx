"use client";

import { useRouter } from "next/navigation";
import {
  ChevronRight,
  FileText,
  History,
  Lock,
  Syringe,
  UserRound,
} from "lucide-react";
import { AuditEntry, AuditActor } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { Card } from "@/components/ui/card";

interface Props {
  entries: AuditEntry[];
  loading?: boolean;
  isAdmin?: boolean;
}

export function AuditList({ entries, loading, isAdmin = false }: Props) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:var(--surface-variant)]">
          <History className="h-8 w-8 text-[color:var(--brand-gray)]" />
        </div>
        <p className="text-sm text-muted-foreground">No hay cambios registrados</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => {
        const dest = destinationFor(entry, isAdmin);
        return (
          <li key={entry.id}>
            <AuditItem
              entry={entry}
              isAdmin={isAdmin}
              onClick={dest ? () => router.push(dest) : undefined}
            />
          </li>
        );
      })}
    </ul>
  );
}

function AuditItem({
  entry,
  isAdmin,
  onClick,
}: {
  entry: AuditEntry;
  isAdmin: boolean;
  onClick?: () => void;
}) {
  const action = entry.action;
  const tone = actionTone(action);
  const icon = actionIcon(action);
  const details = (entry.details ?? {}) as Record<string, unknown>;
  const lines = detailLines(details);

  const content = (
    <Card className="transition-colors hover:border-[color:var(--primary)]/60">
      <div className="flex items-start gap-3 p-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `color-mix(in srgb, ${tone} 14%, transparent)`,
            color: tone,
          }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">
            {actionTitle(action)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Por: {actorName(entry.actor)}
          </p>
          {entry.created_at && (
            <p className="text-xs text-muted-foreground">
              {formatDateTime(entry.created_at)}
            </p>
          )}
          {isAdmin && details.student_id ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Estudiante: {studentLabel(details)}
            </p>
          ) : null}
          {lines.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-xs">
              {lines.map((l, idx) => (
                <li key={idx} className="text-foreground/85">
                  {l}
                </li>
              ))}
            </ul>
          )}
        </div>
        {onClick && (
          <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </div>
    </Card>
  );

  if (!onClick) return content;
  return (
    <button onClick={onClick} className="block w-full text-left">
      {content}
    </button>
  );
}

// ── helpers ───────────────────────────────────────────────────────────

function actorName(actor: AuditActor | null): string {
  if (!actor) return "Sistema";
  if (actor.name && actor.name.trim()) return actor.name;
  return actor.email || "Usuario";
}

function studentLabel(details: Record<string, unknown>): string {
  const name = String(details.student_name ?? "").trim();
  const email = String(details.student_email ?? "").trim();
  if (name && email) return `${name} <${email}>`;
  if (email) return email;
  if (name) return name;
  return String(details.student_id ?? "Sin estudiante");
}

function detailLines(details: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const vaccine = String(details.vaccine ?? "").trim();
  const dose = String(details.dose ?? "").trim();
  if (vaccine) lines.push(dose ? `${vaccine} - ${dose}` : vaccine);

  const oldStatus = String(details.old_status ?? "").trim();
  const newStatus = String(details.new_status ?? "").trim();
  if (newStatus) {
    lines.push(
      oldStatus
        ? `Estado: ${statusLabel(oldStatus)} → ${statusLabel(newStatus)}`
        : `Estado: ${statusLabel(newStatus)}`,
    );
  }

  const notes = String(details.notes ?? "").trim();
  if (notes) lines.push(`Comentario: ${notes}`);

  if (Array.isArray(details.files) && details.files.length > 0) {
    lines.push(`Archivos: ${(details.files as unknown[]).join(", ")}`);
  }

  if (
    details.changes &&
    typeof details.changes === "object" &&
    !Array.isArray(details.changes)
  ) {
    const changes = details.changes as Record<string, unknown>;
    const entries = Object.entries(changes);
    for (const [k, v] of entries.slice(0, 4)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const change = v as { old?: unknown; new?: unknown };
        lines.push(
          `${fieldLabel(k)}: ${value(change.old)} → ${value(change.new)}`,
        );
      }
    }
    if (entries.length > 4) {
      lines.push(`${entries.length - 4} cambio(s) adicional(es)`);
    }
  }

  return lines;
}

function value(v: unknown): string {
  if (v === undefined || v === null || String(v) === "") return "Sin dato";
  return String(v);
}

function fieldLabel(field: string): string {
  const map: Record<string, string> = {
    first_name: "Nombre",
    last_name: "Apellido",
    job_title: "Cargo",
    document_number: "Documento",
    student_id: "ID estudiantil",
    birth_date: "Fecha de nacimiento",
    sex: "Sexo",
    phone: "Teléfono",
    eps_affiliation: "EPS",
    emergency_contact_name: "Contacto de emergencia",
    emergency_contact_phone: "Teléfono emergencia",
    program: "Programa",
    semester: "Semestre",
    applied_date: "Fecha",
    titer_value: "Valor de titulación",
  };
  return map[field] ?? field;
}

function statusLabel(s: string): string {
  return (
    {
      approved: "Aprobada",
      denied: "Denegada",
      in_review: "En revisión",
      pending: "Pendiente",
    } as Record<string, string>
  )[s] ?? s;
}

function actionTitle(action: string): string {
  const map: Record<string, string> = {
    "student.created": "Estudiante creado",
    "student.deactivated": "Estudiante desactivado",
    "student.reactivated": "Estudiante reactivado",
    "profile.updated": "Perfil actualizado",
    "sex.changed": "Sexo actualizado",
    "scheme.regenerated": "Esquema regenerado",
    "dose.updated": "Dosis actualizada",
    "dose.reviewed": "Dosis revisada",
    "evidence.uploaded": "Documentos subidos",
    "evidence.deleted": "Documentos eliminados",
    "password.changed": "Contraseña cambiada",
    "password.reset": "Contraseña restablecida",
  };
  return map[action] ?? action;
}

function actionIcon(action: string): React.ReactNode {
  const cls = "h-5 w-5";
  if (action.includes("dose") || action.includes("scheme"))
    return <Syringe className={cls} />;
  if (action.includes("evidence")) return <FileText className={cls} />;
  if (
    action.includes("profile") ||
    action.includes("student") ||
    action.includes("sex")
  )
    return <UserRound className={cls} />;
  if (action.includes("password")) return <Lock className={cls} />;
  return <History className={cls} />;
}

function actionTone(action: string): string {
  if (action.includes("deleted") || action.includes("deactivated"))
    return "var(--destructive)";
  if (action.includes("reviewed")) return "var(--warning)";
  if (action.includes("uploaded") || action.includes("created"))
    return "var(--success)";
  return "var(--primary)";
}

function destinationFor(entry: AuditEntry, isAdmin: boolean): string | null {
  const action = entry.action;
  const details = (entry.details ?? {}) as Record<string, unknown>;

  if (isAdmin) {
    if (action.startsWith("password.")) return "/admin/change-password";
    const studentId = String(details.student_id ?? "");
    if (!studentId) return null;
    if (action.includes("dose") || action.includes("scheme"))
      return `/admin/students/${studentId}?tab=scheme`;
    if (action.includes("evidence"))
      return `/admin/students/${studentId}?tab=evidence`;
    return `/admin/students/${studentId}`;
  }

  if (action.includes("dose") || action.includes("scheme")) return "/student/scheme";
  if (action.includes("evidence")) return "/student/evidence";
  if (action.includes("profile") || action.includes("sex"))
    return "/student/profile";
  if (action.startsWith("password.")) return "/student/change-password";
  return null;
}
