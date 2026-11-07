"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/store";
import { isAdminRole, isAppAdminRole, isPlainAdminRole } from "@/lib/config";

type Allowed = "admin" | "app_admin" | "plain_admin";

export function RoleGuard({
  allow,
  children,
}: {
  allow: Allowed;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { role, isHydrated } = useAuthStore();

  const ok = allow === "admin"
    ? isAdminRole(role)
    : allow === "app_admin"
      ? isAppAdminRole(role)
      : isPlainAdminRole(role);

  useEffect(() => {
    if (!isHydrated) return;
    if (!ok) router.replace("/admin");
  }, [isHydrated, ok, router]);

  if (!isHydrated || !ok) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Sin acceso a esta sección…
      </div>
    );
  }
  return <>{children}</>;
}
