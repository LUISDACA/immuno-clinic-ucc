import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UserMenu } from '../user-menu';
import { useThemeStore } from '@/lib/theme/store';

const state = vi.hoisted(() => ({ role: 'student', email: 'synthetic@example.invalid', logout: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => state }));
vi.mock('@/lib/auth/store', () => ({ useAuthStore: () => state }));
beforeEach(() => { vi.clearAllMocks(); state.role = 'student'; useThemeStore.setState({ mode: 'system', isHydrated: true }); });
afterEach(cleanup);
function mount() { render(<><UserMenu /><button>Fuera</button></>); return screen.getByRole('button', { name: 'Opciones de usuario' }); }

it.each(['{Enter}', ' '])('opens disclosure with %s and reaches native profile links with Tab', async key => {
  const user = userEvent.setup(), trigger = mount();
  act(() => trigger.focus()); await user.keyboard(key);
  const panel = screen.getByRole('region', { name: 'Opciones de usuario' });
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(trigger).toHaveAttribute('aria-controls', panel.id);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  await user.tab(); expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(trigger).toHaveFocus(); expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(state.logout).not.toHaveBeenCalled();
});

it('outside click and focus leaving close without stealing focus', async () => {
  const user = userEvent.setup(), trigger = mount();
  await user.click(trigger); await user.click(screen.getByRole('button', { name: 'Fuera' }));
  expect(screen.getByRole('button', { name: 'Fuera' })).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await user.click(trigger); act(() => screen.getByRole('button', { name: 'Fuera' }).focus());
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

it.each(['student', 'admin', 'app_admin'])('preserves role=%s destinations and conditional history', async role => {
  state.role = role; const user = userEvent.setup(); await user.click(mount());
  const base = role === 'student' ? '/student' : '/admin';
  expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('href', base + '/profile');
  expect(screen.getByRole('link', { name: 'Cambiar contraseña' })).toHaveAttribute('href', base + '/change-password');
  if (role === 'app_admin') expect(screen.queryByRole('link', { name: 'Mi historial' })).not.toBeInTheDocument();
  else expect(screen.getByRole('link', { name: 'Mi historial' })).toHaveAttribute('href', base + '/history');
});

it('native keyboard theme selection preserves expanded panel and never logs out', async () => {
  const user = userEvent.setup(); await user.click(mount());
  const dark = screen.getByRole('button', { name: 'Oscuro' });
  act(() => dark.focus()); await user.keyboard('{Enter}');
  expect(dark).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('region')).toBeVisible();
  expect(state.logout).not.toHaveBeenCalled();
});

it('logout calls the existing coordinated operation once and navigates only after completion', async () => {
  let resolve!: () => void;
  state.logout.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  const user = userEvent.setup(); await user.click(mount());
  act(() => screen.getByRole('button', { name: 'Cerrar sesión' }).focus());
  await user.keyboard('{Enter}');
  expect(state.logout).toHaveBeenCalledTimes(1);
  expect(state.replace).not.toHaveBeenCalled();
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  await act(async () => resolve());
  await waitFor(() => expect(state.replace).toHaveBeenCalledExactlyOnceWith('/login'));
});
