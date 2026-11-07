import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AppShell } from '../app-shell';
import { NotificationsList } from '../notifications-list';

const navigation = vi.hoisted(() => ({ pathname: '/student/notifications', push: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname, useRouter: () => navigation }));
vi.mock('@/lib/api/notifications', () => ({ listNotifications: vi.fn(async () => []) }));
vi.mock('@/components/brand', () => ({ UccBrandBackground: ({ children }: { children: ReactNode }) => <div>{children}</div>, UccLogo: () => <span>Logo</span> }));
vi.mock('@/components/user-menu', () => ({ UserMenu: () => <button>User</button> }));
vi.mock('@/components/theme-toggle', () => ({ ThemeModeToggle: () => <button>Theme</button> }));
const clients: QueryClient[] = [];
beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals(); });

function mount() {
  const client = new QueryClient(); clients.push(client);
  const shell = () => <QueryClientProvider client={client}><AppShell title="Synthetic" nav={[]}><h1>Notificaciones</h1></AppShell></QueryClientProvider>;
  return { ...render(shell()), shell };
}

for (const role of ['student', 'admin']) {
  it(`${role}: observes the actual header height and disconnects outside notifications`, () => {
    navigation.pathname = `/${role}/notifications`;
    let resize!: () => void;
    const observe = vi.fn(), disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback; } observe = observe; disconnect = disconnect; });
    const { container, rerender, shell } = mount();
    const header = container.querySelector('header')!, main = screen.getByRole('main');
    Object.defineProperty(header, 'offsetHeight', { configurable: true, value: 66 });
    act(() => resize());
    expect(main.style.getPropertyValue('--notification-header-height')).toBe('66px');
    Object.defineProperty(header, 'offsetHeight', { configurable: true, value: 96 });
    act(() => resize());
    expect(main.style.getPropertyValue('--notification-header-height')).toBe('96px');
    expect(observe).toHaveBeenCalledExactlyOnceWith(header);
    navigation.pathname = `/${role}`;
    rerender(shell());
    expect(disconnect).toHaveBeenCalledOnce();
    expect(main.style.getPropertyValue('--notification-header-height')).toBe('');
  });

  it(`${role}: handles window resize without ResizeObserver and removes its listener on unmount`, () => {
    navigation.pathname = `/${role}/notifications`;
    vi.stubGlobal('ResizeObserver', undefined);
    const { container, unmount } = mount(), main = screen.getByRole('main');
    Object.defineProperty(container.querySelector('header'), 'offsetHeight', { value: 80 });
    fireEvent(window, new Event('resize'));
    expect(main.style.getPropertyValue('--notification-header-height')).toBe('80px');
    unmount();
    fireEvent(window, new Event('resize'));
    expect(main.style.getPropertyValue('--notification-header-height')).toBe('');
  });

  it(`${role}: other routes do not attach a notification layout observer`, () => {
    navigation.pathname = `/${role}/history`;
    const construct = vi.fn();
    vi.stubGlobal('ResizeObserver', class { constructor() { construct(); } });
    mount();
    expect(construct).not.toHaveBeenCalled();
    expect(screen.getByRole('main').style.getPropertyValue('--notification-header-height')).toBe('');
  });
}

it.each(['{Enter}', ' '])('long notice keeps distinct keyboard actions after reflow: %s', async key => {
  const title = 'Aviso sintético de prueba con un título extenso y sin datos personales';
  const mark = vi.fn(), user = userEvent.setup();
  render(<NotificationsList notifications={[{ id: 'synthetic', title, message: 'Mensaje sintético extenso para comprobar el contenido completo.', category: 'system', is_read: false, action_path: '/student/profile', created_at: '2026-10-09T12:00:00Z' }]} onMarkRead={mark} />);
  const open = screen.getByRole('button', { name: `Notificación ${title}` }), read = screen.getByRole('button', { name: `Marcar como leída: ${title}` });
  expect(open.contains(read)).toBe(false);
  act(() => read.focus()); await user.keyboard(key);
  expect(mark).toHaveBeenCalledExactlyOnceWith('synthetic');
  expect(navigation.push).not.toHaveBeenCalled();
  mark.mockClear();
  act(() => open.focus()); await user.keyboard(key);
  expect(mark).toHaveBeenCalledExactlyOnceWith('synthetic');
  expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/student/profile');
});
