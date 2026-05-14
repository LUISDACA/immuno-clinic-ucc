"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Users,
  UserPlus,
  UserCheck,
  UserMinus,
  BadgeCheck,
  Clock4,
  History,
  MessageSquare,
  Bell,
  UserRound,
  Syringe,
  Settings2,
  Download,
} from "lucide-react";
import {
  downloadStudentsExport,
  getStatistics,
} from "@/lib/api/admin";
import { useAuthStore } from "@/lib/auth/store";
import { isAppAdminRole } from "@/lib/config";
import { AdminStatistics } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ActionCard,
  DataState,
  PageSurface,
  RetryButton,
  SectionHeader,
  SkeletonCard,
} from "@/components/ui/page";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UccHeroPanel, UccLogo } from "@/components/brand";

export default function AdminDashboard() {
  const { role } = useAuthStore();
  if (isAppAdminRole(role)) return <AppAdminDashboard />;
  return <RegularAdminDashboard />;
}

// ── Admin de aplicación ───────────────────────────────────────────────

function AppAdminDashboard() {
  const { email } = useAuthStore();
  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["admin", "stats", "all"],
    queryFn: () => getStatistics(),
  });

  const tiles = [
    {
      href: "/admin/admins",
      title: "Administradores",
      desc: "Crear, eliminar y asignar programa/sede",
      icon: <UserRound className="h-5 w-5" />,
      color: "var(--primary-dark)",
    },
    {
      href: "/admin/vaccines",
      title: "Catálogo de vacunas",
      desc: "Crear, editar y desactivar vacunas",
      icon: <Syringe className="h-5 w-5" />,
      color: "var(--accent)",
    },
    {
      href: "/admin/communications",
      title: "Comunicaciones",
      desc: "Conversar con administradores",
      icon: <MessageSquare className="h-5 w-5" />,
      color: "var(--info)",
    },
  ];

  return (
    <PageSurface>
      <UccHeroPanel
        eyebrow="Administrador de aplicación"
        title="Panel global"
        subtitle={email ?? ""}
        icon={<Settings2 className="h-6 w-6 text-white" />}
        trailing={<UccLogo size={64} />}
      />

      <div>
        <SectionHeader title="Gestion global" />
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => (
            <ActionCard
              key={tile.href}
              href={tile.href}
              title={tile.title}
              description={tile.desc}
              icon={tile.icon}
              color={tile.color}
            />
          ))}
        </div>
      </div>

      <div>
        <SectionHeader title="Analisis global" />
        {isLoading ? (
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <SkeletonCard rows={4} />
            <SkeletonCard rows={4} />
            <SkeletonCard rows={4} />
          </div>
        ) : isError ? (
          <DataState
            className="mt-3"
            type="error"
            title="No se pudo cargar el analisis"
            description="Revisa la conexion con el servidor e intenta de nuevo."
            action={<RetryButton onClick={() => refetch()} />}
          />
        ) : data ? (
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <VaccineComplianceRanking stats={data} compact />
            <Distribution title="Por sede" map={data.by_campus} />
            <Distribution title="Por programa" map={data.by_program} />
          </div>
        ) : null}
      </div>
    </PageSurface>
  );
}

// ── Admin normal ──────────────────────────────────────────────────────

function RegularAdminDashboard() {
  const { email } = useAuthStore();
  const [semester, setSemester] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["admin", "stats", semester],
    queryFn: () => getStatistics(semester ? Number(semester) : undefined),
  });

  async function onExport() {
    setExporting(true);
    const toastId = toast.loading("Preparando descarga...");
    try {
      await downloadStudentsExport(
        semester ? { semester: Number(semester) } : {},
        {
          onProgress: (progress) =>
            toast.loading(
              progress == null
                ? "Descargando reporte..."
                : `Descargando reporte ${progress}%`,
              { id: toastId },
            ),
        },
      );
      toast.success("Reporte descargado", { id: toastId });
    } catch {
      toast.error("No se pudo exportar", { id: toastId });
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageSurface>
      <UccHeroPanel
        eyebrow="Administración UCC"
        title="Panel administrativo"
        subtitle={email ?? ""}
        icon={<ShieldCheck className="h-6 w-6 text-white" />}
        trailing={<UccLogo size={64} />}
      />

      <div>
        <SectionHeader title="Estadisticas" actions={
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="semester" className="text-xs">
                  Semestre
                </Label>
                <Select
                  id="semester"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="h-9"
                >
                  <option value="">Todos</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onExport}
                disabled={exporting}
              >
                <Download className="h-4 w-4" />
                {exporting ? "Exportando…" : "CSV"}
              </Button>
            </div>
          }
        />
        {isError ? (
          <DataState
            className="mt-3"
            type="error"
            title="No se pudieron cargar las estadisticas"
            description="Revisa la conexion con el servidor e intenta de nuevo."
            action={<RetryButton onClick={() => refetch()} />}
          />
        ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile
            label="Totales"
            value={data?.total_students}
            loading={isLoading}
            href="/admin/students"
            icon={<Users className="h-5 w-5" />}
            color="var(--primary)"
          />
          <StatTile
            label="Activos"
            value={data?.active_students}
            loading={isLoading}
            href="/admin/students?active=true"
            icon={<UserCheck className="h-5 w-5" />}
            color="var(--success)"
          />
          <StatTile
            label="Desactivados"
            value={data?.inactive_students}
            loading={isLoading}
            href="/admin/students?active=false"
            icon={<UserMinus className="h-5 w-5" />}
            color="var(--destructive)"
          />
          <StatTile
            label="Esquema 100%"
            value={data?.vaccination_status.approved}
            loading={isLoading}
            href="/admin/students?scheme=approved"
            icon={<BadgeCheck className="h-5 w-5" />}
            color="var(--accent)"
          />
          <StatTile
            label="Pendientes"
            value={data?.vaccination_status.pending}
            loading={isLoading}
            href="/admin/students?scheme=pending"
            icon={<Clock4 className="h-5 w-5" />}
            color="var(--warning)"
          />
        </div>
        )}
      </div>

      {isLoading ? (
        <div>
          <SectionHeader title="Analisis grafico" />
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <SkeletonCard rows={4} />
            <SkeletonCard rows={4} />
          </div>
        </div>
      ) : data && (
        <div>
          <SectionHeader title="Analisis grafico" />
          <div className="mt-3">
            <SchemeBreakdown stats={data} />
          </div>
        </div>
      )}

      <div>
        <SectionHeader title="Gestion" />
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TileCard
            href="/admin/students/create"
            title="Crear estudiante"
            desc="Nuevo registro con esquema"
            icon={<UserPlus className="h-5 w-5" />}
            color="var(--primary-dark)"
          />
          <TileCard
            href="/admin/students"
            title="Lista de estudiantes"
            desc="Ver, buscar y filtrar"
            icon={<Users className="h-5 w-5" />}
            color="var(--primary)"
          />
          <TileCard
            href="/admin/history"
            title="Historial"
            desc="Quién cambió qué y cuándo"
            icon={<History className="h-5 w-5" />}
            color="var(--brand-gray)"
          />
          <TileCard
            href="/admin/communications"
            title="Comunicaciones"
            desc="Responder dudas y problemas"
            icon={<MessageSquare className="h-5 w-5" />}
            color="var(--info)"
          />
          <TileCard
            href="/admin/notifications"
            title="Notificaciones"
            desc="Avisos del sistema"
            icon={<Bell className="h-5 w-5" />}
            color="var(--warning)"
          />
          <TileCard
            href="/admin/profile"
            title="Mi perfil"
            desc="Datos de mi cuenta"
            icon={<UserRound className="h-5 w-5" />}
            color="var(--accent)"
          />
        </div>
      </div>
    </PageSurface>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function TileCard({
  href,
  title,
  desc,
  icon,
  color,
}: {
  href: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <ActionCard
      href={href}
      title={title}
      description={desc}
      icon={icon}
      color={color}
    />
  );
}

function StatTile({
  label,
  value,
  loading,
  href,
  icon,
  color,
}: {
  label: string;
  value?: number;
  loading?: boolean;
  href: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Link href={href} className="group">
      <Card
        className="h-full border-l-4 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md"
        style={{ borderLeftColor: color }}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
              color,
            }}
          >
            {icon}
          </span>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <span className="text-2xl font-extrabold">
              {loading ? "…" : (value ?? "—")}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Distribution({
  title,
  map,
}: {
  title: string;
  map: Record<string, number>;
}) {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const max = entries.reduce((acc, [, v]) => Math.max(acc, v), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {entries.map(([k, v]) => {
              const pct = max > 0 ? (v / max) * 100 : 0;
              return (
                <li key={k} className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{k || "—"}</span>
                    <span className="font-semibold">{v}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[color:var(--surface-variant)]">
                    <div
                      className="h-2 rounded-full bg-[color:var(--primary)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SchemeBreakdown({ stats }: { stats: AdminStatistics }) {
  const approved = stats.vaccination_status.approved;
  const pending = stats.vaccination_status.pending;
  const totalScheme = approved + pending;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {totalScheme > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cumplimiento de esquema</CardTitle>
          </CardHeader>
          <CardContent>
            <Bar
              segments={[
                {
                  label: `Completo (${approved})`,
                  value: approved,
                  color: "var(--accent)",
                },
                {
                  label: `Pendiente (${pending})`,
                  value: pending,
                  color: "var(--warning)",
                },
              ]}
              total={totalScheme}
            />
          </CardContent>
        </Card>
      )}
      <VaccineComplianceRanking stats={stats} />
    </div>
  );
}

function VaccineComplianceRanking({
  stats,
  compact,
}: {
  stats: AdminStatistics;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const vaccines = [...(stats.vaccine_compliance ?? [])].sort((a, b) => {
    const aPct = a.total > 0 ? a.up_to_date / a.total : 0;
    const bPct = b.total > 0 ? b.up_to_date / b.total : 0;
    return bPct - aPct;
  });
  const limit = compact ? 4 : 3;
  const visible = expanded ? vaccines : vaccines.slice(0, limit);
  const canExpand = vaccines.length > limit;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-sm">Vacunas al dia vs pendientes</CardTitle>
          <CardDescription>Resumen por cumplimiento.</CardDescription>
        </div>
        {canExpand && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Ver menos" : "Ver mas"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <ul className="flex flex-col gap-2.5 text-sm">
            {visible.map((vaccine) => {
              const pending =
                vaccine.pending + vaccine.denied + vaccine.in_review;
              const pct =
                vaccine.total > 0
                  ? Math.round((vaccine.up_to_date / vaccine.total) * 100)
                  : 0;
              return (
                <li key={vaccine.vaccine_id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-semibold">
                      {vaccine.name}
                    </span>
                    <span className="shrink-0 text-xs font-bold text-[color:var(--success)]">
                      {pct}% al dia
                    </span>
                  </div>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--warning-light)]">
                    <div
                      className="bg-[color:var(--success)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Al dia {vaccine.up_to_date} - Pendientes {pending}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Bar({
  segments,
  total,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-4 w-full overflow-hidden rounded-full">
        {segments.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <div
              key={s.label}
              style={{ width: `${pct}%`, background: s.color }}
            />
          );
        })}
      </div>
      <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            <span>
              {s.label}{" "}
              <span className="text-foreground">
                · {total > 0 ? ((s.value / total) * 100).toFixed(1) : 0}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
