import { apiClient } from "@/lib/api/client";
import { User } from "@/lib/api/types";

export interface ProfileUpdateRequest {
  first_name?: string;
  last_name?: string;
  job_title?: string;
  birth_date?: string | null;
  phone?: string;
  eps_affiliation?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  program?: string;
  campus?: string;
  semester?: number;
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>("/users/me");
  return data;
}

export async function updateMyProfile(data: ProfileUpdateRequest): Promise<User> {
  const { data: result } = await apiClient.put<User>("/users/me/profile", data);
  return result;
}
