import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verificación de certificado | ImmunoClinic",
  robots: { index: false, follow: false },
};

export default function VerificationLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
