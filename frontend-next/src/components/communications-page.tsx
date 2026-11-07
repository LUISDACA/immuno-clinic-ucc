"use client";
import { useSafeMutation as useMutation } from "@/lib/query/safe-mutation";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createThread, listThreads, searchRecipients } from "@/lib/api/communications";
import { ConversationUser } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/store";
import { safeCommunicationReturn } from "@/lib/navigation";
import { ThreadRow } from "@/components/thread-row";
import { QueryError } from "@/components/query-error";
import { PageHeader, LoadingState, EmptyState } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CommunicationsPage() {
  const role = useAuthStore(state => state.role);
  const params = useSearchParams();
  const initialStudentId = role === 'admin' ? params.get('studentId') : null;
  const router = useRouter();
  const qc = useQueryClient();
  const base = role === 'student' ? '/student' : '/admin';
  const [showNew, setShowNew] = useState(Boolean(initialStudentId));
  const [target, setTarget] = useState<'admins'|'students'>(role === 'admin' ? 'students' : 'admins');
  const [selected, setSelected] = useState<ConversationUser|null>(initialStudentId ? {id:initialStudentId, name:'Estudiante seleccionado',email:'',role:'student'} : null);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');
  const threads = useQuery({queryKey:['threads'],queryFn:listThreads,refetchInterval:30000});
  const recipients = useQuery({queryKey:['recipients',role,target,search],queryFn:()=>searchRecipients(target,search),enabled:showNew && !selected && search.trim().length>=2});
  const create = useMutation({
    affectedQueries: [["threads"],["notifications"]],
    mutationFn: () => createThread({subject:subject.trim(),message:message.trim(),category,
      ...(target === 'admins' ? {admin_id:selected?.id} : {student_id:selected?.id})}),
    onSuccess: thread => { toast.success('Mensaje enviado'); setShowNew(false); setSubject(''); setMessage(''); void qc.invalidateQueries({queryKey:['threads']}); const returnTo=safeCommunicationReturn(params.get("returnTo"),base); router.push(`${base}/communications/${thread.id}`+(returnTo===`${base}/communications`?"":"?returnTo="+encodeURIComponent(returnTo))); },
  });
  return <div className="flex flex-col gap-5">
    <PageHeader title="Comunicaciones" description="Conversaciones con el equipo y los destinatarios autorizados."
      actions={<Button disabled={create.isPending} onClick={()=>setShowNew(!showNew)}>{showNew?'Cancelar':'Nuevo mensaje'}</Button>} />
    {showNew && <Card><CardContent><fieldset disabled={create.isPending} className="flex flex-col gap-3 p-4">
      {role === 'admin' && <><Label htmlFor="recipient-target">Destinatario</Label><select id="recipient-target" value={target} onChange={e=>{setTarget(e.target.value as 'admins'|'students');setSelected(null);setSearch('');}}><option value="students">Estudiantes</option><option value="admins">Administrador de aplicación</option></select></>}
      <Label htmlFor="recipient-search">{target==='admins'?'Buscar administrador':'Buscar estudiante'}</Label>
      <Input id="recipient-search" value={search} onChange={e=>{setSearch(e.target.value);setSelected(null);}} placeholder="Nombre o correo (mínimo 2 caracteres)" />
      {selected ? <p>Seleccionado: {selected.name || selected.email} <Button variant="ghost" onClick={()=>setSelected(null)}>Cambiar destinatario</Button></p> : search.trim().length>=2 && <>
        {recipients.isFetching ? <LoadingState /> : recipients.error ? <QueryError error={recipients.error} retry={recipients.refetch} /> : recipients.data?.length ? <ul>{recipients.data.map(u=><li key={u.id}><Button variant="ghost" onClick={()=>setSelected(u)}>{u.name || u.email}</Button></li>)}</ul> : <p>No hay destinatarios disponibles.</p>}
      </>}
      {role==='student' && !selected && <p>Sin destinatario seleccionado, se enviará al equipo administrativo de tu ámbito.</p>}
      <Label htmlFor="category">Categoría</Label><select id="category" value={category} onChange={e=>setCategory(e.target.value)}><option value="general">General</option><option value="scheme">Esquema</option><option value="evidence">Documentos</option><option value="technical">Soporte técnico</option></select>
      <Label htmlFor="subject">Asunto</Label><Input id="subject" value={subject} maxLength={200} onChange={e=>setSubject(e.target.value)} />
      <Label htmlFor="message">Mensaje</Label><Textarea id="message" value={message} maxLength={4000} onChange={e=>setMessage(e.target.value)} />
      {create.error && <QueryError error={create.error} retry={()=>create.reset()} />}
      <Button disabled={create.isPending || subject.trim().length<3 || !message.trim() || (role!=='student' && !selected)} onClick={()=>create.mutate()}>{create.isPending?'Enviando…':'Enviar'}</Button>
    </fieldset></CardContent></Card>}
    {threads.isLoading ? <LoadingState /> : threads.error ? <QueryError error={threads.error} retry={()=>threads.refetch({cancelRefetch:false})} retrying={threads.isFetching} /> : !threads.data?.length ? <EmptyState icon={null} title="No hay conversaciones" /> : <ul className="flex flex-col gap-2">{threads.data.map(t=><ThreadRow key={t.id} basePath={base} thread={t} />)}</ul>}
  </div>;
}
