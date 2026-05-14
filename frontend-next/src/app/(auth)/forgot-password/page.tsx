"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck, Send } from "lucide-react";
import { forgotPassword } from "@/lib/auth/api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmailInput } from "@/components/ui/email-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email) {
      setEmailError("Ingresa tu correo");
      return;
    }
    if (!email.includes("@")) {
      setEmailError("Correo inválido");
      return;
    }
    setEmailError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
    } catch (err) {
      const ax = err as {
        code?: string;
        message?: string;
        response?: { status?: number; data?: { detail?: string } };
      };
      const status = ax.response?.status;
      const detail = ax.response?.data?.detail;

      if (status === 429) {
        setError("Demasiados intentos. Espera un minuto e intenta de nuevo.");
      } else if (typeof detail === "string") {
        setError(`(${status ?? "?"}) ${detail}`);
      } else if (status) {
        setError(`Servidor respondió con estado ${status}.`);
      } else if (
        ax.code === "ERR_NETWORK" ||
        ax.message?.toLowerCase().includes("network")
      ) {
        setError(
          "No se pudo contactar al servidor (probablemente CORS o backend caído).",
        );
      } else if (ax.code === "ECONNABORTED") {
        setError(
          "El servidor tardó demasiado en responder. Intenta de nuevo en 30-60s (Render free puede estar 'durmiendo').",
        );
      } else {
        setError(
          `Error inesperado: ${ax.code ?? ""} ${ax.message ?? "sin detalle"}`.trim(),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[color:var(--success-light)]">
            <MailCheck className="h-10 w-10 text-[color:var(--success)]" />
          </div>
          <h2 className="text-xl font-extrabold">Correo enviado</h2>
          <p className="text-sm text-muted-foreground">
            Si el correo existe en nuestro sistema, recibirás instrucciones
            para restablecer tu contraseña.
          </p>
          <Link href="/login" className="w-full">
            <Button variant="outline" className="w-full">
              Volver al inicio de sesión
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-md p-1 text-[color:var(--primary)] hover:bg-[color:var(--primary)]/10"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <CardTitle className="text-xl">Recuperar contraseña</CardTitle>
        </div>
        <CardDescription>
          Ingresa tu correo electrónico y te enviaremos instrucciones para
          restablecer tu contraseña.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <EmailInput
              id="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!emailError}
            />
            {emailError && (
              <p className="text-xs text-[color:var(--destructive)]">
                {emailError}
              </p>
            )}
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Enviando…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar instrucciones
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
