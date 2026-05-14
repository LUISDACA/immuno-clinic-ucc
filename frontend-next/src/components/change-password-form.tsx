"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound } from "lucide-react";
import { isAxiosError } from "axios";
import { changePassword } from "@/lib/auth/api";
import { useAuthStore } from "@/lib/auth/store";
import { isAdminRole } from "@/lib/config";
import {
  passwordRequirementsText,
  validateStrongPassword,
} from "@/lib/password";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export function ChangePasswordForm() {
  const router = useRouter();
  const { role, mustChangePassword, markPasswordChanged } = useAuthStore();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    current?: string;
    next?: string;
    confirm?: string;
  }>({});

  function validate() {
    const e: typeof errors = {};
    if (!current) e.current = "Requerido";
    const nextErr = validateStrongPassword(next);
    if (nextErr) e.next = nextErr;
    if (confirm !== next) e.confirm = "Las contraseñas no coinciden";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await changePassword(current, next);
      markPasswordChanged();
      setSuccess(true);
    } catch (err) {
      if (isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (typeof detail === "string") {
          setError(detail);
        } else if (err.response?.status === 401) {
          setError("La contraseña actual no es correcta.");
        } else {
          setError("Error al cambiar contraseña.");
        }
      } else {
        setError("Error al cambiar contraseña.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--success-light)]">
            <CheckCircle2 className="h-12 w-12 text-[color:var(--success)]" />
          </div>
          <h2 className="text-xl font-extrabold">Contraseña actualizada</h2>
          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              router.replace(isAdminRole(role) ? "/admin" : "/student")
            }
          >
            Volver
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--primary)]/12 text-[color:var(--primary)]">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">
              {mustChangePassword
                ? "Cambio obligatorio de contraseña"
                : "Cambiar contraseña"}
            </CardTitle>
            <CardDescription>
              Por seguridad, define una contraseña nueva.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {mustChangePassword && (
          <div className="mb-4">
            <Alert tone="warning">
              Tu contraseña temporal es tu cédula. Debes cambiarla antes de continuar.
            </Alert>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current">Contraseña actual</Label>
            <PasswordInput
              id="current"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              aria-invalid={!!errors.current}
            />
            {errors.current && (
              <p className="text-xs text-[color:var(--destructive)]">
                {errors.current}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="next">Nueva contraseña</Label>
            <PasswordInput
              id="next"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              aria-invalid={!!errors.next}
            />
            <p className="text-xs text-muted-foreground">
              {passwordRequirementsText}
            </p>
            {errors.next && (
              <p className="text-xs text-[color:var(--destructive)]">
                {errors.next}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm">Confirmar nueva contraseña</Label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={!!errors.confirm}
            />
            {errors.confirm && (
              <p className="text-xs text-[color:var(--destructive)]">
                {errors.confirm}
              </p>
            )}
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Guardando…
              </>
            ) : (
              "Cambiar contraseña"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
