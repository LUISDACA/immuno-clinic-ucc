"use client";
import { useSafeMutation as useMutation } from "@/lib/query/safe-mutation";
import { QueryError } from "@/components/query-error";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertCircle,
  Cake,
  GraduationCap,
  Hash,
  Heart,
  IdCard,
  Lock,
  Mail,
  Pencil,
  PhoneCall,
  Save,
  School,
  ShieldAlert,
  Stethoscope,
  User2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getMe, updateMyProfile } from "@/lib/api/users";
import { User } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState, PageHeader } from "@/components/page-header";
import { UccLogo } from "@/components/brand";
import { Alert } from "@/components/ui/alert";
import styles from "./student-profile.module.css";

export default function ProfilePage() {
  const { data: user, isFetching, error, refetch } = useQuery({
    queryKey: ["user", "me"],
    queryFn: getMe,
  });

  const retry = () => refetch({ cancelRefetch: false });
  if (!user) {
    if (error) return <QueryError error={error} retrying={isFetching} retry={retry} />;
    return <LoadingState />;
  }
  return <ProfileView key={user.id} user={user} readError={error} retrying={isFetching} retry={retry} />;
}

interface EditableState {
  phone: string;
  eps_affiliation: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

function ProfileView({ user, readError, retrying, retry }: {
  user: User;
  readError: unknown;
  retrying: boolean;
  retry: () => unknown;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmedReadVersion, setConfirmedReadVersion] = useState<number | null>(null);
  const [writeError, setWriteError] = useState(false);
  // A successful read increments this even when structural sharing keeps the
  // same User object. A later, unrelated failure must not reuse an old notice.
  const confirmedSave = confirmedReadVersion !== null &&
    queryClient.getQueryState(["user", "me"])?.dataUpdateCount === confirmedReadVersion;
  const p = user.profile;

  const [form, setForm] = useState<EditableState>({
    phone: p?.phone ?? "",
    eps_affiliation: p?.eps_affiliation ?? "",
    emergency_contact_name: p?.emergency_contact_name ?? "",
    emergency_contact_phone: p?.emergency_contact_phone ?? "",
  });

  const update = useMutation({
    affectedQueries: [["user", "me"]],
    mutationFn: () =>
      updateMyProfile({
        phone: form.phone.trim() || null,
        eps_affiliation: form.eps_affiliation.trim() || null,
        emergency_contact_name: form.emergency_contact_name.trim() || null,
        emergency_contact_phone: form.emergency_contact_phone.trim() || null,
      }),
    onMutate: () => { setWriteError(false); setConfirmedReadVersion(null); },
    onSuccess: () => {
      const read = queryClient.getQueryState(["user", "me"]);
      const failedRead = read?.status === "error";
      setConfirmedReadVersion(failedRead ? read.dataUpdateCount : null);
      if (failedRead) toast.warning("Los cambios se guardaron, pero no se pudo actualizar el perfil.");
      else toast.success("Perfil actualizado");
      setEditing(false);
    },
    onError: () => { setWriteError(true); toast.error("No se pudo guardar"); },
  });

  function startEdit() {
    setWriteError(false);
    setForm({
      phone: p?.phone ?? "",
      eps_affiliation: p?.eps_affiliation ?? "",
      emergency_contact_name: p?.emergency_contact_name ?? "",
      emergency_contact_phone: p?.emergency_contact_phone ?? "",
    });
    setEditing(true);
  }

  const fullName =
    [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() || user.email;
  const initials =
    fullName
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";
  const sexLabel =
    p?.sex === "male"
      ? "Masculino"
      : p?.sex === "female"
        ? "Femenino"
        : (p?.sex ?? "—");

  // Keep this view's draft/hooks mounted, but never render retained profile data
  // while a failed query is unresolved. Recovery reads never submit the form.
  if (readError) return <div className="flex flex-col gap-3">
    {confirmedSave && <p role="status">Los cambios se guardaron, pero no se pudo actualizar el perfil.</p>}
    {writeError && <p role="status">No se pudo guardar el perfil. Intenta nuevamente.</p>}
    <QueryError error={readError} retrying={retrying} retry={retry} />
  </div>;

  return (
    <div className={`flex flex-col gap-5 ${styles.profile}`}>
      {editing && writeError && <Alert tone="error">No se pudo guardar el perfil. Intenta nuevamente.</Alert>}
      <PageHeader
        title="Mi perfil"
        description="Datos personales y contacto."
        actions={
          !editing ? (
            <Button variant="outline" onClick={startEdit}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          ) : null
        }
      />

      {/* Hero del perfil */}
      <div className="ucc-brand-gradient relative overflow-hidden rounded-2xl p-6 text-white shadow-lg">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full border-[16px] border-white/20"
        />
        <div className={`relative flex items-center gap-5 ${styles.identity}`}>
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/30 bg-white/15 text-2xl font-extrabold">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-extrabold">{fullName}</p>
            <p className="flex items-start gap-1.5 text-sm text-white/85">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">{user.email}</span>
            </p>
          </div>
          <UccLogo size={60} className="hidden sm:block" />
        </div>
      </div>

      {!editing ? (
        // ── Vista normal ─────────────────────────────────────────────
        <div className={`grid gap-3 sm:grid-cols-2 ${styles.tiles}`}>
          <InfoTile
            icon={<IdCard className="h-5 w-5" />}
            label="Documento"
            value={p?.document_number}
          />
          <InfoTile
            icon={<Hash className="h-5 w-5" />}
            label="ID estudiantil"
            value={p?.student_id}
          />
          <InfoTile
            icon={<Cake className="h-5 w-5" />}
            label="Fecha de nacimiento"
            value={p?.birth_date ? formatDate(p.birth_date) : null}
          />
          <InfoTile
            icon={<User2 className="h-5 w-5" />}
            label="Sexo"
            value={sexLabel}
          />
          <InfoTile
            icon={<PhoneCall className="h-5 w-5" />}
            label="Teléfono"
            value={p?.phone}
          />
          <InfoTile
            icon={<Stethoscope className="h-5 w-5" />}
            label="EPS afiliado"
            value={p?.eps_affiliation}
          />
          <InfoTile
            icon={<Heart className="h-5 w-5" />}
            label="Contacto de emergencia"
            value={p?.emergency_contact_name}
          />
          <InfoTile
            icon={<ShieldAlert className="h-5 w-5" />}
            label="Tel. contacto de emergencia"
            value={p?.emergency_contact_phone}
          />
          <InfoTile
            icon={<GraduationCap className="h-5 w-5" />}
            label="Programa"
            value={p?.program}
          />
          <InfoTile
            icon={<School className="h-5 w-5" />}
            label="Sede"
            value={p?.campus}
          />
          <InfoTile
            icon={<Hash className="h-5 w-5" />}
            label="Semestre"
            value={p?.semester ? String(p.semester) : null}
          />
        </div>
      ) : (
        // ── Modo edición ────────────────────────────────────────────
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex items-start gap-2 p-3 text-sm text-muted-foreground">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--info)]" />
              <p>
                Los datos académicos y personales son administrados por la
                clínica. Solo puedes actualizar tu información de contacto.
              </p>
            </CardContent>
          </Card>

          <div className={`grid gap-3 sm:grid-cols-2 ${styles.tiles}`}>
            <LockedTile
              icon={<Mail className="h-5 w-5" />}
              label="Correo"
              value={user.email}
            />
            <LockedTile
              icon={<IdCard className="h-5 w-5" />}
              label="Documento"
              value={p?.document_number}
            />
            <LockedTile
              icon={<Hash className="h-5 w-5" />}
              label="ID estudiantil"
              value={p?.student_id}
            />
            <LockedTile
              icon={<Cake className="h-5 w-5" />}
              label="Fecha de nacimiento"
              value={p?.birth_date ? formatDate(p.birth_date) : null}
            />
            <LockedTile
              icon={<User2 className="h-5 w-5" />}
              label="Sexo"
              value={sexLabel}
            />
            <LockedTile
              icon={<GraduationCap className="h-5 w-5" />}
              label="Programa"
              value={p?.program}
            />
            <LockedTile
              icon={<School className="h-5 w-5" />}
              label="Sede"
              value={p?.campus}
            />
            <LockedTile
              icon={<Hash className="h-5 w-5" />}
              label="Semestre"
              value={p?.semester ? String(p.semester) : null}
            />
          </div>

          <Card>
            <CardContent className={`grid gap-4 p-5 sm:grid-cols-2 ${styles.fields}`}>
              <FieldInput
                disabled={update.isPending}
                icon={<PhoneCall className="h-4 w-4" />}
                label="Teléfono"
                type="tel"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
              <FieldInput
                disabled={update.isPending}
                icon={<Stethoscope className="h-4 w-4" />}
                label="EPS afiliado"
                value={form.eps_affiliation}
                onChange={(v) => setForm({ ...form, eps_affiliation: v })}
              />
              <FieldInput
                disabled={update.isPending}
                icon={<Heart className="h-4 w-4" />}
                label="Nombre contacto de emergencia"
                value={form.emergency_contact_name}
                onChange={(v) =>
                  setForm({ ...form, emergency_contact_name: v })
                }
              />
              <FieldInput
                disabled={update.isPending}
                icon={<ShieldAlert className="h-4 w-4" />}
                label="Teléfono contacto de emergencia"
                type="tel"
                value={form.emergency_contact_phone}
                onChange={(v) =>
                  setForm({ ...form, emergency_contact_phone: v })
                }
              />
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setEditing(false)}
              disabled={update.isPending}
            >
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={() => update.mutate()} disabled={update.isPending}>
              {update.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Guardando…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar cambios
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[color:var(--divider)] bg-card p-3.5 transition-colors hover:border-[color:var(--primary)]/40">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--primary)]/12 text-[color:var(--primary)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="font-semibold">{value || "No registrado"}</p>
      </div>
    </div>
  );
}

function LockedTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-variant)]/60 p-3.5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--brand-gray)]/15 text-[color:var(--brand-gray)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="font-semibold text-muted-foreground">
          {value || "No registrado"}
        </p>
      </div>
      <Lock
        className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground"
        aria-label="Bloqueado"
      />
    </div>
  );
}

function FieldInput({
  icon,
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={label} className="flex items-center gap-1.5 text-xs">
        <span className="text-[color:var(--primary)]">{icon}</span>
        {label}
      </Label>
      <Input
                id={label}
        disabled={disabled}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
