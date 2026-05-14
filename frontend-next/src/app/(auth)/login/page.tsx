"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { useAuthStore } from "@/lib/auth/store";
import { isAdminRole } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { EmailInput } from "@/components/ui/email-input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const {
    login,
    isAuthenticated,
    isHydrated,
    isLoading,
    errorMessage,
    role,
    mustChangePassword,
  } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return;
    if (mustChangePassword) {
      router.replace(
        isAdminRole(role) ? "/admin/change-password" : "/student/change-password",
      );
    } else {
      router.replace(isAdminRole(role) ? "/admin" : "/student");
    }
  }, [isAuthenticated, isHydrated, role, mustChangePassword, router]);

  function validate(): boolean {
    const e: FieldErrors = {};
    if (!email) e.email = "Ingresa tu correo";
    else if (!email.includes("@")) e.email = "Ingresa un correo válido";
    if (!password) e.password = "Ingresa tu contraseña";
    else if (password.length < 6)
      e.password = "La contraseña debe tener al menos 6 caracteres";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await login(email.trim(), password);
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-extrabold">Bienvenido</CardTitle>
        <CardDescription>
          Ingresa con tu cuenta institucional.
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
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <p className="text-xs text-[color:var(--destructive)]">
                {errors.email}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
            />
            {errors.password && (
              <p className="text-xs text-[color:var(--destructive)]">
                {errors.password}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-bold text-[color:var(--primary)] hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          {errorMessage && <Alert tone="error">{errorMessage}</Alert>}

          <Button
            type="submit"
            disabled={isLoading}
            size="lg"
            className="w-full"
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Ingresando…
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Ingresar
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
