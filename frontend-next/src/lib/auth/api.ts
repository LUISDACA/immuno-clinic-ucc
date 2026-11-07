import { apiClient, authOperation } from "@/lib/api/client";
type LoginResult = { must_change_password: boolean };

export async function login(email: string, password: string): Promise<LoginResult> {
  return authOperation(async () => (await apiClient.post<LoginResult>("/auth/login", { email, password })).data);
}
export async function logout(): Promise<void> {
  await authOperation(() => apiClient.post("/auth/logout"));
}
export async function forgotPassword(email: string): Promise<void> {
  await apiClient.post("/auth/forgot-password", { email });
}
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiClient.post("/auth/reset-password", { token, new_password: newPassword });
}
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post("/auth/change-password", { current_password: currentPassword, new_password: newPassword });
}
