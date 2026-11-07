import { expect, it } from 'vitest';
import { adminDashboardSemester, adminDashboardUrl } from '../ui/admin-dashboard-location';

const semesters = Array.from({ length: 10 }, (_, index) => index + 1);

it('uses semester options supplied by FastAPI', () => {
  expect(semesters).toEqual(Array.from({ length: 10 }, (_, index) => index + 1));
});
it.each(semesters.map(String))('semester %s round trips through a canonical local URL', semester => {
  expect(adminDashboardSemester(new URLSearchParams(`semester=${semester}`), semesters)).toBe(semester);
  expect(adminDashboardUrl(semester, semesters)).toBe(`/admin?semester=${semester}`);
});
it.each(['', '0', '-1', '11', '20', '21', '03', '1.5', '3e0', 'NaN', 'Infinity', ' true ', 'https://example.invalid', '3&ignored=synthetic'])('unsupported input %s never becomes a request parameter or redirect', value => {
  const params = new URLSearchParams(); params.set('semester', value);
  expect(adminDashboardSemester(params, semesters)).toBe('');
  expect(adminDashboardUrl(value, semesters)).toBe('/admin');
});
it('ambiguous duplicate parameters default to Todos', () => {
  expect(adminDashboardSemester(new URLSearchParams('semester=3&semester=5'), semesters)).toBe('');
  expect(adminDashboardSemester(new URLSearchParams('semester=3&semester=3'), semesters)).toBe('');
});
it('URL writing includes only semester and never forwards arbitrary parameters', () => {
  const params = new URLSearchParams('semester=3&search=synthetic-private-value&returnTo=https://example.invalid');
  expect(adminDashboardUrl(adminDashboardSemester(params, semesters), semesters)).toBe('/admin?semester=3');
  expect(adminDashboardUrl('', semesters)).toBe('/admin');
});
