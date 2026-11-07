"use client";
import { QueryError } from "@/components/query-error";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getMyScheme } from "@/lib/api/scheme";
import { downloadMyCertificate } from "@/lib/api/certificates";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CertificatePage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["scheme", "me"],
    queryFn: getMyScheme,
  });
  const [downloading, setDownloading] = useState(false);

  const approved = data?.approved_vaccines ?? 0;
  const total = data?.total_vaccines ?? 0;
  const ready = data?.is_certifiable ?? false;

  async function onDownload() {
    setDownloading(true);
    const toastId = toast.loading("Preparando certificado...");
    try {
      await downloadMyCertificate({
        onProgress: (progress) =>
          toast.loading(
            progress == null
              ? "Descargando certificado..."
              : `Descargando certificado ${progress}%`,
            { id: toastId },
          ),
      });
      toast.success("Certificado descargado. Usa el QR para verificarlo.", { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar", {
        id: toastId,
      });
    } finally {
      setDownloading(false);
    }
  }

  if (error) return <QueryError error={error} retry={refetch} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Certificado</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          La disponibilidad se determina con la evaluación vigente del esquema en el servidor.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Esquema de vacunación</CardTitle>
              <CardDescription>
                {isLoading ? "Cargando…" : `${approved} de ${total} vacunas aprobadas`}
              </CardDescription>
            </div>
            <Badge variant={ready ? "success" : "warning"}>
              {isLoading ? "Consultando…" : ready ? "Disponible" : "No disponible"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {ready
              ? "El servidor permite emitir tu certificado con la evaluación vigente."
              : "El servidor todavía no permite emitir el certificado. Actualiza el esquema para consultar el estado vigente."}
          </p>
          <div>
            <Button onClick={onDownload} disabled={!ready || downloading}>
              {downloading ? "Descargando…" : "Descargar PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
