import { Suspense } from "react";
import { CommunicationsPage } from "@/components/communications-page";
import { LoadingState } from "@/components/page-header";
export default function Page() { return <Suspense fallback={<LoadingState />}><CommunicationsPage /></Suspense>; }
