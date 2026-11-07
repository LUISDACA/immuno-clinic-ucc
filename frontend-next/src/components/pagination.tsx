"use client";
import { useEffect } from 'react';
import { Button } from './ui/button';
import type { PageResponse } from '@/lib/api/types';
export function Pagination({data,page,onPage,refresh,busy=false}:{data?:Omit<PageResponse<unknown>,'items'>;page:number;onPage:(page:number)=>void;refresh:()=>unknown;busy?:boolean}) {
  const last=data?.total_pages;
  useEffect(()=>{if(last!==undefined && page>Math.max(1,last))onPage(Math.max(1,last));},[last,page,onPage]);
  return <nav aria-label="Paginación" className="flex flex-wrap items-center gap-3">
    <Button variant="outline" disabled={busy || !data?.has_previous} onClick={()=>onPage(page-1)}>Anterior</Button>
    <span>Página {page} de {data?.total_pages ?? '…'} · {data?.total ?? '…'} registros</span>
    <Button variant="outline" disabled={busy || !data?.has_next} onClick={()=>onPage(page+1)}>Siguiente</Button>
    <Button variant="ghost" disabled={busy} onClick={()=>void refresh()}>Actualizar lista</Button>
  </nav>;
}
