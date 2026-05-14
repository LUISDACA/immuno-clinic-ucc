"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getMyScheme } from "@/lib/api/scheme";
import { downloadMyCertificate } from "@/lib/api/certificates";
import { useAuthStore } from "@/lib/auth/store";
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
  const { email } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["scheme", "me"],
    queryFn: getMyScheme,
  });
  const [downloading, setDownloading] = useState(false);

  const total = data?.total_vaccines ?? 0;
  const approved = data?.approved_vaccines ?? 0;
  const ready = total > 0 && approved === total;

  async function onDownload() {
    setDownloading(true);
    const toastId = toast.loading("Preparando certificado...");
    try {
      await downloadMyCertificate(email ?? "estudiante", {
        onProgress: (progress) =>
          toast.loading(
            progress == null
              ? "Descargando certificado..."
              : `Descargando certificado ${progress}%`,
            { id: toastId },
          ),
      });
      toast.success("Certificado descargado", { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar", {
        id: toastId,
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Certificado</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Disponible cuando todas tus vacunas estén aprobadas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Esquema de vacunación</CardTitle>
              <CardDescription>
                {isLoading ? "Cargando…" : `${approved} de ${total} aprobadas`}
              </CardDescription>
            </div>
            <Badge variant={ready ? "success" : "warning"}>
              {ready ? "Listo" : "Incompleto"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {ready
              ? "Tu esquema está completo. Puedes descargar el certificado en PDF."
              : "El certificado se generará automáticamente cuando todas tus vacunas estén aprobadas por el equipo administrativo."}
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
