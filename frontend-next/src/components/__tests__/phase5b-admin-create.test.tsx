import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import Admins from '@/app/admin/admins/page';
import { createAdmin, deleteAdmin, getAcademicOptions, listAdmins } from '@/lib/api/admin';
import { useAuthStore } from '@/lib/auth/store';
import type { User } from '@/lib/api/types';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('@/lib/api/admin', () => ({ createAdmin: vi.fn(), deleteAdmin: vi.fn(), getAcademicOptions: vi.fn(), listAdmins: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const clients: QueryClient[] = [];
const existing = { id: 'synthetic-admin', email: 'admin@example.invalid', role: 'admin', is_active: true, profile: null } as User;
function pending<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><Admins /></QueryClientProvider>);
  await screen.findByText(existing.email);
  await userEvent.click(screen.getByRole('button', { name: 'Crear admin' }));
  await screen.findByLabelText('Programa *');
  return client;
}
async function fill() {
  fireEvent.change(screen.getByLabelText('Correo *'), { target: { value: 'new-admin@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Contraseña *'), { target: { value: 'SyntheticOnly123!' } });
  fireEvent.change(screen.getByLabelText('Programa *'), { target: { value: 'Enfermería' } });
  fireEvent.change(screen.getByLabelText('Campus *'), { target: { value: 'Bogotá' } });
}
beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({ userId: 'synthetic-app-admin', role: 'app_admin', isAuthenticated: true });
  vi.mocked(listAdmins).mockResolvedValue([existing]);
  vi.mocked(getAcademicOptions).mockResolvedValue({ programs: ['Medicina', 'Enfermería'], campuses: ['Bogotá', 'Cali'], semesters: Array.from({ length: 10 }, (_, i) => i + 1) });
  vi.mocked(createAdmin).mockResolvedValue({ ...existing, id: 'created', email: 'new-admin@example.invalid' });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); });

it('empty required fields do not dispatch a creation request', async () => {
  await mount(); await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
  expect(createAdmin).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Correo *')).toBeInvalid();
});
it('malformed email is stopped by native form validation', async () => {
  await mount(); await fill();
  fireEvent.change(screen.getByLabelText('Correo *'), { target: { value: 'invalid' } });
  await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
  expect(createAdmin).not.toHaveBeenCalled();
});
it('uses a named native form and backend length constraints without making optional names required', async () => {
  await mount();
  expect(screen.getByRole('form', { name: 'Nuevo administrador' })).toContainElement(screen.getByRole('button', { name: 'Crear' }));
  expect(screen.getByLabelText('Contraseña *')).toHaveAttribute('minlength', '8');
  for (const label of ['Nombres', 'Apellidos']) {
    expect(screen.getByLabelText(label)).not.toBeRequired();
    expect(screen.getByLabelText(label)).toHaveAttribute('maxlength', '100');
  }
  expect(screen.getByLabelText('Cargo')).toHaveAttribute('maxlength', '150');
  expect(screen.getByLabelText('Programa *').querySelectorAll('option')).toHaveLength(3);
  expect(screen.getByLabelText('Campus *').querySelectorAll('option')).toHaveLength(3);
});
it('Enter submits exactly one valid payload through POST creation', async () => {
  await mount(); await fill();
  screen.getByLabelText('Cargo').focus(); await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(createAdmin).toHaveBeenCalledTimes(1));
  expect(createAdmin).toHaveBeenCalledWith({ email: 'new-admin@example.invalid', password: 'SyntheticOnly123!', program: 'Enfermería', campus: 'Bogotá' });
  expect(deleteAdmin).not.toHaveBeenCalled();
});
it('omits optional names cleared by the user instead of sending invalid empty strings', async () => {
  await mount(); await fill();
  for (const label of ['Nombres', 'Apellidos', 'Cargo']) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: 'Temporary' } });
    fireEvent.change(screen.getByLabelText(label), { target: { value: '' } });
  }
  await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
  await waitFor(() => expect(createAdmin).toHaveBeenCalledTimes(1));
  expect(createAdmin).toHaveBeenCalledWith({ email: 'new-admin@example.invalid', password: 'SyntheticOnly123!', program: 'Enfermería', campus: 'Bogotá' });
});
it('trims ordinary fields but preserves the password exactly as entered', async () => {
  await mount(); await fill();
  for (const [label, value] of [['Nombres', '  Synthetic  '], ['Apellidos', '  Administrator  '], ['Cargo', '  Reviewer  '], ['Contraseña *', ' SyntheticOnly123! ']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
  await waitFor(() => expect(createAdmin).toHaveBeenCalledTimes(1));
  expect(createAdmin).toHaveBeenCalledWith({ email: 'new-admin@example.invalid', password: ' SyntheticOnly123! ', program: 'Enfermería', campus: 'Bogotá', first_name: 'Synthetic', last_name: 'Administrator', job_title: 'Reviewer' });
});
it('freezes every field, cancel and delete while one immutable request is pending', async () => {
  const write = pending<User>(); vi.mocked(createAdmin).mockReturnValue(write.promise);
  await mount(); await fill();
  const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Crear' }));
  await waitFor(() => expect(createAdmin).toHaveBeenCalledTimes(1));
  for (const label of ['Correo *', 'Contraseña *', 'Nombres', 'Apellidos', 'Cargo', 'Programa *', 'Campus *']) expect(screen.getByLabelText(label)).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
  await user.type(screen.getByLabelText('Nombres'), 'Newer draft');
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.getByText('Nuevo administrador')).toBeInTheDocument();
  expect(screen.getByLabelText('Nombres')).toHaveValue('');
  await act(async () => { write.resolve(existing); });
  expect(createAdmin).toHaveBeenCalledTimes(1);
});
it('same-frame duplicate submit is coalesced by the existing mutation guard', async () => {
  const write = pending<User>(); vi.mocked(createAdmin).mockReturnValue(write.promise);
  await mount(); await fill(); const form = screen.getByRole('form', { name: 'Nuevo administrador' });
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  await waitFor(() => expect(createAdmin).toHaveBeenCalledTimes(1));
  await act(async () => { write.resolve(existing); });
});
it('successful write refreshes the list once, then clears the password and closes the form', async () => {
  await mount(); await fill();
  await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Administrador creado'));
  expect(listAdmins).toHaveBeenCalledTimes(2);
  expect(screen.queryByLabelText('Contraseña *')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Crear admin' }));
  expect(screen.getByLabelText('Contraseña *')).toHaveValue('');
});
it('keeps the draft locked until the post-write read settles', async () => {
  await mount(); await fill();
  const read = pending<User[]>(); vi.mocked(listAdmins).mockReturnValueOnce(read.promise);
  await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
  await waitFor(() => expect(listAdmins).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText('Correo *')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  expect(toast.success).not.toHaveBeenCalled();
  await act(async () => { read.resolve([existing]); });
  await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
  expect(createAdmin).toHaveBeenCalledTimes(1);
});
it('failed POST retains the draft, unlocks fields and requires an explicit resubmit', async () => {
  vi.mocked(createAdmin).mockRejectedValueOnce(new Error('PRIVATE_DIAGNOSTIC'));
  await mount(); await fill();
  await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No se pudo crear'));
  expect(screen.getByLabelText('Correo *')).toHaveValue('new-admin@example.invalid');
  expect(screen.getByLabelText('Contraseña *')).toBeEnabled();
  expect(screen.queryByText('PRIVATE_DIAGNOSTIC')).not.toBeInTheDocument();
  expect(createAdmin).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
  await waitFor(() => expect(createAdmin).toHaveBeenCalledTimes(2));
});
