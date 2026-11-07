// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/[...path]/route';
beforeEach(() => { process.env.BFF_SESSION_KEY = randomBytes(32).toString('base64'); process.env.BFF_ORIGIN = 'https://app.example.invalid'; process.env.API_INTERNAL_URL = 'https://api.example.invalid'; vi.stubGlobal('fetch', vi.fn()); });
const context = (path:string) => ({params:Promise.resolve({path:path.split('/')})});
it('rejects a forged cross-origin mutation before contacting FastAPI', async () => {
  const response = await POST(new NextRequest('https://app.example.invalid/api/auth/login',{method:'POST',headers:{origin:'https://attacker.invalid'},body:'{}'}),context('auth/login'));
  expect(response.status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects same-origin mutations without CSRF', async () => {
  const response = await POST(new NextRequest('https://app.example.invalid/api/auth/login',{method:'POST',headers:{origin:'https://app.example.invalid'},body:'{}'}),context('auth/login'));
  expect(response.status).toBe(403);
});
it('does not allow refresh through GET or arbitrary proxy destinations', async () => {
  expect((await GET(new NextRequest('https://app.example.invalid/api/auth/refresh'),context('auth/refresh'))).status).toBe(405);
  const missing = await GET(new NextRequest('https://app.example.invalid/api/elsewhere'),context('elsewhere'));
  expect(missing.status).toBe(404);
  expect(await missing.json()).toMatchObject({ code: 'NOT_FOUND', message: expect.any(String), detail: expect.any(String), details: null });
  expect(fetch).not.toHaveBeenCalled();
});
it('issues a no-store CSRF bootstrap with an HttpOnly cookie', async () => {
  const response = await GET(new NextRequest('https://app.example.invalid/api/auth/csrf'),context('auth/csrf'));
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i);
  expect(response.headers.get('set-cookie')).toMatch(/SameSite=lax/i);
  expect((await response.json()).token).toBeTypeOf('string');
});
it('allows only the public GET verifier without a BFF session', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status: 'VALID' }), { status: 200 }));
  const id = 'A'.repeat(43);
  const response = await GET(
    new NextRequest(`https://app.example.invalid/api/verify/${id}?sha256=${'b'.repeat(64)}`),
    context(`verify/${id}`),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(fetch).toHaveBeenCalledWith(
    `https://api.example.invalid/verify/${id}?sha256=${'b'.repeat(64)}`,
    expect.objectContaining({ method: 'GET', cache: 'no-store' }),
  );
  expect(vi.mocked(fetch).mock.calls[0][1]).not.toHaveProperty('headers.Authorization');
  const denied = await POST(new NextRequest(`https://app.example.invalid/api/verify/${id}`, { method: 'POST' }), context(`verify/${id}`));
  expect(denied.status).toBe(404);
});
it('sets host-only Secure cookies for production BFF sessions', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.resetModules();
  const route = await import('@/app/api/[...path]/route');
  const response = await route.GET(new NextRequest('https://app.example.invalid/api/auth/csrf'),context('auth/csrf'));
  expect(response.headers.get('set-cookie')).toMatch(/__Host-immuno_bootstrap=/);
  expect(response.headers.get('set-cookie')).toMatch(/Secure/i);
  expect(response.headers.get('set-cookie')).toMatch(/Path=\//i);
  vi.unstubAllEnvs();
  vi.resetModules();
});
