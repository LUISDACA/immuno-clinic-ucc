"use client";

import { useQuery } from "@tanstack/react-query";
import { listAdminAudit } from "@/lib/api/audit";
import { AuditList } from "@/components/audit-list";
import { PageHeader } from "@/components/page-header";

export default function AdminHistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "admin"],
    queryFn: () => listAdminAudit(100, 0),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Historial general"
        description="Registro de acciones administrativas."
      />
      <AuditList entries={data ?? []} loading={isLoading} isAdmin />
    </div>
  );
}
