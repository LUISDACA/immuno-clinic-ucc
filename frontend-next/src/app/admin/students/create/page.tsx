"use client";
import { useSafeMutation as useMutation } from "@/lib/query/safe-mutation";
import { useQuery } from "@tanstack/react-query";
import { QueryError } from "@/components/query-error";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createStudent,
  CreateStudentRequest,
  getAcademicOptions,
  importStudentsFile,
  previewStudentImport,
} from "@/lib/api/admin";
import { ImportPreviewResponse, ImportStudentsResponse } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const INITIAL: CreateStudentRequest = {
  email: "",
  first_name: "",
  last_name: "",
  document_number: "",
  sex: "female",
};

export default function CreateStudentPage() {
  const router = useRouter();
  const sexId = useId();
  const formId = useId();
  const mounted = useRef(true);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [form, setForm] = useState<CreateStudentRequest>(INITIAL);
  const academicOptions = useQuery({
    queryKey: ["academic-options"],
    queryFn: getAcademicOptions,
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportStudentsResponse | null>(
    null,
  );

  const create = useMutation({
    affectedQueries: [["admin", "students"], ["audit"]],
    mutationFn: (payload: CreateStudentRequest) => createStudent(payload),
    onSuccess: (user) => {
      if (!mounted.current) return;
      toast.success("Estudiante creado");
      router.replace(`/admin/students/${user.id}`);
    },
    onError: () => showError("No se pudo crear el estudiante. Revisa los datos antes de reintentar."),
  });

  const previewImport = useMutation({
    affectedQueries: [],
    mutationFn: (selected: File) => previewStudentImport(selected),
    onSuccess: (data) => {
      if (!mounted.current) return;
      setPreview(data);
      toast.success("Vista previa lista");
    },
    onError: () => showError("No se pudo leer el archivo. Vuelve a solicitar la vista previa."),
  });

  const runImport = useMutation({
    affectedQueries: [["admin", "students"], ["audit"]],
    mutationFn: (selected: File) => importStudentsFile(selected),
    onSuccess: (data) => {
      if (!mounted.current) return;
      setImportResult(data);
      toast.success(`Importacion completa: ${data.created} creado(s)`);
    },
    onError: () => showError("No se pudo confirmar la importación. Revisa la lista y solicita una nueva vista previa antes de reintentar."),
  });

  function showError(message: string) {
    if (!mounted.current) return;
    setError(message);
    toast.error(message);
  }

  async function perform(operation: () => Promise<unknown>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try { await operation(); }
    catch { /* The mutation presents a safe error; never expose transport details. */ }
    finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function requestPreview() {
    if (!file || busyRef.current) return;
    const selected = file;
    setPreview(null);
    setImportResult(null);
    void perform(() => previewImport.mutateAsync(selected));
  }

  function confirmImport() {
    if (!file || !preview || preview.will_create === 0 || busyRef.current) return;
    const selected = file;
    // A confirmation authorizes this attempt only, including ambiguous network failures.
    setPreview(null);
    setImportResult(null);
    void perform(() => runImport.mutateAsync(selected));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Crear estudiante</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea una cuenta manualmente o importa varios estudiantes desde Excel.
        </p>
      </div>

      <form id={formId} onSubmit={(event) => {
        event.preventDefault();
        void perform(() => create.mutateAsync(cleanPayload(form)));
      }}>
      <fieldset disabled={busy} className="min-w-0">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos basicos</CardTitle>
          <CardDescription>
            Las instrucciones de acceso se envían por correo; el estudiante deberá cambiar la contraseña temporal.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Correo"
            type="email"
            required
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
          />
          <Field
            label="Documento"
            required
            value={form.document_number}
            onChange={(v) => setForm({ ...form, document_number: v })}
          />
          <Field
            label="Nombres"
            required
            value={form.first_name}
            onChange={(v) => setForm({ ...form, first_name: v })}
          />
          <Field
            label="Apellidos"
            required
            value={form.last_name}
            onChange={(v) => setForm({ ...form, last_name: v })}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={sexId}>Sexo *</Label>
            <Select
              id={sexId}
              value={form.sex}
              onChange={(e) =>
                setForm({
                  ...form,
                  sex: e.target.value as "male" | "female",
                })
              }
            >
              <option value="female">Femenino</option>
              <option value="male">Masculino</option>
            </Select>
          </div>
          <Field
            label="Codigo (opcional)"
            value={form.student_id ?? ""}
            onChange={(v) => setForm({ ...form, student_id: v })}
          />
          <Field
            label="Telefono"
            value={form.phone ?? ""}
            onChange={(v) => setForm({ ...form, phone: v })}
          />
          <Field
            label="Fecha de nacimiento"
            type="date"
            value={form.birth_date ?? ""}
            onChange={(v) => setForm({ ...form, birth_date: v })}
          />
          <Field
            label="EPS"
            value={form.eps_affiliation ?? ""}
            onChange={(v) => setForm({ ...form, eps_affiliation: v })}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="program">Programa</Label>
            <Select id="program" value={form.program ?? ""} disabled={!academicOptions.data} onChange={(e) => setForm({ ...form, program: e.target.value || undefined })}>
              <option value="">Selecciona una opción</option>
              {academicOptions.data?.programs.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campus">Campus</Label>
            <Select id="campus" value={form.campus ?? ""} disabled={!academicOptions.data} onChange={(e) => setForm({ ...form, campus: e.target.value || undefined })}>
              <option value="">Selecciona una opción</option>
              {academicOptions.data?.campuses.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>
          </div>
          {academicOptions.isLoading && <p role="status" className="text-sm text-muted-foreground">Cargando opciones académicas…</p>}
          {academicOptions.error && <QueryError error={academicOptions.error} retry={() => academicOptions.refetch({ cancelRefetch: false })} retrying={academicOptions.isFetching} />}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="student-semester">Semestre</Label>
            <Select
              id="student-semester"
              value={form.semester ? String(form.semester) : ""}
              disabled={!academicOptions.data || busy}
              onChange={(event) => setForm({ ...form, semester: event.target.value ? Number(event.target.value) : undefined })}
            >
              <option value="">Selecciona una opción</option>
              {academicOptions.data?.semesters.map((semester) => (
                <option key={semester} value={semester}>{semester}</option>
              ))}
            </Select>
          </div>
          <Field
            label="Contacto emergencia"
            value={form.emergency_contact_name ?? ""}
            onChange={(v) => setForm({ ...form, emergency_contact_name: v })}
          />
          <Field
            label="Tel. emergencia"
            value={form.emergency_contact_phone ?? ""}
            onChange={(v) => setForm({ ...form, emergency_contact_phone: v })}
          />
        </CardContent>
      </Card>
      </fieldset>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importar desde Excel</CardTitle>
          <CardDescription>
            Usa el mismo archivo de estudiantes del celular. Las instrucciones de acceso se envían por correo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="student-import">Archivo Excel o CSV</Label>
            <Input
              id="student-import"
              disabled={busy}
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setImportResult(null);
                setError(null);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={requestPreview}
              disabled={!file || busy}
            >
              {previewImport.isPending ? "Revisando..." : "Ver vista previa"}
            </Button>
            <Button
              onClick={confirmImport}
              disabled={!file || busy || !preview || preview.will_create === 0}
            >
              {runImport.isPending ? "Importando..." : "Importar estudiantes"}
            </Button>
          </div>
          {preview && <ImportPreviewPanel key={file?.name} preview={preview} />}
          {importResult && <ImportResultPanel key={file?.name} result={importResult} />}
        </CardContent>
      </Card>

      {error && <p role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" form={formId} disabled={busy}>
          {create.isPending ? "Creando..." : "Crear estudiante"}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function cleanPayload(form: CreateStudentRequest): CreateStudentRequest {
  const out: CreateStudentRequest = {
    email: form.email,
    first_name: form.first_name,
    last_name: form.last_name,
    document_number: form.document_number,
    sex: form.sex,
  };
  for (const key of [
    "student_id",
    "birth_date",
    "phone",
    "eps_affiliation",
    "emergency_contact_name",
    "emergency_contact_phone",
    "program",
    "campus",
  ] as const) {
    const v = form[key];
    if (v) (out as unknown as Record<string, unknown>)[key] = v;
  }
  if (form.semester) out.semester = form.semester;
  return out;
}

function ImportPreviewPanel({ preview }: { preview: ImportPreviewResponse }) {
  const [page,setPage]=useState(1);
  const count=Math.ceil(preview.rows.length/20);
  return (
    <div className="rounded-xl border border-[color:var(--divider)] p-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="success">{preview.will_create} se crearan</Badge>
        <Badge variant="muted">{preview.will_skip} existentes</Badge>
        <Badge variant={preview.errors ? "destructive" : "muted"}>
          {preview.errors} errores
        </Badge>
      </div>
      <ul className="mt-3 max-h-64 overflow-auto text-sm">
        {preview.rows.slice((page-1)*20,page*20).map((row) => (
          <li
            key={row.row}
            className="flex items-start justify-between gap-3 border-t border-[color:var(--divider)] py-2 first:border-t-0"
          >
            <div>
              <p className="font-semibold">
                Fila {row.row} - {row.name ?? row.email ?? "Sin nombre"}
              </p>
              <p className="text-xs text-muted-foreground">{row.message}</p>
            </div>
            <Badge variant={previewVariant(row.predicted_status)}>
              {previewLabel(row.predicted_status)}
            </Badge>
          </li>
        ))}
      </ul>
      <nav aria-label="Páginas de importación"><Button disabled={page<=1} onClick={()=>setPage(page-1)}>Anterior</Button><span>Página {page} de {Math.max(1,count)}</span><Button disabled={page>=count} onClick={()=>setPage(page+1)}>Siguiente</Button></nav>
    </div>
  );
}

function ImportResultPanel({ result }: { result: ImportStudentsResponse }) {
  const [page,setPage]=useState(1);
  const count=Math.ceil(result.results.length/20);
  return (
    <div className="rounded-xl border border-[color:var(--divider)] p-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="success">{result.created} creados</Badge>
        <Badge variant="muted">{result.skipped} omitidos</Badge>
        <Badge variant={result.errors ? "destructive" : "muted"}>
          {result.errors} errores
        </Badge>
      </div>
      <ul className="mt-3 max-h-64 overflow-auto text-sm">
        {result.results.slice((page-1)*20,page*20).map((row) => (
          <li
            key={`${row.row}-${row.email}`}
            className="border-t border-[color:var(--divider)] py-2 first:border-t-0"
          >
            <p className="font-semibold">
              Fila {row.row} - {row.email ?? "Sin correo"}
            </p>
            <p className="text-xs text-muted-foreground">{row.message}</p>
          </li>
        ))}
      </ul>
      <nav aria-label="Páginas de importación"><Button disabled={page<=1} onClick={()=>setPage(page-1)}>Anterior</Button><span>Página {page} de {Math.max(1,count)}</span><Button disabled={page>=count} onClick={()=>setPage(page+1)}>Siguiente</Button></nav>
    </div>
  );
}

function previewVariant(status: string) {
  if (status === "will_create") return "success";
  if (status === "will_skip") return "muted";
  return "destructive";
}

function previewLabel(status: string) {
  if (status === "will_create") return "Crear";
  if (status === "will_skip") return "Existe";
  return "Error";
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && " *"}
      </Label>
      <Input
        id={id}
        value={value}
        type={type}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
