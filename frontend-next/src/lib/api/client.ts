import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";
import { API_BASE_URL, STORAGE_KEYS } from "@/lib/config";

const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/refresh",
];

function isBrowser() {
  return typeof window !== "undefined";
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(STORAGE_KEYS.accessToken);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(STORAGE_KEYS.refreshToken);
}

export function saveTokens(accessToken: string, refreshToken: string) {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
  localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
}

export function saveUserRole(role: string) {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEYS.userRole, role);
}

export function clearSession() {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.userRole);
}

let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function flushQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error || !token) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { Accept: "application/json" },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const url = config.url ?? "";
    const isPublic = PUBLIC_PATHS.some((p) => url.includes(p));
    if (!isPublic) {
      const token = getAccessToken();
      if (token) {
        config.headers.set("Authorization", `Bearer ${token}`);
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearSession();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token: string) => {
            original.headers.set("Authorization", `Bearer ${token}`);
            original._retry = true;
            resolve(apiClient(original));
          },
          reject,
        });
      });
    }

    isRefreshing = true;
    original._retry = true;

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });
      const newAccessToken = response.data.access_token as string;
      saveTokens(newAccessToken, refreshToken);
      flushQueue(null, newAccessToken);
      original.headers.set("Authorization", `Bearer ${newAccessToken}`);
      return apiClient(original);
    } catch (refreshError) {
      flushQueue(refreshError, null);
      clearSession();
      if (isBrowser()) {
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
