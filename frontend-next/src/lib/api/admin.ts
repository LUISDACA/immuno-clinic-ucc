import { apiClient } from "@/lib/api/client";
import { fetchAndDownload, type DownloadOptions } from "@/lib/api/download";
import { API_BASE_URL } from "@/lib/config";
import {
  AdminStatistics,
  AdminStudentListResponse,
  AdminStudentListItem,
  AppliesTo,
  Gender,
  ImportPreviewResponse,
  ImportStudentsResponse,
  User,
  VaccineCatalogItem,
  VaccineDoseConfigInput,
} from "@/lib/api/types";

export interface ListStudentsParams {
  search?: string;
  is_active?: boolean;
  program?: string;
  campus?: string;
  sex?: Gender;
  semester?: number;
  vaccination_status?: "approved" | "pending";
  page?: number;
  page_size?: number;
}

export interface CreateStudentRequest {
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  document_number: string;
  student_id?: string;
  birth_date?: string;
  sex: Gender;
  phone?: string;
  eps_affiliation?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  program?: string;
  campus?: string;
  semester?: number;
}

export interface UpdateStudentProfileRequest {
  first_name?: string;
  last_name?: string;
  document_number?: string;
  student_id?: string;
  birth_date?: string;
  sex?: Gender;
  phone?: string;
  eps_affiliation?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  program?: string;
  campus?: string;
  semester?: number;
}

export interface CreateAdminRequest {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  program: string;
  campus: string;
}

export interface VaccineCreateRequest {
  name: string;
  code: string;
  base_doses?: number;
  has_booster?: boolean;
  has_titer?: boolean;
  has_titer_value?: boolean;
  is_annual?: boolean;
  applies_to?: AppliesTo;
  display_order?: number;
  dose_configs?: VaccineDoseConfigInput[];
}

export interface VaccineUpdateRequest {
  name?: string;
  base_doses?: number;
  has_booster?: boolean;
  has_titer?: boolean;
  has_titer_value?: boolean;
  is_annual?: boolean;
  applies_to?: AppliesTo;
  display_order?: number;
  dose_configs?: VaccineDoseConfigInput[];
}

export async function listStudents(
  params: ListStudentsParams = {},
): Promise<AdminStudentListResponse> {
  const { data } = await apiClient.get<AdminStudentListResponse>(
    "/admin/students",
    { params },
  );
  return data;
}

export async function listAllStudents(
  params: Omit<ListStudentsParams, "page" | "page_size"> = {},
): Promise<AdminStudentListItem[]> {
  const pageSize = 100;
  const first = await listStudents({ ...params, page: 1, page_size: pageSize });
  if (first.total_pages <= 1) return first.items;

  const rest = await Promise.all(
    Array.from({ length: first.total_pages - 1 }, (_, i) =>
      listStudents({ ...params, page: i + 2, page_size: pageSize }),
    ),
  );
  return [first, ...rest].flatMap((page) => page.items);
}

export async function getStudent(id: string): Promise<User> {
  const { data } = await apiClient.get<User>(`/admin/students/${id}`);
  return data;
}

export async function createStudent(payload: CreateStudentRequest): Promise<User> {
  const { data } = await apiClient.post<User>("/admin/students", payload);
  return data;
}

export async function previewStudentImport(
  file: File,
): Promise<ImportPreviewResponse> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<ImportPreviewResponse>(
    "/admin/students/import/preview",
    form,
  );
  return data;
}

export async function importStudentsFile(
  file: File,
): Promise<ImportStudentsResponse> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<ImportStudentsResponse>(
    "/admin/students/import",
    form,
  );
  return data;
}

export async function updateStudentProfile(
  id: string,
  payload: UpdateStudentProfileRequest,
): Promise<User> {
  const { data } = await apiClient.put<User>(
    `/admin/students/${id}/profile`,
    payload,
  );
  return data;
}

export async function deactivateStudent(id: string): Promise<void> {
  await apiClient.post(`/admin/students/${id}/deactivate`);
}

export async function reactivateStudent(id: string): Promise<void> {
  await apiClient.post(`/admin/students/${id}/reactivate`);
}

export async function deleteStudent(id: string): Promise<void> {
  await apiClient.delete(`/admin/students/${id}`);
}

export async function getStatistics(semester?: number): Promise<AdminStatistics> {
  const { data } = await apiClient.get<AdminStatistics>("/admin/statistics", {
    params: semester ? { semester } : undefined,
  });
  return data;
}

export async function listAdmins(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>("/admin/admins");
  return data;
}

export async function createAdmin(payload: CreateAdminRequest): Promise<User> {
  const { data } = await apiClient.post<User>("/admin/admins", payload);
  return data;
}

export async function deleteAdmin(id: string): Promise<void> {
  await apiClient.delete(`/admin/admins/${id}`);
}

export async function listVaccines(): Promise<VaccineCatalogItem[]> {
  const { data } = await apiClient.get<VaccineCatalogItem[]>("/admin/vaccines");
  return data;
}

export async function createVaccine(
  payload: VaccineCreateRequest,
): Promise<VaccineCatalogItem> {
  const { data } = await apiClient.post<VaccineCatalogItem>(
    "/admin/vaccines",
    payload,
  );
  return data;
}

export async function updateVaccine(
  id: string,
  payload: VaccineUpdateRequest,
): Promise<VaccineCatalogItem> {
  const { data } = await apiClient.put<VaccineCatalogItem>(
    `/admin/vaccines/${id}`,
    payload,
  );
  return data;
}

export async function deactivateVaccine(id: string): Promise<VaccineCatalogItem> {
  const { data } = await apiClient.post<VaccineCatalogItem>(
    `/admin/vaccines/${id}/deactivate`,
  );
  return data;
}

export async function reactivateVaccine(id: string): Promise<VaccineCatalogItem> {
  const { data } = await apiClient.post<VaccineCatalogItem>(
    `/admin/vaccines/${id}/reactivate`,
  );
  return data;
}

export async function downloadStudentsExport(
  params: ListStudentsParams = {},
  options: DownloadOptions = {},
): Promise<void> {
  const url = new URL(`${API_BASE_URL}/admin/students/export`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });
  await fetchAndDownload(url.toString(), "reporte_estudiantes.csv", options);
}

export async function downloadStudentCertificate(
  studentId: string,
  email: string,
  options: DownloadOptions = {},
): Promise<void> {
  await fetchAndDownload(
    `${API_BASE_URL}/admin/students/${studentId}/certificate`,
    `certificado_vacunacion_${email.split("@")[0]}.pdf`,
    options,
  );
}
