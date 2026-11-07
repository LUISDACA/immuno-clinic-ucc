import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Dashboard from '@/app/admin/page';
import { AppShell } from '../app-shell';
import { getAcademicOptions, getStatistics, downloadStudentsExport } from '@/lib/api/admin';
import { useAuthStore } from '@/lib/auth/store';
import type { AdminStatistics } from '@/lib/api/types';
const nav = vi.hoisted(() => ({ pathname: '/admin', search: '', listeners: new Set<() => void>(), push: vi.fn() }));
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    usePathname: () => nav.pathname,
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(listener => { nav.listeners.add(listener); return () => { nav.listeners.delete(listener); }; }, () => nav.search, () => nav.search)),
    useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  };
});
vi.mock('@/lib/api/notifications', () => ({ listNotifications: vi.fn(async () => []) }));
vi.mock('@/lib/api/admin', () => ({ getAcademicOptions: vi.fn(), getStatistics: vi.fn(), downloadStudentsExport: vi.fn() }));
const fixture = JSON.parse(readFileSync('../docs/ui/fixtures/phase5b-admin-dashboard.json', 'utf8')) as { data: AdminStatistics; empty: AdminStatistics };
const clients: QueryClient[] = [];
beforeEach(() => {
  vi.resetAllMocks(); nav.pathname = '/admin'; nav.search = '';
  vi.mocked(getAcademicOptions).mockResolvedValue({ programs: [], campuses: [], semesters: Array.from({ length: 10 }, (_, i) => i + 1) });
  nav.push.mockImplementation((url: string) => { nav.search = url.split('?')[1] ?? ''; nav.listeners.forEach(listener => listener()); });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });
function mount(role: 'admin' | 'app_admin') {
  useAuthStore.setState({ email: 'admin@example.invalid', role });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  render(<QueryClientProvider client={client}><Dashboard /></QueryClientProvider>); return client;
}
function deferred() {
  let resolve!: (data: AdminStatistics) => void;
  const promise = new Promise<AdminStatistics>(complete => { resolve = complete; }); return { promise, resolve };
}
function failure(status: number) { return new AxiosError('Synthetic unsafe diagnostic', undefined, undefined, undefined, { status } as never); }
const regionName = (role: string) => role === 'admin' ? 'Estadísticas' : 'Análisis global';
it.each(['admin', 'app_admin'] as const)('%s loading keeps role navigation and disables refresh', async role => {
  const pending = deferred(); vi.mocked(getStatistics).mockReturnValue(pending.promise); mount(role);
  await waitFor(() => expect(getStatistics).toHaveBeenCalled());
  expect(screen.getByRole('region', { name: regionName(role) })).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('button', { name: 'Actualizar estadísticas' })).toBeDisabled();
  expect(screen.getByRole('link', { name: role === 'admin' ? /Crear estudiante/ : /Administradores/ })).toBeVisible();
});
it.each(['admin', 'app_admin'] as const)('%s zero data is a successful empty presentation', async role => {
  vi.mocked(getStatistics).mockResolvedValue(fixture.empty); mount(role);
  expect((await screen.findAllByText('Sin datos.'))[0]).toBeVisible(); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Actualizar estadísticas' })).toBeEnabled();
});
it.each(['admin', 'app_admin'] as const)('%s navigation stays within existing role capabilities', async role => {
  vi.mocked(getStatistics).mockResolvedValue(fixture.data); mount(role); await screen.findByText('Vacuna sintética 1');
  if (role === 'admin') {
    expect(screen.queryByRole('link', { name: /^Administradores/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Totales.*100/ })).toHaveAttribute('href', '/admin/students');
  } else {
    expect(screen.getByRole('link', { name: /^Administradores/ })).toHaveAttribute('href', '/admin/admins');
    expect(screen.queryByRole('link', { name: /Crear estudiante/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Semestre')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /Exportar/ })).not.toBeInTheDocument();
  }
});
it.each(['admin', 'app_admin'] as const)('%s refresh denial hides cached analysis without removing navigation', async role => {
  vi.mocked(getStatistics).mockResolvedValue(fixture.data); const client = mount(role); await screen.findByText('Vacuna sintética 1');
  vi.mocked(getStatistics).mockRejectedValue(failure(403)); await act(() => client.invalidateQueries({ queryKey: ['admin', 'stats'] }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso');
  expect(screen.queryByText('Vacuna sintética 1')).not.toBeInTheDocument(); expect(screen.queryByText('Completo (60)')).not.toBeInTheDocument();
  expect(screen.queryByText('Campus sintético A')).not.toBeInTheDocument(); expect(screen.getByRole('link', { name: /Comunicaciones/ })).toBeVisible();
});
it.each(['admin', 'app_admin'] as const)('%s manual refresh shares one delayed GET and updates data', async role => {
  const pending = deferred(); vi.mocked(getStatistics).mockResolvedValueOnce(fixture.data).mockReturnValue(pending.promise);
  const user = userEvent.setup(); mount(role); await screen.findByText('Vacuna sintética 1'); await user.dblClick(screen.getByRole('button', { name: 'Actualizar estadísticas' }));
  expect(getStatistics).toHaveBeenCalledTimes(2); expect(screen.getByRole('button', { name: 'Actualizar estadísticas' })).toBeDisabled();
  const changed = { ...fixture.data, total_students: 101, vaccine_compliance: fixture.data.vaccine_compliance.map(v => ({ ...v, name: v.name + ' actualizada' })) };
  await act(async () => pending.resolve(changed)); expect(await screen.findByText('Vacuna sintética 1 actualizada')).toBeVisible();
  expect(screen.getByRole('region', { name: regionName(role) })).toHaveAttribute('aria-busy', 'false');
  if (role === 'admin') expect(screen.getByRole('link', { name: /Totales.*101/ })).toBeVisible(); expect(downloadStudentsExport).not.toHaveBeenCalled();
});
it.each([403, 404, 500, 503])('HTTP %s offers safe retry and restores analysis', async status => {
  vi.mocked(getStatistics).mockRejectedValueOnce(failure(status)).mockResolvedValue(fixture.data); const user = userEvent.setup(); mount('admin');
  expect(await screen.findByRole('alert')).toBeVisible(); expect(screen.queryByText('Synthetic unsafe diagnostic')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Reintentar' })); expect(await screen.findByText('Vacuna sintética 1')).toBeVisible();
});
it('all five statistic links preserve semester and existing filters', async () => {
  vi.mocked(getStatistics).mockResolvedValue(fixture.data); const user = userEvent.setup(); mount('admin'); await screen.findByText('Vacuna sintética 1');
  await user.selectOptions(screen.getByLabelText('Semestre'), '3'); await waitFor(() => expect(getStatistics).toHaveBeenCalledWith(3));
  for (const [label, filter] of [['Totales', ''], ['Activos', '&active=true'], ['Desactivados', '&active=false'], ['Esquema 100%', '&scheme=approved'], ['Pendientes', '&scheme=pending']]) {
    const href = screen.getByRole('link', { name: new RegExp(label) }).getAttribute('href')!;
    const query = new URL(href, 'https://example.invalid').searchParams; expect(query.get('semester')).toBe('3');
    for (const [key, value] of new URLSearchParams(filter)) expect(query.get(key)).toBe(value);
  }
});
it.each(['admin', 'app_admin'] as const)('%s ranking expansion associates its existing list', async role => {
  vi.mocked(getStatistics).mockResolvedValue(fixture.data); const user = userEvent.setup(); mount(role); await screen.findByText('Vacuna sintética 1');
  const button = screen.getByRole('button', { name: 'Ver mas' }); expect(button).toHaveAttribute('aria-expanded', 'false');
  const list = document.getElementById(button.getAttribute('aria-controls')!); expect(list).not.toBeNull();
  expect(within(list!).getAllByRole('listitem')).toHaveLength(3); await user.click(button); expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(within(list!).getAllByRole('listitem')).toHaveLength(5); await user.click(screen.getByRole('button', { name: 'Ver menos' })); expect(button).toHaveAttribute('aria-expanded', 'false');
});

it('ranking omits zero-total entries and uses the Flutter tie-break order', async () => {
  vi.mocked(getStatistics).mockResolvedValue({
    ...fixture.data,
    vaccine_compliance: [
      { vaccine_id: 'synthetic-zero', name: 'Zero total', code: 'Z', up_to_date: 0, pending: 0, denied: 0, in_review: 0, total: 0 },
      { vaccine_id: 'synthetic-tie-small', name: 'Tie small total', code: 'S', up_to_date: 1, pending: 1, denied: 0, in_review: 0, total: 2 },
      { vaccine_id: 'synthetic-higher', name: 'Higher compliance', code: 'H', up_to_date: 6, pending: 4, denied: 0, in_review: 0, total: 10 },
      { vaccine_id: 'synthetic-tie-large', name: 'Tie large total', code: 'L', up_to_date: 50, pending: 50, denied: 0, in_review: 0, total: 100 },
      { vaccine_id: 'synthetic-lower', name: 'Lower compliance', code: 'B', up_to_date: 1, pending: 9, denied: 0, in_review: 0, total: 10 },
    ],
  });
  mount('app_admin');
  await screen.findByText('Higher compliance');
  const more = screen.getByRole('button', { name: 'Ver mas' });
  const list = document.getElementById(more.getAttribute('aria-controls')!);
  expect(list).not.toBeNull();
  const entries = within(list!).getAllByRole('listitem');
  expect(entries).toHaveLength(3);
  expect(entries.map(entry => entry.textContent)).toEqual([
    expect.stringContaining('Higher compliance'),
    expect.stringContaining('Tie large total'),
    expect.stringContaining('Tie small total'),
  ]);
  expect(screen.queryByText('Zero total')).not.toBeInTheDocument();
  await userEvent.setup().click(more);
  expect(within(list!).getAllByRole('listitem')).toHaveLength(4);
});

it.each([['/admin', true], ['/admin/history', false]] as const)('shell isolates decoration only for dashboard %s in this block', (path, isolated) => {
  nav.pathname = path;
  const client = new QueryClient(); clients.push(client);
  render(<QueryClientProvider client={client}><AppShell title="Synthetic shell" nav={[]}><p>Synthetic content</p></AppShell></QueryClientProvider>);
  const root = screen.getByRole('banner').parentElement!;
  if (isolated) expect(root).toHaveClass('relative', 'z-0'); else expect(root).not.toHaveClass('z-0');
});
