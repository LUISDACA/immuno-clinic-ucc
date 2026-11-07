import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import Catalog from '@/app/admin/vaccines/page';
import { createVaccine, deactivateVaccine, listVaccines, reactivateVaccine, updateVaccine } from '@/lib/api/admin';
import type { VaccineCatalogItem } from '@/lib/api/types';

vi.mock('@/lib/api/admin', () => ({ createVaccine: vi.fn(), deactivateVaccine: vi.fn(), listVaccines: vi.fn(), reactivateVaccine: vi.fn(), updateVaccine: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const vaccine: VaccineCatalogItem = { id: 'synthetic', name: 'Synthetic vaccine', code: 'SYNTHETIC', is_active: true, base_doses: 1, has_booster: false, has_titer: false, has_titer_value: false, is_annual: false, applies_to: 'all', display_order: 0, dose_configs: [{ id: 'config', dose_number: 1, label: 'First', is_required: true, applies_to: 'all', dose_type: 'standard' }] };
const prototype = HTMLDialogElement.prototype;
const originalShow = Object.getOwnPropertyDescriptor(prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(prototype, 'close');
// JSDOM has no native modality. These tests cover React state/lifecycle only;
// the real Chrome flow checks focus containment and background inertness.
beforeAll(() => {
  Object.defineProperty(prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterAll(() => {
  if (originalShow) Object.defineProperty(prototype, 'showModal', originalShow); else Reflect.deleteProperty(prototype, 'showModal');
  if (originalClose) Object.defineProperty(prototype, 'close', originalClose); else Reflect.deleteProperty(prototype, 'close');
});
beforeEach(() => { vi.clearAllMocks(); vi.mocked(listVaccines).mockResolvedValue([vaccine]); });
afterEach(cleanup);
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><Catalog /></QueryClientProvider>); }
async function openCreate() {
  const user = userEvent.setup();
  mount();
  const trigger = screen.getByRole('button', { name: '+ Nueva vacuna' });
  await user.click(trigger);
  return { user, trigger, dialog: screen.getByRole('dialog', { name: 'Nueva vacuna' }) };
}
function expectNoWrite() {
  for (const api of [createVaccine, updateVaccine, deactivateVaccine, reactivateVaccine]) expect(api).not.toHaveBeenCalled();
}

it('keeps the complete vaccine name readable in the catalog row', async () => {
  const longName = 'Vacuna sintetica con nombre largo para comprobar el reflujo en catalogo '.repeat(2).trim();
  vi.mocked(listVaccines).mockResolvedValue([{ ...vaccine, name: longName }]);
  mount();

  const title = await screen.findByText(longName);
  expect(title).toHaveClass('break-words');
  expect(title).not.toHaveClass('truncate');
});

it("announces the initial catalog loading state", () => {
  vi.mocked(listVaccines).mockImplementation(() => new Promise(() => {}));
  mount();

  expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
  expect(listVaccines).toHaveBeenCalledTimes(1);
});

it.each(["populated", "empty"] as const)("refreshes the %s catalog on explicit request", async initialState => {
  const updated = { ...vaccine, name: "Updated synthetic vaccine" };
  vi.mocked(listVaccines)
    .mockResolvedValueOnce(initialState === "empty" ? [] : [vaccine])
    .mockResolvedValueOnce([updated]);
  const user = userEvent.setup();
  mount();

  if (initialState === "empty") {
    expect(await screen.findByText("Aún no hay vacunas en el catálogo.")).toBeVisible();
  } else {
    expect(await screen.findByText(vaccine.name)).toBeVisible();
  }

  await user.click(screen.getByRole("button", { name: "Actualizar catálogo" }));

  expect(await screen.findByText(updated.name)).toBeVisible();
  expect(listVaccines).toHaveBeenCalledTimes(2);
});

it("disables explicit refresh while the catalog request is pending", async () => {
  let finishRefresh!: (items: VaccineCatalogItem[]) => void;
  vi.mocked(listVaccines)
    .mockResolvedValueOnce([vaccine])
    .mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
  const user = userEvent.setup();
  mount();
  await screen.findByText(vaccine.name);

  const refresh = screen.getByRole("button", { name: "Actualizar catálogo" });
  await user.click(refresh);
  await waitFor(() => expect(refresh).toBeDisabled());
  expect(listVaccines).toHaveBeenCalledTimes(2);

  await act(async () => finishRefresh([vaccine]));
  await waitFor(() => expect(refresh).toBeEnabled());
});

it('opens a named modal with initial focus and associated field/select/group labels', async () => {
  const { dialog } = await openCreate();
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(screen.getByLabelText(/^Nombre/)).toHaveFocus();
  expect(screen.getByLabelText(/^Código/)).toBeVisible();
  expect(screen.getByLabelText('Dosis base')).toBeVisible();
  expect(screen.getByRole('group', { name: 'Características' })).toBeVisible();
  const row = screen.getByRole('group', { name: 'Configuración de dosis 1' });
  expect(within(row).getByLabelText('Tipo')).toHaveValue('standard');
  expect(within(row).getByLabelText('Aplica a')).toHaveValue('all');
  expectNoWrite();
});

it('cycles keyboard focus at both edges and keeps focus in a busy dialog', async () => {
  const { user, dialog } = await openCreate();
  // Model visibility for JSDOM only; real geometry/modality is verified in Chrome.
  const rectangles = vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  try {
    const first = screen.getByRole('button', { name: 'Cerrar' });
    const last = screen.getByRole('button', { name: 'Crear' });
    act(() => last.focus());
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    act(() => dialog.focus());
    await user.tab();
    expect(first).toHaveFocus();
  } finally { rectangles.mockRestore(); }
  expectNoWrite();
});

it.each(['Cancelar', 'Cerrar', 'Escape', 'backdrop'])('%s dismisses without mutation and restores trigger focus', async action => {
  const { user, dialog, trigger } = await openCreate();
  if (action === 'Escape') fireEvent(dialog, new Event('cancel', { cancelable: true }));
  else if (action === 'backdrop') fireEvent.click(dialog, { clientX: 10, clientY: 10 });
  else await user.click(screen.getByRole('button', { name: action }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expectNoWrite();
});

it('moves focus after adding/removing rows and keeps unique control associations and chip selection', async () => {
  const { user } = await openCreate();
  await user.click(screen.getByRole('button', { name: 'Agregar' }));
  const row2 = screen.getByRole('group', { name: 'Configuración de dosis 2' });
  expect(within(row2).getByLabelText('N°')).toHaveFocus();
  await user.click(within(row2).getByRole('button', { name: 'Eliminar configuración de dosis 2' }));
  expect(within(screen.getByRole('group', { name: 'Configuración de dosis 1' })).getByLabelText('N°')).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Eliminar configuración de dosis 1' }));
  expect(screen.getByRole('button', { name: 'Agregar' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Agregar' }));
  const ids = Array.from(screen.getByRole('dialog').querySelectorAll('input,select')).map(element => element.id).filter(Boolean);
  expect(new Set(ids).size).toBe(ids.length);
  await user.click(screen.getByRole('button', { name: 'Anual' }));
  expect(screen.getByRole('button', { name: 'Anual' })).toHaveAttribute('aria-pressed', 'true');
  expectNoWrite();
});

it('submits the original create payload once and blocks edit/dismiss while pending', async () => {
  let resolve!: (value: VaccineCatalogItem) => void;
  vi.mocked(createVaccine).mockImplementation(() => new Promise(done => { resolve = done; }));
  const { user, dialog } = await openCreate();
  await user.type(screen.getByLabelText(/^Nombre/), 'Synthetic new');
  await user.type(screen.getByLabelText(/^Código/), 'new');
  await user.dblClick(screen.getByRole('button', { name: 'Crear' }));
  expect(createVaccine).toHaveBeenCalledTimes(1);
  expect(createVaccine).toHaveBeenCalledWith({ name: 'Synthetic new', code: 'NEW', base_doses: 1, has_booster: false, has_titer: false, has_titer_value: false, is_annual: false, applies_to: 'all', display_order: 0, dose_configs: [{ dose_number: 1, label: 'Primera dosis', is_required: true, applies_to: 'all', dose_type: 'standard' }] });
  expect(dialog).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByLabelText(/^Nombre/)).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  await user.tab();
  expect(dialog).toHaveFocus();
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  fireEvent.click(dialog, { clientX: 10, clientY: 10 });
  expect(dialog).toBeInTheDocument();
  await act(async () => resolve(vaccine));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(listVaccines).toHaveBeenCalledTimes(2);
});

it('retains draft on failure, announces a safe error and allows retry', async () => {
  vi.mocked(createVaccine).mockRejectedValueOnce(new Error('unsafe internal data')).mockResolvedValue(vaccine);
  const { user } = await openCreate();
  await user.type(screen.getByLabelText(/^Nombre/), 'Keep draft');
  await user.click(screen.getByRole('button', { name: 'Crear' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar. Intenta nuevamente.');
  expect(screen.queryByText('unsafe internal data')).not.toBeInTheDocument();
  expect(screen.getByLabelText(/^Nombre/)).toHaveValue('Keep draft');
  await user.click(screen.getByRole('button', { name: 'Crear' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(createVaccine).toHaveBeenCalledTimes(2);
});

it('edits existing values and keeps the immutable code outside the update payload', async () => {
  vi.mocked(updateVaccine).mockResolvedValue(vaccine);
  const user = userEvent.setup(); mount();
  await user.click(await screen.findByRole('button', { name: 'Editar vacuna Synthetic vaccine' }));
  expect(screen.getByRole('dialog', { name: 'Editar vacuna' })).toBeVisible();
  const code = screen.getByLabelText(/^Código/);
  expect(code).toBeDisabled();
  expect(document.getElementById(code.getAttribute('aria-describedby')!)).toHaveTextContent('No se puede cambiar después de crear');
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(updateVaccine).toHaveBeenCalledWith('synthetic', { name: 'Synthetic vaccine', base_doses: 1, has_booster: false, has_titer: false, has_titer_value: false, is_annual: false, applies_to: 'all', display_order: 0, dose_configs: [{ dose_number: 1, label: 'First', is_required: true, applies_to: 'all', dose_type: 'standard' }] });
  expect(createVaccine).not.toHaveBeenCalled();
});

it.each([true, false])('toggles active=%s only after explicit confirmation, blocks pending closure and retains errors', async active => {
  vi.mocked(listVaccines).mockResolvedValue([{ ...vaccine, is_active: active }]);
  const api = active ? deactivateVaccine : reactivateVaccine;
  let reject!: (reason: Error) => void;
  vi.mocked(api).mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  const user = userEvent.setup(); mount();
  const action = active ? 'Desactivar' : 'Reactivar';
  const trigger = await screen.findByRole('button', { name: `${action} vacuna Synthetic vaccine` });
  await user.click(trigger);
  const dialog = screen.getByRole('dialog', { name: `${action} vacuna` });
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  expectNoWrite();
  await user.dblClick(screen.getByRole('button', { name: action }));
  expect(api).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledWith('synthetic');
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(dialog).toBeInTheDocument();
  await act(async () => reject(new Error('unsafe detail')));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo actualizar. Intenta nuevamente.');
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(trigger).toHaveFocus();
  await user.click(trigger);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it.each([
  { status: 401, message: "Tu sesión expiró. Inicia sesión nuevamente." },
  { status: 403, message: "No tienes permiso" },
])('a backend $status is an error with retry and never exposes catalog actions', async ({ status, message }) => {
  vi.mocked(listVaccines).mockRejectedValue(new AxiosError('unsafe', undefined, undefined, undefined, { status } as never));
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent(message);
  expect(screen.queryByRole('button', { name: '+ Nueva vacuna' })).not.toBeInTheDocument();
  expectNoWrite();
});

it('keeps the create action available during a transient catalog read failure', async () => {
  vi.mocked(listVaccines).mockRejectedValue(new AxiosError('unsafe', undefined, undefined, undefined, { status: 503 } as never));
  const user = userEvent.setup();
  mount();

  expect(await screen.findByRole('alert')).toHaveTextContent('El servicio no está disponible temporalmente.');
  await user.click(screen.getByRole('button', { name: '+ Nueva vacuna' }));
  expect(screen.getByRole('dialog', { name: 'Nueva vacuna' })).toBeVisible();
  expectNoWrite();
});
