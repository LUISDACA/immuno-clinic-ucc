import { apiClient } from "@/lib/api/client";
import { User } from "@/lib/api/types";

export interface ProfileUpdateRequest {
  first_name?: string;
  last_name?: string;
  job_title?: string | null;
  birth_date?: string | null;
  phone?: string | null;
  eps_affiliation?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  program?: string;
  campus?: string;
  semester?: number;
}

export async function getMeWithTimeout(timeoutMs = 30_000): Promise<User> {
  const { data } = await apiClient.get<User>("/users/me", { timeout: timeoutMs });
  return data;
}

export async function getMe(): Promise<User> {
  return getMeWithTimeout();
}

export async function updateMyProfile(data: ProfileUpdateRequest): Promise<User> {
  const { data: result } = await apiClient.put<User>("/users/me/profile", data);
  return result;
}

export interface AdminSignatureMetadata {
  id: string;
  sha256: string;
  created_at: string;
  active: true;
}

export async function getActiveAdminSignature(): Promise<AdminSignatureMetadata | null> {
  try {
    const { data } = await apiClient.get<AdminSignatureMetadata>(
      "/certificates/signature/active",
    );
    return data;
  } catch (error) {
    if (typeof error === "object" && error !== null && "response" in error &&
        (error as { response?: { status?: number } }).response?.status === 404) return null;
    throw error;
  }
}

export async function getActiveAdminSignatureImage(): Promise<Blob> {
  const { data } = await apiClient.get<Blob>("/certificates/signature/active/image", {
    responseType: "blob",
  });
  return data;
}

export async function uploadAdminSignature(file: File): Promise<AdminSignatureMetadata> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<AdminSignatureMetadata>(
    "/certificates/signature",
    form,
  );
  return data;
}
