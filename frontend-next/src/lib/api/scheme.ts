import { apiClient } from "@/lib/api/client";
import { SchemeOverview, StudentVaccine } from "@/lib/api/types";

export async function getMyScheme(): Promise<SchemeOverview> {
  const { data } = await apiClient.get<SchemeOverview>("/scheme/");
  return data;
}

export async function updateDose(
  doseId: string,
  payload: { applied_date?: string | null; titer_value?: string | null },
): Promise<void> {
  await apiClient.put(`/scheme/doses/${doseId}`, payload);
}

export async function getStudentScheme(
  studentId: string,
): Promise<StudentVaccine[]> {
  const { data } = await apiClient.get<StudentVaccine[]>(
    `/admin/students/${studentId}/scheme`,
  );
  return data;
}

export async function reviewDose(
  doseId: string,
  payload: { status: "approved" | "denied" | "in_review"; admin_notes?: string | null },
): Promise<void> {
  await apiClient.put(`/admin/doses/${doseId}/review`, payload);
}

export async function updateDoseComment(doseId: string, adminNotes: string | null): Promise<void> {
  await apiClient.patch(`/admin/doses/${doseId}/comment`, { admin_notes: adminNotes });
}
