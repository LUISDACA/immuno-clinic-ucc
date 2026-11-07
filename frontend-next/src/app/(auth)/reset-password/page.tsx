"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { accountFormError } from "@/lib/ui/account-form-error";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, KeyRound } from "lucide-react";
import { resetPassword } from "@/lib/auth/api";
import {
  passwordRequirementsText,
  validateStrongPassword,
} from "@/lib/password";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  if (!token) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <Alert tone="error">
            Token no encontrado en la URL. Solicita un nuevo enlace de recuperación.
          </Alert>
          <Link href="/forgot-password" className="w-full">
            <Button variant="outline" className="w-full">
              Solicitar nuevo enlace
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    const pErr = validateStrongPassword(password);
    const cErr = confirm !== password ? "Las contraseñas no coinciden" : null;
    setPasswordError(pErr);
    setConfirmError(cErr);
    setError(null);
    if (pErr || cErr) return;

    inFlight.current = true;
    setSubmitting(true);
    try {
      await resetPassword(token, password.trim());
      if (mounted.current) setSuccess(true);
    } catch (err) {
      if (mounted.current) setError(accountFormError(err, "reset"));
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  if (success) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--success-light)]">
            <CheckCircle2 className="h-12 w-12 text-[color:var(--success)]" />
          </div>
          <h2 className="text-xl font-extrabold">¡Contraseña actualizada!</h2>
          <p className="text-sm text-muted-foreground">
            Tu contraseña ha sido cambiada exitosamente. Ya puedes iniciar
            sesión con tu nueva contraseña.
          </p>
          <Link href="/login" className="w-full">
            <Button size="lg" className="w-full">
              Ir al inicio de sesión
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--primary)]/12 text-[color:var(--primary)]">
          <KeyRound className="h-7 w-7" />
        </div>
        <CardTitle className="text-xl">Restablecer contraseña</CardTitle>
        <CardDescription>Ingresa tu nueva contraseña.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        <form onSubmit={handleSubmit} aria-busy={submitting} noValidate>
          <fieldset disabled={submitting} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Nueva contraseña</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!passwordError}
              aria-describedby={passwordError ? "password-error" : undefined}
            />
            <p className="text-xs text-muted-foreground">
              {passwordRequirementsText}
            </p>
            {passwordError && (
              <p id="password-error" className="text-xs text-[color:var(--destructive)]">
                {passwordError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm">Confirmar contraseña</Label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={!!confirmError}
              aria-describedby={confirmError ? "confirm-error" : undefined}
            />
            {confirmError && (
              <p id="confirm-error" className="text-xs text-[color:var(--destructive)]">
                {confirmError}
              </p>
            )}
          </div>

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
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <p className="text-center text-sm text-muted-foreground">Cargando…</p>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
