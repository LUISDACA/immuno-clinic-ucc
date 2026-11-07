"use client";

import { useEffect } from "react";
import { create } from "zustand";

type Mode = "system" | "light" | "dark";
const modes: Mode[] = ["system", "light", "dark"];
export const useThemeStore = create<{
  mode: Mode; isHydrated: boolean; setMode: (mode: Mode) => void; cycle: () => void;
}>((set, get) => ({
  mode: "system", isHydrated: false,
  setMode(mode) {
    set({ mode });
    try { localStorage.setItem("ic_theme", JSON.stringify({ state: { mode } })); } catch { /* storage unavailable */ }
  },
  cycle() { get().setMode(modes[(modes.indexOf(get().mode) + 1) % modes.length]); },
}));
export function useApplyTheme() {
  const { mode, isHydrated } = useThemeStore();
  useEffect(() => {
    let stored: Mode = "system";
    try {
      const value = JSON.parse(localStorage.getItem("ic_theme") ?? "null")?.state?.mode;
      if (modes.includes(value)) stored = value;
    } catch { /* use system preference */ }
    useThemeStore.setState({ mode: stored, isHydrated: true });
  }, []);
  useEffect(() => {
    if (isHydrated) document.documentElement.dataset.theme = mode;
  }, [mode, isHydrated]);
}
