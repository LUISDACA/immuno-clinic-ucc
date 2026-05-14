import { RoleGuard } from "@/components/role-guard";

export default function VaccinesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGuard allow="app_admin">{children}</RoleGuard>;
}
