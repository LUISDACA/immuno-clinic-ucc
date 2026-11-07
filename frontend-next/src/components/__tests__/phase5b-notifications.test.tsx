import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NotificationsList } from '../notifications-list';
import StudentNotifications from '@/app/student/notifications/page';
import { listNotifications, markNotificationRead } from '@/lib/api/notifications';
import type { NotificationItem } from '@/lib/api/types';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav }));
vi.mock('@/lib/api/notifications', () => ({ listNotifications: vi.fn(), markNotificationRead: vi.fn() }));
const item: NotificationItem = { id: 'synthetic', title: 'Aviso sintético', message: 'Sin datos clínicos', category: 'system', is_read: false, action_path: '/student/profile', created_at: '2026-10-09T12:00:00Z' };
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it.each(['{Enter}', ' '])('mark read with %s never opens a notification and actions are native siblings', async key => {
  const user = userEvent.setup(), read = vi.fn();
  render(<NotificationsList notifications={[item]} onMarkRead={read} />);
  const open = screen.getByRole('button', { name: 'Notificación Aviso sintético' });
  const mark = screen.getByRole('button', { name: 'Marcar como leída: Aviso sintético' });
  expect(open.contains(mark)).toBe(false);
  expect(mark.tagName).toBe('BUTTON');
  act(() => mark.focus()); await user.keyboard(key);
  expect(read).toHaveBeenCalledExactlyOnceWith('synthetic');
  expect(nav.push).not.toHaveBeenCalled();
  expect(screen.getByText(/No leída/)).toBeVisible();
});

it.each(['{Enter}', ' '])('open with %s preserves Flutter read-and-navigate without duplicate dispatch', async key => {
  const user = userEvent.setup(), read = vi.fn();
  render(<NotificationsList notifications={[item]} onMarkRead={read} />);
  act(() => screen.getByRole('button', { name: 'Notificación Aviso sintético' }).focus());
  await user.keyboard(key);
  expect(read).toHaveBeenCalledExactlyOnceWith('synthetic');
  expect(nav.push).toHaveBeenCalledExactlyOnceWith('/student/profile');
});

it('does not navigate until marking unread notification succeeds', async () => {
  const user = userEvent.setup();
  let complete!: (marked: boolean) => void;
  const read = vi.fn(() => new Promise<boolean>(resolve => { complete = resolve; }));
  render(<NotificationsList notifications={[item]} onMarkRead={read} />);
  await user.click(screen.getByRole('button', { name: 'Notificación Aviso sintético' }));
  expect(read).toHaveBeenCalledExactlyOnceWith('synthetic');
  expect(nav.push).not.toHaveBeenCalled();
  await act(async () => complete(true));
  await waitFor(() => expect(nav.push).toHaveBeenCalledExactlyOnceWith('/student/profile'));
});

it('does not navigate when marking an unread notification fails', async () => {
  const user = userEvent.setup(), read = vi.fn().mockResolvedValue(false);
  render(<NotificationsList notifications={[item]} onMarkRead={read} />);
  await user.click(screen.getByRole('button', { name: 'Notificación Aviso sintético' }));
  expect(read).toHaveBeenCalledExactlyOnceWith('synthetic');
  expect(nav.push).not.toHaveBeenCalled();
});

it('read notifications and notices without destination do not dispatch unintended navigation', async () => {
  const user = userEvent.setup(), read = vi.fn();
  const { rerender } = render(<NotificationsList notifications={[{ ...item, is_read: true }]} onMarkRead={read} />);
  expect(screen.queryByRole('button', { name: /Marcar como leída/ })).not.toBeInTheDocument();
  expect(screen.getByText(/· Leída/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: /Notificación/ }));
  expect(read).not.toHaveBeenCalled();
  nav.push.mockClear();
  rerender(<NotificationsList notifications={[{ ...item, action_path: null }]} onMarkRead={read} />);
  await user.click(screen.getByRole('button', { name: /Notificación/ }));
  expect(read).toHaveBeenCalledExactlyOnceWith('synthetic');
  expect(nav.push).not.toHaveBeenCalled();
});

it('successful read refreshes the real page query, count and row state', async () => {
  vi.mocked(listNotifications).mockResolvedValueOnce([item]).mockResolvedValue([{ ...item, is_read: true }]);
  vi.mocked(markNotificationRead).mockResolvedValue();
  const user = userEvent.setup();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><StudentNotifications /></QueryClientProvider>);
  await user.click(await screen.findByRole('button', { name: /Marcar como leída/ }));
  await waitFor(() => expect(screen.queryByText('1 nueva(s)')).not.toBeInTheDocument());
  expect(await screen.findByText(/· Leída/)).toBeVisible();
  expect(listNotifications).toHaveBeenCalledTimes(2);
  expect(markNotificationRead).toHaveBeenCalledExactlyOnceWith('synthetic');
  expect(nav.push).not.toHaveBeenCalled();
});

it('loading and empty lists expose no notification actions', () => {
  const { rerender } = render(<NotificationsList notifications={[]} loading />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  rerender(<NotificationsList notifications={[]} />);
  expect(screen.getByText('No tienes notificaciones')).toBeVisible();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
