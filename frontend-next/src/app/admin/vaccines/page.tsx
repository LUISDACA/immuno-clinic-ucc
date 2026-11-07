"use client";
import { QueryError } from "@/components/query-error";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Plus, RefreshCw } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";
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
import { Modal } from "@/components/ui/modal";

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
  const { data, isLoading, isFetching, error, refetch } = useQuery({
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
  const accessDenied =
    isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Catálogo de vacunas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea, edita o desactiva vacunas. Los cambios regeneran los esquemas
            de los estudiantes activos.
          </p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {!error && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Actualizar catálogo"
              aria-label="Actualizar catálogo"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw aria-hidden className="h-4 w-4" />
            </Button>
          )}
          {!accessDenied && (
            <Button onClick={() => setEditor({ mode: "create" })}>
              + Nueva vacuna
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <QueryError error={error} retry={refetch} />
      ) : isLoading ? (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          Cargando…
        </p>
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
              onToggle={() => { toggle.reset(); setEditor({ mode: "toggle", vaccine: v }); }}
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
          error={toggle.isError}
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
              ? "bg-[color:var(--success-light)] text-[color:var(--success-text)]"
              : "bg-[color:var(--destructive-light)] text-[color:var(--destructive-text)]",
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
            <p className="min-w-0 break-words font-medium">{vaccine.name}</p>
            {!vaccine.is_active && (
              <span className="rounded-full bg-[color:var(--destructive-light)] px-2 py-0.5 text-xs font-medium text-[color:var(--destructive-text)]">
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
            aria-label={`Editar vacuna ${vaccine.name}`}
          >
            <span aria-hidden>✏️</span>
            <span className="ml-1 hidden sm:inline">Editar</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggle}
            title={vaccine.is_active ? "Desactivar" : "Reactivar"}
            aria-label={`${vaccine.is_active ? "Desactivar" : "Reactivar"} vacuna ${vaccine.name}`}
            className={cn(
              vaccine.is_active
                ? "text-[color:var(--success-text)] hover:bg-[color:var(--success-light)]"
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
  const titleId = useId();
  const appliesId = useId();
  const dosesRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const doseFocus = useRef<number | null>(null);
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
    doseFocus.current = form.dose_configs.length;
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
    doseFocus.current = Math.max(0, Math.min(idx, form.dose_configs.length - 2));
    setForm((f) => ({
      ...f,
      dose_configs: f.dose_configs.filter((_, i) => i !== idx),
    }));
  };

  useLayoutEffect(() => {
    const index = doseFocus.current;
    doseFocus.current = null;
    if (index === null) return;
    const row = dosesRef.current?.querySelectorAll('[data-dose-row]')[index];
    const input = row?.querySelector<HTMLInputElement>('input');
    (input ?? addRef.current)?.focus();
  }, [form.dose_configs]);

  return (
    <Modal onClose={onClose} titleId={titleId} busy={save.isPending} initialFocusSelector="input:not(:disabled)">
      <fieldset disabled={save.isPending} className="m-0 min-w-0 border-0 p-0">
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-xl font-semibold leading-tight tracking-normal">
            {isEdit ? "Editar vacuna" : "Nueva vacuna"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-10 w-10 place-items-center rounded-full text-[color:var(--interactive-foreground)] hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ✕
          </button>
        </div>

        {isEdit && (
          <div className="mb-4 rounded-md border border-warning/40 bg-[color:var(--warning-light)] p-3 text-sm text-[color:var(--warning-text)]">
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
            <Label htmlFor={appliesId}>Aplica a</Label>
            <Select
              id={appliesId}
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
          <fieldset className="min-w-0 sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium">Características</legend>
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
          </fieldset>
        </div>

        {/* Dosis */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">
              Dosis ({form.dose_configs.length})
            </h3>
            <Button
              ref={addRef}
              size="sm"
              variant="ghost"
              onClick={addDose}
              className="text-sm text-[color:var(--interactive-foreground)] hover:bg-primary/10"
            >
              <Plus className="h-4 w-4" aria-hidden />
              <span className="ml-1">Agregar</span>
            </Button>
          </div>
          <div ref={dosesRef} className="flex flex-col gap-3">
            {form.dose_configs.map((dose, idx) => (
              <div
                key={idx}
                data-dose-row
                role="group"
                aria-label={`Configuración de dosis ${idx + 1}`}
                className="rounded-lg border border-[color:var(--divider)] bg-transparent p-3"
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
                    aria-label={`Eliminar configuración de dosis ${idx + 1}`}
                    className="mt-5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--destructive-text)] hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    🗑️
                  </button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${titleId}-type-${idx}`} className="text-xs">Tipo</Label>
                    <Select
                      id={`${titleId}-type-${idx}`}
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
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${titleId}-applies-${idx}`} className="text-xs">Aplica a</Label>
                    <Select
                      id={`${titleId}-applies-${idx}`}
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
                    className="!h-5 !w-5 accent-primary"
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
            className="text-[color:var(--interactive-foreground)] hover:bg-primary/10"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending
              ? "Guardando…"
              : isEdit
                ? "Guardar cambios"
                : "Crear"}
          </Button>
        </div>
        {save.isError && <p role="alert" className="mt-3 text-sm text-[color:var(--destructive-text)]">No se pudo guardar. Intenta nuevamente.</p>}
      </fieldset>
    </Modal>
  );
}

function ConfirmToggleModal({
  vaccine,
  loading,
  error,
  onCancel,
  onConfirm,
}: {
  vaccine: VaccineCatalogItem;
  loading: boolean;
  error: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const willDeactivate = vaccine.is_active;
  const titleId = useId();
  const descriptionId = useId();
  return (
    <Modal onClose={onCancel} titleId={titleId} descriptionId={descriptionId} busy={loading} className="max-w-md rounded-lg">
      <fieldset disabled={loading} className="m-0 min-w-0 border-0 p-0">
        <h2 id={titleId} className="mb-2 text-lg font-semibold">
          {willDeactivate ? "Desactivar vacuna" : "Reactivar vacuna"}
        </h2>
        <p id={descriptionId} className="text-sm text-muted-foreground">
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
        {error && <p role="alert" className="mt-3 text-sm text-[color:var(--destructive-text)]">No se pudo actualizar. Intenta nuevamente.</p>}
      </fieldset>
    </Modal>
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
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && " *"}
      </Label>
      <Input
        id={id}
        aria-describedby={helperText ? `${id}-help` : undefined}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
      />
      {helperText && (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">{helperText}</p>
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
        "rounded-lg border px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-[color:var(--interactive-foreground)] bg-primary/10 text-[color:var(--interactive-foreground)]"
          : "border-[color:var(--divider)] bg-card text-foreground hover:bg-[color:var(--surface-variant)]",
      )}
    >
      {label}
    </button>
  );
}
