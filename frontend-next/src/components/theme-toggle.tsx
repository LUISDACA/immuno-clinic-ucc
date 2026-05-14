"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/lib/theme/store";
import { cn } from "@/lib/utils";

const TOOLTIP: Record<"system" | "light" | "dark", string> = {
  system: "Modo del sistema",
  light: "Modo claro",
  dark: "Modo oscuro",
};

/** Botón único que cicla system → light → dark → system. */
export function ThemeModeToggle({ className }: { className?: string }) {
  const { mode, cycle, isHydrated } = useThemeStore();
  const tooltip = isHydrated ? TOOLTIP[mode] : "Tema";
  return (
    <button
      type="button"
      onClick={cycle}
      title={tooltip}
      aria-label={tooltip}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--primary)]/12 text-[color:var(--primary)] transition-colors hover:bg-[color:var(--primary)]/20",
        className,
      )}
    >
      {!isHydrated || mode === "system" ? (
        <Monitor className="h-4 w-4" />
      ) : mode === "light" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}

/** Selector visual con 3 opciones (para menús/preferencias). */
export function ThemeModeSelector() {
  const { mode, setMode } = useThemeStore();
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-variant)]/50 p-1">
      {(["system", "light", "dark"] as const).map((m) => {
        const active = mode === m;
        const Icon = m === "system" ? Monitor : m === "light" ? Sun : Moon;
        const label =
          m === "system" ? "Auto" : m === "light" ? "Claro" : "Oscuro";
        return (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors",
              active
                ? "bg-card text-[color:var(--primary)] shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
