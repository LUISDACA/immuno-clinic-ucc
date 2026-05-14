import { getAccessToken } from "@/lib/api/client";

export interface DownloadOptions {
  onProgress?: (progress: number | null) => void;
}

export async function fetchAndDownload(
  url: string,
  filename: string,
  options: DownloadOptions = {},
) {
  const token = getAccessToken();
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new Error("No se pudo descargar el archivo");

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  const reader = response.body?.getReader();
  if (!reader) {
    const blob = await response.blob();
    saveBlob(blob, filename);
    options.onProgress?.(100);
    return;
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  options.onProgress?.(contentLength > 0 ? 0 : null);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    received += value.length;
    if (contentLength > 0) {
      options.onProgress?.(Math.round((received / contentLength) * 100));
    }
  }

  const parts = chunks.map((chunk) =>
    chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength),
  ) as BlobPart[];
  const blob = new Blob(parts);
  saveBlob(blob, filename);
  options.onProgress?.(100);
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
