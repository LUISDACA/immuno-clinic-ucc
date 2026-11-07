import { formatDate } from "@/lib/format";

export function VaccineDueBadge({
  dueDate,
  days,
  isOverdue,
  isDueToday,
}: {
  dueDate?: string | null;
  days?: number | null;
  isOverdue?: boolean | null;
  isDueToday?: boolean | null;
}) {
  if (!dueDate) return null;

  const tone =
    days == null
      ? "var(--info)"
      : isOverdue
        ? "var(--destructive)"
        : days >= 0 && days <= 7
          ? "var(--warning)"
          : "var(--info)";
  const detail =
    days == null
      ? ""
      : isDueToday
        ? "vence hoy"
        : days > 0
          ? `faltan ${days} dias`
          : isOverdue
            ? `${Math.abs(days)} dias vencida`
            : "";

  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{
        color: tone,
        borderColor: `color-mix(in srgb, ${tone} 28%, transparent)`,
        background: `color-mix(in srgb, ${tone} 10%, transparent)`,
      }}
    >
      Vence {formatDate(dueDate)}
      {detail ? ` - ${detail}` : ""}
    </span>
  );
}
