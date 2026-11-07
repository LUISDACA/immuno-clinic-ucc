import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Dashboard from '@/app/student/page';
import { getMyScheme } from '@/lib/api/scheme';
import { useAuthStore } from '@/lib/auth/store';
import type { SchemeOverview } from '@/lib/api/types';

vi.mock('@/lib/api/scheme', () => ({ getMyScheme: vi.fn() }));
const fixture = JSON.parse(readFileSync('../docs/ui/fixtures/phase5b-student-dashboard.json', 'utf8')) as { data: SchemeOverview; empty: SchemeOverview };
const clients: QueryClient[] = [];
beforeEach(() => { vi.resetAllMocks(); useAuthStore.setState({ email: 'student@example.invalid', role: 'student' }); });
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  render(<QueryClientProvider client={client}><Dashboard /></QueryClientProvider>);
  return client;
}
function deferred() {
  let resolve!: (data: SchemeOverview) => void;
  const promise = new Promise<SchemeOverview>(complete => { resolve = complete; });
  return { promise, resolve };
}
function failure(status: number) { return new AxiosError('Synthetic unsafe diagnostic', undefined, undefined, undefined, { status } as never); }

it('initial loading shows no invented clinical status and keeps quick actions available', async () => {
  const pending = deferred(); vi.mocked(getMyScheme).mockReturnValue(pending.promise); mount();
  expect(screen.queryByText('Requiere atención')).not.toBeInTheDocument();
  expect(screen.queryByText('Al día')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Actualizar estadísticas' })).toBeDisabled();
  expect(screen.getByRole('link', { name: /Mi esquema/ })).toHaveAttribute('href', '/student/scheme');
  await act(async () => pending.resolve(fixture.data));
  expect(await screen.findByText('Requiere atención')).toBeVisible();
});

it('shows all five backend counters, including zero denied, without recounting vaccines', async () => {
  vi.mocked(getMyScheme).mockResolvedValue(fixture.data); mount();
  const region = await screen.findByRole('region', { name: 'Estadísticas de vacunas' });
  await waitFor(() => expect(within(region).getByText('Total').parentElement).toHaveTextContent('10'));
  for (const [label, count] of [['Total', 10], ['Aprobadas', 5], ['Pendientes', 3], ['Denegadas', 0], ['En revisión', 2]] as const) {
    expect(within(region).getByText(label).parentElement).toHaveTextContent(String(count));
  }
});

it('a zero response displays backend zeros and keeps navigation, without treating it as an error', async () => {
  vi.mocked(getMyScheme).mockResolvedValue(fixture.empty); mount();
  await waitFor(() => expect(screen.getByText('Denegadas').parentElement).toHaveTextContent('0'));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Documentos/ })).toHaveAttribute('href', '/student/evidence');
});

it.each([true, false])('represents is_up_to_date=%s independently of counts and other backend flags', async ready => {
  vi.mocked(getMyScheme).mockResolvedValue({ ...fixture.data, is_up_to_date: ready, is_complete: false, is_certifiable: !ready });
  mount();
  expect(await screen.findByText(ready ? 'Al día' : 'Requiere atención')).toBeVisible();
  expect(screen.getByRole('link', { name: /Certificado/ })).toHaveAttribute('href', '/student/certificate');
});

it.each([403, 404, 500, 503])('HTTP %s stays inside statistics and preserves all quick actions', async status => {
  vi.mocked(getMyScheme).mockRejectedValue(failure(status)); mount();
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByText('Bienvenido')).toBeVisible();
  for (const href of ['/student/scheme', '/student/evidence', '/student/certificate', '/student/communications', '/student/notifications', '/student/history', '/student/profile']) {
    expect(screen.getAllByRole('link').some(link => link.getAttribute('href') === href)).toBe(true);
  }
  expect(screen.queryByText('Synthetic unsafe diagnostic')).not.toBeInTheDocument();
  expect(screen.queryByText('Requiere atención')).not.toBeInTheDocument();
});

it('manual refresh shares one delayed request and updates backend counters and signal', async () => {
  const pending = deferred(); vi.mocked(getMyScheme).mockResolvedValueOnce(fixture.data).mockReturnValue(pending.promise);
  const user = userEvent.setup(); mount(); await screen.findByText('Requiere atención');
  await user.dblClick(screen.getByRole('button', { name: 'Actualizar estadísticas' }));
  expect(getMyScheme).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: 'Actualizar estadísticas' })).toBeDisabled();
  expect(screen.getByRole('region', { name: 'Estadísticas de vacunas' })).toHaveAttribute('aria-busy', 'true');
  await act(async () => pending.resolve({ ...fixture.data, approved_vaccines: 7, is_up_to_date: true }));
  expect(await screen.findByText('Al día')).toBeVisible();
  expect(screen.getByText('Aprobadas').parentElement).toHaveTextContent('7');
  expect(screen.getByRole('button', { name: 'Actualizar estadísticas' })).toBeEnabled();
});

it('a refresh denied by the server hides cached clinical counters and signal while preserving navigation', async () => {
  vi.mocked(getMyScheme).mockResolvedValue(fixture.data); const client = mount(); await screen.findByText('Requiere atención');
  vi.mocked(getMyScheme).mockRejectedValue(failure(403));
  await act(() => client.invalidateQueries({ queryKey: ['scheme', 'me'] }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso');
  expect(screen.queryByText('Total')).not.toBeInTheDocument();
  expect(screen.queryByText('Requiere atención')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Mi perfil/ })).toBeVisible();
});

it('retry restores statistics and never performs a clinical mutation', async () => {
  vi.mocked(getMyScheme).mockRejectedValueOnce(failure(503)).mockResolvedValue(fixture.data);
  const user = userEvent.setup(); mount(); await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('Requiere atención')).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(getMyScheme).toHaveBeenCalledTimes(2);
});
