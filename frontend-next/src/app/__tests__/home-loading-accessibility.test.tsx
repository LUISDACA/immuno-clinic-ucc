import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useAuthStore } from '@/lib/auth/store';
import type { Role } from '@/lib/api/types';
import HomePage from '../page';

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('@/components/brand', () => ({
  UccBrandBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UccLogo: () => null,
}));

beforeEach(() => {
  navigation.replace.mockReset();
  useAuthStore.setState({
    isAuthenticated: false,
    isHydrated: false,
    role: null,
    mustChangePassword: false,
    checkSession: vi.fn().mockResolvedValue(undefined),
  });
});

afterEach(() => cleanup());

it('announces session restoration while the auth store is not hydrated', () => {
  render(<HomePage />);

  expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
  expect(navigation.replace).not.toHaveBeenCalled();
});

const hydratedDestinations: Array<{ name: string; isAuthenticated: boolean; role: Role | null; mustChangePassword: boolean; destination: string }> = [
  { name: 'anonymous session', isAuthenticated: false, role: null, mustChangePassword: false, destination: '/login' },
  { name: 'student session', isAuthenticated: true, role: 'student', mustChangePassword: false, destination: '/student' },
  { name: 'admin session', isAuthenticated: true, role: 'admin', mustChangePassword: false, destination: '/admin' },
  { name: 'app admin session', isAuthenticated: true, role: 'app_admin', mustChangePassword: false, destination: '/admin' },
  { name: 'student forced password change', isAuthenticated: true, role: 'student', mustChangePassword: true, destination: '/student/change-password' },
  { name: 'admin forced password change', isAuthenticated: true, role: 'admin', mustChangePassword: true, destination: '/admin/change-password' },
];

it.each(hydratedDestinations)('routes a hydrated $name to its existing destination', ({ isAuthenticated, role, mustChangePassword, destination }) => {
  render(<HomePage />);
  expect(navigation.replace).not.toHaveBeenCalled();

  act(() => {
    useAuthStore.setState({
      isHydrated: true,
      isAuthenticated,
      role,
      mustChangePassword,
    });
  });

  expect(navigation.replace).toHaveBeenCalledTimes(1);
  expect(navigation.replace).toHaveBeenCalledWith(destination);
});
