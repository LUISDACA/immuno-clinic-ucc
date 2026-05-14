"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  CreateAdminRequest,
  createAdmin,
  deleteAdmin,
  listAdmins,
} from "@/lib/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPTY: CreateAdminRequest = {
  email: "",
  password: "",
  program: "",
  campus: "",
};

export default function AdminManagementPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admins"],
    queryFn: listAdmins,
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateAdminRequest>(EMPTY);

  const create = useMutation({
    mutationFn: () => createAdmin(form),
    onSuccess: () => {
      toast.success("Administrador creado");
      setForm(EMPTY);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: () => toast.error("No se pudo crear"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAdmin(id),
    onSuccess: () => {
      toast.success("Administrador eliminado");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administradores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuentas con permisos de administración por programa y sede.
          </p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancelar" : "Crear admin"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nuevo administrador</CardTitle>
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
              label="Contraseña"
              type="password"
              required
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
            />
            <Field
              label="Nombres"
              value={form.first_name ?? ""}
              onChange={(v) => setForm({ ...form, first_name: v })}
            />
            <Field
              label="Apellidos"
              value={form.last_name ?? ""}
              onChange={(v) => setForm({ ...form, last_name: v })}
            />
            <Field
              label="Cargo"
              value={form.job_title ?? ""}
              onChange={(v) => setForm({ ...form, job_title: v })}
            />
            <Field
              label="Programa"
              required
              value={form.program}
              onChange={(v) => setForm({ ...form, program: v })}
            />
            <Field
              label="Sede"
              required
              value={form.campus}
              onChange={(v) => setForm({ ...form, campus: v })}
            />
            <div className="sm:col-span-2">
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? "Creando…" : "Crear"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-destructive">No se pudieron cargar.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-left">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Programa</th>
                    <th className="px-3 py-2">Sede</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.map((a) => {
                    const name = a.profile
                      ? `${a.profile.first_name} ${a.profile.last_name}`.trim()
                      : "—";
                    return (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">{name}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {a.email}
                        </td>
                        <td className="px-3 py-2">{a.profile?.program ?? "—"}</td>
                        <td className="px-3 py-2">{a.profile?.campus ?? "—"}</td>
                        <td className="px-3 py-2">
                          <Badge variant={a.is_active ? "success" : "muted"}>
                            {a.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("¿Eliminar administrador?")) {
                                remove.mutate(a.id);
                              }
                            }}
                          >
                            Eliminar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
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
