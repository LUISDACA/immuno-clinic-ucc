"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { markCategoryRead } from "@/lib/api/notifications";
import { useAuthStore } from "@/lib/auth/store";

type ReadState = { threadId?: string; userId: string | null; error: unknown; pending: boolean };

// Same category-wide API operation as before. This only coordinates this mounted view.
export function useCommunicationReadSync(threadId?: string, lastMessageAt?: string) {
  const client = useQueryClient();
  const userId = useAuthStore(state => state.userId);
  const retry = useRef<(() => Promise<void>) | null>(null);
  const [state, setState] = useState<ReadState>({ userId: null, error: null, pending: false });

  useEffect(() => {
    if (!threadId) return;
    let active = true;
    let inFlight: Promise<void> | null = null;
    const current = () => active && useAuthStore.getState().userId === userId;
    const synchronize = (): Promise<void> => {
      if (!current()) return Promise.resolve();
      if (inFlight) return inFlight;
      setState(previous => ({
        threadId, userId, pending: true,
        error: previous.threadId === threadId && previous.userId === userId ? previous.error : null,
      }));
      const operation = (async () => {
        await client.cancelQueries({ queryKey: ["notifications"] });
        if (!current()) return;
        await markCategoryRead("communication");
        if (!current()) return;
        await client.cancelQueries({ queryKey: ["notifications"] });
        if (!current()) return;
        await client.invalidateQueries({ queryKey: ["notifications"] });
        if (current()) setState({ threadId, userId, error: null, pending: false });
      })().catch(error => {
        if (current()) setState({ threadId, userId, error, pending: false });
      }).finally(() => { if (inFlight === operation) inFlight = null; });
      inFlight = operation;
      return operation;
    };
    retry.current = synchronize;
    void synchronize();
    return () => {
      active = false;
      if (retry.current === synchronize) retry.current = null;
    };
  }, [client, threadId, lastMessageAt, userId]);

  const visible = state.threadId === threadId && state.userId === userId;
  return {
    error: visible ? state.error : null,
    pending: visible && state.pending,
    retry: () => retry.current?.(),
  };
}
