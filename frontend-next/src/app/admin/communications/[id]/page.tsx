import { ThreadDetail } from "@/components/thread-detail";

export default async function AdminThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ThreadDetail threadId={id} />;
}
