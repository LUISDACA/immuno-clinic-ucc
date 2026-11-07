import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import EvidencePage from '@/app/student/evidence/page';
import { listMyEvidence, deleteEvidenceBatch, uploadEvidence } from '@/lib/api/evidence';
import { getMyScheme } from '@/lib/api/scheme';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()}),useSearchParams:()=>new URLSearchParams(),usePathname:()=>'/student/evidence'}));
vi.mock('@/lib/api/evidence', () => ({listMyEvidence:vi.fn(),deleteEvidenceBatch:vi.fn(),uploadEvidence:vi.fn(),downloadEvidenceFile:vi.fn()}));
vi.mock('@/lib/api/scheme', () => ({getMyScheme:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(getMyScheme).mockResolvedValue({vaccines:[]} as never);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function mount(){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><EvidencePage /></QueryClientProvider>);}
it('shows loading, then a true empty response; picker offers only PDF and submits the selected PDF',async()=>{
 let finish!: (data:never)=>void;
 vi.mocked(listMyEvidence).mockReturnValue(new Promise(resolve=>{finish=resolve;}));
 const {container}=mount();
 expect(screen.queryByText('Aún no has cargado evidencia')).not.toBeInTheDocument();
 finish({items:[]} as never);
 await screen.findByText('Aún no has cargado evidencia');
 const picker=container.querySelector('input[type="file"]')!;
 expect(picker).toHaveAttribute('accept','application/pdf,.pdf');
 expect(screen.getByText('Solo PDF. Máximo 10 MB por archivo.')).toBeInTheDocument();
 const pdf=new File(['%PDF-1.4 synthetic'],'synthetic.pdf',{type:'application/pdf'});
 fireEvent.change(picker,{target:{files:[pdf]}});
 fireEvent.click(screen.getByText('Subir evidencia'));
 await waitFor(()=>expect(uploadEvidence).toHaveBeenCalledWith([pdf],undefined,undefined));
});
it.each(['in_review','approved','denied'])('offers deletion for %s only after confirmation',async status=>{
 vi.mocked(listMyEvidence).mockResolvedValue({items:[{id:'batch',status,created_at:'2026-09-28T10:00:00Z',files:[]}]} as never);
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
 mount();fireEvent.click(await screen.findByText('Eliminar'));
 expect(deleteEvidenceBatch).not.toHaveBeenCalled();
 confirm.mockReturnValue(true);fireEvent.click(screen.getByText('Eliminar'));
 await waitFor(()=>expect(deleteEvidenceBatch).toHaveBeenCalledWith('batch'));
});
