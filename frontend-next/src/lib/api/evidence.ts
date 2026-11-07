import { apiClient } from "@/lib/api/client";
import { API_BASE_URL } from "@/lib/config";
import { fetchAndDownload, type DownloadOptions } from "@/lib/api/download";
import { EvidenceBatch, PageResponse } from "@/lib/api/types";

export async function listMyEvidence(
  page = 1,
  pageSize = 20,
): Promise<PageResponse<EvidenceBatch>> {
  const { data } = await apiClient.get<PageResponse<EvidenceBatch>>("/evidence/page", {
    params: { page, size: pageSize },
  });
  return data;
}

export async function uploadEvidence(
  files: File[],
  notes?: string,
  doseId?: string,
): Promise<EvidenceBatch> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  if (notes) form.append("notes", notes);
  if (doseId) form.append("dose_id", doseId);
  const { data } = await apiClient.post<EvidenceBatch>("/evidence/upload", form);
  return data;
}

export async function deleteEvidenceBatch(batchId: string): Promise<void> {
  await apiClient.delete(`/evidence/${batchId}`);
}

export function evidenceFileDownloadUrl(fileId: string): string {
  return `${API_BASE_URL}/evidence/files/${fileId}`;
}

export async function downloadEvidenceFile(
  fileId: string,
  filename: string,
  options: DownloadOptions = {},
): Promise<void> {
  await fetchAndDownload(evidenceFileDownloadUrl(fileId), filename, options);
}

export async function listStudentEvidence(
  studentId: string,
): Promise<EvidenceBatch[]> {
  const { data } = await apiClient.get<EvidenceBatch[]>(
    `/admin/students/${studentId}/evidence`,
  );
  return data;
}

export async function deleteStudentEvidence(
  studentId: string,
  batchId: string,
): Promise<void> {
  await apiClient.delete(`/admin/students/${studentId}/evidence/${batchId}`);
}

export async function reviewEvidenceBatch(
  batchId: string,
  status: "in_review" | "approved" | "denied",
): Promise<EvidenceBatch> {
  const { data } = await apiClient.patch<EvidenceBatch>(
    `/evidence/batches/${batchId}/review`,
    { status },
  );
  return data;
}

export async function listStudentEvidencePage(studentId:string,page=1,page_size=20):Promise<PageResponse<EvidenceBatch>> {
 const {data}=await apiClient.get<PageResponse<EvidenceBatch>>(`/admin/students/${studentId}/evidence/page`,{params:{page,page_size}});return data;
}
