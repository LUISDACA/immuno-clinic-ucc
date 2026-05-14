"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  VaccineCreateRequest,
  VaccineUpdateRequest,
  createVaccine,
  deactivateVaccine,
  listVaccines,
  reactivateVaccine,
  updateVaccine,
} from "@/lib/api/admin";
import {
  AppliesTo,
  DoseType,
  VaccineCatalogItem,
  VaccineDoseConfigInput,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type FlagKey = "has_booster" | "has_titer" | "has_titer_value" | "is_annual";

const FLAG_LABELS: Record<FlagKey, string> = {
  has_booster: "Refuerzo",
  has_titer: "Titulación",
  has_titer_value: "Valor titer",
  is_annual: "Anual",
};

const APPLIES_TO_LABEL: Record<AppliesTo, string> = {
  all: "Ambos sexos",
  male: "Hombres",
  female: "Mujeres",
};

const DOSE_TYPE_LABEL: Record<DoseType, string> = {
  standard: "Estándar",
  booster: "Refuerzo",
  titer: "Titulación",
  annual: "Anual",
};

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; vaccine: VaccineCatalogItem }
  | { mode: "toggle"; vaccine: VaccineCatalogItem };

interface DraftForm {
  name: string;
  code: string;
  base_doses: number;
  has_booster: boolean;
  has_titer: boolean;
  has_titer_value: boolean;
  is_annual: boolean;
  applies_to: AppliesTo;
  display_order: number;
  dose_configs: VaccineDoseConfigInput[];
}

const EMPTY: DraftForm = {
  name: "",
  code: "",
  base_doses: 1,
  has_booster: false,
  has_titer: false,
  has_titer_value: false,
  is_annual: false,
  applies_to: "all",
  display_order: 0,
  dose_configs: [
    {
      dose_number: 1,
      label: "Primera dosis",
      is_required: true,
      applies_to: "all",
      dose_type: "standard",
    },
  ],
};

export default function VaccineCatalogPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["vaccines"],
    queryFn: listVaccines,
  });
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["vaccines"] });

  const toggle = useMutation({
    mutationFn: (vaccine: VaccineCatalogItem) =>
      vaccine.is_active
        ? deactivateVaccine(vaccine.id)
        : reactivateVaccine(vaccine.id),
    onSuccess: (_, vaccine) => {
      toast.success(
        vaccine.is_active ? "Vacuna desactivada" : "Vacuna reactivada",
      );
      setEditor({ mode: "closed" });
      refresh();
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
            Crea, edita o desactiva vacunas. Los cambios regeneran los esquemas
            de los estudiantes activos.
          </p>
        </div>
        <Button onClick={() => setEditor({ mode: "create" })}>
          + Nueva vacuna
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aún no hay vacunas en el catálogo.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((v) => (
            <VaccineRow
              key={v.id}
              vaccine={v}
              onEdit={() => setEditor({ mode: "edit", vaccine: v })}
              onToggle={() => setEditor({ mode: "toggle", vaccine: v })}
            />
          ))}
        </div>
      )}

      {(editor.mode === "create" || editor.mode === "edit") && (
        <VaccineEditorModal
          initial={editor.mode === "edit" ? editor.vaccine : null}
          onClose={() => setEditor({ mode: "closed" })}
          onSaved={() => {
            setEditor({ mode: "closed" });
            refresh();
          }}
        />
      )}

      {editor.mode === "toggle" && (
        <ConfirmToggleModal
          vaccine={editor.vaccine}
          loading={toggle.isPending}
          onCancel={() => setEditor({ mode: "closed" })}
          onConfirm={() => toggle.mutate(editor.vaccine)}
        />
      )}
    </div>
  );
}

function VaccineRow({
  vaccine,
  onEdit,
  onToggle,
}: {
  vaccine: VaccineCatalogItem;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const flags: FlagKey[] = [];
  if (vaccine.has_booster) flags.push("has_booster");
  if (vaccine.has_titer) flags.push("has_titer");
  if (vaccine.has_titer_value) flags.push("has_titer_value");
  if (vaccine.is_annual) flags.push("is_annual");

  const dosesCount = vaccine.dose_configs?.length ?? vaccine.base_doses;

  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            vaccine.is_active
              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
              : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
          )}
          aria-hidden
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="m18 2 4 4-2 2-3-3-3 3-2-2 3-3-3-3 2-2z" />
            <path d="m9 13 4 4-7 7-4-4z" />
            <path d="M14 8 9 13" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{vaccine.name}</p>
            {!vaccine.is_active && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                Inactiva
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{vaccine.code}</span>
            {" · "}
            {dosesCount} dosis
            {" · "}
            {APPLIES_TO_LABEL[vaccine.applies_to]}
          </p>
          {flags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {flags.map((flag) => (
                <FlagChip key={flag} label={FLAG_LABELS[flag]} />
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            title="Editar vacuna"
          >
            <span aria-hidden>✏️</span>
            <span className="ml-1 hidden sm:inline">Editar</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggle}
            title={vaccine.is_active ? "Desactivar" : "Reactivar"}
            className={cn(
              vaccine.is_active
                ? "text-green-700 hover:bg-green-100 hover:text-green-800 dark:text-green-400"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <span aria-hidden>{vaccine.is_active ? "🟢" : "⚪"}</span>
            <span className="ml-1 hidden sm:inline">
              {vaccine.is_active ? "Activa" : "Inactiva"}
            </span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FlagChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-foreground">
      {label}
    </span>
  );
}

function VaccineEditorModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: VaccineCatalogItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = initial !== null;
  const [form, setForm] = useState<DraftForm>(() => {
    if (!initial) return EMPTY;
    const configs: VaccineDoseConfigInput[] = (initial.dose_configs ?? []).map(
      (d) => ({
        dose_number: d.dose_number,
        label: d.label,
        is_required: d.is_required,
        applies_to: d.applies_to,
        dose_type: d.dose_type,
      }),
    );
    return {
      name: initial.name,
      code: initial.code,
      base_doses: initial.base_doses,
      has_booster: initial.has_booster,
      has_titer: initial.has_titer,
      has_titer_value: initial.has_titer_value,
      is_annual: initial.is_annual,
      applies_to: initial.applies_to,
      display_order: initial.display_order,
      dose_configs: configs.length
        ? configs
        : [
            {
              dose_number: 1,
              label: "Primera dosis",
              is_required: true,
              applies_to: "all",
              dose_type: "standard",
            },
          ],
    };
  });

  const save = useMutation({
    mutationFn: () => {
      const payload: VaccineCreateRequest = {
        name: form.name,
        code: form.code,
        base_doses: form.base_doses,
        has_booster: form.has_booster,
        has_titer: form.has_titer,
        has_titer_value: form.has_titer_value,
        is_annual: form.is_annual,
        applies_to: form.applies_to,
        display_order: form.display_order,
        dose_configs: form.dose_configs,
      };
      if (isEdit && initial) {
        const update: VaccineUpdateRequest = {
          name: payload.name,
          base_doses: payload.base_doses,
          has_booster: payload.has_booster,
          has_titer: payload.has_titer,
          has_titer_value: payload.has_titer_value,
          is_annual: payload.is_annual,
          applies_to: payload.applies_to,
          display_order: payload.display_order,
          dose_configs: payload.dose_configs,
        };
        return updateVaccine(initial.id, update);
      }
      return createVaccine(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Vacuna actualizada" : "Vacuna creada");
      onSaved();
    },
    onError: () => toast.error("No se pudo guardar"),
  });

  const updateDose = (idx: number, patch: Partial<VaccineDoseConfigInput>) => {
    setForm((f) => ({
      ...f,
      dose_configs: f.dose_configs.map((d, i) =>
        i === idx ? { ...d, ...patch } : d,
      ),
    }));
  };

  const addDose = () => {
    setForm((f) => {
      const nextNumber =
        Math.max(0, ...f.dose_configs.map((d) => d.dose_number)) + 1;
      return {
        ...f,
        dose_configs: [
          ...f.dose_configs,
          {
            dose_number: nextNumber,
            label: `Dosis ${nextNumber}`,
            is_required: true,
            applies_to: "all",
            dose_type: "standard",
          },
        ],
      };
    });
  };

  const removeDose = (idx: number) => {
    setForm((f) => ({
      ...f,
      dose_configs: f.dose_configs.filter((_, i) => i !== idx),
    }));
  };

  return (
    <Overlay onClose={onClose}>
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#244247] bg-[#24292c] p-5 text-[#eaf7f7] shadow-2xl [&_input]:h-11 [&_input]:rounded-xl [&_input]:border-[#2d4f55] [&_input]:bg-[#0e2023] [&_input]:px-4 [&_input]:text-sm [&_input]:shadow-none [&_input]:placeholder:text-[#a8bfc2] [&_label]:text-xs [&_label]:font-medium [&_label]:text-[#a8bfc2] [&_select]:h-11 [&_select]:rounded-xl [&_select]:border-[#2d4f55] [&_select]:bg-[#0e2023] [&_select]:px-4 [&_select]:text-sm [&_select]:shadow-none">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold leading-tight tracking-normal">
            {isEdit ? "Editar vacuna" : "Nueva vacuna"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-10 w-10 place-items-center rounded-full text-[#45d2df] hover:bg-[#45d2df]/10"
          >
            ✕
          </button>
        </div>

        {isEdit && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            Al guardar se regenerará el esquema de todos los estudiantes
            activos. Las fechas aplicadas se preservan para las dosis cuyo
            número se mantenga.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nombre"
            required
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
          />
          <Field
            label="Código (A-Z, 0-9, _)"
            required
            disabled={isEdit}
            value={form.code}
            onChange={(v) =>
              setForm({
                ...form,
                code: v.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
              })
            }
            helperText={isEdit ? "No se puede cambiar después de crear" : undefined}
          />
          <Field
            label="Dosis base"
            type="number"
            value={String(form.base_doses)}
            onChange={(v) =>
              setForm({ ...form, base_doses: Math.max(1, Number(v) || 1) })
            }
          />
          <Field
            label="Orden visual"
            type="number"
            value={String(form.display_order)}
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
              <option value="all">Ambos sexos</option>
              <option value="female">Mujeres</option>
              <option value="male">Hombres</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Características</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FLAG_LABELS) as FlagKey[]).map((flag) => (
                <ToggleChip
                  key={flag}
                  label={FLAG_LABELS[flag]}
                  selected={Boolean(form[flag])}
                  onToggle={() => setForm({ ...form, [flag]: !form[flag] })}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Dosis */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">
              Dosis ({form.dose_configs.length})
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={addDose}
              className="text-sm text-[#45d2df] hover:bg-[#45d2df]/10"
            >
              <Plus className="h-4 w-4" aria-hidden />
              <span className="ml-1">Agregar</span>
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {form.dose_configs.map((dose, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-[#d8e2e3]/80 bg-transparent p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="flex flex-1 flex-col gap-3 sm:grid sm:grid-cols-[80px_1fr] sm:items-end">
                    <Field
                      label="N°"
                      type="number"
                      value={String(dose.dose_number)}
                      onChange={(v) =>
                        updateDose(idx, {
                          dose_number: Math.max(1, Number(v) || 1),
                        })
                      }
                    />
                    <Field
                      label="Etiqueta"
                      value={dose.label}
                      onChange={(v) => updateDose(idx, { label: v })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDose(idx)}
                    title="Eliminar dosis"
                    className="mt-5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#c94242] hover:bg-[#c94242]/10"
                  >
                    🗑️
                  </button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Tipo</Label>
                    <Select
                      value={dose.dose_type}
                      onChange={(e) =>
                        updateDose(idx, {
                          dose_type: e.target.value as DoseType,
                        })
                      }
                    >
                      <option value="standard">{DOSE_TYPE_LABEL.standard}</option>
                      <option value="booster">{DOSE_TYPE_LABEL.booster}</option>
                      <option value="titer">{DOSE_TYPE_LABEL.titer}</option>
                      <option value="annual">{DOSE_TYPE_LABEL.annual}</option>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Aplica a</Label>
                    <Select
                      value={dose.applies_to}
                      onChange={(e) =>
                        updateDose(idx, {
                          applies_to: e.target.value as AppliesTo,
                        })
                      }
                    >
                      <option value="all">Ambos sexos</option>
                      <option value="female">Mujeres</option>
                      <option value="male">Hombres</option>
                    </Select>
                  </div>
                </div>
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="!h-5 !w-5 accent-[#45d2df]"
                    checked={dose.is_required}
                    onChange={(e) =>
                      updateDose(idx, { is_required: e.target.checked })
                    }
                  />
                  <span>Requerida para certificación</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-[#45d2df] hover:bg-[#45d2df]/10"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="bg-[#007f93] text-white hover:bg-[#00afc6]"
          >
            {save.isPending
              ? "Guardando…"
              : isEdit
                ? "Guardar cambios"
                : "Crear"}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

function ConfirmToggleModal({
  vaccine,
  loading,
  onCancel,
  onConfirm,
}: {
  vaccine: VaccineCatalogItem;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const willDeactivate = vaccine.is_active;
  return (
    <Overlay onClose={onCancel}>
      <div className="w-full max-w-md rounded-lg border bg-background p-5 shadow-lg">
        <h2 className="mb-2 text-lg font-semibold">
          {willDeactivate ? "Desactivar vacuna" : "Reactivar vacuna"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {willDeactivate
            ? `Al desactivar "${vaccine.name}" se eliminará del esquema de los estudiantes activos. ¿Continuar?`
            : `Al reactivar "${vaccine.name}" se asignará al esquema de los estudiantes activos. ¿Continuar?`}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant={willDeactivate ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading
              ? "Aplicando…"
              : willDeactivate
                ? "Desactivar"
                : "Reactivar"}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#02090a]/85 p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl">
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  disabled,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
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
        disabled={disabled}
      />
      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}

function ToggleChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm font-bold transition-colors",
        selected
          ? "border-[#2d4f55] bg-[#0e3a3f] text-[#eaf7f7]"
          : "border-[#2d4f55] bg-[#0e2023] text-[#eaf7f7] hover:bg-[#142d31]",
      )}
    >
      {label}
    </button>
  );
}
