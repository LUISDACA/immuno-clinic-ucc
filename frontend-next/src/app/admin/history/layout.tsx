import { RoleGuard } from "@/components/role-guard";

export default function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGuard allow="admin">{children}</RoleGuard>;
}
