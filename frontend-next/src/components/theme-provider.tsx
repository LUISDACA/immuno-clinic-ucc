"use client";

import { useApplyTheme } from "@/lib/theme/store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useApplyTheme();
  return <>{children}</>;
}
