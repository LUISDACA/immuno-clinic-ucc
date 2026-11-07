import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api/client";
import { listMyEvidence, uploadEvidence } from "@/lib/api/evidence";

afterEach(() => vi.restoreAllMocks());

it("requests the additive paginated evidence contract using page and size", async () => {
  const page = {
    items: [],
    page: 1,
    size: 10,
    total: 0,
    pages: 0,
    has_next: false,
    has_previous: false,
    page_size: 10,
    total_pages: 0,
  };
  const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: page } as never);

  await expect(listMyEvidence(1, 10)).resolves.toEqual(page);
  expect(get).toHaveBeenCalledWith("/evidence/page", { params: { page: 1, size: 10 } });
});

it("includes an optional dose association when uploading evidence", async () => {
  const post = vi.spyOn(apiClient, "post").mockResolvedValue({ data: {} } as never);

  await uploadEvidence([], undefined, "synthetic-dose-id");

  const form = post.mock.calls[0][1] as FormData;
  expect(form.get("dose_id")).toBe("synthetic-dose-id");
});

it("keeps generic evidence uploads unassociated", async () => {
  const post = vi.spyOn(apiClient, "post").mockResolvedValue({ data: {} } as never);

  await uploadEvidence([]);

  const form = post.mock.calls[0][1] as FormData;
  expect(form.has("dose_id")).toBe(false);
});

it("maps canonical safe API messages to the legacy detail consumed by screens", async () => {
  const request = apiClient.get("/test-error", {
    adapter: async (config) => {
      const error = new AxiosError("Conflict", "ERR_BAD_REQUEST", config);
      error.response = {
        status: 409,
        statusText: "Conflict",
        headers: new AxiosHeaders(),
        config,
        data: {
          code: "CONFLICT",
          message: "La operación entra en conflicto con el estado actual.",
          detail: "legacy detail",
          details: null,
        },
      };
      throw error;
    },
  });

  await expect(request).rejects.toMatchObject({
    response: {
      data: {
        code: "CONFLICT",
        message: "La operación entra en conflicto con el estado actual.",
        detail: "La operación entra en conflicto con el estado actual.",
      },
    },
  });
});

it("comment mutation cannot carry review intent and uses PATCH on its own endpoint", async () => {
  const { updateDoseComment, reviewDose } = await import("../scheme");
  const patch = vi.spyOn(apiClient, "patch").mockResolvedValue({ data: {} });
  const put = vi.spyOn(apiClient, "put").mockResolvedValue({ data: {} });
  await updateDoseComment("synthetic-dose", null);
  expect(patch).toHaveBeenCalledWith("/admin/doses/synthetic-dose/comment", { admin_notes: null });
  expect(put).not.toHaveBeenCalled();
  await reviewDose("synthetic-dose", { status: "denied" });
  expect(put).toHaveBeenCalledWith("/admin/doses/synthetic-dose/review", { status: "denied" });
});
