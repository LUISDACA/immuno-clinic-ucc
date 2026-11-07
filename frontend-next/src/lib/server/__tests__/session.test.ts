// @vitest-environment node
import { randomBytes } from "node:crypto";
import { beforeAll, afterAll, expect, it } from "vitest";
import { Pool } from "pg";
import { csrf, validCsrf, seal, unseal, store, locked, replace, database, type TokenPair } from "../session";
const pair: TokenPair = { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', session_id: '00000000-0000-0000-0000-000000000001', expires_in: 60, refresh_expires_in: 3600, must_change_password: false, access_until: Date.now()+60000 };
beforeAll(() => { process.env.BFF_SESSION_KEY = randomBytes(32).toString('base64'); });
it('encrypts the pair and rejects tampering', () => {
  const encrypted = seal(pair);
  expect(encrypted).not.toContain(pair.refresh_token);
  expect(unseal(encrypted)).toEqual(pair);
  const parts = encrypted.split('.'); parts[2] = randomBytes(16).toString('base64url');
  expect(() => unseal(parts.join('.'))).toThrow();
});
it('binds CSRF to the opaque session and rejects arbitrary input', () => {
  expect(validCsrf('session-a', csrf('session-a'))).toBe(true);
  expect(validCsrf('session-b', csrf('session-a'))).toBe(false);
  expect(validCsrf('session-a','')).toBe(false);
});
const url = process.env.BFF_TEST_DATABASE_URL;
let control: Pool;
const schema = 'bff_' + randomBytes(8).toString('hex');
beforeAll(async () => {
  if (!url) return;
  const parsed = new URL(url);
  if (!['127.0.0.1','localhost'].includes(parsed.hostname) || !parsed.pathname.startsWith('/immuno_phase')) throw new Error('Disposable local PostgreSQL only');
  control = new Pool({connectionString:url});
  await control.query(`CREATE SCHEMA ${schema}`);
  await control.query(`CREATE TABLE ${schema}.web_sessions(cookie_hash text PRIMARY KEY,auth_session_id uuid NOT NULL,encrypted_tokens text NOT NULL,expires_at timestamptz NOT NULL,status text NOT NULL)`);
  parsed.searchParams.set('options', `-c search_path=${schema}`);
  process.env.BFF_DATABASE_URL = parsed.toString();
});
afterAll(async () => { if (control) { await database().end(); await control.query(`DROP SCHEMA ${schema} CASCADE`); await control.end(); } });
it.skipIf(!url)('serializes workers with PostgreSQL and makes the successor visible', async () => {
  await store('synthetic-cookie', pair);
  const seen: string[] = [];
  await Promise.all([1,2].map(() => locked('synthetic-cookie', async (db,current) => {
    seen.push(current.refresh_token);
    await new Promise(resolve => setTimeout(resolve,20));
    await replace(db,'synthetic-cookie',{...current,refresh_token:'successor'});
  })));
  expect(seen).toEqual(['synthetic-refresh','successor']);
});
it.skipIf(!url)('an ambiguous failure invalidates the stored credentials', async () => {
  await store('failed-cookie', pair);
  await expect(locked('failed-cookie',async () => { throw new Error('Synthetic failure'); })).rejects.toThrow();
  expect(await locked('failed-cookie',async () => 'unexpected')).toBeNull();
});
