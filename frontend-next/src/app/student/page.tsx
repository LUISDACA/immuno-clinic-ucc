"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  GraduationCap,
  Syringe,
  Upload,
  FileCheck2,
  MessageSquare,
  Bell,
  History,
  UserRound,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth/store";
import { getMyScheme } from "@/lib/api/scheme";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BrandSectionTitle,
  UccHeroPanel,
  UccLogo,
} from "@/components/brand";

const QUICK_ACTIONS: Array<{
  href: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}> = [
  {
    href: "/student/scheme",
    title: "Mi esquema",
    desc: "Estado de cada vacuna y dosis.",
    icon: <Syringe className="h-5 w-5" />,
    color: "var(--primary-dark)",
  },
  {
    href: "/student/evidence",
    title: "Documentos",
    desc: "Sube comprobantes.",
    icon: <Upload className="h-5 w-5" />,
    color: "var(--primary)",
  },
  {
    href: "/student/certificate",
    title: "Certificado",
    desc: "Descarga el PDF cuando esté completo.",
    icon: <FileCheck2 className="h-5 w-5" />,
    color: "var(--accent)",
  },
  {
    href: "/student/communications",
    title: "Consultas",
    desc: "Mensajes con administradores.",
    icon: <MessageSquare className="h-5 w-5" />,
    color: "var(--warning)",
  },
  {
    href: "/student/notifications",
    title: "Notificaciones",
    desc: "Recordatorios y avisos.",
    icon: <Bell className="h-5 w-5" />,
    color: "var(--info)",
  },
  {
    href: "/student/history",
    title: "Historial",
    desc: "Cambios en tu cuenta.",
    icon: <History className="h-5 w-5" />,
    color: "var(--brand-gray)",
  },
  {
    href: "/student/profile",
    title: "Mi perfil",
    desc: "Datos personales.",
    icon: <UserRound className="h-5 w-5" />,
    color: "var(--primary)",
  },
];

export default function StudentDashboard() {
  const { email } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["scheme", "me"],
    queryFn: getMyScheme,
  });

  const total = data?.total_vaccines ?? 0;
  const approved = data?.approved_vaccines ?? 0;
  const pending = data?.pending_vaccines ?? 0;
  const denied = data?.denied_vaccines ?? 0;
  const inReview = data?.in_review_vaccines ?? 0;
  const ready = total > 0 && approved === total;

  return (
    <div className="flex flex-col gap-6">
      <UccHeroPanel
        eyebrow="Estudiante UCC"
        title="Bienvenido"
        subtitle={email ?? "Estudiante"}
        icon={<GraduationCap className="h-6 w-6 text-white" />}
        trailing={<UccLogo size={64} />}
      />

      <div>
        <BrandSectionTitle
          title="Estadísticas de vacunas"
          trailing={
            <Badge variant={ready ? "success" : "warning"}>
              {ready ? "Esquema completo" : "En curso"}
            </Badge>
          }
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total" value={total} loading={isLoading} />
          <Stat
            label="Aprobadas"
            value={approved}
            variant="success"
            loading={isLoading}
          />
          <Stat
            label="Pendientes"
            value={pending}
            variant="warning"
            loading={isLoading}
          />
          <Stat
            label="En revisión"
            value={inReview}
            variant="info"
            loading={isLoading}
          />
          {denied > 0 && (
            <Stat
              label="Rechazadas"
              value={denied}
              variant="destructive"
              loading={isLoading}
            />
          )}
        </div>
      </div>

      <div>
        <BrandSectionTitle title="Acciones rápidas" />
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((tile) => (
            <Link key={tile.href} href={tile.href} className="group">
              <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-[color:var(--primary)] group-hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        background: `color-mix(in srgb, ${tile.color} 12%, transparent)`,
                        color: tile.color,
                      }}
                    >
                      {tile.icon}
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-base">{tile.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {tile.desc}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  variant,
  loading,
}: {
  label: string;
  value: number;
  variant?: "success" | "warning" | "destructive" | "info";
  loading?: boolean;
}) {
  const accent =
    variant === "success"
      ? "border-l-[color:var(--success)]"
      : variant === "warning"
        ? "border-l-[color:var(--warning)]"
        : variant === "destructive"
          ? "border-l-[color:var(--destructive)]"
          : variant === "info"
            ? "border-l-[color:var(--info)]"
            : "border-l-[color:var(--primary)]";

  return (
    <Card
      className={`border-l-4 ${accent} transition-shadow hover:shadow-md`}
    >
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-2xl font-extrabold">
          {loading ? "…" : value}
        </span>
      </CardContent>
    </Card>
  );
}
