"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Award,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Edit3,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deactivateStudent,
  deleteStudent,
  downloadStudentCertificate,
  getStudent,
  reactivateStudent,
  updateStudentProfile,
  type UpdateStudentProfileRequest,
} from "@/lib/api/admin";
import { getStudentScheme, reviewDose } from "@/lib/api/scheme";
import {
  deleteStudentEvidence,
  downloadEvidenceFile,
  listStudentEvidence,
} from "@/lib/api/evidence";
import { StudentDose, StudentVaccine } from "@/lib/api/types";
import {
  doseStatusLabel,
  formatBytes,
  formatDate,
  formatDateTime,
  statusVariant,
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
import { Textarea } from "@/components/ui/textarea";
import { VaccineDueBadge } from "@/components/vaccine-due-badge";

type Tab = "info" | "scheme" | "evidence";

export default function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("info");
  const [downloadingCertificate, setDownloadingCertificate] = useState(false);

  const { data: student, isLoading } = useQuery({
    queryKey: ["admin", "student", id],
    queryFn: () => getStudent(id),
  });

  const deactivate = useMutation({
    mutationFn: () => deactivateStudent(id),
    onSuccess: () => {
      toast.success("Estudiante desactivado");
      queryClient.invalidateQueries({ queryKey: ["admin", "student", id] });
    },
    onError: () => toast.error("No se pudo desactivar"),
  });

  const reactivate = useMutation({
    mutationFn: () => reactivateStudent(id),
    onSuccess: () => {
      toast.success("Estudiante reactivado");
      queryClient.invalidateQueries({ queryKey: ["admin", "student", id] });
    },
    onError: () => toast.error("No se pudo reactivar"),
  });

  const remove = useMutation({
    mutationFn: () => deleteStudent(id),
    onSuccess: () => {
      toast.success("Estudiante eliminado");
      router.replace("/admin/students");
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

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
      await downloadStudentCertificate(id, student.email, {
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
    <div className="-mx-4 -my-6 min-h-screen bg-[#071416] text-[#eaf7f7] sm:mx-0 sm:my-0 sm:min-h-0 sm:overflow-hidden sm:rounded-2xl sm:border sm:border-[#244247]">
      <div className="sticky top-0 z-20 border-b border-[#244247] bg-[#0b1d20]/95 backdrop-blur">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Volver"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#45d2df] transition-colors hover:bg-[#45d2df]/10"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold leading-tight tracking-normal">
              {fullName}
            </h1>
            <p className="truncate text-sm text-[#a8bfc2]">{student.email}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onDownloadCertificate}
              disabled={downloadingCertificate}
              aria-label="Descargar certificado"
              title="Descargar certificado"
              className="grid h-9 w-9 place-items-center rounded-full text-[#45d2df] transition-colors hover:bg-[#45d2df]/10 disabled:opacity-50"
            >
              <Award className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setTab("info")}
              aria-label="Ver perfil"
              title="Ver perfil"
              className="grid h-9 w-9 place-items-center rounded-full text-[#45d2df] transition-colors hover:bg-[#45d2df]/10"
            >
              <Edit3 className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setTab("evidence")}
              aria-label="Ver evidencia"
              title="Ver evidencia"
              className="grid h-9 w-9 place-items-center rounded-full text-[#45d2df] transition-colors hover:bg-[#45d2df]/10"
            >
              <MessageSquare className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      <div className="hidden">
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
              onClick={() => deactivate.mutate()}
              disabled={deactivate.isPending}
            >
              Desactivar
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => reactivate.mutate()}
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

      <div className="flex border-t border-[#244247]">
        {(
          [
            ["info", "Perfil"],
            ["scheme", "Esquema"],
            ["evidence", "Evidencia"],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "relative flex-1 px-4 py-3 text-sm font-semibold tracking-normal transition-colors",
              tab === key
                ? "text-[#45d2df]"
                : "text-[#d8e2e3]/80 hover:text-[#eaf7f7]",
            )}
          >
            {label}
            {tab === key && (
              <span className="absolute inset-x-8 -bottom-px h-0.5 rounded-t-full bg-[#45d2df]" />
            )}
          </button>
        ))}
      </div>
      </div>

      <div className="px-3 py-3 sm:px-4">
        {tab === "info" && <InfoTab student={student} studentId={id} />}
        {tab === "scheme" && <SchemeTab studentId={id} />}
        {tab === "evidence" && <EvidenceTab studentId={id} />}
      </div>
    </div>
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
  const update = useMutation({
    mutationFn: () =>
      updateStudentProfile(studentId, {
        ...form,
        student_id: emptyToUndefined(form.student_id),
        birth_date: emptyToUndefined(form.birth_date),
        phone: emptyToUndefined(form.phone),
        eps_affiliation: emptyToUndefined(form.eps_affiliation),
        emergency_contact_name: emptyToUndefined(form.emergency_contact_name),
        emergency_contact_phone: emptyToUndefined(form.emergency_contact_phone),
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
              value={form.first_name ?? ""}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </Field>
          <Field label="Apellido">
            <Input
              value={form.last_name ?? ""}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </Field>
          <Field label="Documento">
            <Input
              value={form.document_number ?? ""}
              onChange={(e) =>
                setForm({ ...form, document_number: e.target.value })
              }
            />
          </Field>
          <Field label="Codigo institucional">
            <Input
              value={form.student_id ?? ""}
              onChange={(e) => setForm({ ...form, student_id: e.target.value })}
            />
          </Field>
          <Field label="Fecha nacimiento">
            <Input
              type="date"
              value={form.birth_date ?? ""}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
            />
          </Field>
          <Field label="Sexo">
            <Select
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
              <option value="other">Otro</option>
            </Select>
          </Field>
          <Field label="Telefono">
            <Input
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="EPS">
            <Input
              value={form.eps_affiliation ?? ""}
              onChange={(e) =>
                setForm({ ...form, eps_affiliation: e.target.value })
              }
            />
          </Field>
          <Field label="Semestre">
            <Input
              type="number"
              min={1}
              max={12}
              value={form.semester ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  semester: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </Field>
          <Field label="Contacto emergencia">
            <Input
              value={form.emergency_contact_name ?? ""}
              onChange={(e) =>
                setForm({ ...form, emergency_contact_name: e.target.value })
              }
            />
          </Field>
          <Field label="Tel. emergencia">
            <Input
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
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
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
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function emptyToUndefined(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : undefined;
}

function SchemeTab({ studentId }: { studentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "student", studentId, "scheme"],
    queryFn: () => getStudentScheme(studentId),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!data || data.length === 0)
    return (
      <p className="text-sm text-muted-foreground">Este estudiante no tiene esquema asignado.</p>
    );
  return (
    <div className="flex flex-col gap-3">
      {data.map((sv, index) => (
        <AdminVaccineCard
          key={sv.id}
          vaccine={sv}
          studentId={studentId}
          defaultOpen={index < 2}
        />
      ))}
    </div>
  );
}

function AdminVaccineCard({
  vaccine,
  studentId,
  defaultOpen,
}: {
  vaccine: StudentVaccine;
  studentId: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const tone = statusColor(vaccine.status);

  return (
    <Card className="overflow-hidden rounded-xl border-[#2d4f55] bg-[#0e2023] text-[#eaf7f7] shadow-none">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-[#142d31]/45"
      >
        <span
          className="h-11 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: tone }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-bold leading-tight">
            {vaccine.vaccine?.name ?? "Vacuna"}
          </span>
          <span
            className="mt-0.5 block text-sm font-semibold"
            style={{ color: tone }}
          >
            {vaccineStatusLabel(vaccine.status)}
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-[#45d2df]" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-[#d8e2e3]" aria-hidden />
        )}
      </button>
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
    </Card>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "approved":
      return "#5fae36";
    case "denied":
      return "#c94242";
    case "in_review":
      return "#e6a700";
    default:
      return "#829196";
  }
}

function AdminDoseRow({
  dose,
  studentId,
}: {
  dose: StudentDose;
  studentId: string;
}) {
  const queryClient = useQueryClient();
  const [reviewAction, setReviewAction] = useState<null | "approved" | "denied">(
    null,
  );
  const [notes, setNotes] = useState(dose.admin_notes ?? "");

  const review = useMutation({
    mutationFn: (payload: {
      status: "approved" | "denied";
      notesOverride?: string | null;
    }) =>
      reviewDose(dose.id, {
        status: payload.status,
        admin_notes:
          payload.notesOverride === undefined ? notes || null : payload.notesOverride,
      }),
    onSuccess: (_, payload) => {
      toast.success(
        payload.status === "approved" ? "Dosis aprobada" : "Dosis rechazada",
      );
      setReviewAction(null);
      queryClient.invalidateQueries({
        queryKey: ["admin", "student", studentId, "scheme"],
      });
    },
    onError: () => toast.error("No se pudo guardar"),
  });

  const isApproved = dose.status === "approved";
  const isDenied = dose.status === "denied";
  const tone = statusColor(dose.status);
  const label = dose.dose_config?.label ?? `Dosis ${dose.dose_number}`;

  const cancel = () => {
    setReviewAction(null);
    setNotes(dose.admin_notes ?? "");
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-tight text-[#eaf7f7]">
            {label}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: tone }}
          />
          <span className="hidden">
            {dose.dose_config?.label ?? `Dosis ${dose.dose_number}`}
          </span>
          <Badge variant={statusVariant(dose.status)} className="text-xs">
            {doseStatusLabel(dose.status)}
          </Badge>
          {dose.applied_date && (
            <>
              <CalendarDays className="h-4 w-4 text-[#647478]" aria-hidden />
              <span className="text-[#647478]">{dose.applied_date}</span>
            </>
          )}
          {dose.due_date && (
            <VaccineDueBadge
              dueDate={dose.due_date}
              days={dose.days_until_due ?? null}
            />
          )}
          {dose.titer_value && (
            <span className="text-[#a8bfc2]">Titulacion: {dose.titer_value}</span>
          )}
        </div>
        </div>
        {!reviewAction && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!isApproved && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 rounded-full bg-[#5fae36]/15 px-2.5 text-[#8dd965] hover:bg-[#5fae36]/25 hover:text-[#a7da64] [&>span:first-child]:hidden"
                onClick={() => setReviewAction("approved")}
                title="Aprobar dosis"
              >
                <span aria-hidden className="text-base leading-none">✓</span>
                <span className="ml-1">Aprobar</span>
              </Button>
            )}
            {!isDenied && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 rounded-full bg-[#c94242]/15 px-2.5 text-[#ff7373] hover:bg-[#c94242]/25 hover:text-[#ff8a8a] [&>span:first-child]:hidden"
                onClick={() => setReviewAction("denied")}
                title="Rechazar dosis"
              >
                <span aria-hidden className="text-base leading-none">✗</span>
                <span className="ml-1">Denegar</span>
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="hidden">
        {dose.applied_date && <span>{formatDate(dose.applied_date)}</span>}
        {dose.due_date && (
          <VaccineDueBadge
            dueDate={dose.due_date}
            days={dose.days_until_due ?? null}
          />
        )}
        {dose.titer_value && (
          <span>
            <span className="text-muted-foreground">Titulación: </span>
            {dose.titer_value}
          </span>
        )}
      </div>

      {dose.admin_notes && !reviewAction && (
        <div className="mt-3 rounded-lg border border-[#2d4f55] bg-[#063d43] p-3">
          <div className="mb-2 flex items-center gap-2 text-[#45d2df]">
            <MessageSquare className="h-4 w-4" aria-hidden />
            <p className="flex-1 text-sm font-bold leading-tight">
              Comentario del administrador
            </p>
            <button
              type="button"
              onClick={() => setReviewAction(isDenied ? "denied" : "approved")}
              className="grid h-7 w-7 place-items-center rounded-full text-[#45d2df] transition-colors hover:bg-[#45d2df]/10"
              title="Editar comentario"
              aria-label="Editar comentario"
            >
              <Edit3 className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() =>
                review.mutate({
                  status: isDenied ? "denied" : "approved",
                  notesOverride: null,
                })
              }
              className="grid h-7 w-7 place-items-center rounded-full text-[#45d2df] transition-colors hover:bg-[#45d2df]/10"
              title="Eliminar comentario"
              aria-label="Eliminar comentario"
              disabled={review.isPending}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className="text-sm leading-snug text-[#eaf7f7]">
            {dose.admin_notes}
          </p>
        </div>
      )}

      {reviewAction && (
        <div
          className={cn(
            "mt-3 flex flex-col gap-3 rounded-lg border-l-4 p-3",
            reviewAction === "approved"
              ? "border-[#5fae36] bg-[#11341a]"
              : "border-[#c94242] bg-[#3a1313]",
          )}
        >
          <p className="text-sm font-medium">
            {reviewAction === "approved"
              ? "¿Confirmar aprobación de esta dosis?"
              : "¿Confirmar rechazo de esta dosis?"}
          </p>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Nota (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={
                reviewAction === "approved"
                  ? "Ej: Evidencia válida, dosis aplicada correctamente."
                  : "Ej: Documento ilegible, fecha incorrecta…"
              }
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={reviewAction === "approved" ? "default" : "destructive"}
              onClick={() => review.mutate({ status: reviewAction })}
              disabled={review.isPending}
            >
              {review.isPending
                ? "Guardando…"
                : reviewAction === "approved"
                  ? "Aprobar"
                  : "Rechazar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceTab({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "student", studentId, "evidence"],
    queryFn: () => listStudentEvidence(studentId),
  });
  const remove = useMutation({
    mutationFn: (batchId: string) => deleteStudentEvidence(studentId, batchId),
    onSuccess: () => {
      toast.success("Evidencia eliminada");
      queryClient.invalidateQueries({
        queryKey: ["admin", "student", studentId, "evidence"],
      });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!data || data.length === 0)
    return <p className="text-sm text-muted-foreground">Sin evidencias.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {data.map((batch) => (
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
              onClick={() => remove.mutate(batch.id)}
              disabled={remove.isPending}
            >
              Eliminar
            </Button>
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
    </ul>
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
        className="text-sm text-primary hover:underline disabled:opacity-60"
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
