import { RoleGuard } from "@/components/role-guard";

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGuard allow="plain_admin">{children}</RoleGuard>;
}
