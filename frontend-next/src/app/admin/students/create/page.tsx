"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  createStudent,
  CreateStudentRequest,
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
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateStudentRequest>(INITIAL);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportStudentsResponse | null>(
    null,
  );

  const create = useMutation({
    mutationFn: () => createStudent(cleanPayload(form)),
    onSuccess: (user) => {
      toast.success("Estudiante creado");
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      router.replace(`/admin/students/${user.id}`);
    },
    onError: () => toast.error("No se pudo crear"),
  });

  const previewImport = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Selecciona un archivo");
      return previewStudentImport(file);
    },
    onSuccess: (data) => {
      setPreview(data);
      setImportResult(null);
      toast.success("Vista previa lista");
    },
    onError: () => toast.error("No se pudo leer el archivo"),
  });

  const runImport = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Selecciona un archivo");
      return importStudentsFile(file);
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      toast.success(`Importacion completa: ${data.created} creado(s)`);
    },
    onError: () => toast.error("No se pudo importar"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Crear estudiante</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea una cuenta manualmente o importa varios estudiantes desde Excel.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos basicos</CardTitle>
          <CardDescription>
            La contrasena temporal sera la cedula del estudiante.
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
            <Label>Sexo *</Label>
            <Select
              value={form.sex}
              onChange={(e) =>
                setForm({
                  ...form,
                  sex: e.target.value as "male" | "female" | "other",
                })
              }
            >
              <option value="female">Femenino</option>
              <option value="male">Masculino</option>
              <option value="other">Otro</option>
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
          <Field
            label="Programa"
            value={form.program ?? ""}
            onChange={(v) => setForm({ ...form, program: v })}
          />
          <Field
            label="Sede"
            value={form.campus ?? ""}
            onChange={(v) => setForm({ ...form, campus: v })}
          />
          <Field
            label="Semestre"
            type="number"
            value={form.semester ? String(form.semester) : ""}
            onChange={(v) =>
              setForm({ ...form, semester: v ? Number(v) : undefined })
            }
          />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importar desde Excel</CardTitle>
          <CardDescription>
            Usa el mismo archivo de estudiantes del celular. La cedula queda
            como contrasena temporal.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="student-import">Archivo Excel o CSV</Label>
            <Input
              id="student-import"
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setImportResult(null);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => previewImport.mutate()}
              disabled={!file || previewImport.isPending}
            >
              {previewImport.isPending ? "Revisando..." : "Ver vista previa"}
            </Button>
            <Button
              onClick={() => runImport.mutate()}
              disabled={!file || runImport.isPending || !preview}
            >
              {runImport.isPending ? "Importando..." : "Importar estudiantes"}
            </Button>
          </div>
          {preview && <ImportPreviewPanel preview={preview} />}
          {importResult && <ImportResultPanel result={importResult} />}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Creando..." : "Crear estudiante"}
        </Button>
        <Button variant="ghost" onClick={() => router.back()}>
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
        {preview.rows.slice(0, 30).map((row) => (
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
    </div>
  );
}

function ImportResultPanel({ result }: { result: ImportStudentsResponse }) {
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
        {result.results.slice(0, 40).map((row) => (
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
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required && " *"}
      </Label>
      <Input
        value={value}
        type={type}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
