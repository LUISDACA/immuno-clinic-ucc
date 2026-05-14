import { RoleGuard } from "@/components/role-guard";

export default function AdminsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGuard allow="app_admin">{children}</RoleGuard>;
}
