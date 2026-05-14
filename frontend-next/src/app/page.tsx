"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/store";
import { isAdminRole } from "@/lib/config";
import { UccBrandBackground, UccLogo } from "@/components/brand";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isHydrated, role, mustChangePassword } =
    useAuthStore();

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (mustChangePassword) {
      router.replace(
        isAdminRole(role) ? "/admin/change-password" : "/student/change-password",
      );
      return;
    }
    router.replace(isAdminRole(role) ? "/admin" : "/student");
  }, [isAuthenticated, isHydrated, role, mustChangePassword, router]);

  return (
    <UccBrandBackground>
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <UccLogo size={120} />
        <p className="text-base font-bold text-[color:var(--primary-dark)]">
          UCC ImmunoClinic
        </p>
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    </UccBrandBackground>
  );
}
