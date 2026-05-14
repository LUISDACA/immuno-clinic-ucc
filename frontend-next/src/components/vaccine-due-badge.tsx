import { formatDate } from "@/lib/format";

export function VaccineDueBadge({
  dueDate,
  days,
}: {
  dueDate?: string | null;
  days?: number | null;
}) {
  if (!dueDate) return null;

  const tone =
    days == null
      ? "var(--info)"
      : days < 0
        ? "var(--destructive)"
        : days <= 7
          ? "var(--warning)"
          : "var(--info)";
  const detail =
    days == null
      ? ""
      : days === 0
        ? "vence hoy"
        : days > 0
          ? `faltan ${days} dias`
          : `${Math.abs(days)} dias vencida`;

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
