export function adminDashboardSemester(
  params: Pick<URLSearchParams, 'getAll'>,
  semesters: readonly number[],
): string {
  const values = params.getAll('semester');
  return values.length === 1 && semesters.some((semester) => String(semester) === values[0])
    ? values[0]
    : '';
}

export function adminDashboardUrl(semester: string, semesters: readonly number[]): string {
  return semesters.some((candidate) => String(candidate) === semester)
    ? `/admin?semester=${semester}`
    : '/admin';
}
