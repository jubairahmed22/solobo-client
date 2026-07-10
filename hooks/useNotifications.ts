"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api/notifications";
import type { NotificationListParams } from "@/types/notification";

/**
 * Notification hooks - polled rather than push-based.
 *
 * The unread-count query has a 60s refetchInterval which is the heartbeat
 * for the sidebar badge. It's short enough that sellers don't have to
 * refresh to see a new order, but long enough that the queries don't
 * meaningfully load the API. We DON'T poll the full list - that only
 * refetches when the dropdown is opened or a mutation succeeds.
 *
 * Mutations invalidate both the list and the count so the badge updates
 * the moment a row is marked read without waiting for the next poll tick.
 */

export const notificationKeys = {
  list: (params: NotificationListParams) =>
    ["notifications", "list", params] as const,
  listAll: ["notifications", "list"] as const,
  unreadCount: ["notifications", "unread-count"] as const,
};

export function useNotifications(params: NotificationListParams = {}) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationsApi.list(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

/**
 * Unread count is the polled query that drives the sidebar badge. Pass
 * `enabled: false` to suspend polling when the user isn't logged in or
 * is on a public surface (no badge to show, no reason to ping the API).
 */
export function useUnreadNotificationCount(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: () => notificationsApi.unreadCount(),
    // 60s heartbeat. Tightening this is cheap (the endpoint is a single
    // countDocuments call indexed on (user, read)), but we don't gain much
    // from polling faster than once a minute for "you have new orders".
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });
}

function useInvalidateNotifications() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: notificationKeys.listAll });
    qc.invalidateQueries({ queryKey: notificationKeys.unreadCount });
  };
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidate,
  });
}
