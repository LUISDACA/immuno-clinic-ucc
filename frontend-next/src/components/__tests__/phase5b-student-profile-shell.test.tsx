import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { AppShell } from '../app-shell';
import styles from '../student-profile-shell.module.css';

const nav = vi.hoisted(() => ({ pathname: '/student/profile' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
vi.mock('@/lib/api/notifications', () => ({ listNotifications: vi.fn().mockResolvedValue([]) }));
vi.mock('@/components/brand', () => ({ UccBrandBackground: ({ children }: { children: ReactNode }) => <div>{children}</div>, UccLogo: () => <span>Logo</span> }));
vi.mock('@/components/user-menu', () => ({ UserMenu: () => <button aria-label="Opciones de usuario">Usuario</button> }));
vi.mock('@/components/theme-toggle', () => ({ ThemeModeToggle: () => <button>Tema</button> }));
const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); });
function mount(path: string) {
  nav.pathname = path;
  const client = new QueryClient(); clients.push(client);
  render(<QueryClientProvider client={client}><AppShell title="Estudiante" nav={[{ href: '/student', label: 'Inicio' }, { href: '/student/profile', label: 'Mi perfil' }]}><p>Datos sintéticos</p></AppShell></QueryClientProvider>);
  return screen.getByRole('banner').parentElement!;
}
it('scopes container reflow and layers to the student profile without dropping navigation/actions', () => {
  const root = mount('/student/profile');
  expect(root).toHaveClass(styles.shell, 'relative', 'z-0');
  expect(screen.getByRole('navigation', { name: 'Navegación de módulos' })).toHaveClass(styles.navigation);
  expect(screen.getByRole('banner').firstElementChild).toHaveClass(styles.header);
  expect(screen.getAllByRole('link', { name: 'Mi perfil' })).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Opciones de usuario' })).toBeEnabled();
  expect(screen.getByRole('main').closest('[aria-hidden=true]')).toBeNull();
});
it.each(['/student', '/admin/profile', '/student/profile-old', '/student/profile/other', '/student/evidence'])('does not apply profile layout policy to %s', path => {
  const root = mount(path);
  expect(root).not.toHaveClass(styles.shell);
  expect(screen.getByRole('banner').firstElementChild).not.toHaveClass(styles.header);
  expect(screen.getByRole('navigation', { name: 'Navegación de módulos' })).not.toHaveClass(styles.navigation);
});
