"use client";

import { AuthGate } from "@/components/auth-gate";
import { AppShell, NavItem } from "@/components/app-shell";

const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "Inicio" },
  { href: "/student/scheme", label: "Esquema de vacunación" },
  { href: "/student/evidence", label: "Cargar evidencia" },
  { href: "/student/certificate", label: "Certificado" },
  { href: "/student/communications", label: "Comunicaciones" },
  { href: "/student/notifications", label: "Notificaciones" },
  { href: "/student/history", label: "Historial" },
  { href: "/student/profile", label: "Mi perfil" },
];

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate requireRole="student">
      <AppShell title="Estudiante" nav={STUDENT_NAV}>
        {children}
      </AppShell>
    </AuthGate>
  );
}
