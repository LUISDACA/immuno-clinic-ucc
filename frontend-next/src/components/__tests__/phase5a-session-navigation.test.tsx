import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, isCancel, type AxiosResponse } from 'axios';
import { AppProviders } from '../providers';
import { AppShell } from '../app-shell';
import { AuthGate } from '../auth-gate';
import { apiClient, clearSession } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';
import { getQueryClient } from '@/lib/query/provider';

const navigation = vi.hoisted(() => ({ replace: vi.fn(), path: '/student/scheme' }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation, usePathname: () => navigation.path }));
vi.mock('../brand', () => ({ UccBrandBackground: ({children}: {children: React.ReactNode}) => <>{children}</>, UccLogo: () => null }));
vi.mock('../theme-provider', () => ({ ThemeProvider: ({children}: {children: React.ReactNode}) => <>{children}</> }));
vi.mock('../theme-toggle', () => ({ ThemeModeToggle: () => null }));
vi.mock('../user-menu', () => ({ UserMenu: () => null }));
vi.mock('sonner', () => ({ Toaster: () => null }));

beforeEach(() => {
  navigation.replace.mockReset();
  getQueryClient().clear();
  useAuthStore.setState({ isAuthenticated: true, isHydrated: true, role: 'student', mustChangePassword: false, checkSession: vi.fn().mockResolvedValue(undefined) });
});
afterEach(() => { cleanup(); getQueryClient().clear(); });

it('a terminal API 401 removes mounted protected content, clears cache and redirects', async () => {
  render(<AppProviders><AuthGate requireRole="student"><p>Protected synthetic data</p></AuthGate></AppProviders>);
  getQueryClient().setQueryData(['scheme', 'me'], { synthetic: true });
  expect(screen.getByText('Protected synthetic data')).toBeInTheDocument();
  await act(async () => {
    await expect(apiClient.get('/scheme/', { adapter: async config => {
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, { status: 401, data: {message: 'Sesión expirada'}, statusText: 'Unauthorized', headers: new AxiosHeaders(), config });
    } })).rejects.toBeInstanceOf(AxiosError);
  });
  expect(screen.queryByText('Protected synthetic data')).not.toBeInTheDocument();
  expect(getQueryClient().getQueryData(['scheme','me'])).toBeUndefined();
  expect(navigation.replace).toHaveBeenCalledWith('/login');
});

it('discards a late successful response from the previous session', async () => {
  let finish!: (value: AxiosResponse) => void;
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const pending = apiClient.get('/scheme/', { adapter: config => new Promise(resolve => {
    finish = response => resolve({ ...response, config }); started();
  }) });
  await ready;
  clearSession();
  const rejected = expect(pending).rejects.toSatisfy(isCancel);
  finish({ status: 200, data: { synthetic: true }, statusText: 'OK', headers: new AxiosHeaders() } as AxiosResponse);
  await rejected;
});

it('exposes every configured module on mobile with one current route', () => {
  const nav = [{ href: '/student', label: 'Inicio' }, { href: '/student/scheme', label: 'Esquema' }, { href: '/student/profile', label: 'Perfil' }];
  render(<AppProviders><AppShell title="Student" nav={nav}><p>Page</p></AppShell></AppProviders>);
  const mobile = within(screen.getByRole('navigation', { name: 'Navegación de módulos' }));
  for (const item of nav) expect(mobile.getByRole('link', { name: item.label })).toHaveAttribute('href', item.href);
  expect(mobile.getByRole('link', { name: 'Esquema' })).toHaveAttribute('aria-current', 'page');
  expect(mobile.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
});
