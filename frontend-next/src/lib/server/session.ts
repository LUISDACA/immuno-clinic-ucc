import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Pool, type PoolClient } from "pg";

export type TokenPair = { access_token: string; refresh_token: string; session_id: string; expires_in: number; refresh_expires_in: number; must_change_password: boolean; access_until: number };
let pool: Pool | undefined;
export function database() {
  if (!process.env.BFF_DATABASE_URL) throw new Error("BFF_DATABASE_URL required");
  return pool ??= new Pool({ connectionString: process.env.BFF_DATABASE_URL, max: 5, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10000 });
}
function key() {
  const value = Buffer.from(process.env.BFF_SESSION_KEY ?? "", "base64");
  if (value.length !== 32) throw new Error("BFF_SESSION_KEY must contain 32 random bytes (base64)");
  return value;
}
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const opaque = () => randomBytes(32).toString("base64url");
export function seal(value: TokenPair) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}
export function unseal(value: string): TokenPair {
  const [version, iv, tag, data] = value.split(".");
  if (version !== "v1") throw new Error("Unsupported envelope");
  const cipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data, "base64url")), cipher.final()]).toString("utf8"));
}
export function csrf(handle: string) { return createHmac("sha256", key()).update("csrf:" + handle).digest("base64url"); }
export function validCsrf(handle: string, token: string) {
  const expected = Buffer.from(csrf(handle));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function store(handle: string, pair: TokenPair) {
  await database().query("INSERT INTO web_sessions(cookie_hash,auth_session_id,encrypted_tokens,expires_at,status) VALUES($1,$2,$3,$4,'ACTIVE')", [digest(handle), pair.session_id, seal(pair), new Date(Date.now()+pair.refresh_expires_in*1000)]);
}
export async function locked<T>(handle: string, fn: (client: PoolClient, pair: TokenPair) => Promise<T>): Promise<T | null> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '20s'");
    const result = await client.query("SELECT encrypted_tokens FROM web_sessions WHERE cookie_hash=$1 AND status='ACTIVE' AND expires_at>now() FOR UPDATE", [digest(handle)]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return null; }
    const resultValue = await fn(client, unseal(result.rows[0].encrypted_tokens));
    await client.query("COMMIT");
    return resultValue;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    // Ambiguous refresh outcome: never put an old pair back into service.
    await client.query("UPDATE web_sessions SET status='REVOKED',encrypted_tokens='' WHERE cookie_hash=$1", [digest(handle)]).catch(() => undefined);
    throw error;
  } finally { client.release(); }
}
export async function replace(client: PoolClient, handle: string, pair: TokenPair) {
  await client.query("UPDATE web_sessions SET encrypted_tokens=$2 WHERE cookie_hash=$1 AND status='ACTIVE'", [digest(handle), seal(pair)]);
}
export async function retire(client: PoolClient, handle: string) {
  await client.query("UPDATE web_sessions SET status='REVOKED',encrypted_tokens='' WHERE cookie_hash=$1", [digest(handle)]);
}
