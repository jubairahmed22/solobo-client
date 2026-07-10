import axios from "axios";
import { apiClient } from "./client";
import type { ApiResponse, PaginationMeta } from "@/types/api";
import type {
  NotificationListParams,
  NotificationListResponse,
  UnreadCountResponse,
} from "@/types/notification";

/**
 * Notifications API client. Same envelope conventions as reviews/seller:
 * `unwrap` for single-shot data, `unwrapWithMeta` when we need pagination
 * meta alongside the payload (the list endpoint).
 */

export class NotificationsError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    const res = await promise;
    if (res.data.success) return res.data.data;
    throw new NotificationsError(res.data.message, res.data.code ?? "ERROR");
  } catch (err) {
    if (err instanceof NotificationsError) throw err;
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as { message?: string; code?: string };
      throw new NotificationsError(
        body.message ?? "Request failed",
        body.code ?? "ERROR",
      );
    }
    throw err;
  }
}

async function unwrapWithMeta<T>(
  promise: Promise<{ data: ApiResponse<T> }>,
): Promise<{ data: T; meta?: PaginationMeta }> {
  try {
    const res = await promise;
    if (res.data.success) return { data: res.data.data, meta: res.data.meta };
    throw new NotificationsError(res.data.message, res.data.code ?? "ERROR");
  } catch (err) {
    if (err instanceof NotificationsError) throw err;
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as { message?: string; code?: string };
      throw new NotificationsError(
        body.message ?? "Request failed",
        body.code ?? "ERROR",
      );
    }
    throw err;
  }
}

export const notificationsApi = {
  list: (params: NotificationListParams = {}) =>
    unwrapWithMeta<NotificationListResponse>(
      apiClient.get("/notifications", {
        params: {
          page: params.page,
          limit: params.limit,
          // Server reads a string "true" - we pass that explicitly so booleans
          // don't get serialised to "false" and turn the filter on by mistake.
          unread: params.unread ? "true" : undefined,
        },
      }),
    ),

  unreadCount: () =>
    unwrap<UnreadCountResponse>(apiClient.get("/notifications/unread-count")),

  markRead: (id: string) =>
    unwrap<{ ok: true }>(apiClient.post(`/notifications/${id}/read`)),

  markAllRead: () =>
    unwrap<{ updated: number }>(apiClient.post("/notifications/mark-all-read")),
};
