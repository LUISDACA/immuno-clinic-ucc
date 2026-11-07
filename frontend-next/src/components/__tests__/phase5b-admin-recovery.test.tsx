import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import Admins from '@/app/admin/admins/page';
import { createAdmin, deleteAdmin, getAcademicOptions, listAdmins } from '@/lib/api/admin';
import { useAuthStore } from '@/lib/auth/store';
import type { User } from '@/lib/api/types';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('@/lib/api/admin', () => ({ createAdmin: vi.fn(), deleteAdmin: vi.fn(), getAcademicOptions: vi.fn(), listAdmins: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
const clients: QueryClient[] = [];
const admin = { id: 'synthetic-admin', email: 'admin@example.com', role: 'admin', is_active: true, profile: null } as User;
const failure = (status: number) => new AxiosError('PRIVATE_DIAGNOSTIC', undefined, undefined, undefined, { status, data: { message: 'PRIVATE_DIAGNOSTIC' } } as AxiosResponse);
const confirmed = {
  create: 'El administrador se creó, pero no se pudo actualizar la lista.',
  remove: 'El administrador se eliminó, pero no se pudo actualizar la lista.',
};
function pending<T>() { let resolve!: (v:T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  clients.push(client); render(<QueryClientProvider client={client}><Admins /></QueryClientProvider>); return client;
}
async function draft() {
  await screen.findByText(admin.email);
  await userEvent.click(screen.getByRole('button', { name: 'Crear admin' }));
  await screen.findByLabelText('Programa *');
  for (const [label,value] of [['Correo *','new-admin@example.com'],['Contraseña *','SyntheticOnly123!'],['Programa *','Enfermería'],['Campus *','Bogotá']]) fireEvent.change(screen.getByLabelText(label), {target:{value}});
}
async function write(kind:'create'|'remove') {
  if (kind === 'create') { await draft(); await userEvent.click(screen.getByRole('button', {name:'Crear'})); }
  else { await screen.findByText(admin.email); await userEvent.click(screen.getByRole('button', {name:'Eliminar'})); }
}
beforeEach(() => {
  vi.resetAllMocks(); vi.spyOn(window, 'confirm').mockReturnValue(true);
  useAuthStore.setState({ userId:'synthetic-app-admin',role:'app_admin',isAuthenticated:true });
  vi.mocked(listAdmins).mockResolvedValue([admin]); vi.mocked(createAdmin).mockResolvedValue(admin); vi.mocked(deleteAdmin).mockResolvedValue(undefined);
  vi.mocked(getAcademicOptions).mockResolvedValue({ programs: ['Medicina', 'Enfermería'], campuses: ['Bogotá', 'Cali'], semesters: Array.from({ length: 10 }, (_, i) => i + 1) });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); vi.restoreAllMocks(); });

for (const status of [401,403,404,429,500,503]) {
  it(`GET ${status} hides stale list and draft; one retry restores the same draft`, async () => {
    const client = mount(); await draft(); vi.mocked(listAdmins).mockRejectedValue(failure(status));
    await act(async () => { await client.refetchQueries({queryKey:['admins']}); });
    const retry = await screen.findByRole('button',{name:'Reintentar'});
    expect(screen.queryByText(admin.email)).not.toBeInTheDocument();
    expect(screen.queryByText('No hay administradores creados')).not.toBeInTheDocument();
    expect(screen.queryByText('PRIVATE_DIAGNOSTIC')).not.toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Crear admin'})).not.toBeInTheDocument();
    const read = pending<User[]>(); vi.mocked(listAdmins).mockReturnValue(read.promise); const before=vi.mocked(listAdmins).mock.calls.length;
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(listAdmins).toHaveBeenCalledTimes(before+1)); expect(retry).toBeDisabled();
    await act(async()=>{read.resolve([admin]);});
    expect(await screen.findByLabelText('Correo *')).toHaveValue('new-admin@example.com'); expect(createAdmin).not.toHaveBeenCalled(); expect(deleteAdmin).not.toHaveBeenCalled();
  });
}
it('initial loading, successful empty and failed read are distinct states', async () => {
  const read=pending<User[]>();vi.mocked(listAdmins).mockReturnValue(read.promise);mount();
  expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
  expect(screen.queryByText('No hay administradores creados')).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Crear admin'})).not.toBeInTheDocument();
  await act(async()=>{read.resolve([]);});await screen.findByText('No hay administradores creados');expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Crear admin'})).toBeEnabled();
});
it.each([403,503])('initial GET %s has safe error and a shared GET-only recovery',async status=>{
  vi.mocked(listAdmins).mockRejectedValue(failure(status));mount();await screen.findByRole('alert');
  expect(screen.queryByRole('form')).not.toBeInTheDocument();expect(screen.queryByText('No hay administradores creados')).not.toBeInTheDocument();
  const read=pending<User[]>();vi.mocked(listAdmins).mockReturnValue(read.promise);const before=vi.mocked(listAdmins).mock.calls.length;
  const retry=screen.getByRole('button',{name:'Reintentar'});fireEvent.click(retry);fireEvent.click(retry);
  await waitFor(()=>expect(listAdmins).toHaveBeenCalledTimes(before+1));
  await act(async()=>{read.resolve([admin]);});await screen.findByText(admin.email);
  expect(createAdmin).not.toHaveBeenCalled();expect(deleteAdmin).not.toHaveBeenCalled();
});
it('refresh freezes all write controls until its shared GET completes', async () => {
  mount(); await draft(); const read=pending<User[]>();vi.mocked(listAdmins).mockReturnValue(read.promise);
  fireEvent.click(screen.getByRole('button',{name:'Actualizar lista'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Actualizar lista'})).toBeDisabled());
  expect(screen.getByRole('button',{name:'Cancelar'})).toBeDisabled(); expect(screen.getByRole('button',{name:'Eliminar'})).toBeDisabled();expect(screen.getByLabelText('Correo *')).toBeDisabled();
  await act(async()=>{read.resolve([admin]);});await waitFor(()=>expect(screen.getByLabelText('Correo *')).toBeEnabled());
});
for (const kind of ['create','remove'] as const) {
  for (const status of [401,403,404,429,500,503]) {
    it(`${kind} confirmed plus GET ${status} shows confirmed outcome and retries GET only`, async () => {
      mount(); await screen.findByText(admin.email);vi.mocked(listAdmins).mockRejectedValue(failure(status));await write(kind);
      await screen.findByText(confirmed[kind]); expect(toast.warning).toHaveBeenCalledWith(confirmed[kind]);expect(toast.success).not.toHaveBeenCalled();
      expect(screen.queryByRole('form')).not.toBeInTheDocument();expect(screen.queryByText(admin.email)).not.toBeInTheDocument();
      const mutation = kind==='create'?createAdmin:deleteAdmin;expect(mutation).toHaveBeenCalledTimes(1);
      const read=pending<User[]>();vi.mocked(listAdmins).mockReturnValue(read.promise);const before=vi.mocked(listAdmins).mock.calls.length;
      const retry=screen.getByRole('button',{name:'Reintentar'});fireEvent.click(retry);fireEvent.click(retry);
      await waitFor(()=>expect(listAdmins).toHaveBeenCalledTimes(before+1));expect(retry).toBeDisabled();
      await act(async()=>{read.resolve([admin]);});await screen.findByText(admin.email);expect(screen.queryByText(confirmed[kind])).not.toBeInTheDocument();expect(mutation).toHaveBeenCalledTimes(1);
      if(kind==='create'){fireEvent.click(screen.getByRole('button',{name:'Crear admin'}));expect(screen.getByLabelText('Contraseña *')).toHaveValue('');}
    });
  }
  it(`${kind} failed plus GET failure is not confirmed; recovery does not resubmit`, async () => {
    mount();await screen.findByText(admin.email);const mutation=kind==='create'?createAdmin:deleteAdmin;vi.mocked(mutation).mockRejectedValueOnce(failure(503));vi.mocked(listAdmins).mockRejectedValue(failure(403));await write(kind);
    await screen.findByRole('alert');await waitFor(()=>expect(toast.error).toHaveBeenCalled());expect(screen.queryByText(confirmed[kind])).not.toBeInTheDocument();expect(toast.warning).not.toHaveBeenCalled();
    vi.mocked(listAdmins).mockResolvedValue([admin]);fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));await screen.findByText(admin.email);expect(mutation).toHaveBeenCalledTimes(1);
    if(kind==='create')expect(screen.getByLabelText('Correo *')).toHaveValue('new-admin@example.com');
  });
  it(`${kind} success notice is not reused after recovery then an unrelated GET failure`, async()=>{
    const client=mount();await screen.findByText(admin.email);vi.mocked(listAdmins).mockRejectedValue(failure(503));await write(kind);await screen.findByText(confirmed[kind]);
    vi.mocked(listAdmins).mockResolvedValue([admin]);fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));await screen.findByText(admin.email);
    vi.mocked(listAdmins).mockRejectedValue(failure(403));await act(async()=>{await client.refetchQueries({queryKey:['admins']});});await screen.findByRole('alert');expect(screen.queryByText(confirmed[kind])).not.toBeInTheDocument();
  });
}
it('successful removal refreshes once and cancellation never removes',async()=>{
  mount();await screen.findByText(admin.email);vi.mocked(window.confirm).mockReturnValueOnce(false);fireEvent.click(screen.getByRole('button',{name:'Eliminar'}));expect(deleteAdmin).not.toHaveBeenCalled();
  vi.mocked(window.confirm).mockReturnValueOnce(true);fireEvent.click(screen.getByRole('button',{name:'Eliminar'}));await waitFor(()=>expect(toast.success).toHaveBeenCalledWith('Administrador eliminado'));expect(listAdmins).toHaveBeenCalledTimes(2);
});
