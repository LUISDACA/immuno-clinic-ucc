import { beforeEach, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api/client";
import * as auth from "@/lib/auth/api";

vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn() }, authOperation: (fn: () => unknown) => fn() }));
beforeEach(() => vi.mocked(apiClient.post).mockResolvedValue({ data: {} }));
it("uses the BFF without exposing refresh tokens", async () => {
  await auth.login("synthetic@example.invalid", "synthetic-password");
  expect(apiClient.post).toHaveBeenLastCalledWith("/auth/login", { email: "synthetic@example.invalid", password: "synthetic-password" });
  await auth.logout();
  expect(apiClient.post).toHaveBeenLastCalledWith("/auth/logout");
  await auth.forgotPassword("synthetic@example.invalid");
  expect(apiClient.post).toHaveBeenLastCalledWith("/auth/forgot-password", { email: "synthetic@example.invalid" });
  await auth.resetPassword("synthetic-reset", "synthetic-new");
  expect(apiClient.post).toHaveBeenLastCalledWith("/auth/reset-password", { token: "synthetic-reset", new_password: "synthetic-new" });
  await auth.changePassword("synthetic-old", "synthetic-new");
  expect(apiClient.post).toHaveBeenLastCalledWith("/auth/change-password", { current_password: "synthetic-old", new_password: "synthetic-new" });
});
