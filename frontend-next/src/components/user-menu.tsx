"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  History,
  KeyRound,
  LogOut,
  UserRound,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth/store";
import { isAdminRole } from "@/lib/config";
import { cn } from "@/lib/utils";
import { ThemeModeSelector } from "@/components/theme-toggle";

export function UserMenu() {
  const router = useRouter();
  const { email, role, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    function onFocus(e: FocusEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
    };
  }, [open]);

  const base = isAdminRole(role) ? "/admin" : "/student";
  const initials = (email ?? "U")
    .split(/[@.]/)[0]
    .slice(0, 2)
    .toUpperCase();

  async function handleLogout() {
    setOpen(false);
    await logout();
    router.replace("/login");
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={trigger}
        id={`${panelId}-trigger`}
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex items-center gap-2 rounded-full border border-[color:var(--divider)] bg-card pl-1 pr-2 py-1 transition-colors hover:border-[color:var(--primary)]"
        aria-label="Opciones de usuario"
        aria-controls={panelId}
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--primary)] text-xs font-bold text-white">
          {initials}
        </span>
        <span className="hidden max-w-[160px] truncate text-sm font-semibold sm:inline">
          {email ?? "Usuario"}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={`${panelId}-trigger`}
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[color:var(--divider)] bg-card shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-[color:var(--divider)] p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--primary)] text-xs font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{email ?? "Usuario"}</p>
              <p className="text-xs text-muted-foreground">
                {role === "app_admin"
                  ? "Admin de aplicación"
                  : role === "admin"
                    ? "Administrador"
                    : "Estudiante"}
              </p>
            </div>
          </div>

          <ul className="flex flex-col py-1">
            <MenuItem
              href={`${base}/profile`}
              icon={<UserRound className="h-4 w-4" />}
              label="Mi perfil"
              onClick={() => setOpen(false)}
            />
            <MenuItem
              href={`${base}/change-password`}
              icon={<KeyRound className="h-4 w-4" />}
              label="Cambiar contraseña"
              onClick={() => setOpen(false)}
            />
            {role !== "app_admin" && (
              <MenuItem
                href={`${base}/history`}
                icon={<History className="h-4 w-4" />}
                label="Mi historial"
                onClick={() => setOpen(false)}
              />
            )}
          </ul>

          <div className="border-t border-[color:var(--divider)] p-3">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Tema
            </p>
            <ThemeModeSelector />
          </div>

          <div className="border-t border-[color:var(--divider)] p-1">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-[color:var(--destructive)] transition-colors hover:bg-[color:var(--destructive-light)]"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[color:var(--primary)]/8"
      >
        <span className="text-[color:var(--primary)]">{icon}</span>
        <span>{label}</span>
      </Link>
    </li>
  );
}
