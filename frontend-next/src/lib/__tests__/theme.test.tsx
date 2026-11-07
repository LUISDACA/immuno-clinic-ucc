import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useApplyTheme, useThemeStore } from "@/lib/theme/store";

afterEach(() => {
  cleanup();
  localStorage.clear();
  useThemeStore.setState({ mode: "system", isHydrated: false });
});
it("restores the theme used by the existing layout script", () => {
  localStorage.setItem("ic_theme", JSON.stringify({ state: { mode: "dark" } }));
  renderHook(useApplyTheme);
  expect(document.documentElement.dataset.theme).toBe("dark");
  act(() => useThemeStore.getState().setMode("light"));
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(JSON.parse(localStorage.getItem("ic_theme")!).state.mode).toBe("light");
});
it("recovers from malformed preferences", () => {
  localStorage.setItem("ic_theme", "malformed");
  renderHook(useApplyTheme);
  expect(document.documentElement.dataset.theme).toBe("system");
});
