"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  VaccineCreateRequest,
  createVaccine,
  deactivateVaccine,
  listVaccines,
  reactivateVaccine,
} from "@/lib/api/admin";
import { AppliesTo, VaccineCatalogItem } from "@/lib/api/types";
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
import { Select } from "@/components/ui/select";

const EMPTY: VaccineCreateRequest = {
  name: "",
  code: "",
  base_doses: 1,
  has_booster: false,
  has_titer: false,
  has_titer_value: false,
  is_annual: false,
  applies_to: "all",
  display_order: 0,
};

export default function VaccineCatalogPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["vaccines"],
    queryFn: listVaccines,
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<VaccineCreateRequest>(EMPTY);

  const create = useMutation({
    mutationFn: () => createVaccine(form),
    onSuccess: () => {
      toast.success("Vacuna creada");
      setForm(EMPTY);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["vaccines"] });
    },
    onError: () => toast.error("No se pudo crear"),
  });

  const toggleActive = useMutation({
    mutationFn: (vaccine: VaccineCatalogItem) =>
      vaccine.is_active
        ? deactivateVaccine(vaccine.id)
        : reactivateVaccine(vaccine.id),
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["vaccines"] });
    },
    onError: () => toast.error("No se pudo actualizar"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Catálogo de vacunas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crear o desactivar vacunas. Los cambios regeneran los esquemas
            activos.
          </p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancelar" : "Crear vacuna"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nueva vacuna</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Nombre"
              required
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
            />
            <TextField
              label="Código (A-Z, 0-9, _)"
              required
              value={form.code}
              onChange={(v) =>
                setForm({ ...form, code: v.toUpperCase().replace(/[^A-Z0-9_]/g, "") })
              }
            />
            <TextField
              label="Dosis base"
              type="number"
              value={String(form.base_doses ?? 1)}
              onChange={(v) =>
                setForm({ ...form, base_doses: Math.max(1, Number(v) || 1) })
              }
            />
            <TextField
              label="Orden"
              type="number"
              value={String(form.display_order ?? 0)}
              onChange={(v) =>
                setForm({ ...form, display_order: Math.max(0, Number(v) || 0) })
              }
            />
            <div className="flex flex-col gap-1.5">
              <Label>Aplica a</Label>
              <Select
                value={form.applies_to}
                onChange={(e) =>
                  setForm({ ...form, applies_to: e.target.value as AppliesTo })
                }
              >
                <option value="all">Todos</option>
                <option value="female">Femenino</option>
                <option value="male">Masculino</option>
              </Select>
            </div>
            <div className="flex flex-col gap-2 text-sm sm:col-span-2">
              <CheckboxRow
                label="Tiene refuerzo"
                checked={!!form.has_booster}
                onChange={(c) => setForm({ ...form, has_booster: c })}
              />
              <CheckboxRow
                label="Permite titulación"
                checked={!!form.has_titer}
                onChange={(c) => setForm({ ...form, has_titer: c })}
              />
              <CheckboxRow
                label="Captura valor de titulación"
                checked={!!form.has_titer_value}
                onChange={(c) => setForm({ ...form, has_titer_value: c })}
              />
              <CheckboxRow
                label="Anual"
                checked={!!form.is_annual}
                onChange={(c) => setForm({ ...form, is_annual: c })}
              />
            </div>
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
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-left">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Dosis</th>
                    <th className="px-3 py-2">Aplica a</th>
                    <th className="px-3 py-2">Flags</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.map((v) => (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{v.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{v.code}</td>
                      <td className="px-3 py-2">{v.base_doses}</td>
                      <td className="px-3 py-2">{v.applies_to}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {v.has_booster && <Badge variant="muted">refuerzo</Badge>}
                          {v.has_titer && <Badge variant="muted">titulación</Badge>}
                          {v.is_annual && <Badge variant="muted">anual</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={v.is_active ? "success" : "muted"}>
                          {v.is_active ? "Activa" : "Inactiva"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleActive.mutate(v)}
                          disabled={toggleActive.isPending}
                        >
                          {v.is_active ? "Desactivar" : "Reactivar"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TextField({
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
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
