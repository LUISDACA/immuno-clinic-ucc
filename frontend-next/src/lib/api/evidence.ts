import { apiClient } from "@/lib/api/client";
import { API_BASE_URL } from "@/lib/config";
import { fetchAndDownload, type DownloadOptions } from "@/lib/api/download";
import { EvidenceBatch } from "@/lib/api/types";

export async function listMyEvidence(
  page = 1,
  pageSize = 20,
): Promise<EvidenceBatch[]> {
  const { data } = await apiClient.get<EvidenceBatch[]>("/evidence/", {
    params: { page, page_size: pageSize },
  });
  return data;
}

export async function uploadEvidence(
  files: File[],
  notes?: string,
): Promise<EvidenceBatch> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  if (notes) form.append("notes", notes);
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
