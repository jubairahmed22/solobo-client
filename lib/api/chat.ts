import axios from "axios";
import { apiClient } from "./client";
import type { ApiResponse } from "@/types/api";
import type { ChatMessage, SendChatMessageResponse, ChatCheckoutBody, OrderPlaced } from "@/types/chat";

/**
 * Public chat-assistant endpoints. Anonymous-readable (backend uses
 * `optionalJWT`, never rejects) - the `sessionId` UUID is the only handle
 * needed, same trust model as a guest cart id.
 */

export class ChatError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Unwraps the `{success, data}` envelope. A non-2xx response makes axios
 * REJECT rather than resolve, so the catch below pulls the real
 * `{message, code}` back out of `error.response.data` - otherwise callers
 * only ever see axios's generic "Request failed with status code NNN"
 * instead of the backend's actual message. See commerce.ts's unwrap for
 * the full explanation.
 */
async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    const res = await promise;
    if (res.data.success) return res.data.data;
    throw new ChatError(res.data.message, res.data.code ?? "ERROR");
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as { message?: string; code?: string };
      throw new ChatError(body.message ?? "Request failed", body.code ?? "ERROR");
    }
    throw err;
  }
}

export const chatApi = {
  sendMessage: (sessionId: string, message: string) =>
    unwrap<SendChatMessageResponse>(apiClient.post("/chat/message", { sessionId, message })),

  getHistory: (sessionId: string) =>
    unwrap<{ messages: ChatMessage[] }>(apiClient.get(`/chat/${encodeURIComponent(sessionId)}`)),

  checkout: (body: ChatCheckoutBody) =>
    unwrap<{ orderPlaced: OrderPlaced }>(apiClient.post("/chat/checkout", body)),
};
