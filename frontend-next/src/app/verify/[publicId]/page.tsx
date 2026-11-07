"use client";

import { useEffect, useState } from "react";

type Verification = {
  status: "VALID" | "REVOKED" | "NOT_FOUND" | "INVALID";
  integrity: "NOT_CHECKED" | "MATCH" | "MISMATCH";
  document_sha256?: string;
  issued_at?: string;
};

export default function CertificateVerificationPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const [publicId, setPublicId] = useState("");
  const [verification, setVerification] = useState<Verification | null>(null);
  const [checking, setChecking] = useState(true);
  const [fileBusy, setFileBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void params.then(({ publicId: id }) => {
      if (!active) return;
      setPublicId(id);
      void fetchVerification(id).then((result) => {
        if (active) setVerification(result);
        if (active) setChecking(false);
      });
    });
    return () => { active = false; };
  }, [params]);

  async function fetchVerification(id: string, hash?: string): Promise<Verification> {
    try {
      const query = hash ? `?sha256=${encodeURIComponent(hash)}` : "";
      const response = await fetch(`/api/verify/${encodeURIComponent(id)}${query}`, {
        cache: "no-store",
      });
      return (await response.json()) as Verification;
    } catch {
      return { status: "INVALID", integrity: "NOT_CHECKED" };
    }
  }

  async function checkFile(file?: File) {
    if (!file || !publicId) return;
    setFileBusy(true);
    try {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
      setVerification(await fetchVerification(publicId, hash));
    } catch {
      setVerification({ status: "INVALID", integrity: "MISMATCH" });
    } finally {
      setFileBusy(false);
    }
  }

  const labels = {
    VALID: "CERTIFICADO VÁLIDO",
    REVOKED: "CERTIFICADO REVOCADO",
    NOT_FOUND: "CERTIFICADO NO ENCONTRADO",
    INVALID: "CERTIFICADO INVÁLIDO",
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">ImmunoClinic</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Verificación de certificado</h1>
        {checking ? <p className="mt-6 text-slate-600">Consultando vigencia…</p> : (
          <>
            <p className={`mt-6 text-lg font-bold ${verification?.status === "VALID" ? "text-emerald-700" : "text-red-700"}`}>
              {labels[verification?.status ?? "INVALID"]}
            </p>
            {verification?.issued_at && <p className="mt-2 text-sm text-slate-600">Emitido: {new Date(verification.issued_at).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</p>}
            {verification?.status === "VALID" && verification.integrity === "NOT_CHECKED" && (
              <p className="mt-2 text-sm text-slate-600">La vigencia está activa. Seleccione el PDF para comprobar que sus bytes coinciden con el documento emitido.</p>
            )}
            {verification?.integrity === "MATCH" && <p className="mt-2 text-sm font-medium text-emerald-700">Integridad del archivo comprobada (SHA-256).</p>}
            {verification?.integrity === "MISMATCH" && <p className="mt-2 text-sm font-medium text-red-700">El archivo no coincide con el documento emitido.</p>}
          </>
        )}
        <label className="mt-7 block text-sm font-medium text-slate-700" htmlFor="certificate-file">Comprobar integridad del PDF</label>
        <input id="certificate-file" className="mt-2 block w-full text-sm" type="file" accept="application/pdf,.pdf" disabled={checking || fileBusy} onChange={(event) => void checkFile(event.target.files?.[0])} />
        {fileBusy && <p className="mt-2 text-sm text-slate-500">Calculando hash…</p>}
        <p className="mt-6 break-all text-xs text-slate-500">Código público: {publicId}</p>
      </section>
    </main>
  );
}
