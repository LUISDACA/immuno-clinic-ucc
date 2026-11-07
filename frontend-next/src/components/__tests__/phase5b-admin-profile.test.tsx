import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import Profile from '@/app/admin/profile/page';
import { getMe, updateMyProfile, getActiveAdminSignature, uploadAdminSignature } from '@/lib/api/users';
import { useAuthStore } from '@/lib/auth/store';
import type { User } from '@/lib/api/types';

vi.mock('@/lib/api/users',()=>({getMe:vi.fn(),updateMyProfile:vi.fn(),getActiveAdminSignature:vi.fn(),getActiveAdminSignatureImage:vi.fn(),uploadAdminSignature:vi.fn()}));
vi.mock('sonner',()=>({toast:{success:vi.fn(),warning:vi.fn(),error:vi.fn()}}));
const fixture:User={id:'synthetic-admin',email:'admin@example.com',role:'admin',is_active:true,must_change_password:false,created_at:'2026-01-01T12:00:00Z',profile:{id:'synthetic-profile',first_name:'Synthetic',last_name:'Administrator',job_title:'Cargo sintético',sex:'female',program:'Medicina',campus:'Bogotá'}};
const changed:User={...fixture,profile:{...fixture.profile!,first_name:'Updated',job_title:'Cargo actualizado'}};
const confirmed='Los cambios se guardaron, pero no se pudo actualizar el perfil.';
const clients:QueryClient[]=[];
function failure(status:number){return new AxiosError('PRIVATE_DIAGNOSTIC',undefined,undefined,undefined,{status,data:{message:'PRIVATE_DIAGNOSTIC'}} as never);}
function pending<T>(){let resolve!:(value:T)=>void;let reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function mount(){const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity},mutations:{retry:false}}});clients.push(client);const view=render(<QueryClientProvider client={client}><Profile/></QueryClientProvider>);return{client,...view};}
async function draft(){fireEvent.click(await screen.findByRole('button',{name:'Editar'}));fireEvent.change(screen.getByLabelText('Nombres'),{target:{value:'Updated'}});fireEvent.change(screen.getByLabelText('Cargo'),{target:{value:'Cargo actualizado'}});}
function submit(){const button=screen.getByRole('button',{name:'Guardar cambios'});const form=(button as HTMLButtonElement).form;if(form)fireEvent.submit(form);else fireEvent.click(button);}
beforeEach(()=>{vi.resetAllMocks();useAuthStore.setState({userId:fixture.id,role:'admin',isAuthenticated:true});vi.mocked(getMe).mockResolvedValue(fixture);vi.mocked(getActiveAdminSignature).mockResolvedValue(null);});
afterEach(()=>{cleanup();clients.splice(0).forEach(c=>c.clear());});
for(const role of ['admin','app_admin'] as const){
 for(const status of [401,403,503])for(const editing of [false,true])it(`${role} GET ${status}, editing=${editing}: safe error hides data and preserves draft on retry`,async()=>{
  useAuthStore.setState({role});const {client}=mount();await screen.findByText('Medicina');if(editing)await draft();vi.mocked(getMe).mockRejectedValueOnce(failure(status));await act(async()=>{await client.refetchQueries({queryKey:['user','me']});});await screen.findByRole('alert');expect(screen.queryByText('Medicina')).not.toBeInTheDocument();expect(screen.queryByLabelText('Nombres')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Editar'})).not.toBeInTheDocument();expect(screen.queryByText('PRIVATE_DIAGNOSTIC')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));if(editing)expect(await screen.findByLabelText('Nombres')).toHaveValue('Updated');else expect(await screen.findByRole('button',{name:'Editar'})).toBeEnabled();expect(updateMyProfile).not.toHaveBeenCalled();expect(uploadAdminSignature).not.toHaveBeenCalled();
 });
 it(`${role} PUT confirmed/GET denied distinguishes committed write and retries only GET`,async()=>{
  useAuthStore.setState({role});mount();await draft();vi.mocked(updateMyProfile).mockResolvedValue(changed);vi.mocked(getMe).mockRejectedValue(failure(403));submit();await screen.findByText(confirmed);expect(screen.queryByText('Medicina')).not.toBeInTheDocument();expect(toast.success).not.toHaveBeenCalled();expect(updateMyProfile).toHaveBeenCalledTimes(1);expect(getMe).toHaveBeenCalledTimes(2);vi.mocked(getMe).mockResolvedValue(changed);fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));await screen.findByRole('button',{name:'Editar'});expect(screen.getByText('Updated Administrator')).toBeInTheDocument();expect(updateMyProfile).toHaveBeenCalledTimes(1);expect(getMe).toHaveBeenCalledTimes(3);
 });
 it(`${role} PUT and GET failed: retain unsaved draft and require explicit write`,async()=>{
  useAuthStore.setState({role});mount();await draft();vi.mocked(updateMyProfile).mockRejectedValueOnce(failure(503));vi.mocked(getMe).mockRejectedValue(failure(403));submit();await screen.findByRole('alert');await waitFor(()=>expect(toast.error).toHaveBeenCalled());expect(screen.queryByText(confirmed)).not.toBeInTheDocument();vi.mocked(getMe).mockResolvedValue(fixture);fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));expect(await screen.findByLabelText('Nombres')).toHaveValue('Updated');expect(screen.getByText('No se pudo guardar el perfil. Intenta nuevamente.')).toBeInTheDocument();expect(updateMyProfile).toHaveBeenCalledTimes(1);vi.mocked(updateMyProfile).mockResolvedValue(changed);vi.mocked(getMe).mockResolvedValue(changed);submit();await screen.findByRole('button',{name:'Editar'});expect(updateMyProfile).toHaveBeenCalledTimes(2);
 });
}
it('initial error is not empty and duplicate retries share one GET',async()=>{vi.mocked(getMe).mockRejectedValueOnce(failure(503));mount();await screen.findByRole('alert');expect(screen.queryByText('No registrado')).not.toBeInTheDocument();const read=pending<User>();vi.mocked(getMe).mockReturnValueOnce(read.promise);const retry=screen.getByRole('button',{name:'Reintentar'});act(()=>{fireEvent.click(retry);fireEvent.click(retry);});await waitFor(()=>expect(getMe).toHaveBeenCalledTimes(2));await waitFor(()=>expect(screen.queryByRole('button',{name:'Reintentar'})).not.toBeInTheDocument());expect(screen.getByText('Cargando...')).toBeInTheDocument();await act(async()=>read.resolve(fixture));await screen.findByRole('button',{name:'Editar'});});
it('native form freezes controls and snapshots one PUT without changing locked scope or signature',async()=>{const write=pending<User>();vi.mocked(updateMyProfile).mockReturnValue(write.promise);mount();await draft();const form=screen.getByLabelText('Nombres').closest('form');expect(form).not.toBeNull();const cancel=screen.getByRole('button',{name:'Cancelar'});act(()=>{submit();fireEvent.click(cancel);submit();});await waitFor(()=>expect(updateMyProfile).toHaveBeenCalledTimes(1));expect(screen.getByLabelText('Nombres')).toBeDisabled();expect(screen.getByRole('button',{name:'Cancelar'})).toBeDisabled();expect(vi.mocked(updateMyProfile).mock.calls[0][0]).toEqual({first_name:'Updated',last_name:'Administrator',job_title:'Cargo actualizado'});expect(screen.queryByRole('textbox',{name:'Programa'})).not.toBeInTheDocument();await act(async()=>write.resolve(changed));await screen.findByRole('button',{name:'Editar'});expect(uploadAdminSignature).not.toHaveBeenCalled();});
it('blank cargo retains existing null normalization without broadening update fields',async()=>{mount();await draft();fireEvent.change(screen.getByLabelText('Cargo'),{target:{value:'   '}});vi.mocked(updateMyProfile).mockResolvedValue(fixture);submit();await waitFor(()=>expect(updateMyProfile).toHaveBeenCalledTimes(1));expect(vi.mocked(updateMyProfile).mock.calls[0][0].job_title).toBeNull();});
it('successful identical GET retires confirmed notice before unrelated error',async()=>{const {client}=mount();await draft();vi.mocked(updateMyProfile).mockResolvedValue(fixture);vi.mocked(getMe).mockRejectedValue(failure(503));submit();await screen.findByText(confirmed);vi.mocked(getMe).mockResolvedValue(fixture);fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));await screen.findByRole('button',{name:'Editar'});vi.mocked(getMe).mockRejectedValueOnce(failure(503));await act(async()=>{await client.refetchQueries({queryKey:['user','me']});});await screen.findByRole('alert');expect(screen.queryByText(confirmed)).not.toBeInTheDocument();});
it('pre-write late GET cannot erase post-write denial',async()=>{const {client}=mount();await draft();const old=pending<User>();vi.mocked(getMe).mockReturnValueOnce(old.promise);let read!:Promise<void>;act(()=>{read=client.refetchQueries({queryKey:['user','me']});});vi.mocked(updateMyProfile).mockResolvedValue(changed);vi.mocked(getMe).mockRejectedValue(failure(403));submit();await screen.findByText(confirmed);await act(async()=>{old.resolve(fixture);await read;});expect(screen.getByText(confirmed)).toBeInTheDocument();expect(screen.queryByText('Medicina')).not.toBeInTheDocument();});
for(const failed of [false,true])it(`completion after unmount, failed=${failed}, has no notification`,async()=>{const write=pending<User>();vi.mocked(updateMyProfile).mockReturnValue(write.promise);const {unmount}=mount();await draft();submit();await waitFor(()=>expect(updateMyProfile).toHaveBeenCalledTimes(1));unmount();await act(async()=>{if(failed)write.reject(failure(503));else write.resolve(changed);});expect(toast.success).not.toHaveBeenCalled();expect(toast.warning).not.toHaveBeenCalled();expect(toast.error).not.toHaveBeenCalled();});
it('completion for former owner cannot restore data or announce success',async()=>{const write=pending<User>();vi.mocked(updateMyProfile).mockReturnValue(write.promise);const {client}=mount();await draft();submit();await waitFor(()=>expect(updateMyProfile).toHaveBeenCalledTimes(1));act(()=>{useAuthStore.setState({userId:'synthetic-other'});client.clear();});await act(async()=>write.resolve(changed));expect(toast.success).not.toHaveBeenCalled();expect(toast.warning).not.toHaveBeenCalled();expect(client.getQueryData(['user','me'])).toBeUndefined();});
it('null profile is represented without invented personal data',async()=>{vi.mocked(getMe).mockResolvedValue({...fixture,profile:null});mount();await screen.findByText('Mi perfil');expect(screen.getAllByText('No registrado').length).toBeGreaterThan(0);expect(screen.queryByText('Medicina')).not.toBeInTheDocument();});

it('retains complete long base profile values for responsive rendering',async()=>{
 const email=`${'synthetic-address-segment-'.repeat(5)}@example.invalid`;
 const firstName='Synthetic Name With Multiple Long Segments';
 const lastName='Long Last Name For Narrow Screen';
 const jobTitle='Synthetic Administrative Role '.repeat(8).trim();
 const program='Synthetic Academic Program '.repeat(8).trim();
 const campus='Synthetic Campus Location '.repeat(8).trim();
 vi.mocked(getMe).mockResolvedValue({...fixture,email,profile:{...fixture.profile!,first_name:firstName,last_name:lastName,job_title:jobTitle,program,campus}});
 mount();
 const fullName=await screen.findByText(`${firstName} ${lastName}`);
 expect(fullName).not.toHaveClass('truncate');
 expect(fullName).toHaveClass('break-words');
 for(const value of [email,jobTitle,program,campus]){
  const matches=screen.getAllByText(value,{exact:true});
  expect(matches.length).toBeGreaterThan(0);
  for(const element of matches){expect(element).not.toHaveClass('truncate');expect(element).toHaveClass('break-words');}
 }
 fireEvent.click(await screen.findByRole('button',{name:'Editar'}));
 await screen.findByLabelText('Nombres');
 for(const value of [email,program,campus]){
  const matches=screen.getAllByText(value,{exact:true});
  expect(matches.length).toBeGreaterThan(0);
  for(const element of matches){expect(element).not.toHaveClass('truncate');expect(element).toHaveClass('break-words');}
 }
});

it('retry after retained data stays disabled and shares its GET',async()=>{const {client}=mount();await screen.findByText('Medicina');vi.mocked(getMe).mockRejectedValueOnce(failure(503));await act(async()=>{await client.refetchQueries({queryKey:['user','me']});});const retry=await screen.findByRole('button',{name:'Reintentar'});const read=pending<User>();vi.mocked(getMe).mockReturnValueOnce(read.promise);act(()=>{fireEvent.click(retry);fireEvent.click(retry);});await waitFor(()=>expect(getMe).toHaveBeenCalledTimes(3));await waitFor(()=>expect(retry).toBeDisabled());await act(async()=>read.resolve(fixture));await screen.findByRole('button',{name:'Editar'});expect(updateMyProfile).not.toHaveBeenCalled();});

it('cancelling an unsaved edit retires its failed-write notice',async()=>{const {client}=mount();await draft();vi.mocked(updateMyProfile).mockRejectedValueOnce(failure(503));submit();await screen.findByText('No se pudo guardar el perfil. Intenta nuevamente.');fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));vi.mocked(getMe).mockRejectedValueOnce(failure(403));await act(async()=>{await client.refetchQueries({queryKey:['user','me']});});await screen.findByRole('alert');expect(screen.queryByText('No se pudo guardar el perfil. Intenta nuevamente.')).not.toBeInTheDocument();});
