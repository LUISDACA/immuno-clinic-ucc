"use client";
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/auth/store';
import { validContext, validPage } from '@/lib/navigation';

// Search text is never part of a URL. Tab-local, user-bound and short lived.
const prefix = 'ic_list_context:';
const ttl = 30 * 60 * 1000;
const memory = new Map<string, {value: string; expires: number}>();
function read(owner: string, key: string, initial: string) {
  const storageKey = prefix + owner + ':' + key;
  let saved = memory.get(storageKey);
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (stored) saved = JSON.parse(stored);
  } catch { /* A disabled store retains context for this page's lifetime. */ }
  return saved && saved.expires > Date.now() && typeof saved.value === 'string' ? saved.value : initial;
}
export function usePrivateSearch(key: string) {
  const owner = useAuthStore(s => s.userId) ?? 'anonymous';
  const params = useSearchParams();
  const context = validContext(params.get('ctx'));
  const scope = owner + ':' + key + ':' + (context ?? 'empty');
  const [state,setState] = useState(() => ({scope,value:read(owner,key+':'+(context ?? 'empty'),'')}));
  // Derive a fresh draft when history navigation or identity changes the scope.
  if (state.scope !== scope) setState({scope,value:read(owner,key+':'+(context ?? 'empty'),'')});
  const update = (value: string) => {
    if (value === state.value) return context;
    const nextContext = crypto.randomUUID();
    const saved = {value,expires:Date.now()+ttl};
    for (const [key,entry] of memory) if(entry.expires <= Date.now()) memory.delete(key);
    memory.set(prefix+owner+':'+key+':'+nextContext,saved);
    try {
      for (let i=sessionStorage.length-1;i>=0;i--) {
        const k=sessionStorage.key(i);
        if(k?.startsWith(prefix)) {
          try { if(JSON.parse(sessionStorage.getItem(k) || 'null')?.expires <= Date.now()) sessionStorage.removeItem(k); } catch { sessionStorage.removeItem(k); }
        }
      }
      sessionStorage.setItem(prefix+owner+':'+key+':'+nextContext,JSON.stringify(saved));
    } catch { /* Storage unavailable: keep the current draft in memory. */ }
    setState({scope,value});
    return nextContext;
  };
  return [state.value,update,context] as const;
}
// Observe the existing auth store; do not alter the authentication protocol.
if (typeof window !== 'undefined') useAuthStore.subscribe((next,prev) => {
  if ((prev.userId && next.userId !== prev.userId) || (prev.isAuthenticated && !next.isAuthenticated)) {
    memory.clear();
    try { for (let i=sessionStorage.length-1;i>=0;i--) { const key=sessionStorage.key(i); if(key?.startsWith(prefix)) sessionStorage.removeItem(key); } } catch { /* Storage can be disabled. */ }
  }
});
export const pageNumber = validPage;
export function usePageLocation(key='page') {
  const params=useSearchParams(); const router=useRouter(); const path=usePathname();
  const page=pageNumber(params.get(key));
  const setPage=(next:number)=>{const p=new URLSearchParams(params.toString());p.set(key,String(Math.max(1,next)));router.push(path+'?'+p.toString(),{scroll:false});};
  return [page,setPage] as const;
}
export function useDebounced<T>(value:T) {
  const [stable,setStable]=useState(value);
  useEffect(()=>{const timer=setTimeout(()=>setStable(value),250);return()=>clearTimeout(timer);},[value]);
  return stable;
}
