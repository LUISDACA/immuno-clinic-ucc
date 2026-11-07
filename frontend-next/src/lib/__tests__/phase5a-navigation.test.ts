import { expect, it } from 'vitest';
import { safeStudentReturn, studentDetailTab, studentListFilters, studentListUrl } from '../navigation';
it('preserves permitted filters and tabs without adding PII to the URL',()=>{
 const filters=studentListFilters(new URLSearchParams('active=false&scheme=pending&semester=4&sex=female'));
 expect(filters).toMatchObject({is_active:'false',vaccination_status:'pending',semester:'4',sex:'female'});
 expect(studentListUrl({...filters,search:'synthetic private search'})).not.toContain('search');
 expect(studentDetailTab('evidence')).toBe('evidence');expect(studentDetailTab('scheme')).toBe('scheme');expect(studentDetailTab('invalid')).toBe('info');
 expect(safeStudentReturn('https://example.invalid')).toBe('/admin/students');
 expect(safeStudentReturn('/admin/students?active=true&secret=ignored')).toBe('/admin/students?active=true');
});
