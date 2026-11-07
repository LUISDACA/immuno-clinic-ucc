import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Detail from '@/app/admin/students/[id]/page';
import { deactivateStudent, reactivateStudent, deleteStudent, getStudent } from '@/lib/api/admin';
import { getStudentScheme } from '@/lib/api/scheme';
import { useAuthStore } from '@/lib/auth/store';
const nav=vi.hoisted(()=>({push:vi.fn(),replace:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>nav,useSearchParams:()=>new URLSearchParams('tab=scheme&returnTo=%2Fadmin%2Fstudents%3Factive%3Dtrue')}));
vi.mock('@/lib/api/admin',()=>({getAcademicOptions:vi.fn(async()=>({programs:[],campuses:[],semesters:Array.from({length:10},(_,i)=>i+1)})),getStudent:vi.fn(),deactivateStudent:vi.fn(),reactivateStudent:vi.fn(),deleteStudent:vi.fn()}));
vi.mock('@/lib/api/scheme',()=>({getStudentScheme:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();useAuthStore.setState({role:'admin'});vi.mocked(getStudent).mockResolvedValue({id:'synthetic',email:'synthetic@example.invalid',profile:null,is_active:true} as never);vi.mocked(getStudentScheme).mockResolvedValue([]);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
async function mount(){await act(async()=>{render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Detail params={Promise.resolve({id:'synthetic'})} /></QueryClientProvider>);});}
it.each(['Desactivar','Reactivar','Eliminar'])('%s is available and requires confirmation',async label=>{
 if(label==='Reactivar')vi.mocked(getStudent).mockResolvedValue({id:'synthetic',email:'synthetic@example.invalid',profile:null,is_active:false} as never);
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
 await mount();fireEvent.click(await screen.findByText(label));
 const api=label==='Desactivar'?deactivateStudent:label==='Reactivar'?reactivateStudent:deleteStudent;
 expect(api).not.toHaveBeenCalled();confirm.mockReturnValue(true);fireEvent.click(screen.getByText(label));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('synthetic'));
});
it('opens scheme deep link, retains list filters on back and routes message to communications',async()=>{
 await mount();await screen.findByText('Este estudiante no tiene esquema asignado.');
 expect(getStudentScheme).toHaveBeenCalledWith('synthetic');
 fireEvent.click(screen.getByLabelText('Volver'));expect(nav.push).toHaveBeenCalledWith('/admin/students?active=true');
 fireEvent.click(screen.getByLabelText('Enviar mensaje'));expect(nav.push).toHaveBeenCalledWith(expect.stringContaining('/admin/communications?studentId=synthetic&returnTo='));
 fireEvent.click(screen.getByText('Evidencia'));expect(nav.replace).toHaveBeenCalledWith('/admin/students/synthetic?tab=evidence&returnTo=%2Fadmin%2Fstudents%3Factive%3Dtrue',{scroll:false});
});
it.each([403,404,500])('detail HTTP %s exits loading and supports retry',async status=>{
 vi.mocked(getStudent).mockRejectedValue(new AxiosError('unsafe',undefined,undefined,undefined,{status} as never));
 await mount();fireEvent.click(await screen.findByText('Reintentar'));
 await waitFor(()=>expect(getStudent).toHaveBeenCalledTimes(2));
 expect(screen.queryByText('Cargando…')).not.toBeInTheDocument();
});
