"use client";

import { useQuery } from "@tanstack/react-query";
import { listMyAudit } from "@/lib/api/audit";
import { AuditList } from "@/components/audit-list";
import { PageHeader } from "@/components/page-header";

export default function StudentHistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "me"],
    queryFn: () => listMyAudit(100, 0, true),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Mi historial"
        description="Acciones que afectaron tu cuenta."
      />
      <AuditList entries={data ?? []} loading={isLoading} />
    </div>
  );
}
