"use client";
import { Suspense } from "react";
import { Pagination } from "@/components/pagination";
import { usePageLocation } from "@/lib/ui/list-state";
import { QueryError } from "@/components/query-error";

import { useQuery } from "@tanstack/react-query";
import { auditPage } from "@/lib/api/audit";
import { AuditList } from "@/components/audit-list";
import { PageHeader } from "@/components/page-header";

export default function Page(){return <Suspense fallback={<p>Cargando…</p>}><History /></Suspense>;}
function History() {
 const [page,setPage]=usePageLocation();
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["audit", "me", page],
    queryFn: () => auditPage(false,page),
  });

  if (error) return <QueryError error={error} retrying={isFetching} retry={() => refetch({ cancelRefetch: false })} />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Mi historial"
        description="Acciones que afectaron tu cuenta."
      />
      <Pagination data={data} page={page} onPage={setPage} refresh={refetch} busy={isFetching} />
      <AuditList entries={data?.items ?? []} loading={isLoading} />
    </div>
  );
}
