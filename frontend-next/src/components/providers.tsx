"use client";

import { QueryProvider } from "@/lib/query/provider";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth/store";

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const expired = () => useAuthStore.getState().expire();
    window.addEventListener("immuno:session-expired", expired);
    void useAuthStore.getState().checkSession();
    return () => window.removeEventListener("immuno:session-expired", expired);
  }, []);
  return (
    <ThemeProvider>
      <QueryProvider>
        {children}
        <Toaster richColors position="top-right" />
      </QueryProvider>
    </ThemeProvider>
  );
}
