import { RoleGuard } from "@/components/role-guard";

export default function StudentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGuard allow="plain_admin">{children}</RoleGuard>;
}
