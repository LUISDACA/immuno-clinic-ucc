import { apiClient } from "@/lib/api/client";
import { AuditEntry } from "@/lib/api/types";

export async function listMyAudit(
  limit = 100,
  offset = 0,
  includeSelf = true,
): Promise<AuditEntry[]> {
  const { data } = await apiClient.get<AuditEntry[]>("/audit/me", {
    params: { limit, offset, include_self: includeSelf },
  });
  return data;
}

export async function listAdminAudit(
  limit = 100,
  offset = 0,
): Promise<AuditEntry[]> {
  const { data } = await apiClient.get<AuditEntry[]>("/audit/admin", {
    params: { limit, offset },
  });
  return data;
}
