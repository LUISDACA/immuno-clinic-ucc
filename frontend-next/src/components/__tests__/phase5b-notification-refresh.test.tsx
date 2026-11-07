import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, CanceledError } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Student from '@/app/student/notifications/page';
import Admin from '@/app/admin/notifications/page';
import { listNotifications, markNotificationRead } from '@/lib/api/notifications';
import type { NotificationItem } from '@/lib/api/types';
import { canRetainNotificationData, loadNotificationsWithRetention } from '@/lib/ui/notification-query';
import { toast } from 'sonner';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('@/lib/api/notifications', () => ({ listNotifications: vi.fn(), markNotificationRead: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const notice: NotificationItem = {
  id: 'synthetic', title: 'Synthetic notice', message: 'Synthetic message',
  is_read: false, action_path: '/synthetic-destination', category: 'system', created_at: '2026-10-09T12:00:00Z',
};
const clients: QueryClient[] = [];
beforeEach(() => vi.resetAllMocks());
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });
function failure(status?: number) {
  return new AxiosError('Synthetic internal diagnostic', undefined, undefined, undefined,
    status === undefined ? undefined : { status, data: { message: 'Synthetic internal diagnostic' } } as never);
}

it('an older successful request cannot clear a newer access denial', async () => {
  const client = new QueryClient(); clients.push(client);
  let complete!: (items: NotificationItem[]) => void;
  vi.mocked(listNotifications).mockReturnValueOnce(new Promise(resolve => { complete = resolve; })).mockRejectedValue(failure(403));
  const older = loadNotificationsWithRetention(client);
  await expect(loadNotificationsWithRetention(client)).rejects.toBeInstanceOf(AxiosError);
  complete([notice]); await older;
  expect(canRetainNotificationData(client, failure(503))).toBe(false);
});

it('an older denied request cannot block a newer successful response', async () => {
  const client = new QueryClient(); clients.push(client);
  let reject!: (error: unknown) => void;
  vi.mocked(listNotifications).mockReturnValueOnce(new Promise((_, fail) => { reject = fail; })).mockResolvedValue([notice]);
  const older = loadNotificationsWithRetention(client);
  const rejected = expect(older).rejects.toBeInstanceOf(AxiosError);
  await loadNotificationsWithRetention(client);
  reject(failure(403)); await rejected;
  expect(canRetainNotificationData(client, failure(503))).toBe(true);
});
function mount(Component: typeof Student, retry: false | number = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry, retryDelay: 0 }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><Component /></QueryClientProvider>);
  return client;
}
for (const [role, Component] of [['student', Student], ['admin', Admin]] as const) {
  it.each([503, 429, undefined])(`${role}: transient refresh %s retains notices and count with a safe warning`, async status => {
    vi.mocked(listNotifications).mockResolvedValueOnce([notice]).mockRejectedValue(failure(status));
    const client = mount(Component);
    await screen.findByText(notice.title);
    await act(() => client.invalidateQueries({ queryKey: ['notifications'] }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.getByText(notice.title)).toBeVisible();
    expect(screen.getByText('1 nueva(s)')).toBeVisible();
    expect(screen.queryByText('No tienes notificaciones')).not.toBeInTheDocument();
    expect(screen.queryByText('Synthetic internal diagnostic')).not.toBeInTheDocument();
    expect(markNotificationRead).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 404, 422])(`${role}: refresh HTTP %s hides cached data and all notification actions`, async status => {
    vi.mocked(listNotifications).mockResolvedValueOnce([notice]).mockRejectedValue(failure(status));
    const client = mount(Component);
    await screen.findByText(notice.title);
    await act(() => client.invalidateQueries({ queryKey: ['notifications'] }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByText(notice.title)).not.toBeInTheDocument();
    expect(screen.queryByText('1 nueva(s)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Marcar como leída/ })).not.toBeInTheDocument();
    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it(`${role}: initial failure is never empty success and retry can recover empty`, async () => {
    vi.mocked(listNotifications).mockRejectedValueOnce(failure(503)).mockResolvedValue([]);
    const user = userEvent.setup(); mount(Component);
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByText('No tienes notificaciones')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('No tienes notificaciones')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it(`${role}: failed mark-read is announced without exposing the error`, async () => {
    vi.mocked(listNotifications).mockResolvedValue([notice]);
    vi.mocked(markNotificationRead).mockRejectedValue(failure(503));
    const user = userEvent.setup(); mount(Component);
    await screen.findByText(notice.title);
    await user.click(screen.getByRole('button', { name: `Marcar como leída: ${notice.title}` }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No se pudo marcar como leída. Inténtalo de nuevo.'));
    expect(screen.getByText(notice.title)).toBeVisible();
    expect(screen.queryByText('Synthetic internal diagnostic')).not.toBeInTheDocument();
  });

  it(`${role}: failed mark-read prevents navigation to the notification destination`, async () => {
    vi.mocked(listNotifications).mockResolvedValue([notice]);
    vi.mocked(markNotificationRead).mockRejectedValue(failure(503));
    const user = userEvent.setup(); mount(Component);
    await screen.findByText(notice.title);
    await user.click(screen.getByRole('button', { name: `Notificación ${notice.title}` }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No se pudo marcar como leída. Inténtalo de nuevo.'));
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it(`${role}: retry stays disabled while pending and updates retained data without duplicate requests`, async () => {
    let complete!: (items: NotificationItem[]) => void;
    const pending = new Promise<NotificationItem[]>(resolve => { complete = resolve; });
    vi.mocked(listNotifications).mockResolvedValueOnce([notice]).mockRejectedValueOnce(failure(503)).mockReturnValue(pending);
    const user = userEvent.setup(), client = mount(Component);
    await screen.findByText(notice.title);
    await act(() => client.invalidateQueries({ queryKey: ['notifications'] }));
    await screen.findByRole('alert');
    await user.dblClick(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDisabled();
    expect(screen.getByText(notice.title)).toBeVisible();
    expect(listNotifications).toHaveBeenCalledTimes(3);
    await act(async () => complete([{ ...notice, title: 'Synthetic updated', is_read: true }]));
    expect(await screen.findByText('Synthetic updated')).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.queryByText('1 nueva(s)')).not.toBeInTheDocument();
    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it(`${role}: a failed refresh of previously empty data shows warning and empty state together`, async () => {
    vi.mocked(listNotifications).mockResolvedValueOnce([]).mockRejectedValue(failure(503));
    const client = mount(Component);
    await screen.findByText('No tienes notificaciones');
    await act(() => client.invalidateQueries({ queryKey: ['notifications'] }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.getByText('No tienes notificaciones')).toBeVisible();
  });

  it(`${role}: a session cancellation never retains the previous list`, async () => {
    vi.mocked(listNotifications).mockResolvedValueOnce([notice]).mockRejectedValue(new CanceledError('Synthetic session changed'));
    const client = mount(Component);
    await screen.findByText(notice.title);
    await act(() => client.invalidateQueries({ queryKey: ['notifications'] }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByText(notice.title)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Marcar como leída/ })).not.toBeInTheDocument();
  });

  it(`${role}: transient failure after a 403 cannot reveal data until a successful GET`, async () => {
    vi.mocked(listNotifications).mockResolvedValueOnce([notice])
      .mockRejectedValueOnce(failure(403)).mockRejectedValueOnce(failure(503))
      .mockResolvedValue([notice]);
    const user = userEvent.setup(), client = mount(Component);
    await screen.findByText(notice.title);
    await act(() => client.invalidateQueries({ queryKey: ['notifications'] }));
    await screen.findByText('No tienes permiso para consultar esta información.');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('El servicio no está disponible temporalmente.');
    expect(screen.queryByText(notice.title)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Marcar como leída/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText(notice.title)).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it(`${role}: automatic retry cannot hide an earlier 403 behind a final 503`, async () => {
    vi.mocked(listNotifications).mockResolvedValueOnce([notice])
      .mockRejectedValueOnce(failure(403)).mockRejectedValue(failure(503));
    const client = mount(Component, 1);
    await screen.findByText(notice.title);
    await act(() => client.invalidateQueries({ queryKey: ['notifications'] }));
    await screen.findByText('El servicio no está disponible temporalmente.');
    expect(listNotifications).toHaveBeenCalledTimes(3);
    expect(screen.queryByText(notice.title)).not.toBeInTheDocument();
  });

  it(`${role}: a 403 hides cached data while its automatic retry is still pending`, async () => {
    let complete!: (items: NotificationItem[]) => void;
    vi.mocked(listNotifications).mockResolvedValueOnce([notice])
      .mockRejectedValueOnce(failure(403))
      .mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const client = mount(Component, 1);
    await screen.findByText(notice.title);
    act(() => { void client.invalidateQueries({ queryKey: ['notifications'] }); });
    await screen.findByText('No tienes permiso para consultar esta información.');
    expect(screen.queryByText(notice.title)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDisabled();
    await act(async () => complete([notice]));
    expect(await screen.findByText(notice.title)).toBeVisible();
  });

  it(`${role}: remount after denial cannot expose retained data while a fresh response is pending`, async () => {
    vi.mocked(listNotifications).mockResolvedValueOnce([notice])
      .mockRejectedValueOnce(failure(403)).mockRejectedValueOnce(failure(503));
    const user = userEvent.setup(), client = mount(Component);
    await screen.findByText(notice.title);
    await act(() => client.invalidateQueries({ queryKey: ['notifications'] }));
    await screen.findByText('No tienes permiso para consultar esta información.');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('El servicio no está disponible temporalmente.');
    cleanup();
    let complete!: (items: NotificationItem[]) => void;
    vi.mocked(listNotifications).mockReturnValue(new Promise(resolve => { complete = resolve; }));
    render(<QueryClientProvider client={client}><Component /></QueryClientProvider>);
    await screen.findByRole('alert');
    expect(screen.queryByText(notice.title)).not.toBeInTheDocument();
    await act(async () => complete([notice]));
    expect(await screen.findByText(notice.title)).toBeVisible();
  });
}
