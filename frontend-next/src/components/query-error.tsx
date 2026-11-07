"use client";
import { isAxiosError } from "axios";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function queryErrorMessage(error: unknown): string {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  return ({
    401: "Tu sesión expiró. Inicia sesión nuevamente.",
    403: "No tienes permiso para consultar esta información.",
    404: "No se encontró la información solicitada.",
    429: "Demasiadas solicitudes. Espera antes de reintentar.",
    500: "Ocurrió un error en el servidor. Intenta nuevamente.",
    503: "El servicio no está disponible temporalmente.",
  } as Record<number,string>)[status ?? 0] ?? "No se pudo cargar la información. Comprueba la conexión y reintenta.";
}
export function QueryError({ error, retry, retrying = false }: { error: unknown; retry: () => unknown; retrying?: boolean }) {
  return <Alert tone="error"><p>{queryErrorMessage(error)}</p><Button variant="outline" disabled={retrying} aria-busy={retrying} onClick={() => { void retry(); }}>Reintentar</Button></Alert>;
}
