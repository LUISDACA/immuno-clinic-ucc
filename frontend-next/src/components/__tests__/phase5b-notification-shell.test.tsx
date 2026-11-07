import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppShell } from '../app-shell';
import Student from '@/app/student/notifications/page';
import Admin from '@/app/admin/notifications/page';
import { listNotifications } from '@/lib/api/notifications';
import type { NotificationItem } from '@/lib/api/types';

const navigation = vi.hoisted(() => ({ pathname: '/student/notifications', push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation, usePathname: () => navigation.pathname }));
vi.mock('@/lib/api/notifications', () => ({ listNotifications: vi.fn(), markNotificationRead: vi.fn() }));
vi.mock('@/components/brand', () => ({ UccBrandBackground: ({ children }: { children: ReactNode }) => <div>{children}</div>, UccLogo: () => <span>Logo</span> }));
vi.mock('@/components/user-menu', () => ({ UserMenu: () => <button>User</button> }));
vi.mock('@/components/theme-toggle', () => ({ ThemeModeToggle: () => <button>Theme</button> }));
const notice: NotificationItem = { id: 'synthetic', title: 'Synthetic notice', message: 'Synthetic message', is_read: false, action_path: null, category: 'system', created_at: '2026-10-09T12:00:00Z' };
const clients: QueryClient[] = [];
beforeEach(() => vi.resetAllMocks());
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });
function failure(status: number) { return new AxiosError('Synthetic internal diagnostic', undefined, undefined, undefined, { status } as never); }
function mount(role: string, children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  render(<QueryClientProvider client={client}><AppShell title="Synthetic" nav={[{ href: `/${role}`, label: 'Inicio' }, { href: `/${role}/notifications`, label: 'Notificaciones' }]}>{children}</AppShell></QueryClientProvider>);
  return client;
}
for (const [role, Component] of [['student', Student], ['admin', Admin]] as const) {
  it(`${role}: shell and page show exactly one error while retaining the page list`, async () => {
    navigation.pathname = `/${role}/notifications`;
    vi.mocked(listNotifications).mockResolvedValue([notice]);
    const client = mount(role, <Component />);
    await screen.findByText(notice.title);
    vi.mocked(listNotifications).mockRejectedValue(failure(503));
    await act(() => client.invalidateQueries({ queryKey: ['notifications'] }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Reintentar' })).toHaveLength(1);
    expect(screen.getByText(notice.title)).toBeVisible();
  });

  it(`${role}: other routes keep the shell error and deduplicate its delayed retry`, async () => {
    navigation.pathname = `/${role}`;
    let complete!: (items: NotificationItem[]) => void;
    const pending = new Promise<NotificationItem[]>(resolve => { complete = resolve; });
    vi.mocked(listNotifications).mockResolvedValueOnce([notice]).mockRejectedValueOnce(failure(503)).mockReturnValue(pending);
    const user = userEvent.setup(), client = mount(role, <p>Synthetic dashboard</p>);
    await screen.findByText('1', { selector: 'aside span' });
    await act(() => client.invalidateQueries({ queryKey: ['notifications'] }));
    await screen.findByRole('alert');
    await user.dblClick(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDisabled();
    expect(listNotifications).toHaveBeenCalledTimes(3);
    expect(screen.getByText('Synthetic dashboard')).toBeVisible();
    await act(async () => complete([notice]));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it(`${role}: a failed counter query hides cached navigation counts`, async () => {
    navigation.pathname = `/${role}`;
    vi.mocked(listNotifications).mockResolvedValue([notice]);
    const client = mount(role, <p>Synthetic dashboard</p>);
    await screen.findByText('1', { selector: 'aside span' });
    vi.mocked(listNotifications).mockRejectedValue(failure(403));
    await act(() => client.invalidateQueries({ queryKey: ['notifications'] }));
    await screen.findByRole('alert');
    expect(screen.queryByText('1', { selector: 'aside span' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Notificaciones' })).toHaveLength(2);
  });
}

it('app_admin navigation shows unread communication count on its dashboard shell', async () => {
  navigation.pathname = '/admin';
  vi.mocked(listNotifications).mockResolvedValue([{ ...notice, category: 'communication' }]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  render(<QueryClientProvider client={client}><AppShell title="Admin de aplicación" nav={[
    { href: '/admin', label: 'Inicio' }, { href: '/admin/communications', label: 'Comunicaciones' },
  ]}><p>Synthetic app admin dashboard</p></AppShell></QueryClientProvider>);
  expect(await screen.findByText('1', { selector: 'aside span' })).toBeVisible();
  expect(screen.getAllByRole('link', { name: /Comunicaciones/ })).toHaveLength(2);
  expect(screen.getByText('Synthetic app admin dashboard')).toBeVisible();
});
