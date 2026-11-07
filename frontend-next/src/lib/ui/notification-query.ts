"use client";

import { isAxiosError, isCancel } from "axios";
import type { QueryClient } from "@tanstack/react-query";
import { listNotifications } from "@/lib/api/notifications";

// Memory only, scoped to the query cache, with no identities or response data.
const retention = new WeakMap<QueryClient, { request: number; blocked: boolean }>();

// Presentation only: retain the last response during a transient load failure.
// Access/contract failures and cancelled sessions must keep their error-only view.
function canRetainNotificationsOnError(error: unknown): boolean {
  if (isCancel(error)) return false;
  const status = isAxiosError(error) ? error.response?.status : undefined;
  return status === undefined || status === 429 || (status >= 500 && status <= 599);
}

export async function loadNotificationsWithRetention(client: QueryClient) {
  let state = retention.get(client);
  if (!state) {
    state = { request: 0, blocked: false };
    retention.set(client, state);
  }
  const request = ++state.request;
  try {
    const items = await listNotifications();
    if (request === state.request) state.blocked = false;
    return items;
  } catch (error) {
    // Observe each attempt, not only the last error after automatic retries.
    // The block survives navigation and only a newer successful GET clears it.
    if (request === state.request && !canRetainNotificationsOnError(error)) state.blocked = true;
    throw error;
  }
}

export function canRetainNotificationData(client: QueryClient, error: unknown): boolean {
  return !retention.get(client)?.blocked && canRetainNotificationsOnError(error);
}
