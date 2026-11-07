import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StudentHistory from '@/app/student/history/page';
import AdminHistory from '@/app/admin/history/page';
import { auditPage } from '@/lib/api/audit';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams('page=2'), usePathname: () => '/student/history' }));
vi.mock('@/lib/api/audit', () => ({ auditPage: vi.fn() }));
const data = { page:2, page_size:20, total:21, total_pages:2, has_next:false, has_previous:true, items:[{id:'synthetic-event',action:'profile.updated',actor:null,created_at:'2026-01-01T10:00:00Z',details:{notes:'Synthetic authorized history'}}] };
const failure = (status:number) => new AxiosError('PRIVATE_DIAGNOSTIC', undefined, undefined, undefined, { status, data:{message:'PRIVATE_DIAGNOSTIC'} } as AxiosResponse);
beforeEach(() => {vi.clearAllMocks();vi.mocked(auditPage).mockResolvedValue(data as never);});
afterEach(() => {cleanup();vi.restoreAllMocks();});
async function mount(admin:boolean) {
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}>{admin?<AdminHistory/>:<StudentHistory/>}</QueryClientProvider>);
 await screen.findByText('Comentario: Synthetic authorized history');return client;
}
for(const admin of [false,true]) {
 it.each([401,403,404,429,500,503])(`history admin=${admin} hides retained data on GET %s and shares double retry`,async status=>{
  const client=await mount(admin);vi.mocked(auditPage).mockRejectedValue(failure(status));
  await act(async()=>{await client.invalidateQueries({queryKey:['audit',admin?'admin':'me',2]});});
  const retry=await screen.findByRole('button',{name:'Reintentar'});
  expect(screen.queryByText('Comentario: Synthetic authorized history')).not.toBeInTheDocument();
  expect(screen.queryByText('No hay cambios registrados')).not.toBeInTheDocument();
  expect(screen.queryByText('PRIVATE_DIAGNOSTIC')).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation',{name:'Paginación'})).not.toBeInTheDocument();
  let finish!:(value:never)=>void;vi.mocked(auditPage).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const before=vi.mocked(auditPage).mock.calls.length;fireEvent.click(retry);fireEvent.click(retry);
  await waitFor(()=>expect(auditPage).toHaveBeenCalledTimes(before+1));expect(retry).toBeDisabled();
  await act(async()=>finish(data as never));await screen.findByText('Comentario: Synthetic authorized history');
  expect(auditPage).toHaveBeenLastCalledWith(admin,2);
 });
 it(`admin=${admin} blocks pager and refresh throughout background GET`,async()=>{
  await mount(admin);let finish!:(value:never)=>void;
  vi.mocked(auditPage).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  fireEvent.click(screen.getByRole('button',{name:'Actualizar lista'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Actualizar lista'})).toBeDisabled());
  expect(screen.getByRole('button',{name:'Anterior'})).toBeDisabled();
  await act(async()=>finish(data as never));
 });
 it(`admin=${admin} distinguishes initial loading and a valid empty page`,async()=>{
  let finish!:(value:never)=>void;vi.mocked(auditPage).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<QueryClientProvider client={client}>{admin?<AdminHistory/>:<StudentHistory/>}</QueryClientProvider>);
  expect(screen.getByText('Cargando…')).toBeInTheDocument();expect(screen.queryByText('No hay cambios registrados')).not.toBeInTheDocument();
  await act(async()=>finish({...data,items:[],total:0,total_pages:0} as never));await screen.findByText('No hay cambios registrados');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 });
}
