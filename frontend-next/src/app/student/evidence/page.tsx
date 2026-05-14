"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Download,
  FileText,
  FileUp,
  Image as ImageIcon,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteEvidenceBatch,
  downloadEvidenceFile,
  listMyEvidence,
  uploadEvidence,
} from "@/lib/api/evidence";
import { EvidenceBatch, EvidenceFile } from "@/lib/api/types";
import { formatBytes, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  EmptyState,
  LoadingState,
  PageHeader,
} from "@/components/page-header";

const STATUS_LABEL: Record<EvidenceBatch["status"], string> = {
  pending: "Pendiente",
  in_review: "En revisión",
  approved: "Aprobada",
  denied: "Rechazada",
};

const STATUS_VARIANT: Record<
  EvidenceBatch["status"],
  "warning" | "info" | "success" | "destructive"
> = {
  pending: "warning",
  in_review: "info",
  approved: "success",
  denied: "destructive",
};

export default function EvidencePage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["evidence", "me"],
    queryFn: () => listMyEvidence(1, 100),
  });

  const upload = useMutation({
    mutationFn: () => uploadEvidence(files, notes || undefined),
    onSuccess: () => {
      toast.success("Evidencia cargada");
      setFiles([]);
      setNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["evidence", "me"] });
    },
    onError: () => toast.error("No se pudo cargar la evidencia"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEvidenceBatch(id),
    onSuccess: () => {
      toast.success("Evidencia eliminada");
      queryClient.invalidateQueries({ queryKey: ["evidence", "me"] });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Cargar evidencia"
        description="Sube uno o varios archivos PDF o imágenes con los comprobantes de tus dosis."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nueva carga</CardTitle>
          <CardDescription>
            Selecciona los archivos o arrástralos sobre el área.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={
              "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors " +
              (dragOver
                ? "border-[color:var(--primary)] bg-[color:var(--primary)]/8"
                : "border-[color:var(--border)] hover:border-[color:var(--primary)]")
            }
          >
            <FileUp className="h-9 w-9 text-[color:var(--primary)]" />
            <p className="text-sm font-bold">Haz clic o arrastra archivos aquí</p>
            <p className="text-xs text-muted-foreground">
              PDF e imágenes. Máx. 10 archivos por carga.
            </p>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="sr-only"
            onChange={(e) =>
              setFiles(e.target.files ? Array.from(e.target.files) : [])
            }
          />
          {files.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-variant)]/50 p-2 text-xs">
              {files.map((f) => (
                <li
                  key={f.name + f.size}
                  className="flex items-center gap-2 rounded-md px-2 py-1"
                >
                  {f.type.startsWith("image/") ? (
                    <ImageIcon className="h-3.5 w-3.5 text-[color:var(--accent)]" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-[color:var(--primary)]" />
                  )}
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-muted-foreground">
                    {formatBytes(f.size)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Información adicional para el revisor"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => upload.mutate()}
              disabled={upload.isPending || files.length === 0}
            >
              {upload.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Subiendo…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Subir evidencia
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-base font-bold">Mis cargas</h2>
        {isLoading ? (
          <LoadingState />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-7 w-7" />}
            title="Aún no has cargado evidencia"
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.map((batch) => (
              <li key={batch.id}>
                <BatchCard
                  batch={batch}
                  onDelete={() => remove.mutate(batch.id)}
                  deleting={remove.isPending}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BatchCard({
  batch,
  onDelete,
  deleting,
}: {
  batch: EvidenceBatch;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[batch.status]}>
              {STATUS_LABEL[batch.status]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(batch.created_at)}
            </span>
            <span className="text-xs text-muted-foreground">
              · {batch.files.length} archivo{batch.files.length === 1 ? "" : "s"}
            </span>
          </div>
          {batch.status === "pending" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </Button>
          )}
        </div>
        {batch.notes && (
          <div className="rounded-xl border border-[color:var(--info)]/30 bg-[color:var(--info-light)] p-3 text-sm text-[color:var(--info)]">
            <span className="font-bold">Nota: </span>
            {batch.notes}
          </div>
        )}
        <ul className="flex flex-col gap-1">
          {batch.files.map((f) => (
            <FileRow key={f.id} file={f} />
          ))}
        </ul>
      </div>
    </Card>
  );
}

function FileRow({ file }: { file: EvidenceFile }) {
  const isImage = file.mime_type.startsWith("image/");
  const [downloading, setDownloading] = useState(false);

  async function onDownload() {
    setDownloading(true);
    const toastId = toast.loading("Preparando descarga...");
    try {
      await downloadEvidenceFile(file.id, file.original_filename, {
        onProgress: (progress) =>
          toast.loading(
            progress == null
              ? "Descargando archivo..."
              : `Descargando archivo ${progress}%`,
            { id: toastId },
          ),
      });
      toast.success("Archivo descargado", { id: toastId });
    } catch {
      toast.error("No se pudo descargar", { id: toastId });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      onClick={onDownload}
      disabled={downloading}
      className="group flex items-center gap-3 rounded-xl border border-[color:var(--divider)] bg-card p-2.5 text-left transition-colors hover:border-[color:var(--primary)]"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: isImage
            ? "color-mix(in srgb, var(--accent) 14%, transparent)"
            : "color-mix(in srgb, var(--primary) 14%, transparent)",
          color: isImage ? "var(--accent)" : "var(--primary)",
        }}
      >
        {isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{file.original_filename}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(file.file_size)} · {formatDateTime(file.uploaded_at)}
        </p>
      </div>
      {downloading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--primary)]/30 border-t-[color:var(--primary)]" />
      ) : (
        <Download className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-[color:var(--primary)]" />
      )}
    </button>
  );
}
