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

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await promise;
  if (res.data.success) return res.data.data;
  throw new ChatError(res.data.message, res.data.code ?? "ERROR");
}

export const chatApi = {
  sendMessage: (sessionId: string, message: string) =>
    unwrap<SendChatMessageResponse>(apiClient.post("/chat/message", { sessionId, message })),

  getHistory: (sessionId: string) =>
    unwrap<{ messages: ChatMessage[] }>(apiClient.get(`/chat/${encodeURIComponent(sessionId)}`)),

  checkout: (body: ChatCheckoutBody) =>
    unwrap<{ orderPlaced: OrderPlaced }>(apiClient.post("/chat/checkout", body)),
};
