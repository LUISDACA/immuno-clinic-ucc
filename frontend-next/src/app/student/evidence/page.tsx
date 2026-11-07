"use client";
import { useSafeMutation as useMutation } from "@/lib/query/safe-mutation";
import { Pagination } from "@/components/pagination";
import { usePageLocation } from "@/lib/ui/list-state";
import { QueryError } from "@/components/query-error";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, useRef, useState } from "react";
import {
  Download,
  FileText,
  FileUp,
  Image as ImageIcon,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteEvidenceBatch,
  downloadEvidenceFile,
  listMyEvidence,
  uploadEvidence,
} from "@/lib/api/evidence";
import { EvidenceBatch, EvidenceFile } from "@/lib/api/types";
import { getMyScheme } from "@/lib/api/scheme";
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
import { Alert } from "@/components/ui/alert";
import {
  EmptyState,
  LoadingState,
  PageHeader,
} from "@/components/page-header";

const STATUS_LABEL: Record<EvidenceBatch["status"], string> = {
  in_review: "En revisión",
  approved: "Aprobada",
  denied: "Denegada",
  uploaded: "Cargada",
  under_review: "En revisión",
  reviewed: "Estado de revisión histórico",
  pending: "En revisión",
};

const STATUS_VARIANT: Record<
  EvidenceBatch["status"],
  "warning" | "info" | "success" | "destructive"
> = {
  in_review: "info",
  approved: "success",
  denied: "destructive",
  uploaded: "warning",
  under_review: "info",
  reviewed: "info",
  pending: "warning",
};

export default function Page(){return <Suspense fallback={<p>Cargando…</p>}><EvidencePage /></Suspense>;}
function EvidencePage() {
 const [page,setPage]=usePageLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [doseId, setDoseId] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [confirmedRead, setConfirmedRead] = useState<{ page: number; version: number } | null>(null);
  const evidenceKey = ["evidence", "me", page];
  const confirmedUpload = confirmedRead?.page === page &&
    queryClient.getQueryState(evidenceKey)?.dataUpdateCount === confirmedRead.version;
  const confirmedMessage = "Los documentos se subieron, pero no se pudo actualizar la lista.";
  const unconfirmedMessage = "No se pudo confirmar la carga. Comprueba tus documentos antes de reintentar.";

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: evidenceKey,
    queryFn: () => listMyEvidence(page, 20),
  });
  const { data: scheme, error: schemeError, refetch: refetchScheme } = useQuery({
    queryKey: ["scheme", "me"],
    queryFn: getMyScheme,
  });

  const upload = useMutation({
    affectedQueries: [["evidence", "me"],["scheme", "me"],["audit"]],
    mutationFn: (selection: { files: File[]; notes: string; doseId: string }) =>
      uploadEvidence(selection.files, selection.notes || undefined, selection.doseId || undefined),
    onMutate: () => { setUploadError(false); setConfirmedRead(null); },
    onSuccess: () => {
      const read = queryClient.getQueryState(evidenceKey);
      const failedRead = read?.status === "error";
      setConfirmedRead(failedRead ? { page, version: read.dataUpdateCount } : null);
      if (failedRead) toast.warning(confirmedMessage);
      else toast.success("Evidencia cargada");
      setFiles([]);
      setNotes("");
      setDoseId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: () => { setUploadError(true); toast.error(unconfirmedMessage); },
  });

  const remove = useMutation({
    affectedQueries: [["evidence", "me"],["scheme", "me"],["audit"]],
    mutationFn: (id: string) => deleteEvidenceBatch(id),
    onSuccess: () => {
      toast.success("Evidencia eliminada");
      queryClient.invalidateQueries({ queryKey: ["evidence", "me"] });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  function handleDrop(e: React.DragEvent) {
    if(upload.isPending){e.preventDefault();return;}
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  }

  if (error) return <div className="flex flex-col gap-3">
    {confirmedUpload && <p role="status">{confirmedMessage}</p>}
    {uploadError && <p role="status">{unconfirmedMessage}</p>}
    <QueryError error={error} retrying={isFetching} retry={() => refetch({ cancelRefetch: false })} />
  </div>;

  return (
    <div className="flex flex-col gap-5">
      {uploadError && <Alert tone="error">{unconfirmedMessage}</Alert>}
      <PageHeader
        title="Cargar evidencia"
        description="Sube uno o varios archivos PDF con los comprobantes de tus dosis."
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
            disabled={upload.isPending}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!upload.isPending) setDragOver(true);
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
              Solo PDF. Máximo 10 MB por archivo.
            </p>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Seleccionar archivos PDF"
            disabled={upload.isPending}
            multiple
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => {
              if (!upload.isPending) setFiles(e.target.files ? Array.from(e.target.files) : []);
            }}
          />
          {files.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-xl border border-[color:var(--divider)] bg-[color:var(--surface-variant)]/50 p-2 text-xs">
              {files.map((f, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 rounded-md px-2 py-1"
                >
                  {f.type.startsWith("image/") ? (
                    <ImageIcon className="h-3.5 w-3.5 text-[color:var(--accent)]" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-[color:var(--primary)]" />
                  )}
                  <span className="min-w-0 flex-1 break-words">{f.name}</span>
                  <span className="text-muted-foreground">
                    {formatBytes(f.size)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar ${f.name}`}
                    disabled={upload.isPending}
                    onClick={() => {
                      setFiles((current) => current.filter((_, position) => position !== index));
                      // File[] owns the draft; reset the native input so the same
                      // file can be picked again after removing it.
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-1.5">
            {schemeError && <QueryError error={schemeError} retry={refetchScheme} />}
            <Label htmlFor="evidence-dose">Dosis relacionada (opcional)</Label>
            <select
              id="evidence-dose"
              disabled={upload.isPending}
              value={doseId}
              onChange={(event) => setDoseId(event.target.value)}
              className="h-10 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm"
            >
              <option value="">Carga general, sin dosis asociada</option>
              {(scheme?.vaccines ?? []).flatMap((vaccine) =>
                vaccine.doses.map((dose) => (
                  <option key={dose.id} value={dose.id}>
                    {vaccine.vaccine?.name ?? "Vacuna"} · {dose.dose_config?.label ?? `Dosis ${dose.dose_number}`}
                  </option>
                )),
              )}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea disabled={upload.isPending}
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Información adicional para el revisor"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setDragOver(false);
                upload.mutate({ files: [...files], notes, doseId });
              }}
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
        <Pagination data={data} page={page} onPage={setPage} refresh={refetch} busy={isLoading} />
        {isLoading ? (
          <LoadingState />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-7 w-7" />}
            title="Aún no has cargado evidencia"
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.items.map((batch) => (
              <li key={batch.id}>
                <BatchCard
                  batch={batch}
                  onDelete={() => { if (confirm("¿Eliminar estos documentos?")) remove.mutate(batch.id); }}
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
          {(

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
        <p className="break-words text-sm font-semibold">{file.original_filename}</p>
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
