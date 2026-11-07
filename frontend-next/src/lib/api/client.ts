import axios from "axios";
import { API_BASE_URL, STORAGE_KEYS } from "@/lib/config";

let generation = 0;
const epochs = new WeakMap<object, number>();
export function clearSession() {
  generation++;
  if (typeof window !== "undefined") for (const key of Object.values(STORAGE_KEYS)) localStorage.removeItem(key);
}
export const apiClient = axios.create({ baseURL: API_BASE_URL, timeout: 30000, withCredentials: true });
apiClient.interceptors.request.use(async config => {
  const epoch = generation;
  if (!["get", "head", "options"].includes(config.method ?? "get")) {
    const response = await axios.get<{token: string}>("/api/auth/csrf", { timeout: 10000 });
    config.headers.set("X-CSRF-Token", response.data.token);
  }
  if (epoch !== generation && !config.url?.endsWith("/auth/logout")) throw new axios.CanceledError("Session changed");
  epochs.set(config, epoch);
  config.headers.delete("Authorization");
  return config;
});
apiClient.interceptors.response.use(response => {
  if (epochs.has(response.config) && epochs.get(response.config) !== generation) throw new axios.CanceledError("Session changed");
  return response;
}, error => {
  if (axios.isAxiosError(error) && error.config && epochs.has(error.config) && epochs.get(error.config) !== generation) return Promise.reject(new axios.CanceledError("Session changed"));
  if (axios.isAxiosError(error) && error.response?.status === 401 && !error.config?.url?.includes("/auth/") && typeof window !== "undefined") {
    window.dispatchEvent(new Event("immuno:session-expired"));
  }
  if (axios.isAxiosError(error) && error.response?.data && typeof error.response.data === "object") {
    const payload = error.response.data as { message?: unknown };
    if (typeof payload.message === "string") {
      // Keep the legacy property consumed by existing screens, but show the safe contract message.
      (error.response.data as { detail?: string }).detail = payload.message;
    }
  }
  return Promise.reject(error);
});
// Serialize browser login/logout, including across tabs where Web Locks is supported.
let authQueue: Promise<unknown> = Promise.resolve();
export async function authOperation<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request("immuno-auth", operation);
  const result = authQueue.then(operation, operation);
  authQueue = result.catch(() => undefined);
  return result;
}
