import { NextRequest, NextResponse } from "next/server";
import { csrf, locked, opaque, replace, retire, store, validCsrf, type TokenPair } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const production = process.env.NODE_ENV === "production";
const cookieName = production ? "__Host-immuno_session" : "immuno_session";
const bootstrapName = production ? "__Host-immuno_bootstrap" : "immuno_bootstrap";
const cookieOptions = { httpOnly: true, secure: production, sameSite: "lax" as const, path: "/" };
const allowed = new Set(["auth", "users", "scheme", "evidence", "certificates", "admin", "vaccines", "notifications", "communications", "audit", "verify"]);
const publicAuth = new Set(["auth/login", "auth/forgot-password", "auth/reset-password"]);
const errorCodes: Record<number, string> = { 400: "BAD_REQUEST", 401: "UNAUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT", 422: "INVALID_REQUEST", 429: "RATE_LIMITED", 500: "INTERNAL_ERROR", 503: "SERVICE_UNAVAILABLE" };
const safeErrorMessages: Record<number, string> = { 400: "La solicitud no se pudo procesar.", 401: "La autenticación no es válida.", 403: "No tienes permiso para realizar esta acción.", 404: "No se encontró el recurso solicitado.", 409: "La operación entra en conflicto con el estado actual.", 422: "La solicitud no es válida.", 429: "Demasiadas solicitudes. Intenta de nuevo más tarde.", 500: "Ocurrió un error interno.", 503: "El servicio no está disponible temporalmente." };
function failure(status: number, detail: string, code?: string) {
  const message = safeErrorMessages[status] ?? "No se pudo procesar la solicitud.";
  return NextResponse.json({ code: code ?? errorCodes[status] ?? "REQUEST_FAILED", message, details: null, detail }, { status, headers: { "Cache-Control": "no-store" } });
}
function upstream(path: string) {
  const configured = process.env.API_INTERNAL_URL;
  if (!configured) throw new Error("API_INTERNAL_URL required");
  const base = configured.replace(/\/+$/, "").replace(/\/api\/v[12]$/, "");
  if (path.startsWith("verify/")) return `${base}/${path}`;
  const version = (["auth/login", "auth/refresh", "auth/logout"].includes(path) || path.startsWith("auth/sessions")) ? "v2" : "v1";
  return `${base}/api/${version}/${path}`;
}
async function call(path: string, init: RequestInit) {
  return fetch(upstream(path), { ...init, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(12000) });
}
async function rotate(pair: TokenPair): Promise<TokenPair | null> {
  const response = await call("auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: pair.refresh_token }) });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Refresh unavailable");
  const next = await response.json();
  return { ...next, access_until: Date.now()+next.expires_in*1000 };
}
function relay(response: Response) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const key of ["content-type", "content-disposition", "retry-after"]) {
    const value = response.headers.get(key); if (value) headers.set(key, value);
  }
  // Never forward upstream cookies or redirect locations.
  if (response.status >= 300 && response.status < 400) return failure(502, "Respuesta no disponible");
  return new NextResponse(response.body, { status: response.status, headers });
}
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const parts = (await context.params).path;
  if (!allowed.has(parts[0]) || parts.some(p => !/^[a-zA-Z0-9_-]+$/.test(p))) return failure(404, "Ruta no disponible");
  const path = parts.join("/");
  if (parts[0] === "verify") {
    if (request.method !== "GET" || parts.length !== 2) return failure(404, "Ruta no disponible");
    try {
      const response = await call(path + request.nextUrl.search, { method: "GET" });
      return relay(response);
    } catch {
      return failure(503, "Servicio temporalmente no disponible");
    }
  }
  if (["auth/login", "auth/logout", "auth/refresh", "auth/forgot-password", "auth/reset-password", "auth/change-password"].includes(path) && request.method !== "POST") return failure(405, "Método no permitido");
  const handle = request.cookies.get(cookieName)?.value;
  const bootstrap = request.cookies.get(bootstrapName)?.value;
  try {
    if (path === "auth/csrf" && request.method === "GET") {
      const seed = handle ?? bootstrap ?? opaque();
      const response = NextResponse.json({ token: csrf(seed) }, { headers: { "Cache-Control": "no-store" } });
      if (!handle && !bootstrap) response.cookies.set(bootstrapName, seed, { ...cookieOptions, maxAge: 3600 });
      return response;
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      const origin = process.env.BFF_ORIGIN ?? (!production ? request.nextUrl.origin : undefined);
      if (!origin || request.headers.get("origin") !== origin || !validCsrf(handle ?? bootstrap ?? "", request.headers.get("x-csrf-token") ?? "")) return failure(403, "Solicitud no autorizada");
    }
    if (publicAuth.has(path) && request.method === "POST") {
      if (path === "auth/login" && handle) {
        const previous = await locked(handle, async (db, pair) => {
          await retire(db, handle);
          return pair.refresh_token;
        });
        if (previous) await call("auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: previous }) });
      }
      const response = await call(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: await request.text() });
      if (path !== "auth/login" || !response.ok) return relay(response);
      const pair = await response.json();
      const nextHandle = opaque();
      await store(nextHandle, { ...pair, access_until: Date.now()+pair.expires_in*1000 });
      const result = NextResponse.json({ must_change_password: pair.must_change_password }, { headers: { "Cache-Control": "no-store" } });
      result.cookies.set(cookieName, nextHandle, { ...cookieOptions, maxAge: pair.refresh_expires_in });
      return result;
    }
    if (!handle) return failure(401, "Inicia sesión nuevamente");
    const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
    const result = await locked(handle, async (db, stored) => {
      let pair = stored;
      if (path === "auth/logout" && request.method === "POST") {
        await retire(db, handle);
        return { kind: "logout" as const, refresh: pair.refresh_token };
      }
      if (pair.access_until <= Date.now()+5000 || path === "auth/refresh") {
        const next = await rotate(pair);
        if (!next) { await retire(db, handle); return { kind: "expired" as const }; }
        pair = next; await replace(db, handle, pair);
      }
      return { kind: path === "auth/refresh" ? "refresh" as const : "proxy" as const, pair };
    });
    if (!result || result.kind === "expired") {
      const response = failure(401, "Inicia sesión nuevamente");
      response.cookies.set(cookieName, "", { ...cookieOptions, maxAge: 0 });
      return response;
    }
    if (result.kind === "logout") {
      let response: NextResponse;
      try {
        await call("auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: result.refresh }) });
        response = new NextResponse(null, { status: 204 });
      } catch {
        response = failure(503, "Servicio temporalmente no disponible");
      }
      response.cookies.set(cookieName, "", { ...cookieOptions, maxAge: 0 });
      return response;
    }
    if (result.kind === "refresh") {
      const response = new NextResponse(null, { status: 204 });
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    const headers = new Headers({ Authorization: `Bearer ${result.pair.access_token}` });
    const type = request.headers.get("content-type"); if (type) headers.set("Content-Type", type);
    // Keep FastAPI's trailing slash contracts to avoid 307 on multipart/POST.
    const suffix = ["scheme", "evidence", "notifications"].includes(path) ? "/" : "";
    const upstreamResponse = await call(path+suffix+request.nextUrl.search, { method: request.method, headers, body });
    if (upstreamResponse.status === 401 || (path === "auth/change-password" && upstreamResponse.ok)) {
      await locked(handle, async (db) => { await retire(db, handle); return null; });
    }
    const response = relay(upstreamResponse);
    response.headers.set("Cache-Control", "no-store");
    if (response.status === 401 || (path === "auth/change-password" && response.ok)) response.cookies.set(cookieName, "", { ...cookieOptions, maxAge: 0 });
    return response;
  } catch {
    return failure(503, "Servicio temporalmente no disponible");
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE, handle as HEAD };
