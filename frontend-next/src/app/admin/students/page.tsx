"use client";
import { Pagination } from "@/components/pagination";
import { usePrivateSearch, useDebounced } from "@/lib/ui/list-state";
import { QueryError } from "@/components/query-error";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { cloneElement, ReactElement, Suspense, createContext, useContext, useId, useMemo, useState } from "react";
import { ChevronDown, FileSpreadsheet, Users } from "lucide-react";
import { toast } from "sonner";
import {
  downloadStudentsExport,
  getAcademicOptions,
  listStudents,
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
  SkeletonCard,
} from "@/components/ui/page";

import { useRouter, useSearchParams } from "next/navigation";
import { studentListFilters, studentListUrl } from "@/lib/navigation";

const ListLocation = createContext("/admin/students");

interface Filters {
  search: string;
  is_active: string;
  vaccination_status: string;
  semester: string;
  sex: string;
  page: string;
  context?: string;
}

const EMPTY_FILTERS: Filters = {
  search: "",
  is_active: "",
  vaccination_status: "",
  semester: "",
  sex: "",
  page: "1",
};

export default function Page() { return <Suspense fallback={<p>Cargando…</p>}><StudentsFromUrl /></Suspense>; }
function StudentsFromUrl() {
  const params = useSearchParams();
  const initial = studentListFilters(params);
  return <AdminStudentsPage initial={initial} />;
}
function AdminStudentsPage({ initial }: { initial: Filters }) {
  const router = useRouter();
  const [search, setSearch, context] = usePrivateSearch("students");
  const debouncedSearch = useDebounced(search);
  const filters = { ...initial, search, context };
  const setFilters = (next: Filters, resetPage = true) => { const context=setSearch(next.search); router.push(studentListUrl({...next,context,page:resetPage ? "1" : next.page}), {scroll:false}); };
  const [exporting, setExporting] = useState(false);
  const academicOptions = useQuery({
    queryKey: ["academic-options"],
    queryFn: getAcademicOptions,
  });

  const params: Omit<ListStudentsParams, "page" | "page_size"> = {
    search: debouncedSearch || undefined,
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
    sex: (filters.sex || undefined) as "male" | "female" | undefined,
  };

  const { data, error, isError, isLoading, refetch } = useQuery({
    queryKey: ["admin", "students", "page", params, initial.page],
    queryFn: () => listStudents({...params, page:Number(initial.page), page_size:20}),
  });

  const groups = useMemo(() => groupBySemester(data?.items ?? []), [data]);

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
    <ListLocation.Provider value={studentListUrl(filters)}><PageSurface>
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
              aria-label="Buscar estudiantes"
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
              {academicOptions.data?.semesters.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              {filters.semester && !academicOptions.data?.semesters.includes(Number(filters.semester)) && (
                <option value={filters.semester}>Semestre actual ({filters.semester})</option>
              )}
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
        {academicOptions.isLoading && <p role="status" className="px-6 pb-4 text-sm text-muted-foreground">Cargando opciones académicas…</p>}
        {academicOptions.error && <div className="px-6 pb-4"><QueryError error={academicOptions.error} retry={() => academicOptions.refetch({ cancelRefetch: false })} retrying={academicOptions.isFetching} /></div>}
      </Card>

      <Pagination data={data} page={Number(initial.page)} onPage={page=>setFilters({...filters,page:String(page)},false)} refresh={refetch} busy={isLoading} />
      {isLoading ? (
        <div className="grid gap-3">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={4} />
          <SkeletonCard rows={4} />
        </div>
      ) : isError ? (
        <QueryError error={error} retry={refetch} />
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
    </PageSurface></ListLocation.Provider>
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
  const pending = group.students.filter(
    (student) =>
      student.vaccination_status === "pending" ||
      student.vaccination_status === "in_review",
  ).length;
  const denied = group.students.filter(
    (student) => student.vaccination_status === "denied",
  ).length;

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
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <Badge variant="success">{approved} aprobados</Badge>
          <Badge variant={pending > 0 ? "warning" : "muted"}>
            {pending} pendientes
          </Badge>
          <Badge variant={denied > 0 ? "destructive" : "muted"}>
            {denied} denegados
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
  const returnTo = useContext(ListLocation);
  const fullName = studentName(student) || "-";
  const status = studentStatus(student.vaccination_status);

  return (
    <Link href={`/admin/students/${student.id}?returnTo=${encodeURIComponent(returnTo)}`} className="block">
      <div className="rounded-lg border border-[color:var(--divider)] bg-[color:var(--surface-variant)]/60 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words text-sm font-bold">{fullName}</p>
            <p className="break-words text-xs text-muted-foreground">
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
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
      </div>
    </Link>
  );
}

function StudentRow({ student }: { student: AdminStudentListItem }) {
  const returnTo = useContext(ListLocation);
  const fullName = student.profile
    ? `${student.profile.first_name} ${student.profile.last_name}`.trim()
    : "-";
  const status = studentStatus(student.vaccination_status);

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
        <Badge variant={status.variant}>{status.label}</Badge>
      </td>
      <td className="px-3 py-2 text-right">
        <Link href={`/admin/students/${student.id}?returnTo=${encodeURIComponent(returnTo)}`}>
          <Button size="sm" variant="outline">
            Ver
          </Button>
        </Link>
      </td>
    </tr>
  );
}

function studentStatus(status: AdminStudentListItem["vaccination_status"]) {
  switch (status) {
    case "approved":
      return { label: "Aprobado", variant: "success" as const };
    case "denied":
      return { label: "Denegado", variant: "destructive" as const };
    case "pending":
    case "in_review":
      return { label: "Pendiente", variant: "warning" as const };
  }
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

function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, { id })}
    </div>
  );
}
