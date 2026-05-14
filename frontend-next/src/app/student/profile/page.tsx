"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export default function ProfilePage() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["user", "me"],
    queryFn: getMe,
  });

  if (isLoading || !user) return <LoadingState />;
  return <ProfileView key={user.id} user={user} />;
}

interface EditableState {
  phone: string;
  eps_affiliation: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

function ProfileView({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const p = user.profile;

  const [form, setForm] = useState<EditableState>({
    phone: p?.phone ?? "",
    eps_affiliation: p?.eps_affiliation ?? "",
    emergency_contact_name: p?.emergency_contact_name ?? "",
    emergency_contact_phone: p?.emergency_contact_phone ?? "",
  });

  const update = useMutation({
    mutationFn: () =>
      updateMyProfile({
        phone: form.phone || undefined,
        eps_affiliation: form.eps_affiliation || undefined,
        emergency_contact_name: form.emergency_contact_name || undefined,
        emergency_contact_phone: form.emergency_contact_phone || undefined,
      }),
    onSuccess: () => {
      toast.success("Perfil actualizado");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
    onError: () => toast.error("No se pudo guardar"),
  });

  function startEdit() {
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

  return (
    <div className="flex flex-col gap-5">
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
        <div className="relative flex items-center gap-5">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/30 bg-white/15 text-2xl font-extrabold">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-extrabold">{fullName}</p>
            <p className="flex items-center gap-1.5 text-sm text-white/85">
              <Mail className="h-3.5 w-3.5" />
              {user.email}
            </p>
          </div>
          <UccLogo size={60} className="hidden sm:block" />
        </div>
      </div>

      {!editing ? (
        // ── Vista normal ─────────────────────────────────────────────
        <div className="grid gap-3 sm:grid-cols-2">
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

          <div className="grid gap-3 sm:grid-cols-2">
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
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
              <FieldInput
                icon={<PhoneCall className="h-4 w-4" />}
                label="Teléfono"
                type="tel"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
              <FieldInput
                icon={<Stethoscope className="h-4 w-4" />}
                label="EPS afiliado"
                value={form.eps_affiliation}
                onChange={(v) => setForm({ ...form, eps_affiliation: v })}
              />
              <FieldInput
                icon={<Heart className="h-4 w-4" />}
                label="Nombre contacto de emergencia"
                value={form.emergency_contact_name}
                onChange={(v) =>
                  setForm({ ...form, emergency_contact_name: v })
                }
              />
              <FieldInput
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

          <div className="flex justify-end gap-2">
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
        <p className="truncate font-semibold">{value || "No registrado"}</p>
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
        <p className="truncate font-semibold text-muted-foreground">
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="flex items-center gap-1.5 text-xs">
        <span className="text-[color:var(--primary)]">{icon}</span>
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
