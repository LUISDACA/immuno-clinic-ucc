import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminDoseRow } from '../admin-dose-row';
import { useAuthStore } from '@/lib/auth/store';
import { reviewDose, updateDoseComment } from '@/lib/api/scheme';
import type { StudentDose } from '@/lib/api/types';
vi.mock('@/lib/api/scheme', () => ({ reviewDose: vi.fn(), updateDoseComment: vi.fn() }));
const dose = { id: 'dose1', dose_number: 1, status: 'in_review', admin_notes: 'Synthetic note', dose_config: null } as StudentDose;
beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ role: 'admin' }); });
afterEach(cleanup);
function mount() { render(<QueryClientProvider client={new QueryClient({defaultOptions:{mutations:{retry:false}}})}><AdminDoseRow dose={dose} studentId="student1" /></QueryClientProvider>); }
it('editing and deleting comments use only comment API, with confirmation for deletion', async () => {
  mount(); fireEvent.click(screen.getByText('Editar comentario'));
  fireEvent.change(screen.getByLabelText('Comentario (sin cambiar el estado de la dosis)'), {target:{value:'New note'}});
  fireEvent.click(screen.getByText('Guardar comentario'));
  await waitFor(() => expect(updateDoseComment).toHaveBeenCalledWith('dose1', 'New note'));
  await waitFor(() => expect(screen.getByText('Eliminar comentario')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Eliminar comentario'));
  expect(updateDoseComment).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Confirmar eliminación del comentario'));
  await waitFor(() => expect(updateDoseComment).toHaveBeenCalledWith('dose1', null));
  expect(reviewDose).not.toHaveBeenCalled();
});
it.each(['Aprobar','Denegar'])('%s requires explicit confirmation and never calls comment API', async action => {
  mount(); fireEvent.click(screen.getByText(action));
  expect(reviewDose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText(action));
  await waitFor(() => expect(reviewDose).toHaveBeenCalledWith('dose1', expect.objectContaining({status: action === 'Aprobar' ? 'approved' : 'denied'})));
  expect(updateDoseComment).not.toHaveBeenCalled();
});
it('student cannot mount administrative actions', () => {
  useAuthStore.setState({role:'student'}); mount();
  expect(screen.queryByText('Aprobar')).not.toBeInTheDocument();
  expect(screen.queryByText('Denegar')).not.toBeInTheDocument();
  expect(screen.queryByText('Editar comentario')).not.toBeInTheDocument();
});
it('retains long dose labels so they can wrap like Flutter', () => {
  const longLabel = 'Etiqueta sintética extensa para verificar que el nombre completo de la dosis se ajuste en pantallas estrechas';
  render(<QueryClientProvider client={new QueryClient()}><AdminDoseRow dose={{...dose, dose_config: {id: 'synthetic-config', dose_number: 1, label: longLabel, is_required: true, applies_to: 'all', dose_type: 'standard'}} as StudentDose} studentId="student1" /></QueryClientProvider>);

  const visibleLabel = screen.getAllByText(longLabel, {exact: true}).find((element) => element.tagName === 'P');
  expect(visibleLabel).toBeDefined();
  expect(visibleLabel).toHaveClass('break-words');
  expect(visibleLabel).not.toHaveClass('truncate');
  expect(visibleLabel?.parentElement).toHaveClass('w-full');
});
it('sending an approved dose to review is explicit and separate from commenting', async () => {
  render(<QueryClientProvider client={new QueryClient()}><AdminDoseRow dose={{...dose,status:'approved'}} studentId="student1" /></QueryClientProvider>);
  fireEvent.click(screen.getByText('Enviar a revisión'));
  expect(reviewDose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Confirmar revisión'));
  await waitFor(()=>expect(reviewDose).toHaveBeenCalledWith('dose1',expect.objectContaining({status:'in_review'})));
  expect(updateDoseComment).not.toHaveBeenCalled();
});
