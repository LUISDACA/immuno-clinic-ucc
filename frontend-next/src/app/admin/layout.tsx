"use client";

import { AuthGate } from "@/components/auth-gate";
import { AppShell, NavItem } from "@/components/app-shell";
import { useAuthStore } from "@/lib/auth/store";
import { isAppAdminRole } from "@/lib/config";

const APP_ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/admins", label: "Administradores" },
  { href: "/admin/vaccines", label: "Catálogo de vacunas" },
  { href: "/admin/communications", label: "Comunicaciones" },
  { href: "/admin/profile", label: "Mi perfil" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/students", label: "Estudiantes" },
  { href: "/admin/students/create", label: "Crear estudiante" },
  { href: "/admin/communications", label: "Comunicaciones" },
  { href: "/admin/notifications", label: "Notificaciones" },
  { href: "/admin/history", label: "Historial" },
  { href: "/admin/profile", label: "Mi perfil" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role } = useAuthStore();
  const appAdmin = isAppAdminRole(role);
  const nav = appAdmin ? APP_ADMIN_NAV : ADMIN_NAV;
  const title = appAdmin ? "Admin de aplicación" : "Administración";

  return (
    <AuthGate requireRole="admin">
      <AppShell title={title} nav={nav}>
        {children}
      </AppShell>
    </AuthGate>
  );
}
