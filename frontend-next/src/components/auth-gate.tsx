"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/store";
import { isAdminRole, isAppAdminRole, isPlainAdminRole } from "@/lib/config";

type RoleRequirement = "student" | "admin" | "app_admin" | "plain_admin";

interface AuthGateProps {
  children: React.ReactNode;
  requireRole?: RoleRequirement;
}

function roleAllowed(requireRole: RoleRequirement | undefined, role: string | null) {
  if (!requireRole) return true;
  switch (requireRole) {
    case "student":
      return !isAdminRole(role);
    case "admin":
      return isAdminRole(role);
    case "app_admin":
      return isAppAdminRole(role);
    case "plain_admin":
      return isPlainAdminRole(role);
  }
}

export function AuthGate({ children, requireRole }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    isAuthenticated,
    isHydrated,
    role,
    mustChangePassword,
    checkSession,
  } = useAuthStore();

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    void checkSession();
  }, [isHydrated, isAuthenticated, checkSession, router]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return;

    if (mustChangePassword) {
      const target = isAdminRole(role)
        ? "/admin/change-password"
        : "/student/change-password";
      if (pathname !== target) router.replace(target);
      return;
    }

    if (!roleAllowed(requireRole, role)) {
      router.replace(isAdminRole(role) ? "/admin" : "/student");
    }
  }, [isHydrated, isAuthenticated, mustChangePassword, role, requireRole, pathname, router]);

  if (!isHydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  return <>{children}</>;
}
