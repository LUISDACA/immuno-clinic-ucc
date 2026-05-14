import { fetchAndDownload, type DownloadOptions } from "@/lib/api/download";
import { API_BASE_URL } from "@/lib/config";

export async function downloadMyCertificate(
  emailHint: string,
  options: DownloadOptions = {},
): Promise<void> {
  await fetchAndDownload(
    `${API_BASE_URL}/certificates/scheme`,
    `certificado_vacunacion_${emailHint.split("@")[0]}.pdf`,
    options,
  );
}
