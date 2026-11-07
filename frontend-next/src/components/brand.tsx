import Image from "next/image";
import { cn } from "@/lib/utils";

export function UccLogo({
  size = 56,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/brand/ucc_logo_app.png"
      alt="Universidad Cooperativa de Colombia"
      width={size}
      height={Math.round(size * 0.74)}
      priority
      className={cn("object-contain", className)}
    />
  );
}

export function UccBrandBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-full ucc-soft-gradient">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -right-14 -top-20 h-56 w-56 rounded-full border-[20px] border-[color:var(--primary)]/15" />
        <div className="absolute -left-16 -bottom-24 h-60 w-60 rounded-full border-[20px] border-[color:var(--primary)]/10" />
      </div>
      {children}
    </div>
  );
}

export function UccHeroPanel({
  eyebrow,
  title,
  subtitle,
  icon,
  trailing,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="ucc-brand-gradient relative overflow-hidden rounded-xl p-5 text-white shadow-lg">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full border-[16px] border-white/20"
      />
      <div className="relative flex items-start gap-4">
        {icon && (
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15 p-3">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">
            {eyebrow}
          </p>
          <h1 className="mt-1 text-xl font-extrabold leading-tight">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-white/85 line-clamp-1">
              {subtitle}
            </p>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
    </div>
  );
}

export function BrandSectionTitle({
  title,
  trailing,
}: {
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="block h-5 w-1.5 rounded-full bg-[color:var(--accent)]" />
      <h2 className="flex-1 text-base font-extrabold tracking-tight">{title}</h2>
      {trailing}
    </div>
  );
}
