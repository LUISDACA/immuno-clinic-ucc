import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Detail from '@/app/admin/students/[id]/page';
import StudentScheme from '@/app/student/scheme/page';
import { AdminDoseRow } from '@/components/admin-dose-row';
import { getStudent, listStudentCertificates } from '@/lib/api/admin';
import { getMyScheme, getStudentScheme, reviewDose, updateDose, updateDoseComment } from '@/lib/api/scheme';
import { listStudentEvidencePage } from '@/lib/api/evidence';
import { useAuthStore } from '@/lib/auth/store';
import type { SchemeOverview, StudentDose, StudentVaccine, User } from '@/lib/api/types';

const nav = vi.hoisted(() => ({ query: '', push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/admin/students/synthetic', useSearchParams: () => new URLSearchParams(nav.query) }));
vi.mock('@/lib/api/admin', () => ({ getAcademicOptions: vi.fn(async () => ({ programs: [], campuses: [], semesters: Array.from({ length: 10 }, (_, i) => i + 1) })), getStudent: vi.fn(), listStudentCertificates: vi.fn(), deactivateStudent: vi.fn(), reactivateStudent: vi.fn(), deleteStudent: vi.fn(), updateStudentProfile: vi.fn() }));
vi.mock('@/lib/api/scheme', () => ({ getStudentScheme: vi.fn(), getMyScheme: vi.fn(), reviewDose: vi.fn(), updateDose: vi.fn(), updateDoseComment: vi.fn() }));
vi.mock('@/lib/api/evidence', () => ({ listStudentEvidencePage: vi.fn(), deleteStudentEvidence: vi.fn(), reviewEvidenceBatch: vi.fn() }));

const vaccines: StudentVaccine[] = ['A', 'B', 'C'].map((suffix) => ({
  id: `synthetic-${suffix}`, vaccine_id: `catalog-${suffix}`, status: 'in_review', admin_notes: null, reviewed_at: null, doses: [],
  vaccine: { id: `catalog-${suffix}`, name: `Vacuna ${suffix}`, code: suffix, base_doses: 1, has_booster: false, has_titer: false, has_titer_value: false, is_annual: false, applies_to: 'all', display_order: 0, dose_configs: [] },
}));
const student: User = { id: 'synthetic', email: 'synthetic@example.invalid', profile: null, role: 'student', is_active: true, must_change_password: false, created_at: '2026-10-01T12:00:00Z' };
const overview: SchemeOverview = { total_vaccines: 3, approved_vaccines: 0, pending_vaccines: 3, denied_vaccines: 0, in_review_vaccines: 3, is_up_to_date: false, is_complete: false, is_certifiable: false, evaluated_on: '2026-10-09', scheme_version: 1, vaccines };
beforeEach(() => {
  vi.clearAllMocks();
  nav.query = 'tab=scheme&evidence_page=2&returnTo=%2Fadmin%2Fstudents%3Fpage%3D2%26active%3Dtrue';
  useAuthStore.setState({ role: 'admin' });
  vi.mocked(getStudent).mockResolvedValue(student);
  vi.mocked(getStudentScheme).mockResolvedValue(vaccines);
  vi.mocked(getMyScheme).mockResolvedValue(overview);
  vi.mocked(listStudentCertificates).mockResolvedValue([]);
  vi.mocked(listStudentEvidencePage).mockResolvedValue({ page: 2, page_size: 20, total: 45, total_pages: 3, has_next: true, has_previous: true, items: [] });
});
afterEach(cleanup);
async function mountDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const params = Promise.resolve({ id: 'synthetic' });
  const tree = () => <QueryClientProvider client={client}><Detail params={params} /></QueryClientProvider>;
  let result!: ReturnType<typeof render>;
  await act(async () => { result = render(tree()); });
  await screen.findByRole('tab', { name: 'Esquema' });
  return { refresh: () => result.rerender(tree()) };
}
function panelFor(button: HTMLElement) {
  const panel = document.getElementById(button.getAttribute('aria-controls')!);
  expect(panel).not.toBeNull();
  expect(panel).toHaveAttribute('aria-labelledby', button.id);
  return panel!;
}
function expectNoClinicalWrites() {
  expect(reviewDose).not.toHaveBeenCalled();
  expect(updateDoseComment).not.toHaveBeenCalled();
  expect(updateDose).not.toHaveBeenCalled();
}

it('links all tabs to panels and only fetches the selected scheme', async () => {
  await mountDetail();
  expect(screen.getByRole('tablist', { name: 'Detalle del estudiante' })).toBeVisible();
  for (const tab of screen.getAllByRole('tab')) {
    const selected = tab.textContent === 'Esquema';
    expect(tab).toHaveAttribute('aria-selected', String(selected));
    expect(tab).toHaveAttribute('tabindex', selected ? '0' : '-1');
    expect(panelFor(tab).hidden).toBe(!selected);
  }
  expect(getStudentScheme).toHaveBeenCalledWith('synthetic');
  expect(listStudentEvidencePage).not.toHaveBeenCalled();
  expect(listStudentCertificates).not.toHaveBeenCalled();
});

it('does not truncate a long student name in the admin detail header', async () => {
  const longName = 'Nombre sintetico extenso para comprobar el reflujo del encabezado administrativo '.repeat(2).trim();
  vi.mocked(getStudent).mockResolvedValue({
    ...student,
    profile: {
      id: 'synthetic-profile', first_name: longName, last_name: '', sex: 'female',
    },
  });
  await mountDetail();

  const heading = screen.getAllByRole('heading', { level: 1, name: longName })[0];
  expect(heading).toHaveClass('break-words');
  expect(heading).not.toHaveClass('truncate');
});

it('moves tab focus with arrows/Home/End without navigating or mounting another panel', async () => {
  const user = userEvent.setup();
  await mountDetail();
  const scheme = screen.getByRole('tab', { name: 'Esquema' });
  act(() => scheme.focus());
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Evidencia' })).toHaveFocus();
  expect(scheme).toHaveAttribute('aria-selected', 'true');
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Perfil' })).toHaveFocus();
  await user.keyboard('{ArrowLeft}');
  expect(screen.getByRole('tab', { name: 'Evidencia' })).toHaveFocus();
  await user.keyboard('{Home}');
  expect(screen.getByRole('tab', { name: 'Perfil' })).toHaveFocus();
  await user.keyboard('{End}');
  expect(screen.getByRole('tab', { name: 'Evidencia' })).toHaveFocus();
  expect(nav.replace).not.toHaveBeenCalled();
  expect(listStudentEvidencePage).not.toHaveBeenCalled();
  expect(listStudentCertificates).not.toHaveBeenCalled();
  expectNoClinicalWrites();
});

it.each(['{Enter}', ' '])('activates a tab explicitly with %s and retains URL context', async key => {
  const user = userEvent.setup();
  const { refresh } = await mountDetail();
  act(() => screen.getByRole('tab', { name: 'Esquema' }).focus());
  await user.keyboard('{ArrowRight}');
  await user.keyboard(key);
  expect(nav.replace).toHaveBeenCalledTimes(1);
  const url = new URL(nav.replace.mock.calls[0][0], 'https://example.invalid');
  expect(url.searchParams.get('tab')).toBe('evidence');
  expect(url.searchParams.get('evidence_page')).toBe('2');
  const returnUrl = new URL(url.searchParams.get('returnTo')!, 'https://example.invalid');
  expect(returnUrl.pathname).toBe('/admin/students');
  expect(returnUrl.searchParams.get('page')).toBe('2');
  expect(returnUrl.searchParams.get('active')).toBe('true');
  nav.query = url.searchParams.toString();
  refresh();
  await screen.findByText('Sin evidencias.');
  const evidence = screen.getByRole('tab', { name: 'Evidencia' });
  expect(evidence).toHaveAttribute('aria-selected', 'true');
  expect(panelFor(evidence)).toBeVisible();
  expect(panelFor(screen.getByRole('tab', { name: 'Esquema' }))).not.toBeVisible();
  expect(listStudentEvidencePage).toHaveBeenCalledWith('synthetic', 2);
  expectNoClinicalWrites();
});

it('starts admin accordions collapsed and toggles only the focused region', async () => {
  const user = userEvent.setup();
  await mountDetail();
  const buttons = await Promise.all(['A', 'B', 'C'].map(name => screen.findByRole('button', { name: new RegExp(`^Vacuna ${name}`) })));
  expect(new Set(buttons.map(button => button.getAttribute('aria-controls'))).size).toBe(3);
  buttons.forEach((button) => {
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(panelFor(button).hidden).toBe(true);
  });
  act(() => buttons[0].focus());
  await user.keyboard('{Enter}');
  expect(buttons[0]).toHaveFocus();
  expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
  expect(panelFor(buttons[0])).toBeVisible();
  expect(buttons[1]).toHaveAttribute('aria-expanded', 'false');
  await user.keyboard(' ');
  expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
  expect(panelFor(buttons[0])).not.toBeVisible();
  expect(panelFor(buttons[1])).not.toBeVisible();
  expectNoClinicalWrites();
});

it('does not truncate a long vaccine name in the admin student scheme', async () => {
  const longName = 'Vacuna sintética de prueba para comprobar el ajuste del texto en pantallas móviles '.repeat(2).trim();
  vi.mocked(getStudentScheme).mockResolvedValue([
    { ...vaccines[0], vaccine: { ...vaccines[0].vaccine!, name: longName } },
  ]);
  await mountDetail();
  const title = await screen.findByText(longName, { selector: 'button span.block' });
  expect(title).toBeVisible();
  expect(title).toHaveClass('break-words');
  expect(title).not.toHaveClass('truncate');
  expectNoClinicalWrites();
});

it('keeps student accordions initially closed with keyboard access and no administrative action', async () => {
  useAuthStore.setState({ role: 'student' });
  const user = userEvent.setup();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><StudentScheme /></QueryClientProvider>);
  const button = await screen.findByRole('button', { name: /^Vacuna A/ });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(panelFor(button)).not.toBeVisible();
  act(() => button.focus());
  await user.keyboard('{Enter}');
  await waitFor(() => expect(panelFor(button)).toBeVisible());
  expect(screen.getByText('Sin dosis configuradas.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
  await user.keyboard(' ');
  expect(button).toHaveFocus();
  expect(panelFor(button)).not.toBeVisible();
  expectNoClinicalWrites();
});

it('retains the complete vaccine name in the student scheme accordion', async () => {
  const longName = 'Vacuna sintética de prueba '.repeat(8).trim();
  const longVaccine: StudentVaccine = {
    ...vaccines[0],
    vaccine: { ...vaccines[0].vaccine!, name: longName },
  };
  vi.mocked(getMyScheme).mockResolvedValue({
    ...overview,
    total_vaccines: 1,
    vaccines: [longVaccine],
  });
  useAuthStore.setState({ role: 'student' });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><StudentScheme /></QueryClientProvider>);

  const name = await screen.findByText(longName, { exact: true });
  const trigger = screen.getByRole('button', { name: new RegExp('Vacuna sintética') });
  expect(within(trigger).getByText(longName)).not.toHaveClass('truncate');
  expect(within(trigger).getByText(longName)).toHaveClass('break-words');
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expectNoClinicalWrites();
  expect(name).toBeVisible();
});

it('retains dose data and cancels keyboard comment editing without sending a review', async () => {
  const user = userEvent.setup();
  const dose: StudentDose = { id: 'synthetic-dose', dose_number: 1, applied_date: '2026-10-01', due_date: null, days_until_due: null, is_overdue: null, is_due_today: null, titer_value: null, status: 'in_review', admin_notes: 'Synthetic note', reviewed_by: null, reviewed_at: null, dose_config: null };
  render(<QueryClientProvider client={new QueryClient()}><AdminDoseRow dose={dose} studentId="synthetic" /></QueryClientProvider>);
  expect(screen.getByText('2026-10-01')).toBeVisible();
  expect(screen.getByText('Synthetic note')).toBeVisible();
  act(() => screen.getByRole('button', { name: 'Editar comentario' }).focus());
  await user.keyboard('{Enter}');
  await user.type(screen.getByLabelText('Comentario (sin cambiar el estado de la dosis)'), ' changed');
  await user.click(screen.getByRole('button', { name: 'Cancelar comentario' }));
  expect(screen.getByText('Synthetic note')).toBeVisible();
  expectNoClinicalWrites();
});
