// @vitest-environment node
import { afterEach, beforeEach, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/store";
import { getQueryClient } from "@/lib/query/provider";

let server: Server;
let baseURL: string;
let requests: Array<{ path: string | undefined; authorization: string | undefined }>;
let failure: "http" | "reset" | "slow";
let delayedResponse: ReturnType<typeof setTimeout> | undefined;
let delayedResponseAttempted: boolean;

beforeEach(async () => {
  baseURL = apiClient.defaults.baseURL ?? "/api";
  requests = [];
  failure = "http";
  delayedResponseAttempted = false;
  server = createServer((request, response) => {
    requests.push({
      path: request.url,
      authorization: request.headers.authorization,
    });
    if (failure === "reset") {
      request.socket.destroy();
      return;
    }
    if (failure === "slow") {
      delayedResponse = setTimeout(() => {
        if (!response.destroyed && !request.socket.destroyed) {
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ id: "synthetic-user", role: "student" }));
        }
        delayedResponseAttempted = true;
      }, 4_800);
      return;
    }
    response.writeHead(503, { "content-type": "application/json" });
    response.end(JSON.stringify({ code: "SERVICE_UNAVAILABLE", message: "Unavailable" }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Local test server did not bind");
  apiClient.defaults.baseURL = `http://127.0.0.1:${address.port}/api`;
  useAuthStore.setState({
    isAuthenticated: true,
    isHydrated: false,
    isLoading: false,
    errorMessage: null,
    role: "student",
    userId: "synthetic-user",
    email: "student@example.invalid",
    mustChangePassword: false,
  });
  getQueryClient().setQueryData(["scheme", "me"], { synthetic: true });
});

afterEach(async () => {
  if (delayedResponse) clearTimeout(delayedResponse);
  apiClient.defaults.baseURL = baseURL;
  getQueryClient().clear();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
});

it.each(["http", "reset"] as const)("startup restoration clears local auth after a real local transport %s", async mode => {
  failure = mode;

  await useAuthStore.getState().checkSession();

  expect(requests).toEqual([{ path: "/api/users/me", authorization: undefined }]);
  expect(useAuthStore.getState()).toMatchObject({
    isAuthenticated: false,
    isHydrated: true,
    role: null,
    userId: null,
  });
  expect(getQueryClient().getQueryData(["scheme", "me"])).toBeUndefined();
});

it("startup restoration applies Flutter's four-second timeout and discards a late local HTTP response", async () => {
  failure = "slow";
  const startedAt = Date.now();

  await useAuthStore.getState().checkSession();

  const elapsedMs = Date.now() - startedAt;
  expect(elapsedMs).toBeGreaterThanOrEqual(3_500);
  expect(elapsedMs).toBeLessThan(5_000);
  expect(requests).toEqual([{ path: "/api/users/me", authorization: undefined }]);
  expect(useAuthStore.getState()).toMatchObject({
    isAuthenticated: false,
    isHydrated: true,
    role: null,
    userId: null,
  });
  expect(getQueryClient().getQueryData(["scheme", "me"])).toBeUndefined();
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  expect(delayedResponseAttempted).toBe(true);
  expect(useAuthStore.getState()).toMatchObject({
    isAuthenticated: false,
    isHydrated: true,
    role: null,
    userId: null,
  });
}, 10_000);
