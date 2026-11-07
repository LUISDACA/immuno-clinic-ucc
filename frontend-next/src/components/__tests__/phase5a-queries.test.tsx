import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { afterEach, expect, it, vi } from 'vitest';
import Dashboard from '@/app/student/page';
import Certificate from '@/app/student/certificate/page';
import Profile from '@/app/student/profile/page';
import AdminProfile from '@/app/admin/profile/page';
import Evidence from '@/app/student/evidence/page';
import Vaccines from '@/app/admin/vaccines/page';
import Admins from '@/app/admin/admins/page';
import AdminDashboard from '@/app/admin/page';
import Notifications from '@/app/student/notifications/page';
import AdminNotifications from '@/app/admin/notifications/page';
import History from '@/app/student/history/page';
import AdminHistory from '@/app/admin/history/page';
import Scheme from '@/app/student/scheme/page';
import { CommunicationsPage } from '../communications-page';
import { ThreadDetail } from '../thread-detail';
import { QueryError } from '../query-error';
import { useAuthStore } from '@/lib/auth/store';
const state = vi.hoisted(() => ({ error: null as unknown, retry: vi.fn() }));
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),replace:vi.fn()}),useSearchParams:()=>new URLSearchParams(),usePathname:()=>'/student'}));
vi.mock('@tanstack/react-query',async importOriginal => ({...await importOriginal<object>(),useQuery:()=>({error:state.error,refetch:state.retry,isLoading:false,isError:!!state.error,data:undefined})}));
afterEach(cleanup);
function failure(status:number){ return new AxiosError('unsafe payload',undefined,undefined,undefined,{status} as never); }
const pages = [Dashboard,Certificate,Profile,AdminProfile,Evidence,Vaccines,Admins,AdminDashboard,Notifications,AdminNotifications,History,AdminHistory,Scheme,CommunicationsPage,()=> <ThreadDetail threadId="synthetic" />];
it.each(pages.map((Component,index)=>({Component,index})))('query failure in page $index is an error with retry, never empty/loading',({Component})=>{
  state.error=failure(403);state.retry.mockReset();useAuthStore.setState({role:'admin'});
  render(<QueryClientProvider client={new QueryClient()}><Component /></QueryClientProvider>);
  expect(screen.getByText('No tienes permiso para consultar esta información.')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Reintentar'));expect(state.retry).toHaveBeenCalled();
  expect(screen.queryByText('unsafe payload')).not.toBeInTheDocument();
});
it.each([[404,'No se encontró la información solicitada.'],[500,'Ocurrió un error en el servidor. Intenta nuevamente.'],[503,'El servicio no está disponible temporalmente.']])('HTTP %s is distinct', (status,message)=>{
 render(<QueryError error={failure(Number(status))} retry={vi.fn()} />);expect(screen.getByText(message)).toBeInTheDocument();
});
