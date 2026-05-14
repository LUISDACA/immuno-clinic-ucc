import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "error" | "warning" | "success" | "info";

const STYLES: Record<Tone, { box: string; icon: React.ReactNode }> = {
  error: {
    box: "bg-[color:var(--destructive-light)] border-[color:var(--destructive)]/30 text-[color:var(--destructive)]",
    icon: <AlertCircle className="h-4 w-4 shrink-0" />,
  },
  warning: {
    box: "bg-[color:var(--warning-light)] border-[color:var(--warning)]/40 text-[color:var(--warning)]",
    icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
  },
  success: {
    box: "bg-[color:var(--success-light)] border-[color:var(--success)]/40 text-[color:var(--success)]",
    icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
  },
  info: {
    box: "bg-[color:var(--info-light)] border-[color:var(--info)]/40 text-[color:var(--info)]",
    icon: <Info className="h-4 w-4 shrink-0" />,
  },
};

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const s = STYLES[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border p-3 text-sm",
        s.box,
        className,
      )}
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
    >
      <span className="mt-0.5">{s.icon}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
