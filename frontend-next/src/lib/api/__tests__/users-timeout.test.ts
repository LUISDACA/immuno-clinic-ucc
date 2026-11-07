import { beforeEach, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api/client";
import { getMe, getMeWithTimeout } from "@/lib/api/users";

vi.mock("@/lib/api/client", () => ({ apiClient: { get: vi.fn() } }));

const user = {
  id: "synthetic-user",
  email: "student@example.invalid",
  role: "student" as const,
  is_active: true,
  must_change_password: false,
  created_at: "2026-01-01T00:00:00Z",
  profile: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.get).mockResolvedValue({ data: user });
});

it("passes the startup restoration timeout to Axios", async () => {
  await getMeWithTimeout(4_000);

  expect(apiClient.get).toHaveBeenCalledWith("/users/me", { timeout: 4_000 });
});

it("keeps the default profile lookup timeout for existing callers", async () => {
  await getMe();

  expect(apiClient.get).toHaveBeenCalledWith("/users/me", { timeout: 30_000 });
});
