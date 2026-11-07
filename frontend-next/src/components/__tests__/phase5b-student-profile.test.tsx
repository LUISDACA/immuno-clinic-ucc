import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import Profile from '@/app/student/profile/page';
import { getMe, updateMyProfile } from '@/lib/api/users';
import { useAuthStore } from '@/lib/auth/store';
import type { User } from '@/lib/api/types';
import fixture from '../../../../docs/ui/fixtures/phase5b-student-profile.json';

vi.mock('@/lib/api/users', () => ({ getMe: vi.fn(), updateMyProfile: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const clients: QueryClient[] = [];
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
function error(status: number) {
  return new AxiosError('PRIVATE_DIAGNOSTIC', undefined, undefined, undefined, { status, data: { message: 'PRIVATE_DIAGNOSTIC' } } as never);
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><Profile /></QueryClientProvider>);
  return client;
}
beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({ userId: fixture.id, role: 'student', isAuthenticated: true });
  vi.mocked(getMe).mockResolvedValue(fixture as User);
});
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); });

it('shows initial loading, complete data and calendar date without administrative controls', async () => {
  const pending = deferred<User>(); vi.mocked(getMe).mockReturnValueOnce(pending.promise);
  mount(); expect(screen.getByText('Cargando...')).toBeInTheDocument();
  await act(async () => pending.resolve(fixture as User));
  expect(await screen.findByText(fixture.profile.program)).toBeInTheDocument();
  expect(screen.getByText('29/02/2000')).toBeInTheDocument();
  expect(screen.queryByText('Firma visual para certificados')).not.toBeInTheDocument();
});
it('represents a null profile without inventing personal data', async () => {
  vi.mocked(getMe).mockResolvedValue({ ...fixture, profile: null } as User);
  mount(); await screen.findByText('Mi perfil');
  expect(screen.getAllByText('No registrado').length).toBeGreaterThan(0);
  expect(screen.queryByText(fixture.profile.program)).not.toBeInTheDocument();
});
it.each([401, 403, 404, 429, 500, 503])('HTTP %s remains a safe query error and supports retry', async status => {
  vi.mocked(getMe).mockRejectedValueOnce(error(status));
  mount(); await screen.findByRole('alert');
  expect(screen.queryByText('PRIVATE_DIAGNOSTIC')).not.toBeInTheDocument();
  expect(screen.queryByText('No registrado')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText(fixture.profile.program)).toBeInTheDocument();
});
it('shares a cached-error retry rather than replacing the pending request on double click', async () => {
  const client = mount(); await screen.findByText('Mi perfil');
  vi.mocked(getMe).mockRejectedValueOnce(error(503));
  await act(async () => { await client.refetchQueries({ queryKey: ['user', 'me'] }); });
  await screen.findByRole('alert');
  const pending = deferred<User>(); vi.mocked(getMe).mockReturnValue(pending.promise);
  const before = vi.mocked(getMe).mock.calls.length;
  const retry = screen.getByRole('button', { name: 'Reintentar' });
  fireEvent.click(retry); fireEvent.click(retry);
  await waitFor(() => expect(getMe).toHaveBeenCalledTimes(before + 1));
  expect(retry).toBeDisabled(); expect(retry).toHaveAttribute('aria-busy', 'true');
  await act(async () => pending.resolve(fixture as User));
  expect(await screen.findByText(fixture.profile.program)).toBeInTheDocument();
});
it('saves only the existing contact contract once and displays confirmed values', async () => {
  const pending = deferred<User>(); vi.mocked(updateMyProfile).mockReturnValue(pending.promise);
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
  for (const label of ['Teléfono', 'EPS afiliado', 'Nombre contacto de emergencia', 'Teléfono contacto de emergencia']) {
    expect(screen.getByLabelText(label)).toBeEnabled();
  }
  expect(screen.queryByRole('textbox', { name: 'Sexo' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '0000000002' } });
  const save = screen.getByRole('button', { name: 'Guardar cambios' });
  fireEvent.click(save); fireEvent.click(save);
  await waitFor(() => expect(updateMyProfile).toHaveBeenCalledTimes(1));
  expect(updateMyProfile).toHaveBeenCalledWith({ phone: '0000000002', eps_affiliation: fixture.profile.eps_affiliation, emergency_contact_name: fixture.profile.emergency_contact_name, emergency_contact_phone: fixture.profile.emergency_contact_phone });
  const updated = { ...fixture, profile: { ...fixture.profile, phone: '0000000002' } } as User;
  vi.mocked(getMe).mockResolvedValue(updated);
  await act(async () => pending.resolve(updated));
  expect(await screen.findByRole('button', { name: 'Editar' })).toBeEnabled();
  expect(screen.getByText('0000000002')).toBeInTheDocument();
});
it('keeps a failed-save draft and cancel restores server values on the next edit', async () => {
  vi.mocked(updateMyProfile).mockRejectedValue(error(503));
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '0000000003' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(updateMyProfile).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled());
  expect(screen.getByLabelText('Teléfono')).toHaveValue('0000000003');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  expect(screen.getByLabelText('Teléfono')).toHaveValue(fixture.profile.phone);
});
