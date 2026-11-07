"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { listNotifications } from "@/lib/api/notifications";
import { cn } from "@/lib/utils";
import { UccBrandBackground, UccLogo } from "@/components/brand";
import { ThemeModeToggle } from "@/components/theme-toggle";
import { QueryError } from "@/components/query-error";
import { UserMenu } from "@/components/user-menu";
import { useEffect, useRef } from "react";
import notificationStyles from "./notification-content.module.css";
import profileStyles from "./student-profile-shell.module.css";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Devuelve true si `href` es la ruta más específica de `nav` que matchea `pathname`.
 *
 * Reglas:
 * - Match exacto siempre cuenta.
 * - Match por prefijo (`pathname.startsWith(href + "/")`) solo cuenta si NINGÚN
 *   otro item del nav tiene un href más largo que también matchea — así
 *   `/admin/students/create` resalta solo "Crear estudiante", no también "Estudiantes".
 */
function isActiveHref(
  href: string,
  pathname: string | null,
  nav: NavItem[],
): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;

  const prefix = href.endsWith("/") ? href : href + "/";
  if (!pathname.startsWith(prefix)) return false;

  // Si hay otro item con href más largo que también es prefijo, ése gana.
  const moreSpecific = nav.some((other) => {
    if (other.href === href) return false;
    if (other.href.length <= href.length) return false;
    if (pathname === other.href) return true;
    const otherPrefix = other.href.endsWith("/") ? other.href : other.href + "/";
    return pathname.startsWith(otherPrefix);
  });
  return !moreSpecific;
}

interface AppShellProps {
  title: string;
  nav: NavItem[];
  children: React.ReactNode;
}

export function AppShell({ title, nav, children }: AppShellProps) {
  const pathname = usePathname();
  const showCounters = nav.some((item) =>
    ["Comunicaciones", "Notificaciones"].includes(item.label),
  );
  const { data: notifications, error: notificationError, isFetching: notificationsFetching, refetch: retryNotifications } = useQuery({
    queryKey: ["notifications", "shell"],
    queryFn: listNotifications,
    enabled: showCounters,
    refetchInterval: 30_000,
  });
  const notificationPage = pathname === "/student/notifications" || pathname === "/admin/notifications";
  const studentProfilePage = pathname === "/student/profile";
  const accountPasswordPage = pathname === "/student/change-password" || pathname === "/admin/change-password";
  const communicationPage = ["/student/communications", "/admin/communications"].some(
    base => pathname === base || pathname.startsWith(`${base}/`),
  );
  const headerRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!notificationPage || !headerRef.current || !mainRef.current) return;
    const header = headerRef.current, main = mainRef.current;
    // offsetHeight is in layout pixels; getBoundingClientRect would apply CSS zoom twice.
    const measure = () => main.style.setProperty("--notification-header-height", `${header.offsetHeight}px`);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      main.style.removeProperty("--notification-header-height");
    };
  }, [notificationPage]);
  const unreadNotifications =
    notificationError ? 0 : notifications?.filter((notification) => !notification.is_read).length ?? 0;
  const unreadCommunications =
    notificationError ? 0 : notifications?.filter(
      (notification) =>
        !notification.is_read && notification.category === "communication",
    ).length ?? 0;

  return (
    <UccBrandBackground>
      <div className={cn("flex min-h-screen flex-col", (notificationPage || communicationPage || studentProfilePage || accountPasswordPage || pathname === "/admin/profile" || pathname === "/admin/students/create" || pathname === "/admin") && "relative z-0", studentProfilePage && profileStyles.shell)}>
        <header ref={headerRef} className="sticky top-0 z-30 border-b border-[color:var(--divider)] bg-card/95 backdrop-blur">
          <div className={cn("mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3", studentProfilePage && profileStyles.header)}>
            <Link href="/" className="flex items-center gap-3">
              <UccLogo size={44} />
              <span className="hidden flex-col leading-none sm:flex">
                <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--brand-gray)]">
                  Immuno Clinic
                </span>
                <span className="text-sm text-muted-foreground">{title}</span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <ThemeModeToggle />
              <UserMenu />
            </div>
          </div>
        </header>
        <div className={cn("mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6", studentProfilePage && profileStyles.layout)}>
          <aside className="hidden w-60 shrink-0 md:block">
            <nav className="flex flex-col gap-1">
              {nav.map((item) => {
                const active = isActiveHref(item.href, pathname, nav);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-[color:var(--action)] text-[color:var(--action-foreground)] shadow-sm"
                        : "text-muted-foreground hover:bg-[color:var(--primary)]/10 hover:text-[color:var(--interactive-foreground)]",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>{item.label}</span>
                      <NavCounter
                        label={item.label}
                        communications={unreadCommunications}
                        notifications={unreadNotifications}
                      />
                    </span>
                  </Link>
                );
              })}
            </nav>
          </aside>
          <div className="min-w-0 flex-1">
            <nav aria-label="Navegación de módulos" className={cn("mb-4 flex flex-wrap gap-2 md:hidden", studentProfilePage && profileStyles.navigation)}>
              {nav.map(item => <Link key={item.href} href={item.href} aria-current={isActiveHref(item.href, pathname, nav) ? "page" : undefined} className="rounded-xl border px-3 py-2 text-sm">{item.label}</Link>)}
            </nav>
            {notificationError && !notificationPage && <QueryError error={notificationError} retry={() => retryNotifications({ cancelRefetch: false })} retrying={notificationsFetching} />}
            <main ref={mainRef} className={notificationPage ? notificationStyles.content : undefined}>{children}</main>
          </div>
        </div>
      </div>
    </UccBrandBackground>
  );
}

function NavCounter({
  label,
  communications,
  notifications,
}: {
  label: string;
  communications: number;
  notifications: number;
}) {
  const count =
    label === "Comunicaciones"
      ? communications
      : label === "Notificaciones"
        ? notifications
        : 0;
  if (count <= 0) return null;
  return (
    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[color:var(--destructive)] px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
