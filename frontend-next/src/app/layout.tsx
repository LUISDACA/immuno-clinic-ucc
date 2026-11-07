import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AppProviders } from "@/components/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UCC ImmunoClinic",
  description:
    "Gestión de esquemas de vacunación — Universidad Cooperativa de Colombia",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

const themeInitScript = `
(function() {
  try {
    var raw = localStorage.getItem('ic_theme');
    var mode = 'system';
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.state && ['system', 'light', 'dark'].indexOf(parsed.state.mode) >= 0) mode = parsed.state.mode;
    }
    document.documentElement.setAttribute('data-theme', mode);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'system');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      data-theme="system"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
