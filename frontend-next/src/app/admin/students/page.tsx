"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, FileSpreadsheet, Users } from "lucide-react";
import { toast } from "sonner";
import {
  downloadStudentsExport,
  listAllStudents,
  ListStudentsParams,
} from "@/lib/api/admin";
import { AdminStudentListItem } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  DataState,
  PageSurface,
  PageToolbar,
  RetryButton,
  SkeletonCard,
} from "@/components/ui/page";

interface Filters {
  search: string;
  is_active: string;
  vaccination_status: string;
  semester: string;
  sex: string;
}

const EMPTY_FILTERS: Filters = {
  search: "",
  is_active: "",
  vaccination_status: "",
  semester: "",
  sex: "",
};

export default function AdminStudentsPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [exporting, setExporting] = useState(false);

  const params: Omit<ListStudentsParams, "page" | "page_size"> = {
    search: filters.search || undefined,
    is_active:
      filters.is_active === "true"
        ? true
        : filters.is_active === "false"
          ? false
          : undefined,
    vaccination_status: (filters.vaccination_status || undefined) as
      | "approved"
      | "pending"
      | undefined,
    semester: filters.semester ? Number(filters.semester) : undefined,
    sex: (filters.sex || undefined) as "male" | "female" | "other" | undefined,
  };

  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["admin", "students", "grouped", params],
    queryFn: () => listAllStudents(params),
  });

  const groups = useMemo(() => groupBySemester(data ?? []), [data]);

  async function onExport() {
    setExporting(true);
    const toastId = toast.loading("Preparando descarga...");
    try {
      await downloadStudentsExport(params, {
        onProgress: (progress) =>
          toast.loading(
            progress == null
              ? "Descargando reporte..."
              : `Descargando reporte ${progress}%`,
            { id: toastId },
          ),
      });
      toast.success("Reporte descargado", { id: toastId });
    } catch {
      toast.error("No se pudo exportar", { id: toastId });
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageSurface>
      <PageToolbar
        title="Estudiantes"
        description="Listado agrupado por semestre con filtros rapidos."
        actions={
          <>
          <Button variant="outline" onClick={onExport} disabled={exporting}>
            <FileSpreadsheet className="h-4 w-4" />
            {exporting ? "Exportando..." : "Exportar CSV"}
          </Button>
          <Link href="/admin/students/create">
            <Button>Crear o importar</Button>
          </Link>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Buscar">
            <Input
              value={filters.search}
              placeholder="Nombre, email..."
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
            />
          </Field>
          <Field label="Estado">
            <Select
              value={filters.is_active}
              onChange={(e) =>
                setFilters({ ...filters, is_active: e.target.value })
              }
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </Select>
          </Field>
          <Field label="Esquema">
            <Select
              value={filters.vaccination_status}
              onChange={(e) =>
                setFilters({ ...filters, vaccination_status: e.target.value })
              }
            >
              <option value="">Todos</option>
              <option value="approved">Aprobado</option>
              <option value="pending">Pendiente</option>
            </Select>
          </Field>
          <Field label="Semestre">
            <Select
              value={filters.semester}
              onChange={(e) =>
                setFilters({ ...filters, semester: e.target.value })
              }
            >
              <option value="">Todos</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sexo">
            <Select
              value={filters.sex}
              onChange={(e) => setFilters({ ...filters, sex: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
              <option value="other">Otro</option>
            </Select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-3">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={4} />
          <SkeletonCard rows={4} />
        </div>
      ) : isError ? (
        <DataState
          type="error"
          title="No se pudo cargar la lista"
          description="Revisa la conexion con el servidor e intenta de nuevo."
          action={<RetryButton onClick={() => refetch()} />}
        />
      ) : groups.length === 0 ? (
        <DataState
          type="empty"
          title="Sin resultados"
          description="Ajusta los filtros o crea estudiantes desde Excel/CSV."
          action={
            <Link href="/admin/students/create">
              <Button size="sm">Crear o importar</Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group, index) => (
            <SemesterGroup
              key={group.key}
              group={group}
              defaultOpen={index === 0 || Boolean(filters.semester)}
            />
          ))}
        </div>
      )}
    </PageSurface>
  );
}

function SemesterGroup({
  group,
  defaultOpen,
}: {
  group: StudentSemesterGroup;
  defaultOpen: boolean;
}) {
  const approved = group.students.filter(
    (student) => student.vaccination_status === "approved",
  ).length;
  const pending = group.students.length - approved;

  return (
    <details
      className="group overflow-hidden rounded-xl border border-[color:var(--divider)] bg-card shadow-sm"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--primary)]/5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--primary)]/12 text-[color:var(--primary)]">
            <Users className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-bold">{group.label}</p>
            <p className="text-xs text-muted-foreground">
              {group.students.length} estudiante(s)
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="success">{approved} completos</Badge>
          <Badge variant={pending > 0 ? "warning" : "muted"}>
            {pending} pendientes
          </Badge>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>
      <div className="border-t border-[color:var(--divider)]">
        <div className="grid gap-2 p-3 md:hidden">
          {group.students.map((student) => (
            <StudentMobileCard key={student.id} student={student} />
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Programa</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Esquema</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {group.students.map((student) => (
                <StudentRow key={student.id} student={student} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

function StudentMobileCard({ student }: { student: AdminStudentListItem }) {
  const fullName = studentName(student) || "-";
  const complete = student.vaccination_status === "approved";

  return (
    <Link href={`/admin/students/${student.id}`} className="block">
      <div className="rounded-lg border border-[color:var(--divider)] bg-[color:var(--surface-variant)]/60 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{fullName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {student.email}
            </p>
          </div>
          <Badge variant={student.is_active ? "success" : "muted"}>
            {student.is_active ? "Activo" : "Inactivo"}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {student.profile?.program && (
            <span className="rounded-md bg-card px-2 py-1 text-muted-foreground">
              {student.profile.program}
            </span>
          )}
          <Badge variant={complete ? "success" : "warning"}>
            {complete ? "Completo" : "Pendiente"}
          </Badge>
        </div>
      </div>
    </Link>
  );
}

function StudentRow({ student }: { student: AdminStudentListItem }) {
  const fullName = student.profile
    ? `${student.profile.first_name} ${student.profile.last_name}`.trim()
    : "-";

  return (
    <tr className="border-t border-[color:var(--divider)] first:border-t-0">
      <td className="px-3 py-2 font-medium">{fullName}</td>
      <td className="px-3 py-2 text-muted-foreground">{student.email}</td>
      <td className="px-3 py-2 text-muted-foreground">
        {student.profile?.program ?? "-"}
      </td>
      <td className="px-3 py-2">
        <Badge variant={student.is_active ? "success" : "muted"}>
          {student.is_active ? "Activo" : "Inactivo"}
        </Badge>
      </td>
      <td className="px-3 py-2">
        <Badge
          variant={
            student.vaccination_status === "approved" ? "success" : "warning"
          }
        >
          {student.vaccination_status === "approved" ? "Completo" : "Pendiente"}
        </Badge>
      </td>
      <td className="px-3 py-2 text-right">
        <Link href={`/admin/students/${student.id}`}>
          <Button size="sm" variant="outline">
            Ver
          </Button>
        </Link>
      </td>
    </tr>
  );
}

interface StudentSemesterGroup {
  key: string;
  label: string;
  order: number;
  students: AdminStudentListItem[];
}

function groupBySemester(students: AdminStudentListItem[]): StudentSemesterGroup[] {
  const map = new Map<string, StudentSemesterGroup>();
  students.forEach((student) => {
    const semester = student.profile?.semester ?? null;
    const key = semester ? String(semester) : "none";
    const label = semester ? `Semestre ${semester}` : "Sin semestre";
    const order = semester ?? 999;
    const group = map.get(key) ?? { key, label, order, students: [] };
    group.students.push(student);
    map.set(key, group);
  });

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      students: group.students.sort((a, b) =>
        studentName(a).localeCompare(studentName(b), "es"),
      ),
    }))
    .sort((a, b) => a.order - b.order);
}

function studentName(student: AdminStudentListItem) {
  return student.profile
    ? `${student.profile.first_name} ${student.profile.last_name}`.trim()
    : student.email;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
