/** Browser requests use only the same-origin BFF. */
export const API_BASE_URL = "/api";

export const STORAGE_KEYS = {
  accessToken: "access_token",
  refreshToken: "refresh_token",
  userRole: "user_role",
} as const;

export const isAdminRole = (role?: string | null) => role === "admin" || role === "app_admin";
export const isAppAdminRole = (role?: string | null) => role === "app_admin";
export const isPlainAdminRole = (role?: string | null) => role === "admin";
