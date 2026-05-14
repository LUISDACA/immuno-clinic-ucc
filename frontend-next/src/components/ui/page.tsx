import Link from "next/link";
import * as React from "react";
import { AlertTriangle, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PageSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-6", className)}>{children}</div>;
}

export function PageToolbar({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 block h-5 w-1.5 shrink-0 rounded-full bg-[color:var(--accent)]" />
        <div className="min-w-0">
          <h2 className="text-base font-extrabold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function DataState({
  type,
  title,
  description,
  action,
  className,
}: {
  type: "loading" | "empty" | "error";
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const icon =
    type === "loading" ? (
      <Loader2 className="h-6 w-6 animate-spin" />
    ) : type === "error" ? (
      <AlertTriangle className="h-6 w-6" />
    ) : null;
  const tone =
    type === "error"
      ? "text-[color:var(--destructive)]"
      : "text-[color:var(--primary)]";

  return (
    <Card className={className}>
      <CardContent className="flex min-h-36 flex-col items-center justify-center gap-3 p-6 text-center">
        {icon && (
          <span
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-lg bg-[color:var(--surface-variant)]",
              tone,
            )}
          >
            {icon}
          </span>
        )}
        <div>
          <p className="font-bold">{title}</p>
          {description && (
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className={cn(
              "h-4 animate-pulse rounded bg-[color:var(--surface-variant)]",
              index === 0 ? "w-2/3" : index === rows - 1 ? "w-1/2" : "w-full",
            )}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export function ActionCard({
  href,
  title,
  description,
  icon,
  color = "var(--primary)",
  badge,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color?: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link href={href} className="group block h-full">
      <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-[color:var(--primary)] group-hover:shadow-md">
        <CardHeader>
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: `color-mix(in srgb, ${color} 12%, transparent)`,
                color,
              }}
            >
              {icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{title}</CardTitle>
                {badge}
              </div>
              <CardDescription>{description}</CardDescription>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}

export function StatCard({
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
    <Link href={href} className="group block h-full">
      <Card
        className="h-full border-l-4 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md"
        style={{ borderLeftColor: color }}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
              color,
            }}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <span className="block truncate text-xs font-bold uppercase text-muted-foreground">
              {label}
            </span>
            <span className="block text-2xl font-extrabold leading-tight">
              {loading ? "..." : (value ?? "-")}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      Reintentar
    </Button>
  );
}
