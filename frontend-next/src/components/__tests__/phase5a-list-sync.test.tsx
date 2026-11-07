import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Pagination } from '../pagination';
import { usePrivateSearch } from '@/lib/ui/list-state';
import { useSafeMutation } from '@/lib/query/safe-mutation';
import { useAuthStore } from '@/lib/auth/store';
import { safeCommunicationReturn, safeStudentReturn, studentListFilters, studentListUrl } from '@/lib/navigation';

const nav=vi.hoisted(()=>({params:'',push:vi.fn()}));
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams(nav.params),useRouter:()=>nav,usePathname:()=>'/admin/students'}));
beforeEach(()=>{nav.params='';sessionStorage.clear();useAuthStore.setState({userId:'synthetic-a',isAuthenticated:true});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function deferred<T>() { let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {resolve,promise}; }

it('uses server page flags, refreshes and clamps an emptied last page',()=>{
 const onPage=vi.fn(),refresh=vi.fn();const data={page:2,page_size:20,total:21,total_pages:2,has_next:false,has_previous:true,size:20,pages:2};
 const {rerender}=render(<Pagination data={data} page={2} onPage={onPage} refresh={refresh} />);
 expect(screen.getByText('Siguiente')).toBeDisabled();fireEvent.click(screen.getByText('Anterior'));expect(onPage).toHaveBeenCalledWith(1);
 fireEvent.click(screen.getByText('Actualizar lista'));expect(refresh).toHaveBeenCalledTimes(1);
 rerender(<Pagination data={{...data,total:20,total_pages:1}} page={2} onPage={onPage} refresh={refresh} />);
 expect(onPage).toHaveBeenLastCalledWith(1);
});
it('restores separate search contexts on back/reload, without search text in URLs',()=>{
 const {result,rerender,unmount}=renderHook(()=>usePrivateSearch('students'));
 let first:string|undefined,second:string|undefined;
 act(()=>{first=result.current[1]('Synthetic search A');});nav.params='ctx='+first;rerender();
 act(()=>{second=result.current[1]('Synthetic search B');});nav.params='ctx='+second;rerender();
 expect(result.current[0]).toBe('Synthetic search B');nav.params='ctx='+first;rerender();expect(result.current[0]).toBe('Synthetic search A');
 const url=studentListUrl({...studentListFilters(new URLSearchParams(nav.params)),search:result.current[0],page:'2'});
 expect(url).not.toContain('Synthetic');expect(safeStudentReturn(url)).toBe(url);
 unmount();const resumed=renderHook(()=>usePrivateSearch('students'));expect(resumed.result.current[0]).toBe('Synthetic search A');
});
it('expires private search and removes it on logout/account change',()=>{
 const {result,rerender}=renderHook(()=>usePrivateSearch('students'));
 let ctx:string|undefined;act(()=>{ctx=result.current[1]('Private synthetic text');});nav.params='ctx='+ctx;rerender();
 const now=Date.now();vi.spyOn(Date,'now').mockReturnValue(now+31*60*1000);
 nav.params='';rerender();nav.params='ctx='+ctx;rerender();expect(result.current[0]).toBe('');
 act(()=>useAuthStore.setState({userId:'synthetic-b'}));expect(result.current[0]).toBe('');expect(sessionStorage.length).toBe(0);
 act(()=>useAuthStore.setState({userId:null,isAuthenticated:false}));expect(sessionStorage.length).toBe(0);
});
it('retains a private draft when browser storage is disabled and clears it on account change',()=>{
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Storage disabled');});
 const {result,rerender}=renderHook(()=>usePrivateSearch('students'));
 let ctx:string|undefined;act(()=>{ctx=result.current[1]('Synthetic draft');});nav.params='ctx='+ctx;rerender();
 expect(result.current[0]).toBe('Synthetic draft');expect(sessionStorage.length).toBe(0);
 act(()=>useAuthStore.setState({userId:'synthetic-b'}));expect(result.current[0]).toBe('');
 act(()=>useAuthStore.setState({userId:'synthetic-a'}));expect(result.current[0]).toBe('');
});
it('validates pages and sanitizes return links while retaining tabs/pages',()=>{
 for(const invalid of ['0','-1','2.5','99999','NaN'])expect(studentListFilters(new URLSearchParams('page='+invalid)).page).toBe('1');
 const value='/admin/students/synthetic?tab=evidence&evidence_page=2&returnTo='+encodeURIComponent('/admin/students?active=true&page=3');
 const safe=safeCommunicationReturn(value,'/admin');
 const params=new URLSearchParams(safe.split('?')[1]);
 expect(params.get('tab')).toBe('evidence');expect(params.get('evidence_page')).toBe('2');expect(params.get('returnTo')).toBe('/admin/students?active=true&page=3');
 expect(safeCommunicationReturn('https://example.invalid','/admin')).toBe('/admin/communications');
 expect(safeCommunicationReturn('/admin/students/synthetic','/student')).toBe('/student/communications');
});
it('blocks a same-tick double write, refreshes affected reads, rejects late reads and leaves unrelated reads running',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 const stale=deferred<string>(),other=deferred<string>(),write=deferred<void>();
 client.setQueryData(['profile'],'before');
 const old=client.fetchQuery({queryKey:['profile'],queryFn:()=>stale.promise}).catch(()=>undefined);
 const unrelated=client.fetchQuery({queryKey:['unrelated'],queryFn:()=>other.promise});
 const api=vi.fn(()=>write.promise);
 const {result}=renderHook(()=>useSafeMutation<void,Error,void>({affectedQueries:[['profile']],mutationFn:api,onSuccess:()=>client.setQueryData(['profile'],'after')}),{wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});
 act(()=>{result.current.mutate();result.current.mutate();});await waitFor(()=>expect(api).toHaveBeenCalledTimes(1));
 expect(client.getQueryState(['unrelated'])?.fetchStatus).toBe('fetching');
 await act(async()=>{write.resolve();});await waitFor(()=>expect(result.current.isPending).toBe(false));
 stale.resolve('stale');await old;expect(client.getQueryData(['profile'])).toBe('after');
 other.resolve('untouched');expect(await unrelated).toBe('untouched');
});
it('does not apply a write callback to a different account',async()=>{
 const client=new QueryClient(),write=deferred<void>(),saved=vi.fn();
 const {result}=renderHook(()=>useSafeMutation<void,Error,void>({affectedQueries:[['profile']],mutationFn:()=>write.promise,onSuccess:saved}),{wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});
 act(()=>result.current.mutate());await waitFor(()=>expect(result.current.isPending).toBe(true));
 act(()=>useAuthStore.setState({userId:'synthetic-b'}));await act(async()=>write.resolve());
 await waitFor(()=>expect(result.current.isPending).toBe(false));expect(saved).not.toHaveBeenCalled();
});
