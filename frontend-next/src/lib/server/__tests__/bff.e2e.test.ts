// @vitest-environment node
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { database } from "../session";
import { GET, POST } from "@/app/api/[...path]/route";

const databaseUrl = process.env.BFF_TEST_DATABASE_URL;
const schema = `bff_e2e_${randomBytes(7).toString("hex")}`;
let control: Pool | undefined;
const ctx = (path: string) => ({ params: Promise.resolve({ path: path.split("/") }) });
const syntheticPair = (access: string, refresh: string) => ({
  access_token: access,
  refresh_token: refresh,
  session_id: "00000000-0000-0000-0000-000000000001",
  expires_in: 600,
  refresh_expires_in: 3600,
  must_change_password: false,
});

beforeAll(async () => {
  if (!databaseUrl) return;
  const parsed = new URL(databaseUrl);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !parsed.pathname.startsWith("/immuno_phase")) {
    throw new Error("Disposable local PostgreSQL only");
  }
  control = new Pool({ connectionString: databaseUrl });
  await control.query(`CREATE SCHEMA ${schema}`);
  await control.query(`CREATE TABLE ${schema}.web_sessions(cookie_hash text PRIMARY KEY,auth_session_id uuid NOT NULL,encrypted_tokens text NOT NULL,expires_at timestamptz NOT NULL,status text NOT NULL)`);
  parsed.searchParams.set("options", `-c search_path=${schema}`);
  process.env.BFF_DATABASE_URL = parsed.toString();
  process.env.BFF_SESSION_KEY = randomBytes(32).toString("base64");
  process.env.API_INTERNAL_URL = "https://api.example.invalid";
  process.env.BFF_ORIGIN = "https://app.example.invalid";
});

afterAll(async () => {
  if (control) {
    await database().end();
    await control.query(`DROP SCHEMA ${schema} CASCADE`);
    await control.end();
  }
});

it.skipIf(!databaseUrl)("completes login, authenticated API, rotation and logout with PostgreSQL-backed BFF state", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  let finishSlowScheme!: (response: Response) => void;
  const slowScheme = new Promise<Response>(resolve => { finishSlowScheme = resolve; });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith("/api/v2/auth/login")) return Response.json(syntheticPair("access-one", "refresh-one"));
    if (url.endsWith("/api/v2/auth/refresh")) return Response.json(syntheticPair("access-two", "refresh-two"));
    if (url.endsWith("/api/v2/auth/logout")) return new Response(null, { status: 204 });
    if (url.includes("/api/v1/scheme/")) return url.includes("slow=1") ? slowScheme : Response.json({ scheme: "synthetic" });
    throw new Error("Unexpected upstream route");
  }));

  const csrfResponse = await GET(new NextRequest("https://app.example.invalid/api/auth/csrf"), ctx("auth/csrf"));
  const csrfCookie = csrfResponse.headers.get("set-cookie")!.match(/immuno_bootstrap=([^;]+)/)![1];
  const csrf = (await csrfResponse.json()).token as string;
  const login = await POST(new NextRequest("https://app.example.invalid/api/auth/login", {
    method: "POST", headers: { origin: "https://app.example.invalid", cookie: `immuno_bootstrap=${csrfCookie}`, "x-csrf-token": csrf }, body: "{}",
  }), ctx("auth/login"));
  expect(login.status).toBe(200);
  const loginBody = await login.json();
  expect(loginBody).toEqual({ must_change_password: false });
  expect(JSON.stringify(loginBody)).not.toContain("refresh-one");
  const sessionCookie = login.headers.get("set-cookie")!.match(/immuno_session=([^;]+)/)![1];
  const cookie = `immuno_session=${sessionCookie}`;

  const sessionCsrfResponse = await GET(new NextRequest("https://app.example.invalid/api/auth/csrf", { headers: { cookie } }), ctx("auth/csrf"));
  const sessionCsrf = (await sessionCsrfResponse.json()).token as string;

  const pendingScheme = GET(new NextRequest("https://app.example.invalid/api/scheme?slow=1", { headers: { cookie } }), ctx("scheme"));
  const deadline = Date.now() + 1000;
  while (!requests.some(item => item.url.includes("/api/v1/scheme/")) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  const schemeRequest = requests.find(item => item.url.includes("/api/v1/scheme/"))!;
  expect(new Headers(schemeRequest.init?.headers).get("authorization")).toBe("Bearer access-one");

  const refresh = await POST(new NextRequest("https://app.example.invalid/api/auth/refresh", {
    method: "POST", headers: { origin: "https://app.example.invalid", cookie, "x-csrf-token": sessionCsrf },
  }), ctx("auth/refresh"));
  expect(refresh.status).toBe(204);
  expect(requests.find(item => item.url.endsWith("/api/v2/auth/refresh"))?.init?.body).toContain("refresh-one");

  const logout = await POST(new NextRequest("https://app.example.invalid/api/auth/logout", {
    method: "POST", headers: { origin: "https://app.example.invalid", cookie, "x-csrf-token": sessionCsrf },
  }), ctx("auth/logout"));
  expect(logout.status).toBe(204);
  const stored = await control!.query(`SELECT status, encrypted_tokens FROM ${schema}.web_sessions`);
  expect(stored.rows).toHaveLength(1);
  expect(stored.rows[0]).toEqual({ status: "REVOKED", encrypted_tokens: "" });
  expect(logout.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
  finishSlowScheme(Response.json({ scheme: "synthetic" }));
  expect((await pendingScheme).status).toBe(200);
});
