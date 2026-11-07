import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import EvidencePage from '@/app/student/evidence/page';
import { listMyEvidence, uploadEvidence } from '@/lib/api/evidence';
import { getMyScheme } from '@/lib/api/scheme';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/student/evidence' }));
vi.mock('@/lib/api/evidence', () => ({ listMyEvidence: vi.fn(), uploadEvidence: vi.fn(), deleteEvidenceBatch: vi.fn(), downloadEvidenceFile: vi.fn() }));
vi.mock('@/lib/api/scheme', () => ({ getMyScheme: vi.fn() }));
const pdf = (name = 'synthetic.pdf', content = '%PDF-A') => new File([content], name, { type: 'application/pdf' });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listMyEvidence).mockResolvedValue({ items: [], page: 1, page_size: 20, total: 0, total_pages: 0, has_next: false, has_previous: false } as never);
  vi.mocked(getMyScheme).mockResolvedValue({ vaccines: [{ vaccine: { name: 'Synthetic vaccine' }, doses: [{ id: 'dose-fixture', dose_number: 1 }] }] } as never);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function mount(files: File[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><EvidencePage /></QueryClientProvider>);
  await screen.findByText('Aún no has cargado evidencia');
  const picker = view.container.querySelector('input[type=file]')!;
  fireEvent.change(picker, { target: { files } });
  return { ...view, picker, client };
}

it('removes only the chosen occurrence, including files with identical name and size', async () => {
  const first = pdf('synthetic.pdf', '%PDF-A'), second = pdf('synthetic.pdf', '%PDF-B');
  const other = pdf('synthetic-other.pdf');
  await mount([first, second, other]);
  fireEvent.click(screen.getAllByRole('button', { name: 'Quitar synthetic.pdf' })[1]);
  expect(screen.getAllByText('synthetic.pdf')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Subir evidencia' }));
  await waitFor(() => expect(uploadEvidence).toHaveBeenCalledWith([first, other], undefined, undefined));
});

it('clears the native picker after removing the last item and permits selecting it again', async () => {
  const file = pdf();
  const { picker } = await mount([file]);
  fireEvent.click(screen.getByRole('button', { name: 'Quitar synthetic.pdf' }));
  expect(screen.queryByText('synthetic.pdf')).not.toBeInTheDocument();
  expect(picker).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Subir evidencia' })).toBeDisabled();
  fireEvent.change(picker, { target: { files: [file] } });
  expect(screen.getByRole('button', { name: 'Subir evidencia' })).toBeEnabled();
});

it('labels the PDF picker and keeps selection actions separate from the upload action', async () => {
  const { picker } = await mount([pdf()]);
  expect(screen.getByLabelText('Seleccionar archivos PDF')).toBe(picker);
  expect(picker).toHaveAttribute('accept', 'application/pdf,.pdf');
  fireEvent.click(screen.getByRole('button', { name: 'Quitar synthetic.pdf' }));
  expect(uploadEvidence).not.toHaveBeenCalled();
});

it.each(['resolve', 'reject'])('freezes the entire form during POST and preserves the draft on failure (%s)', async outcome => {
  let resolve!: (data: never) => void, reject!: (error: Error) => void;
  vi.mocked(uploadEvidence).mockImplementation(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
  const file = pdf();
  const { picker } = await mount([file]);
  fireEvent.change(screen.getByLabelText('Notas (opcional)'), { target: { value: 'Synthetic draft' } });
  fireEvent.change(screen.getByLabelText('Dosis relacionada (opcional)'), { target: { value: 'dose-fixture' } });
  const submit = screen.getByRole('button', { name: 'Subir evidencia' });
  fireEvent.click(submit); fireEvent.click(submit);
  await waitFor(() => expect(uploadEvidence).toHaveBeenCalledTimes(1));
  expect(uploadEvidence).toHaveBeenCalledWith([file], 'Synthetic draft', 'dose-fixture');
  for (const element of [picker, screen.getByLabelText('Notas (opcional)'), screen.getByLabelText('Dosis relacionada (opcional)'), screen.getByRole('button', { name: 'Quitar synthetic.pdf' }), screen.getByRole('button', { name: /Haz clic o arrastra/ })]) expect(element).toBeDisabled();
  fireEvent.drop(screen.getByRole('button', { name: /Haz clic o arrastra/ }), { dataTransfer: { files: [pdf('synthetic-late.pdf')] } });
  expect(screen.queryByText('synthetic-late.pdf')).not.toBeInTheDocument();
  if (outcome === 'resolve') resolve({} as never); else reject(new Error('synthetic failure'));
  await waitFor(() => expect(screen.getByLabelText('Notas (opcional)')).toBeEnabled());
  if (outcome === 'resolve') {
    expect(screen.queryByText('synthetic.pdf')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Notas (opcional)')).toHaveValue('');
    expect(screen.getByLabelText('Dosis relacionada (opcional)')).toHaveValue('');
  } else {
    expect(screen.getByText('synthetic.pdf')).toBeInTheDocument();
    expect(screen.getByLabelText('Notas (opcional)')).toHaveValue('Synthetic draft');
    expect(screen.getByLabelText('Dosis relacionada (opcional)')).toHaveValue('dose-fixture');
  }
});

it('replaces the selection through drop and removes locally without deleting an uploaded batch', async () => {
  await mount([pdf()]);
  fireEvent.drop(screen.getByRole('button', { name: /Haz clic o arrastra/ }), { dataTransfer: { files: [pdf('synthetic-drop.pdf')] } });
  expect(screen.queryByText('synthetic.pdf')).not.toBeInTheDocument();
  const row = screen.getByText('synthetic-drop.pdf').closest('li')!;
  fireEvent.click(within(row).getByRole('button', { name: 'Quitar synthetic-drop.pdf' }));
  expect(screen.queryByText('synthetic-drop.pdf')).not.toBeInTheDocument();
  expect(uploadEvidence).not.toHaveBeenCalled();
});

it('keeps a long selected filename readable before upload', async () => {
  const longName = 'evidencia sintetica con nombre extenso para comprobar el reflujo en pantallas moviles '.repeat(2) + '.pdf';
  await mount([pdf(longName)]);
  const filename = screen.getByText(longName);
  expect(filename).not.toHaveClass('truncate');
  expect(filename).toHaveClass('break-words');
});

it('keeps long uploaded evidence filenames readable', async () => {
  const longName = 'evidencia sintetica con nombre extenso para comprobar el reflujo en pantallas moviles '.repeat(2) + '.pdf';
  vi.mocked(listMyEvidence).mockResolvedValue({
    items: [{
      id: 'synthetic-batch', status: 'in_review', created_at: '2026-01-01T10:00:00Z', notes: null,
      files: [{ id: 'synthetic-file', original_filename: longName, file_size: 123, mime_type: 'application/pdf', uploaded_at: '2026-01-01T10:00:00Z' }],
    }],
    page: 1, page_size: 20, total: 1, total_pages: 1, has_next: false, has_previous: false,
  } as never);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><EvidencePage /></QueryClientProvider>);
  const filename = await screen.findByText(longName);
  expect(filename).not.toHaveClass('truncate');
  expect(filename).toHaveClass('break-words');
});
