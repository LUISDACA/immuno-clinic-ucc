"use client";
import { useSafeMutation } from "@/lib/query/safe-mutation";
import { Pagination } from "@/components/pagination";
import { usePageLocation } from "@/lib/ui/list-state";
import { QueryError } from "@/components/query-error";

import { cloneElement, ReactElement, Suspense, use, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Award,
  ChevronDown,
  ChevronUp,
  Edit3,
  MessageSquare,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  deactivateStudent,
  deleteStudent,
  downloadStudentCertificate,
  getAcademicOptions,
  getStudent,
  listStudentCertificates,
  reactivateStudent,
  revokeStudentCertificate,
  updateStudentProfile,
  type UpdateStudentProfileRequest,
} from "@/lib/api/admin";
import { getStudentScheme } from "@/lib/api/scheme";
import {
  deleteStudentEvidence,
  downloadEvidenceFile,
  listStudentEvidencePage,
  reviewEvidenceBatch,
} from "@/lib/api/evidence";
import { StudentVaccine } from "@/lib/api/types";
import {
  formatBytes,
  formatDate,
  formatDateTime,
  vaccineStatusLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AdminDoseRow } from "@/components/admin-dose-row";

import { studentDetailTab, safeStudentReturn } from "@/lib/navigation";
type Tab = "info" | "scheme" | "evidence";
const detailTabs: Array<[Tab, string]> = [["info", "Perfil"], ["scheme", "Esquema"], ["evidence", "Evidencia"]];

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p>Cargando…</p>}><AdminStudentDetailPage params={params} /></Suspense>;
}
function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const tab = studentDetailTab(searchParams.get("tab"));
  const tabsId = useId();
  const tabButtons = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const [focusedTab, setFocusedTab] = useState<Tab | null>(null);
  const returnTo = safeStudentReturn(searchParams.get("returnTo"));
  const setTab = (value: Tab) => { const params=new URLSearchParams(searchParams.toString());params.set("tab",value);params.set("returnTo",returnTo);router.replace(`/admin/students/${id}?${params}`,{scroll:false}); };
  const [downloadingCertificate, setDownloadingCertificate] = useState(false);

  const { data: student, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "student", id],
    queryFn: () => getStudent(id),
  });

  const deactivate = useSafeMutation({
    affectedQueries: [["admin", "student", id],["admin", "students"],["audit"]],
    mutationFn: () => deactivateStudent(id),
    onSuccess: () => {
      toast.success("Estudiante desactivado");
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "student", id] });
    },
    onError: () => toast.error("No se pudo desactivar"),
  });

  const reactivate = useSafeMutation({
    affectedQueries: [["admin", "student", id],["admin", "students"],["audit"]],
    mutationFn: () => reactivateStudent(id),
    onSuccess: () => {
      toast.success("Estudiante reactivado");
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "student", id] });
    },
    onError: () => toast.error("No se pudo reactivar"),
  });

  const remove = useSafeMutation({
    affectedQueries: [["admin", "student"],["admin", "students"],["audit"]],
    mutationFn: () => deleteStudent(id),
    onSuccess: () => {
      toast.success("Estudiante eliminado");
      router.replace(returnTo);
    },
    onError: () => toast.error("No se pudo eliminar"),
  });
  if (error) return <QueryError error={error} retry={refetch} />;
  if (isLoading || !student) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  const fullName = student.profile
    ? `${student.profile.first_name} ${student.profile.last_name}`.trim()
    : student.email;

  async function onDownloadCertificate() {
    if (!student) return;
    setDownloadingCertificate(true);
    const toastId = toast.loading("Preparando certificado...");
    try {
      await downloadStudentCertificate(id, {
        onProgress: (progress) =>
          toast.loading(
            progress == null
              ? "Descargando certificado..."
              : `Descargando certificado ${progress}%`,
            { id: toastId },
          ),
      });
      toast.success("Certificado descargado", { id: toastId });
    } catch {
      toast.error("No se pudo descargar", { id: toastId });
    } finally {
      setDownloadingCertificate(false);
    }
  }

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-background text-foreground sm:mx-0 sm:my-0 sm:min-h-0 sm:overflow-hidden sm:rounded-2xl sm:border sm:border-[color:var(--divider)]">
      <div className="sticky top-0 z-20 border-b border-[color:var(--divider)] bg-card/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 sm:flex-nowrap">
          <button
            type="button"
            onClick={() => router.push(returnTo)}
            aria-label="Volver"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--interactive-foreground)] transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="order-3 min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-0">
            <h1 className="min-w-0 break-words text-xl font-bold leading-tight tracking-normal">
              {fullName}
            </h1>
            <p className="truncate text-sm text-muted-foreground">{student.email}</p>
          </div>
          <div className="order-2 ml-auto flex shrink-0 items-center gap-1 sm:order-none sm:ml-0">
            <button
              type="button"
              onClick={onDownloadCertificate}
              disabled={downloadingCertificate}
              aria-label="Descargar certificado"
              title="Descargar certificado"
              className="grid h-9 w-9 place-items-center rounded-full text-[color:var(--interactive-foreground)] transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <Award className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setTab("info")}
              aria-label="Ver perfil"
              title="Ver perfil"
              className="grid h-9 w-9 place-items-center rounded-full text-[color:var(--interactive-foreground)] transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Edit3 className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => router.push(`/admin/communications?studentId=${id}&returnTo=${encodeURIComponent(`/admin/students/${id}?${searchParams}`)}`)}
              aria-label="Enviar mensaje"
              title="Enviar mensaje"
              className="grid h-9 w-9 place-items-center rounded-full text-[color:var(--interactive-foreground)] transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageSquare className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      <div className="flex flex-wrap gap-2 px-4 py-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
          <p className="text-sm text-muted-foreground">{student.email}</p>
          <div className="mt-2 flex gap-2">
            <Badge variant={student.is_active ? "success" : "muted"}>
              {student.is_active ? "Activo" : "Inactivo"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={onDownloadCertificate}
            disabled={downloadingCertificate}
          >
            {downloadingCertificate ? "Descargando..." : "Certificado"}
          </Button>
          {student.is_active ? (
            <Button
              variant="outline"
              onClick={() => { if (confirm("¿Desactivar este estudiante?")) deactivate.mutate(); }}
              disabled={deactivate.isPending}
            >
              Desactivar
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => { if (confirm("¿Reactivar este estudiante?")) reactivate.mutate(); }}
              disabled={reactivate.isPending}
            >
              Reactivar
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("¿Eliminar permanentemente este estudiante?")) {
                remove.mutate();
              }
            }}
            disabled={remove.isPending}
          >
            Eliminar
          </Button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Detalle del estudiante"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocusedTab(null);
        }}
        className="flex border-t border-[color:var(--divider)]"
      >
        {detailTabs.map(([key, label], index) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`${tabsId}-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`${tabsId}-panel-${key}`}
            tabIndex={(focusedTab ?? tab) === key ? 0 : -1}
            ref={(element) => { tabButtons.current[key] = element; }}
            onFocus={() => setFocusedTab(key)}
            onKeyDown={(event) => {
              let next: number;
              if (event.key === "ArrowRight") next = (index + 1) % detailTabs.length;
              else if (event.key === "ArrowLeft") next = (index + detailTabs.length - 1) % detailTabs.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = detailTabs.length - 1;
              else return;
              event.preventDefault();
              tabButtons.current[detailTabs[next][0]]?.focus();
            }}
            onClick={() => setTab(key)}
            className={cn(
              "relative flex-1 px-4 py-3 text-sm font-semibold tracking-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              tab === key
                ? "text-[color:var(--interactive-foreground)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {tab === key && (
              <span aria-hidden className="absolute inset-x-8 -bottom-px h-0.5 rounded-t-full bg-[color:var(--interactive-foreground)]" />
            )}
          </button>
        ))}
      </div>
      </div>

      <div className="px-3 py-3 sm:px-4">
        {detailTabs.map(([key]) => (
          <div key={key} role="tabpanel" id={`${tabsId}-panel-${key}`} aria-labelledby={`${tabsId}-tab-${key}`} hidden={tab !== key} tabIndex={0} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {tab === key && key === "info" && <><InfoTab student={student} studentId={id} /><CertificateHistory studentId={id} /></>}
            {tab === key && key === "scheme" && <SchemeTab studentId={id} />}
            {tab === key && key === "evidence" && <EvidenceTab studentId={id} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function CertificateHistory({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "student", studentId, "certificates"],
    queryFn: () => listStudentCertificates(studentId),
  });
  const revoke = useMutation({
    mutationFn: (certificateId: string) => revokeStudentCertificate(certificateId, reason),
    onSuccess: () => {
      setReason("");
      toast.success("Certificado revocado");
      queryClient.invalidateQueries({ queryKey: ["admin", "student", studentId, "certificates"] });
    },
    onError: () => toast.error("No se pudo revocar el certificado"),
  });
  if (error) return <QueryError error={error} retry={refetch} />;
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Certificados emitidos</CardTitle>
        <CardDescription>La revocación queda registrada y no puede revertirse desde esta pantalla.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <p className="text-sm text-muted-foreground">Cargando emisiones…</p> : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay certificados emitidos.</p>
        ) : data.map((certificate) => (
          <div key={certificate.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div className="text-sm">
              <p className="font-medium">{formatDateTime(certificate.issued_at)} · {certificate.status === "ISSUED" ? "Vigente" : "Revocado"}</p>
              <a className="text-primary underline" href={`/verify/${certificate.public_id}`} target="_blank" rel="noreferrer">Abrir verificación pública</a>
            </div>
            {certificate.status === "ISSUED" && (
              <div className="flex flex-wrap items-center gap-2">
                <Input aria-label="Motivo de revocación" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Motivo requerido" />
                <Button variant="destructive" disabled={!reason.trim() || revoke.isPending} onClick={() => revoke.mutate(certificate.id)}>
                  {revoke.isPending ? "Revocando…" : "Revocar"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function InfoTab({
  student,
  studentId,
}: {
  student: { profile: NonNullable<unknown> | null } & {
    profile: {
      first_name: string;
      last_name: string;
      document_number?: string | null;
      student_id?: string | null;
      sex: string;
      phone?: string | null;
      eps_affiliation?: string | null;
      emergency_contact_name?: string | null;
      emergency_contact_phone?: string | null;
      program?: string | null;
      campus?: string | null;
      semester?: number | null;
      birth_date?: string | null;
    } | null;
    email: string;
    created_at: string;
  };
  studentId: string;
}) {
  const queryClient = useQueryClient();
  const academicOptions = useQuery({
    queryKey: ["academic-options"],
    queryFn: getAcademicOptions,
  });
  const p = student.profile;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UpdateStudentProfileRequest>({
    first_name: p?.first_name ?? "",
    last_name: p?.last_name ?? "",
    document_number: p?.document_number ?? "",
    student_id: p?.student_id ?? "",
    birth_date: p?.birth_date ?? "",
    sex: (p?.sex as UpdateStudentProfileRequest["sex"]) ?? "male",
    phone: p?.phone ?? "",
    eps_affiliation: p?.eps_affiliation ?? "",
    emergency_contact_name: p?.emergency_contact_name ?? "",
    emergency_contact_phone: p?.emergency_contact_phone ?? "",
    semester: p?.semester ?? undefined,
  });
  const update = useSafeMutation({
    affectedQueries: [["admin", "student", studentId],["admin", "students"],["audit"]],
    mutationFn: () =>
      updateStudentProfile(studentId, {
        ...form,
        student_id: emptyToNull(form.student_id),
        birth_date: emptyToNull(form.birth_date),
        phone: emptyToNull(form.phone),
        eps_affiliation: emptyToNull(form.eps_affiliation),
        emergency_contact_name: emptyToNull(form.emergency_contact_name),
        emergency_contact_phone: emptyToNull(form.emergency_contact_phone),
        semester: form.semester ? Number(form.semester) : undefined,
      }),
    onSuccess: () => {
      toast.success("Estudiante actualizado");
      setEditing(false);
      queryClient.invalidateQueries({
        queryKey: ["admin", "student", studentId],
      });
    },
    onError: () => toast.error("No se pudo actualizar"),
  });

  if (editing) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Editar estudiante</CardTitle>
              <CardDescription>
                Programa y sede son solo lectura para respetar el alcance del backend.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={update.isPending}
            >
              Cancelar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nombre">
            <Input
                disabled={update.isPending}
              value={form.first_name ?? ""}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </Field>
          <Field label="Apellido">
            <Input
                disabled={update.isPending}
              value={form.last_name ?? ""}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </Field>
          <Field label="Documento">
            <Input
                disabled={update.isPending}
              value={form.document_number ?? ""}
              onChange={(e) =>
                setForm({ ...form, document_number: e.target.value })
              }
            />
          </Field>
          <Field label="Codigo institucional">
            <Input
                disabled={update.isPending}
              value={form.student_id ?? ""}
              onChange={(e) => setForm({ ...form, student_id: e.target.value })}
            />
          </Field>
          <Field label="Fecha nacimiento">
            <Input
                disabled={update.isPending}
              type="date"
              value={form.birth_date ?? ""}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
            />
          </Field>
          <Field label="Sexo">
            <Select
                disabled={update.isPending}
              value={form.sex}
              onChange={(e) =>
                setForm({
                  ...form,
                  sex: e.target.value as UpdateStudentProfileRequest["sex"],
                })
              }
            >
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
            </Select>
          </Field>
          <Field label="Telefono">
            <Input
                disabled={update.isPending}
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="EPS">
            <Input
                disabled={update.isPending}
              value={form.eps_affiliation ?? ""}
              onChange={(e) =>
                setForm({ ...form, eps_affiliation: e.target.value })
              }
            />
          </Field>
          <Field label="Semestre">
            <Select
              disabled={update.isPending || !academicOptions.data}
              value={form.semester?.toString() ?? ""}
              onChange={(e) => setForm({ ...form, semester: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">Sin semestre</option>
              {form.semester != null && !academicOptions.data?.semesters.includes(form.semester) && (
                <option value={form.semester} disabled>Semestre actual ({form.semester})</option>
              )}
              {academicOptions.data?.semesters.map((semester) => (
                <option key={semester} value={semester}>{semester}</option>
              ))}
            </Select>
          </Field>
          {academicOptions.isLoading && <p role="status" className="text-sm text-muted-foreground">Cargando opciones académicas…</p>}
          {academicOptions.error && <QueryError error={academicOptions.error} retry={() => academicOptions.refetch({ cancelRefetch: false })} retrying={academicOptions.isFetching} />}
          <Field label="Contacto emergencia">
            <Input
                disabled={update.isPending}
              value={form.emergency_contact_name ?? ""}
              onChange={(e) =>
                setForm({ ...form, emergency_contact_name: e.target.value })
              }
            />
          </Field>
          <Field label="Tel. emergencia">
            <Input
                disabled={update.isPending}
              value={form.emergency_contact_phone ?? ""}
              onChange={(e) =>
                setForm({ ...form, emergency_contact_phone: e.target.value })
              }
            />
          </Field>
          <div className="rounded-lg border border-[color:var(--divider)] bg-[color:var(--surface-variant)]/60 p-3 text-sm sm:col-span-2 lg:col-span-3">
            <p className="font-semibold">Programa y sede</p>
            <p className="mt-1 text-muted-foreground">
              {p?.program || "-"} / {p?.campus || "-"}
            </p>
          </div>
          <div className="flex justify-end sm:col-span-2 lg:col-span-3">
            <Button onClick={() => update.mutate()} disabled={update.isPending}>
              {update.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Información del estudiante</CardTitle>
        <CardDescription>Cuenta creada {formatDateTime(student.created_at)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex justify-end sm:col-span-2 lg:col-span-3">
          <Button size="sm" variant="outline" onClick={() => { setForm({first_name:p?.first_name ?? "",last_name:p?.last_name ?? "",document_number:p?.document_number ?? "",student_id:p?.student_id ?? "",birth_date:p?.birth_date ?? "",sex:p?.sex as UpdateStudentProfileRequest["sex"],phone:p?.phone ?? "",eps_affiliation:p?.eps_affiliation ?? "",emergency_contact_name:p?.emergency_contact_name ?? "",emergency_contact_phone:p?.emergency_contact_phone ?? "",semester:p?.semester ?? undefined});setEditing(true); }}>
            Editar datos
          </Button>
        </div>
        <KV label="Documento" value={p?.document_number} />
        <KV label="Código" value={p?.student_id} />
        <KV label="Sexo" value={p?.sex} />
        <KV label="Fecha nacimiento" value={p?.birth_date && formatDate(p.birth_date)} />
        <KV label="Teléfono" value={p?.phone} />
        <KV label="EPS" value={p?.eps_affiliation} />
        <KV label="Programa" value={p?.program} />
        <KV label="Sede" value={p?.campus} />
        <KV label="Semestre" value={p?.semester ? String(p.semester) : null} />
        <KV label="Contacto emergencia" value={p?.emergency_contact_name} />
        <KV label="Tel. emergencia" value={p?.emergency_contact_phone} />
      </CardContent>
    </Card>
  );
}

function KV({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, { id })}
    </div>
  );
}

function emptyToNull(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function SchemeTab({ studentId }: { studentId: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "student", studentId, "scheme"],
    queryFn: () => getStudentScheme(studentId),
  });
  if (error) return <QueryError error={error} retry={refetch} />;
  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!data || data.length === 0)
    return (
      <p className="text-sm text-muted-foreground">Este estudiante no tiene esquema asignado.</p>
    );
  return (
    <div className="flex flex-col gap-3">
      {data.map((sv) => (
        <AdminVaccineCard
          key={sv.id}
          vaccine={sv}
          studentId={studentId}
        />
      ))}
    </div>
  );
}

function AdminVaccineCard({
  vaccine,
  studentId,
}: {
  vaccine: StudentVaccine;
  studentId: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerId = `${panelId}-trigger`;
  const tone = statusColor(vaccine.status);

  return (
    <Card className="overflow-hidden rounded-xl border-border bg-card text-foreground shadow-none">
      <button
        type="button"
        id={triggerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-[color:var(--surface-variant)]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span
          className="h-11 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: tone }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block break-words text-lg font-bold leading-tight">
            {vaccine.vaccine?.name ?? "Vacuna"}
          </span>
          <span
            className="mt-0.5 block text-sm font-semibold"
            style={{ color: statusColor(vaccine.status, true) }}
          >
            {vaccineStatusLabel(vaccine.status)}
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-[color:var(--interactive-foreground)]" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>
      <div id={panelId} role="region" aria-labelledby={triggerId} hidden={!open}>
      {open && (
        <CardContent className="flex flex-col gap-3 px-4 pb-4 pt-0">
          {vaccine.doses
            .slice()
            .sort((a, b) => a.dose_number - b.dose_number)
            .map((dose) => (
              <AdminDoseRow key={dose.id} dose={dose} studentId={studentId} />
            ))}
        </CardContent>
      )}
      </div>
    </Card>
  );
}

function statusColor(status: string, text = false): string {
  switch (status) {
    case "approved":
      return text ? "var(--success-text)" : "var(--success)";
    case "denied":
      return text ? "var(--destructive-text)" : "var(--destructive)";
    case "in_review":
      return text ? "var(--warning-text)" : "var(--warning)";
    default:
      return "#829196";
  }
}


function EvidenceTab({ studentId }: { studentId: string }) {
 const [page,setPage]=usePageLocation("evidence_page");
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "student", studentId, "evidence", page],
    queryFn: () => listStudentEvidencePage(studentId,page),
  });
  const remove = useSafeMutation({
    affectedQueries: [["admin", "student"],["admin", "students"],["audit"]],
    mutationFn: (batchId: string) => deleteStudentEvidence(studentId, batchId),
    onSuccess: () => {
      toast.success("Evidencia eliminada");
      queryClient.invalidateQueries({
        queryKey: ["admin", "student", studentId, "evidence"],
      });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });
  const review = useSafeMutation({
    affectedQueries: [["admin", "student", studentId],["admin", "students"],["audit"]],
    mutationFn: (input: { batchId: string; status: "in_review" | "approved" | "denied" }) =>
      reviewEvidenceBatch(input.batchId, input.status),
    onSuccess: () => {
      toast.success("Estado de evidencia actualizado");
      queryClient.invalidateQueries({queryKey:["admin", "student", studentId, "scheme"]});
      queryClient.invalidateQueries({
        queryKey: ["admin", "student", studentId, "evidence"],
      });
    },
    onError: () => toast.error("No se pudo revisar la evidencia"),
  });
  if (error) return <QueryError error={error} retry={refetch} />;
  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div>
    <Pagination data={data} page={page} onPage={setPage} refresh={refetch} busy={isLoading} />
    {!data?.items.length && <p>Sin evidencias.</p>}
    <ul className="flex flex-col gap-3">
      {data?.items.map((batch) => (
        <li key={batch.id} className="rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <Badge variant="muted">{batch.status}</Badge>
              <span className="ml-2 text-muted-foreground">
                {formatDateTime(batch.created_at)}
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { if (confirm("¿Eliminar estos documentos?")) remove.mutate(batch.id); }}
              disabled={remove.isPending}
            >
              Eliminar
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["in_review", "approved", "denied"] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant="outline"
                disabled={review.isPending}
                onClick={() => review.mutate({ batchId: batch.id, status })}
              >
                {status === "in_review" ? "En revisión" : status === "approved" ? "Aprobar" : "Denegar"}
              </Button>
            ))}
          </div>
          {batch.notes && (
            <p className="mt-2 text-sm text-muted-foreground">{batch.notes}</p>
          )}
          <ul className="mt-2 flex flex-col gap-1">
            {batch.files.map((f) => (
              <AdminEvidenceFileItem key={f.id} file={f} />
            ))}
          </ul>
        </li>
      ))}
    </ul></div>
  );
}

function AdminEvidenceFileItem({
  file,
}: {
  file: { id: string; original_filename: string; file_size: number };
}) {
  const [downloading, setDownloading] = useState(false);

  async function onDownload() {
    setDownloading(true);
    const toastId = toast.loading("Preparando descarga...");
    try {
      await downloadEvidenceFile(file.id, file.original_filename, {
        onProgress: (progress) =>
          toast.loading(
            progress == null
              ? "Descargando archivo..."
              : `Descargando archivo ${progress}%`,
            { id: toastId },
          ),
      });
      toast.success("Archivo descargado", { id: toastId });
    } catch {
      toast.error("No se pudo descargar", { id: toastId });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <li>
      <button
        className="max-w-full whitespace-normal break-all text-sm text-primary hover:underline disabled:opacity-60"
        onClick={onDownload}
        disabled={downloading}
      >
        {downloading ? "Descargando..." : file.original_filename}
      </button>
      <span className="ml-2 text-xs text-muted-foreground">
        ({formatBytes(file.file_size)})
      </span>
    </li>
  );
}
