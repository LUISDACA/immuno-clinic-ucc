export function studentListFilters(params: Pick<URLSearchParams, 'get'>) {
  const active = params.get('active');
  const scheme = params.get('scheme');
  const semester = Number(params.get('semester'));
  return { search: '', is_active: active === 'true' || active === 'false' ? active : '',
    vaccination_status: scheme === 'approved' || scheme === 'pending' ? scheme : '',
    semester: Number.isInteger(semester) && semester >= 1 && semester <= 20 ? String(semester) : '', page: String(validPage(params.get('page'))), context: validContext(params.get('ctx')), sex: params.get('sex') === 'male' || params.get('sex') === 'female' ? params.get('sex')! : '' };
}
export function validPage(value: string | null) { const n=Number(value); return Number.isInteger(n) && n>=1 && n<=10000?n:1; }
export function validContext(value: string | null) { return value && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value) ? value : undefined; }
export function studentDetailTab(value: string | null): 'info'|'scheme'|'evidence' {
  return value === 'scheme' || value === 'evidence' ? value : 'info';
}

export function studentListUrl(filters: ReturnType<typeof studentListFilters>) {
  const params = new URLSearchParams();
  for (const [key,value] of Object.entries({active:filters.is_active,scheme:filters.vaccination_status,semester:filters.semester,sex:filters.sex,page:filters.page === '1' ? '' : filters.page,ctx:validContext(filters.context ?? null)})) if(value) params.set(key,value);
  return '/admin/students' + (params.size ? '?' + params.toString() : '');
}
export function safeStudentReturn(value: string | null) {
  if (!value || !value.startsWith('/admin/students?')) return '/admin/students';
  return studentListUrl(studentListFilters(new URLSearchParams(value.split('?')[1])));
}

export function safeCommunicationReturn(value: string | null, base: string) {
  const list = base + '/communications';
  if (!value) return list;
  if (value === list) return value;
  if (value.startsWith(list+'?')) {
    const params=new URLSearchParams(value.split('?')[1]);
    const studentId=params.get('studentId');
    return base==='/admin' && studentId && /^[a-zA-Z0-9-]+$/.test(studentId) ? list+'?studentId='+studentId : list;
  }
  if(base==='/admin') {
    const match=value.match(/^\/admin\/students\/([a-zA-Z0-9-]+)(?:\?(.*))?$/);
    if(match) {
      const source=new URLSearchParams(match[2]);
      const target=new URLSearchParams({tab:studentDetailTab(source.get('tab')),returnTo:safeStudentReturn(source.get('returnTo'))});
      if(source.has('evidence_page'))target.set('evidence_page',String(validPage(source.get('evidence_page'))));
      return '/admin/students/'+match[1]+'?'+target;
    }
  }
  return list;
}
