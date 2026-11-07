"use client";
import { useSafeMutation as useMutation } from "@/lib/query/safe-mutation";
import { QueryError } from "@/components/query-error";

import { useMutation as useSignatureMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  getActiveAdminSignature,
  getActiveAdminSignatureImage,
  getMe,
  updateMyProfile,
  uploadAdminSignature,
} from "@/lib/api/users";
import { User } from "@/lib/api/types";
import { Alert } from "@/components/ui/alert";
import { useAuthStore } from "@/lib/auth/store";
import { isAppAdminRole } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState, PageHeader } from "@/components/page-header";
import { UccLogo } from "@/components/brand";

export default function AdminProfilePage() {
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["user", "me"],
    queryFn: getMe,
  });
  const retry = () => refetch({ cancelRefetch: false });
  if (!data) {
    if (error) return <QueryError error={error} retrying={isFetching} retry={retry} />;
    return <LoadingState />;
  }
  return <ProfileEditor key={data.id} user={data} readError={error} retrying={isFetching} retry={retry} />;
}

interface EditableState {
  first_name: string;
  last_name: string;
  job_title: string;
}

interface ProfileReadProps {
  user: User;
  readError: unknown;
  retrying: boolean;
  retry: () => unknown;
}

// Preserve only the base editor during failed reads. ProfileView (including the
// unchanged signature section) still unmounts on a read error, as before.
function ProfileEditor({ user, readError, retrying, retry }: ProfileReadProps) {
  const queryClient = useQueryClient();
  const mounted = useRef(true);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [writeError, setWriteError] = useState(false);
  const [confirmedReadVersion, setConfirmedReadVersion] = useState<number | null>(null);
  const p = user.profile;
  const [form, setForm] = useState<EditableState>({
    first_name: p?.first_name ?? "",
    last_name: p?.last_name ?? "",
    job_title: p?.job_title ?? "",
  });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const confirmedSave = confirmedReadVersion !== null &&
    queryClient.getQueryState(["user", "me"])?.dataUpdateCount === confirmedReadVersion;
  const update = useMutation({
    affectedQueries: [["user", "me"]],
    mutationFn: (payload: Parameters<typeof updateMyProfile>[0]) => updateMyProfile(payload),
    onMutate: () => {
      if (!mounted.current) return;
      setWriteError(false);
      setConfirmedReadVersion(null);
    },
    onSuccess: () => {
      if (!mounted.current) return;
      const read = queryClient.getQueryState(["user", "me"]);
      const failedRead = read?.status === "error";
      setConfirmedReadVersion(failedRead ? read.dataUpdateCount : null);
      if (failedRead) toast.warning("Los cambios se guardaron, pero no se pudo actualizar el perfil.");
      else toast.success("Perfil actualizado");
      setEditing(false);
    },
    onError: () => {
      if (!mounted.current) return;
      setWriteError(true);
      toast.error("No se pudo guardar");
    },
  });

  async function save() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const payload = {
      first_name: form.first_name || undefined,
      last_name: form.last_name || undefined,
      job_title: form.job_title.trim() || null,
    };
    try { await update.mutateAsync(payload); }
    catch { /* The mutation presents a safe error; no transport details. */ }
    finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function startEdit() {
    if (busyRef.current) return;
    setWriteError(false);
    setForm({ first_name: p?.first_name ?? "", last_name: p?.last_name ?? "", job_title: p?.job_title ?? "" });
    setEditing(true);
  }

  if (readError) return <div className="flex flex-col gap-3">
    {confirmedSave && <p role="status">Los cambios se guardaron, pero no se pudo actualizar el perfil.</p>}
    {writeError && <p role="status">No se pudo guardar el perfil. Intenta nuevamente.</p>}
    <QueryError error={readError} retrying={retrying} retry={retry} />
  </div>;

  return <ProfileView user={user} editing={editing} form={form} busy={busy}
    writeError={writeError} setForm={setForm} startEdit={startEdit} save={() => { void save(); }}
    cancelEdit={() => { if (!busyRef.current) { setWriteError(false); setEditing(false); } }} />;
}

interface ProfileViewProps {
  user: User;
  editing: boolean;
  form: EditableState;
  busy: boolean;
  writeError: boolean;
  setForm: (value: EditableState) => void;
  startEdit: () => void;
  save: () => void;
  cancelEdit: () => void;
}

function ProfileView({ user, editing, form, busy, writeError, setForm, startEdit, save, cancelEdit }: ProfileViewProps) {
  const queryClient = useQueryClient();
  const { role } = useAuthStore();
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [signatureImageError, setSignatureImageError] = useState<unknown>(null);
  const [signatureImageAttempt, setSignatureImageAttempt] = useState(0);
  const p = user.profile;
  const signatureQuery = useQuery({
    queryKey: ["admin-signature", user.id],
    queryFn: getActiveAdminSignature,
    enabled: role === "admin",
  });
  useEffect(() => {
    if (role !== "admin" || !signatureQuery.data) return;
    let objectUrl: string | null = null;
    let alive = true;
    void getActiveAdminSignatureImage().then((blob) => {
      if (!alive) return;
      objectUrl = URL.createObjectURL(blob);
      setSignatureImageError(null);
      setSignaturePreview(objectUrl);
    }).catch((error: unknown) => {
      if (!alive) return;
      setSignaturePreview(null);
      setSignatureImageError(error);
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [role, signatureQuery.data, signatureImageAttempt]);
  const signatureUpload = useSignatureMutation({
    mutationFn: uploadAdminSignature,
    onSuccess: () => {
      toast.success("Firma guardada");
      queryClient.invalidateQueries({ queryKey: ["admin-signature", user.id] });
    },
    onError: () => toast.error("No se pudo validar o guardar la firma"),
  });

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
      {editing && writeError && <Alert tone="error">No se pudo guardar el perfil. Intenta nuevamente.</Alert>}
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
            <p className="break-words text-xl font-extrabold">{fullName}</p>
            <p className="flex min-w-0 items-start gap-1.5 text-sm text-white/85">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 break-words">{user.email}</span>
            </p>
            {p?.job_title && (
              <p className="mt-0.5 break-words text-sm font-semibold text-white/90">
                {p.job_title}
              </p>
            )}
          </div>
          <UccLogo size={60} className="hidden sm:block" />
        </div>
      </div>

      {role === "admin" && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <div>
              <h2 className="font-semibold">Firma visual para certificados</h2>
              <p className="text-sm text-muted-foreground">
                PNG, JPG o WebP; máximo 2 MiB, 8 megapíxeles y 4096 px por lado. Cada certificado conserva la versión usada.
              </p>
            </div>
            {signatureQuery.error && <QueryError error={signatureQuery.error} retry={signatureQuery.refetch} />}
            {signatureQuery.isLoading ? <p className="text-sm">Cargando firma…</p> : null}
            {!!signatureImageError && <QueryError error={signatureImageError} retry={() => {
              setSignatureImageError(null);
              setSignaturePreview(null);
              setSignatureImageAttempt(value => value + 1);
            }} />}
            {signatureQuery.data && !signaturePreview && !signatureImageError && <p>Cargando vista previa…</p>}
            {signaturePreview ? (
              // Authenticated blob URL is revoked when this preview changes or unmounts.
              <Image src={signaturePreview} alt="Vista previa de la firma activa" width={288} height={96} unoptimized className="max-h-24 max-w-72 object-contain object-left" />
            ) : signatureQuery.data === null ? (
              <p className="text-sm text-muted-foreground">No hay una firma activa.</p>
            ) : null}
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Upload className="h-4 w-4" />
              {signatureUpload.isPending ? "Validando…" : signatureQuery.data ? "Reemplazar firma" : "Subir firma"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={signatureUpload.isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) signatureUpload.mutate(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </CardContent>
        </Card>
      )}

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
        <form className="flex flex-col gap-4" aria-label="Editar perfil" aria-busy={busy}
          onSubmit={(event) => { event.preventDefault(); save(); }}>
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
                disabled={busy}
                icon={<User2 className="h-4 w-4" />}
                label="Nombres"
                value={form.first_name}
                onChange={(v) => setForm({ ...form, first_name: v })}
              />
              <FieldInput
                disabled={busy}
                icon={<User2 className="h-4 w-4" />}
                label="Apellidos"
                value={form.last_name}
                onChange={(v) => setForm({ ...form, last_name: v })}
              />
              <div className="sm:col-span-2">
                <FieldInput
                disabled={busy}
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
              type="button"
              onClick={cancelEdit}
              disabled={busy}
            >
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? (
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
        </form>
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
        <p className="break-words font-semibold">{value || "No registrado"}</p>
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
        <p className="break-words font-semibold text-muted-foreground">
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
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={label} className="flex items-center gap-1.5 text-xs">
        <span className="text-[color:var(--primary)]">{icon}</span>
        {label}
      </Label>
      <Input id={label} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
