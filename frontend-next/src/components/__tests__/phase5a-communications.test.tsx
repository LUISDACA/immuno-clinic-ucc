import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CommunicationsPage } from '../communications-page';
import { ThreadDetail } from '../thread-detail';
import { createThread, searchRecipients, listThreads, getThread, updateThreadStatus, addMessage } from '@/lib/api/communications';
import { useAuthStore } from '@/lib/auth/store';
import { markCategoryRead } from '@/lib/api/notifications';
const nav = vi.hoisted(()=>({push:vi.fn(),replace:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>nav,useSearchParams:()=>new URLSearchParams()}));
vi.mock('@/lib/api/communications',()=>({createThread:vi.fn(),searchRecipients:vi.fn(),listThreads:vi.fn(),getThread:vi.fn(),updateThreadStatus:vi.fn(),addMessage:vi.fn()}));
vi.mock('@/lib/api/notifications',()=>({markCategoryRead:vi.fn().mockResolvedValue(undefined)}));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(listThreads).mockResolvedValue([]);vi.mocked(searchRecipients).mockResolvedValue([{id:'recipient',name:'Synthetic recipient',email:'synthetic@example.invalid',role:'admin'}]);vi.mocked(createThread).mockResolvedValue({id:'thread'} as never);});
afterEach(cleanup);
function mount(component:React.ReactNode){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>{component}</QueryClientProvider>);}
it('keeps failed read synchronization visible through retry and recovers only on success',async()=>{
 useAuthStore.setState({role:'admin',userId:'admin'});
 vi.mocked(getThread).mockResolvedValue({id:'thread',subject:'Synthetic',status:'open',student:{name:'Synthetic'},messages:[],last_message_at:'2026-01-01T00:00:00Z'} as never);
 vi.mocked(markCategoryRead).mockRejectedValueOnce(new Error('Synthetic failure')).mockRejectedValueOnce(new Error('Synthetic failure')).mockResolvedValue(undefined);
 mount(<ThreadDetail threadId="thread" />);
 fireEvent.click(await screen.findByText('Reintentar'));
 await waitFor(()=>expect(markCategoryRead).toHaveBeenCalledTimes(2));
 expect(screen.getByText('Reintentar')).toBeVisible();
 fireEvent.click(screen.getByText('Reintentar'));
 await waitFor(()=>expect(screen.queryByText('Reintentar')).not.toBeInTheDocument());
 expect(markCategoryRead).toHaveBeenCalledTimes(3);
});
it.each(['student','admin','app_admin'] as const)('%s creates with the authorized recipient contract',async role=>{
 useAuthStore.setState({role});mount(<CommunicationsPage />);fireEvent.click(screen.getByText('Nuevo mensaje'));
 fireEvent.change(screen.getByLabelText(role==='admin'?'Buscar estudiante':'Buscar administrador'),{target:{value:'Syn'}});
 fireEvent.click(await screen.findByText('Synthetic recipient'));
 fireEvent.change(screen.getByLabelText('Asunto'),{target:{value:'Synthetic subject'}});
 fireEvent.change(screen.getByLabelText('Mensaje'),{target:{value:'Synthetic message'}});
 fireEvent.click(screen.getByText('Enviar'));
 await waitFor(()=>expect(createThread).toHaveBeenCalledWith(expect.objectContaining(role==='admin'?{student_id:'recipient'}:{admin_id:'recipient'})));
 expect(searchRecipients).toHaveBeenCalledWith(role==='admin'?'students':'admins','Syn');
 expect(nav.push).toHaveBeenCalledWith(`${role==='student'?'/student':'/admin'}/communications/thread`);
});
it('normal admin can select app administrator, never forges student scope',async()=>{
 useAuthStore.setState({role:'admin'});mount(<CommunicationsPage />);fireEvent.click(screen.getByText('Nuevo mensaje'));
 fireEvent.change(screen.getByLabelText('Destinatario'),{target:{value:'admins'}});fireEvent.change(screen.getByLabelText('Buscar administrador'),{target:{value:'Syn'}});
 await screen.findByText('Synthetic recipient');expect(searchRecipients).toHaveBeenCalledWith('admins','Syn');
});
it.each(['open','closed'] as const)('%s thread has explicit close/reopen confirmation and reply',async status=>{
 useAuthStore.setState({role:'admin',userId:'admin'});
 vi.mocked(getThread).mockResolvedValue({id:'thread',subject:'Subject',status,student:{name:'Synthetic'},messages:[],last_message_at:'2026-09-28T10:00:00Z'} as never);
 mount(<ThreadDetail threadId="thread" />);
 fireEvent.click(await screen.findByText(status==='open'?'Cerrar conversación':'Reabrir conversación'));
 expect(updateThreadStatus).not.toHaveBeenCalled();fireEvent.click(screen.getByText('Confirmar estado'));
 await waitFor(()=>expect(updateThreadStatus).toHaveBeenCalledWith('thread',status==='open'?'closed':'open'));
 fireEvent.change(screen.getByLabelText('Respuesta'),{target:{value:'Synthetic reply'}});fireEvent.click(screen.getByText('Enviar'));
 await waitFor(()=>expect(addMessage).toHaveBeenCalledWith('thread','Synthetic reply'));
});
