import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import Profile from '@/app/student/profile/page';
import { getMe, updateMyProfile } from '@/lib/api/users';
import { useAuthStore } from '@/lib/auth/store';
import type { User } from '@/lib/api/types';
import fixture from '../../../../docs/ui/fixtures/phase5b-student-profile.json';

vi.mock('@/lib/api/users', () => ({ getMe: vi.fn(), updateMyProfile: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const clients: QueryClient[] = [];
const changed = { ...fixture, profile: { ...fixture.profile, phone: '0000000003' } } as User;
const confirmedMessage = 'Los cambios se guardaron, pero no se pudo actualizar el perfil.';
function failure(status: number) {
  return new AxiosError('PRIVATE_DIAGNOSTIC', undefined, undefined, undefined, { status, data: { message: 'PRIVATE_DIAGNOSTIC' } } as never);
}
function pending<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
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
async function draft() {
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: changed.profile!.phone } });
}

for (const status of [401, 403, 503]) {
  for (const editing of [false, true]) {
    it(`GET ${status} after data, editing=${editing}, hides data/actions and retry restores context`, async () => {
      const client = mount(); await screen.findByText(fixture.profile.program);
      if (editing) await draft();
      vi.mocked(getMe).mockRejectedValueOnce(failure(status));
      await act(async () => { await client.refetchQueries({ queryKey: ['user', 'me'] }); });
      await screen.findByRole('alert');
      expect(screen.queryByText(fixture.profile.program)).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Teléfono')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
      expect(screen.queryByText('PRIVATE_DIAGNOSTIC')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      if (editing) expect(await screen.findByLabelText('Teléfono')).toHaveValue(changed.profile!.phone);
      else expect(await screen.findByRole('button', { name: 'Editar' })).toBeEnabled();
      expect(updateMyProfile).not.toHaveBeenCalled();
    });
  }
}
it.each([403, 503])('PUT confirmed then GET %s is not a failed write; retry performs only GET', async status => {
  mount(); await draft();
  vi.mocked(updateMyProfile).mockResolvedValue(changed);
  vi.mocked(getMe).mockRejectedValue(failure(status));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByText(confirmedMessage);
  expect(screen.queryByText(fixture.profile.program)).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Teléfono')).not.toBeInTheDocument();
  expect(toast.success).not.toHaveBeenCalled();
  expect(updateMyProfile).toHaveBeenCalledTimes(1);
  expect(getMe).toHaveBeenCalledTimes(2);
  vi.mocked(getMe).mockResolvedValue(changed);
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText(changed.profile!.phone!)).toBeInTheDocument();
  expect(screen.queryByText(confirmedMessage)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Editar' })).toBeEnabled();
  expect(updateMyProfile).toHaveBeenCalledTimes(1);
  expect(getMe).toHaveBeenCalledTimes(3);
});
it('failed PUT plus failed GET preserves unsaved draft and needs explicit save after read recovery', async () => {
  mount(); await draft();
  vi.mocked(updateMyProfile).mockRejectedValueOnce(failure(503));
  vi.mocked(getMe).mockRejectedValue(failure(403));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByRole('alert');
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(screen.queryByText(confirmedMessage)).not.toBeInTheDocument();
  vi.mocked(getMe).mockResolvedValue(fixture as User);
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByLabelText('Teléfono')).toHaveValue(changed.profile!.phone);
  expect(screen.getByText('No se pudo guardar el perfil. Intenta nuevamente.')).toBeInTheDocument();
  expect(updateMyProfile).toHaveBeenCalledTimes(1);
  vi.mocked(updateMyProfile).mockResolvedValue(changed);
  vi.mocked(getMe).mockResolvedValue(changed);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(await screen.findByRole('button', { name: 'Editar' })).toBeEnabled();
  expect(updateMyProfile).toHaveBeenCalledTimes(2);
});
it('a successful read of identical data retires the confirmed-save notice before an unrelated later failure', async () => {
  const client = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
  vi.mocked(updateMyProfile).mockResolvedValue(fixture as User);
  vi.mocked(getMe).mockRejectedValue(failure(503));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByText(confirmedMessage);
  vi.mocked(getMe).mockResolvedValue(fixture as User);
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await screen.findByRole('button', { name: 'Editar' });
  vi.mocked(getMe).mockRejectedValueOnce(failure(503));
  await act(async () => { await client.refetchQueries({ queryKey: ['user', 'me'] }); });
  await screen.findByRole('alert');
  expect(screen.queryByText(confirmedMessage)).not.toBeInTheDocument();
});
it('a pre-write GET success cannot erase a later refresh denial', async () => {
  const client = mount(); await draft();
  const old = pending<User>(); vi.mocked(getMe).mockReturnValueOnce(old.promise);
  let read!: Promise<void>; act(() => { read = client.refetchQueries({ queryKey: ['user', 'me'] }); });
  vi.mocked(updateMyProfile).mockResolvedValue(changed);
  vi.mocked(getMe).mockRejectedValue(failure(403));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByText(confirmedMessage);
  await act(async () => { old.resolve(fixture as User); await read; });
  expect(screen.getByText(confirmedMessage)).toBeInTheDocument();
  expect(screen.queryByText(fixture.profile.program)).not.toBeInTheDocument();
});
it('an old write completion does not notify or restore profile data for a changed owner', async () => {
  const client = mount(); await draft();
  const write = pending<User>(); vi.mocked(updateMyProfile).mockReturnValue(write.promise);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(updateMyProfile).toHaveBeenCalledTimes(1));
  act(() => { useAuthStore.setState({ userId: 'synthetic-other' }); client.clear(); });
  await act(async () => write.resolve(changed));
  expect(toast.success).not.toHaveBeenCalled();
  expect(toast.warning).not.toHaveBeenCalled();
  expect(client.getQueryData(['user', 'me'])).toBeUndefined();
});
