"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertCircle,
  Briefcase,
  GraduationCap,
  Lock,
  Mail,
  Pencil,
  Save,
  School,
  ShieldCheck,
  User2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getMe, updateMyProfile } from "@/lib/api/users";
import { User } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/store";
import { isAppAdminRole } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState, PageHeader } from "@/components/page-header";
import { UccLogo } from "@/components/brand";

export default function AdminProfilePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["user", "me"],
    queryFn: getMe,
  });
  if (isLoading || !data) return <LoadingState />;
  return <ProfileView key={data.id} user={data} />;
}

interface EditableState {
  first_name: string;
  last_name: string;
  job_title: string;
}

function ProfileView({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const { role } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const p = user.profile;

  const [form, setForm] = useState<EditableState>({
    first_name: p?.first_name ?? "",
    last_name: p?.last_name ?? "",
    job_title: p?.job_title ?? "",
  });

  const update = useMutation({
    mutationFn: () =>
      updateMyProfile({
        first_name: form.first_name || undefined,
        last_name: form.last_name || undefined,
        job_title: form.job_title || undefined,
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
      first_name: p?.first_name ?? "",
      last_name: p?.last_name ?? "",
      job_title: p?.job_title ?? "",
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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Mi perfil"
        description={
          isAppAdminRole(role) ? "Administrador de aplicación" : "Administrador"
        }
        actions={
          !editing ? (
            <Button variant="outline" onClick={startEdit}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          ) : null
        }
      />

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
            {p?.job_title && (
              <p className="mt-0.5 text-sm font-semibold text-white/90">
                {p.job_title}
              </p>
            )}
          </div>
          <UccLogo size={60} className="hidden sm:block" />
        </div>
      </div>

      {!editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoTile
            icon={<Mail className="h-5 w-5" />}
            label="Correo"
            value={user.email}
          />
          <InfoTile
            icon={<Briefcase className="h-5 w-5" />}
            label="Cargo"
            value={p?.job_title}
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
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Rol"
            value={
              isAppAdminRole(role)
                ? "Admin de aplicación"
                : "Administrador"
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex items-start gap-2 p-3 text-sm text-muted-foreground">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--info)]" />
              <p>
                El correo, programa y sede son administrados por la
                aplicación. Solo puedes actualizar tu nombre y cargo.
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
              icon={<GraduationCap className="h-5 w-5" />}
              label="Programa"
              value={p?.program}
            />
            <LockedTile
              icon={<School className="h-5 w-5" />}
              label="Sede"
              value={p?.campus}
            />
          </div>

          <Card>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
              <FieldInput
                icon={<User2 className="h-4 w-4" />}
                label="Nombres"
                value={form.first_name}
                onChange={(v) => setForm({ ...form, first_name: v })}
              />
              <FieldInput
                icon={<User2 className="h-4 w-4" />}
                label="Apellidos"
                value={form.last_name}
                onChange={(v) => setForm({ ...form, last_name: v })}
              />
              <div className="sm:col-span-2">
                <FieldInput
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Cargo"
                  value={form.job_title}
                  onChange={(v) => setForm({ ...form, job_title: v })}
                />
              </div>
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="flex items-center gap-1.5 text-xs">
        <span className="text-[color:var(--primary)]">{icon}</span>
        {label}
      </Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
