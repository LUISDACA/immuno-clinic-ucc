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

export async function auditPage(administrative:boolean,page=1,page_size=20):Promise<import('./types').PageResponse<AuditEntry>> {
 const {data}=await apiClient.get(`/audit/${administrative?'admin':'me'}/page`,{params:{page,page_size}});return data;
}
