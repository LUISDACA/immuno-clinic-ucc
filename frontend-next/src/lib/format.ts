/** Calendar date in the device timezone, suitable for an HTML date input. */
export function localDateInputValue(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const calendarDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (calendarDate) {
    const [, year, month, day] = calendarDate;
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return value;
    return `${day}/${month}/${year}`;
  }
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

import { DoseStatus, VaccineStatus } from "@/lib/api/types";

export function vaccineStatusLabel(status: VaccineStatus): string {
  return {
    approved: "Aprobada",
    denied: "Rechazada",
    in_review: "En revisión",
  }[status];
}

export function doseStatusLabel(status: DoseStatus): string {
  return {
    approved: "Aprobada",
    denied: "Rechazada",
    in_review: "En revisión",
  }[status];
}

export function statusVariant(
  status: VaccineStatus | DoseStatus,
): "success" | "warning" | "destructive" | "info" {
  return {
    approved: "success" as const,
    denied: "destructive" as const,
    in_review: "info" as const,
  }[status];
}
