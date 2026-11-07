import { UccBrandBackground, UccLogo } from "@/components/brand";
import { ThemeModeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UccBrandBackground>
      <div className="auth-layout-shell relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <div className="absolute right-4 top-4">
          <ThemeModeToggle />
        </div>
        <div className="auth-layout-content w-full max-w-md">
          <div className="auth-brand-header mb-8 flex flex-col items-center text-center">
            <UccLogo size={92} />
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-[color:var(--primary-dark)]">
              Immuno Clinic
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Universidad Cooperativa de Colombia
            </p>
          </div>
          {children}
        </div>
      </div>
    </UccBrandBackground>
  );
}
