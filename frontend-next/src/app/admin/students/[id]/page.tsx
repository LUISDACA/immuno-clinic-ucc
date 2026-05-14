"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
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

      <div className="flex gap-1 border-b">
        {(
          [
            ["info", "Datos"],
            ["scheme", "Esquema"],
            ["evidence", "Evidencias"],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "info" && <InfoTab student={student} studentId={id} />}
      {tab === "scheme" && <SchemeTab studentId={id} />}
      {tab === "evidence" && <EvidenceTab studentId={id} />}
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
    <div className="flex flex-col gap-4">
      {data.map((sv) => (
        <AdminVaccineCard key={sv.id} vaccine={sv} studentId={studentId} />
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
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {vaccine.vaccine?.name ?? "Vacuna"}
            </CardTitle>
            {vaccine.vaccine?.code && (
              <CardDescription>{vaccine.vaccine.code}</CardDescription>
            )}
          </div>
          <Badge variant={statusVariant(vaccine.status)}>
            {vaccineStatusLabel(vaccine.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {vaccine.doses
          .slice()
          .sort((a, b) => a.dose_number - b.dose_number)
          .map((dose) => (
            <AdminDoseRow key={dose.id} dose={dose} studentId={studentId} />
          ))}
      </CardContent>
    </Card>
  );
}

function AdminDoseRow({
  dose,
  studentId,
}: {
  dose: StudentDose;
  studentId: string;
}) {
  const queryClient = useQueryClient();
  const [reviewing, setReviewing] = useState(false);
  const [status, setStatus] = useState<string>(dose.status);
  const [notes, setNotes] = useState(dose.admin_notes ?? "");

  const review = useMutation({
    mutationFn: () => reviewDose(dose.id, { status, admin_notes: notes || null }),
    onSuccess: () => {
      toast.success("Dosis revisada");
      setReviewing(false);
      queryClient.invalidateQueries({
        queryKey: ["admin", "student", studentId, "scheme"],
      });
    },
    onError: () => toast.error("No se pudo revisar"),
  });

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {dose.dose_config?.label ?? `Dosis ${dose.dose_number}`}
          </span>
          <Badge variant={statusVariant(dose.status)}>
            {doseStatusLabel(dose.status)}
          </Badge>
        </div>
        {!reviewing && (
          <Button size="sm" variant="outline" onClick={() => setReviewing(true)}>
            Revisar
          </Button>
        )}
      </div>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
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
      {dose.admin_notes && !reviewing && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium">Nota: </span>
          {dose.admin_notes}
        </p>
      )}
      {reviewing && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Estado</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="pending">Pendiente</option>
                <option value="in_review">En revisión</option>
                <option value="approved">Aprobar</option>
                <option value="denied">Rechazar</option>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => review.mutate()}
              disabled={review.isPending}
            >
              {review.isPending ? "Guardando…" : "Guardar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReviewing(false)}>
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
