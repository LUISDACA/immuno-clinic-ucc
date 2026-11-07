import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Dashboard from '@/app/admin/page';
import { getAcademicOptions, getStatistics, downloadStudentsExport } from '@/lib/api/admin';
import { useAuthStore } from '@/lib/auth/store';
import type { AdminStatistics } from '@/lib/api/types';
const nav = vi.hoisted(() => ({ search: '', listeners: new Set<() => void>(), push: vi.fn() }));
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(listener => { nav.listeners.add(listener); return () => { nav.listeners.delete(listener); }; }, () => nav.search, () => nav.search)),
    useRouter: () => ({ push: nav.push }),
  };
});
vi.mock('@/lib/api/admin', () => ({ getAcademicOptions: vi.fn(), getStatistics: vi.fn(), downloadStudentsExport: vi.fn() }));
const fixture = JSON.parse(readFileSync('../docs/ui/fixtures/phase5b-admin-dashboard.json', 'utf8')) as { data: AdminStatistics };
const clients: QueryClient[] = [];
function location(search: string) { nav.search = search; nav.listeners.forEach(listener => listener()); }
beforeEach(() => {
  vi.resetAllMocks(); nav.search = '';
  nav.push.mockImplementation((url: string) => location(url.split('?')[1] ?? ''));
  vi.mocked(getAcademicOptions).mockResolvedValue({ programs: [], campuses: [], semesters: Array.from({ length: 10 }, (_, i) => i + 1) });
  useAuthStore.setState({ email: 'admin@example.invalid', role: 'admin' });
  vi.mocked(getStatistics).mockImplementation(async semester => ({ ...fixture.data, total_students: (semester ?? 0) * 10 }));
  vi.mocked(downloadStudentsExport).mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });
function mount(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  if (!clients.includes(client)) clients.push(client);
  return { client, ...render(<QueryClientProvider client={client}><Dashboard /></QueryClientProvider>) };
}
function deferred() {
  let resolve!: (data: AdminStatistics) => void, reject!: (error: unknown) => void;
  const promise = new Promise<AdminStatistics>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
it('deep link loads only its semester and uses the existing query key', async () => {
  nav.search = 'semester=3'; const { client } = mount();
  await waitFor(() => expect(getStatistics).toHaveBeenCalledWith(3));
  expect(screen.getByLabelText('Semestre')).toHaveValue('3');
  expect(getStatistics).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(['admin', 'stats', '3'])).toMatchObject({ total_students: 30 });
});
it('reload or remount reads the same URL semester', async () => {
  nav.search = 'semester=3'; const first = mount(); await screen.findByRole('link', { name: /Totales.*30/ });
  first.unmount(); mount(); await screen.findByRole('link', { name: /Totales.*30/ });
  expect(screen.getByLabelText('Semestre')).toHaveValue('3');
  expect(vi.mocked(getStatistics).mock.calls.every(([semester]) => semester === 3)).toBe(true);
});
it('history changes update selection, query and all five statistic links', async () => {
  nav.search = 'semester=1'; mount(); await screen.findByRole('link', { name: /Totales.*10/ });
  await act(() => location('semester=3')); await screen.findByRole('link', { name: /Totales.*30/ });
  expect(screen.getByLabelText('Semestre')).toHaveValue('3');
  await act(() => location('semester=1')); await screen.findByRole('link', { name: /Totales.*10/ });
  expect(screen.getByLabelText('Semestre')).toHaveValue('1');
  for (const label of ['Totales', 'Activos', 'Desactivados', 'Esquema 100%', 'Pendientes']) {
    expect(new URL(screen.getByRole('link', { name: new RegExp(label) }).getAttribute('href')!, 'https://example.invalid').searchParams.get('semester')).toBe('1');
  }
});
it('selection writes a canonical local URL with only semester; Todos removes it', async () => {
  nav.search = 'ignored=synthetic-private-value'; const user = userEvent.setup(); mount(); await screen.findByText('Vacuna sintética 1');
  await user.selectOptions(screen.getByLabelText('Semestre'), '3');
  expect(nav.push).toHaveBeenLastCalledWith('/admin?semester=3', { scroll: false });
  await screen.findByRole('link', { name: /Totales.*30/ });
  await user.selectOptions(screen.getByLabelText('Semestre'), '');
  expect(nav.push).toHaveBeenLastCalledWith('/admin', { scroll: false });
  await screen.findByRole('link', { name: /Totales.*0/ });
});
it('CSV export uses the restored semester', async () => {
  nav.search = 'semester=3'; const user = userEvent.setup(); mount(); await screen.findByRole('link', { name: /Totales.*30/ }, { timeout: 5000 });
  await user.click(screen.getByRole('button', { name: 'Exportar reporte CSV' }));
  expect(downloadStudentsExport).toHaveBeenCalledWith({ semester: 3 }, expect.any(Object));
});
it('app_admin stays unfiltered regardless of a regular-admin semester URL', async () => {
  nav.search = 'semester=3'; useAuthStore.setState({ role: 'app_admin' }); mount(); await screen.findByText('Vacuna sintética 1');
  expect(getStatistics).toHaveBeenCalledWith(); expect(screen.queryByLabelText('Semestre')).not.toBeInTheDocument();
  expect(downloadStudentsExport).not.toHaveBeenCalled();
});
it.each(['semester=13', 'semester=0', 'semester=3&semester=5', 'semester=synthetic-invalid'])('unsupported URL %s safely retains current options and defaults to Todos', async search => {
  nav.search = search; mount(); await screen.findByRole('link', { name: /Totales.*0/ }, { timeout: 5000 });
  expect(screen.getByLabelText('Semestre')).toHaveValue(''); expect(getStatistics).toHaveBeenCalledWith(undefined);
  expect(screen.getAllByRole('option')).toHaveLength(11); // Todos plus FastAPI's ten canonical options.
});
it('a delayed response for the old semester cannot overwrite the selected semester', async () => {
  const old = deferred(); vi.mocked(getStatistics).mockImplementation(semester => semester === 1 ? old.promise : Promise.resolve({ ...fixture.data, total_students: 30 }));
  nav.search = 'semester=1'; mount(); await waitFor(() => expect(getStatistics).toHaveBeenCalledWith(1));
  await act(() => location('semester=3')); await screen.findByRole('link', { name: /Totales.*30/ });
  await act(async () => old.resolve({ ...fixture.data, total_students: 777 }));
  expect(screen.getByLabelText('Semestre')).toHaveValue('3'); expect(screen.getByRole('link', { name: /Totales.*30/ })).toBeVisible();
  expect(screen.queryByRole('link', { name: /Totales.*777/ })).not.toBeInTheDocument();
});
it('a delayed 403 for the old semester cannot turn current successful data into an error', async () => {
  const old = deferred(); vi.mocked(getStatistics).mockImplementation(semester => semester === 1 ? old.promise : Promise.resolve({ ...fixture.data, total_students: 30 }));
  nav.search = 'semester=1'; const { client } = mount(); await waitFor(() => expect(getStatistics).toHaveBeenCalledWith(1));
  await act(() => location('semester=3')); await screen.findByRole('link', { name: /Totales.*30/ });
  await act(async () => old.reject(new AxiosError('Synthetic unsafe diagnostic', undefined, undefined, undefined, { status: 403 } as never)));
  await waitFor(() => expect(client.getQueryState(['admin', 'stats', '1'])?.status).toBe('error'));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(screen.getByRole('link', { name: /Totales.*30/ })).toBeVisible();
});
