import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import { toast } from 'sonner';
import Forgot from '@/app/(auth)/forgot-password/page';
import Reset from '@/app/(auth)/reset-password/page';
import { AuthGate } from '@/components/auth-gate';
import { ChangePasswordForm } from '@/components/change-password-form';
import { forgotPassword, resetPassword, changePassword } from '@/lib/auth/api';
import { useAuthStore } from '@/lib/auth/store';

const nav=vi.hoisted(()=>({replace:vi.fn(),token:'synthetic-reset-only',pathname:'/student/change-password'}));
vi.mock('next/navigation',()=>({useRouter:()=>nav,usePathname:()=>nav.pathname,useSearchParams:()=>new URLSearchParams(nav.token?{token:nav.token}:{})}));
vi.mock('@/lib/auth/api',()=>({forgotPassword:vi.fn(),resetPassword:vi.fn(),changePassword:vi.fn()}));
vi.mock('sonner',()=>({toast:{success:vi.fn()}}));
const operations=['forgot','reset','change'] as const;
type Operation=typeof operations[number];
const calls={forgot:forgotPassword,reset:resetPassword,change:changePassword};
const safe503='El servicio no está disponible temporalmente.';
const failure=(status?:number,code?:string)=>new AxiosError('PRIVATE_DIAGNOSTIC',code,undefined,undefined,status?{status,data:{detail:'PRIVATE_DIAGNOSTIC',message:'PRIVATE_DIAGNOSTIC'}} as AxiosResponse:undefined);
function pending(){let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return{promise,resolve};}
function mount(kind:Operation){render(kind==='forgot'?<Forgot/>:kind==='reset'?<Reset/>:<ChangePasswordForm/>);}
async function fill(kind:Operation){
 if(kind==='forgot')fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'synthetic@example.com'}});
 else {
  if(kind==='change')fireEvent.change(screen.getByLabelText('Contraseña actual'),{target:{value:'SyntheticOld123!'}});
  fireEvent.change(screen.getByLabelText('Nueva contraseña'),{target:{value:'SyntheticNew123!'}});
  fireEvent.change(screen.getByLabelText(kind==='reset'?'Confirmar contraseña':'Confirmar nueva contraseña'),{target:{value:'SyntheticNew123!'}});
 }
}
beforeEach(()=>{vi.resetAllMocks();nav.token='synthetic-reset-only';nav.pathname='/student/change-password';useAuthStore.setState({userId:'synthetic-student',role:'student',mustChangePassword:false,isAuthenticated:true,logout:vi.fn().mockResolvedValue(undefined)});});
afterEach(cleanup);
for(const kind of operations){
 it(`${kind}: invalid fields are associated with errors and do not submit`,async()=>{
  mount(kind);fireEvent.submit(document.querySelector('form')!);expect(calls[kind]).not.toHaveBeenCalled();
  const fields=[...document.querySelectorAll('input[aria-invalid=true]')];expect(fields.length).toBeGreaterThan(0);
  for(const field of fields){const ids=field.getAttribute('aria-describedby')?.split(' ')??[];expect(ids.length).toBeGreaterThan(0);expect(ids.some(id=>document.getElementById(id)?.textContent)).toBe(true);}
 });
 it(`${kind}: same-frame duplicate submit sends one request and freezes controls`,async()=>{
  const request=pending();vi.mocked(calls[kind]).mockReturnValue(request.promise);mount(kind);await fill(kind);
  const form=document.querySelector('form')!;act(()=>{fireEvent.submit(form);fireEvent.submit(form);});await waitFor(()=>expect(calls[kind]).toHaveBeenCalledTimes(1));
  for(const field of document.querySelectorAll('input, form button'))expect(field).toBeDisabled();
  await act(async()=>{request.resolve();});
  if(kind==='forgot')expect(await screen.findByText('Correo enviado')).toBeInTheDocument();
  if(kind==='reset')expect(await screen.findByText('¡Contraseña actualizada!')).toBeInTheDocument();
  if(kind==='change'){expect(useAuthStore.getState().logout).toHaveBeenCalledTimes(1);expect(nav.replace).toHaveBeenCalledWith('/login');expect(toast.success).toHaveBeenCalledWith('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');}
 });
 for(const status of [400,401,403,422,429,500,503]){
  it(`${kind}: HTTP ${status} uses safe error, retains draft and needs explicit retry`,async()=>{
   vi.mocked(calls[kind]).mockRejectedValueOnce(failure(status));mount(kind);await fill(kind);fireEvent.submit(document.querySelector('form')!);const alert=await screen.findByRole('alert');
   expect(alert).not.toHaveTextContent('PRIVATE_DIAGNOSTIC');expect(alert).not.toHaveTextContent(/CORS|Render|backend caído/);
   if(status===503)expect(alert).toHaveTextContent(safe503);
   if(kind==='reset'&&status>=500)expect(alert).not.toHaveTextContent('Token inválido');
   if(kind==='change'&&status===401)expect(alert).toHaveTextContent('Tu sesión expiró');
   expect(calls[kind]).toHaveBeenCalledTimes(1);expect(document.querySelector('input')).toBeEnabled();
   if(kind==='forgot')expect(screen.getByLabelText('Correo electrónico')).toHaveValue('synthetic@example.com');else expect(screen.getByLabelText('Nueva contraseña')).toHaveValue('SyntheticNew123!');
   fireEvent.submit(document.querySelector('form')!);await waitFor(()=>expect(calls[kind]).toHaveBeenCalledTimes(2));
  });
 }
 it(`${kind}: timeout does not leak diagnostics or mislabel token`,async()=>{
  vi.mocked(calls[kind]).mockRejectedValueOnce(failure(undefined,'ECONNABORTED'));mount(kind);await fill(kind);fireEvent.submit(document.querySelector('form')!);const alert=await screen.findByRole('alert');expect(alert).toHaveTextContent('tardó demasiado');expect(alert).not.toHaveTextContent(/PRIVATE_DIAGNOSTIC|Token inválido|Render/);
 });
}
it('reset without token offers recovery without a request or token display',()=>{
 nav.token='';mount('reset');expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument();expect(screen.getByRole('link',{name:'Solicitar nuevo enlace'})).toHaveAttribute('href','/forgot-password');expect(resetPassword).not.toHaveBeenCalled();
});
it('forced change describes the existing emailed temporary password',()=>{
 useAuthStore.setState({mustChangePassword:true});mount('change');expect(screen.getByText(/contraseña temporal recibida por correo/)).toBeInTheDocument();expect(screen.queryByText(/tu cédula/)).not.toBeInTheDocument();
});
it('forgot password submits once on Enter from the email field',async()=>{
 const user=userEvent.setup();vi.mocked(forgotPassword).mockResolvedValueOnce();mount('forgot');
 await user.type(screen.getByLabelText('Correo electrónico'),'Synthetic@Example.com');await user.keyboard('{Enter}');
 await waitFor(()=>expect(forgotPassword).toHaveBeenCalledTimes(1));expect(forgotPassword).toHaveBeenCalledWith('synthetic@example.com');expect(await screen.findByText('Correo enviado')).toBeInTheDocument();
});
it('reset password submits once on Enter from the confirmation field',async()=>{
 const user=userEvent.setup();vi.mocked(resetPassword).mockResolvedValueOnce();mount('reset');
 await user.type(screen.getByLabelText('Nueva contraseña'),'SyntheticNew123!');await user.type(screen.getByLabelText('Confirmar contraseña'),'SyntheticNew123!');await user.keyboard('{Enter}');
 await waitFor(()=>expect(resetPassword).toHaveBeenCalledTimes(1));expect(resetPassword).toHaveBeenCalledWith('synthetic-reset-only','SyntheticNew123!');expect(await screen.findByText('¡Contraseña actualizada!')).toBeInTheDocument();
});
it('change password submits once on Enter from the confirmation field',async()=>{
 const user=userEvent.setup();vi.mocked(changePassword).mockResolvedValueOnce();mount('change');
 await user.type(screen.getByLabelText('Contraseña actual'),'SyntheticOld123!');await user.type(screen.getByLabelText('Nueva contraseña'),'SyntheticNew123!');await user.type(screen.getByLabelText('Confirmar nueva contraseña'),'SyntheticNew123!');await user.keyboard('{Enter}');
 await waitFor(()=>expect(changePassword).toHaveBeenCalledTimes(1));expect(changePassword).toHaveBeenCalledWith('SyntheticOld123!','SyntheticNew123!');expect(useAuthStore.getState().logout).toHaveBeenCalledTimes(1);expect(await screen.findByText('Contraseña actualizada')).toBeInTheDocument();
 expect(toast.success).toHaveBeenCalledWith('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
});
it('change password success notification survives form unmount during logout',async()=>{
 const request=pending();
 useAuthStore.setState({
  isHydrated:true,
  checkSession:vi.fn(),
  logout:vi.fn(async()=>{
   useAuthStore.setState({isAuthenticated:false,role:null,userId:null,email:null,mustChangePassword:false});
   await request.promise;
  }),
 });
 vi.mocked(changePassword).mockResolvedValueOnce();render(<AuthGate requireRole="student"><ChangePasswordForm/></AuthGate>);
 await fill('change');fireEvent.submit(document.querySelector('form')!);
 await waitFor(()=>expect(useAuthStore.getState().logout).toHaveBeenCalledTimes(1));
 await waitFor(()=>expect(nav.replace).toHaveBeenCalledWith('/login'));
 await act(async()=>request.resolve());
 expect(toast.success).toHaveBeenCalledWith('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
});
