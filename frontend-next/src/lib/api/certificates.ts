import { fetchAndDownload, type DownloadOptions } from "@/lib/api/download";
import { API_BASE_URL } from "@/lib/config";

export async function downloadMyCertificate(options: DownloadOptions = {}): Promise<void> {
  await fetchAndDownload(
    `${API_BASE_URL}/certificates/scheme`,
    "certificado_vacunacion.pdf",
    options,
  );
}
