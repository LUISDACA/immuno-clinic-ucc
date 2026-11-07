"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let browserClient: QueryClient | undefined;
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return new QueryClient();
  return browserClient ??= new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
}
export function clearQueryCache() {
  browserClient?.clear();
}
export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
