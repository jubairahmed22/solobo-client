import * as React from "react";
import { ChatSessionDetailClient } from "./ChatSessionDetailClient";

export default function AdminChatSessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <ChatSessionDetailClient id={params.id} />;
}
