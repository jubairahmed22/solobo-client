"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Bot, User } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { AdminDetailSkeleton } from "@/components/admin/Skeleton";
import { AdminError } from "@/lib/api/admin";
import { useAdminChatSession } from "@/hooks/useAdmin";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ChatSessionDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useAdminChatSession(id);

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/chat-logs")}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span className="ml-1">Back to Chat Logs</span>
        </Button>
      </div>

      {isLoading ? (
        <AdminDetailSkeleton lineItems={4} sidebarCards={1} />
      ) : isError || !data ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
          <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
          <p className="text-sm text-neutral-500">
            {error instanceof AdminError ? error.message : "Couldn't load this conversation."}
          </p>
          <Button variant="secondary" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="rounded-sm border border-neutral-200 bg-paper p-4">
            <header className="mb-4 flex flex-wrap items-center gap-1.5 border-b border-neutral-100 pb-3">
              <span className="text-sm font-semibold text-ink">{data.sessionId}</span>
              <span className="text-xs text-neutral-400">·</span>
              <time dateTime={data.createdAt} className="text-xs text-neutral-500">
                Started {formatDate(data.createdAt)}
              </time>
            </header>

            <div className="flex flex-col gap-3">
              {data.messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "flex max-w-[80%] items-start gap-2",
                      m.role === "user" ? "flex-row-reverse" : "flex-row",
                    )}
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                      {m.role === "user" ? <User className="h-3.5 w-3.5" aria-hidden /> : <Bot className="h-3.5 w-3.5" aria-hidden />}
                    </span>
                    <div
                      className={cn(
                        "rounded-2xl px-3 py-2 text-sm leading-snug",
                        m.role === "user" ? "bg-ink text-paper" : "bg-neutral-100 text-neutral-800",
                      )}
                    >
                      <p className="whitespace-pre-line">{m.content}</p>
                      <time dateTime={m.createdAt} className={cn("mt-1 block text-[10px]", m.role === "user" ? "text-paper/60" : "text-neutral-400")}>
                        {formatDate(m.createdAt)}
                      </time>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="flex flex-col gap-3">
            <div className="rounded-sm border border-neutral-200 bg-paper p-4">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">Orders placed</h2>
              {data.orderIds.length === 0 ? (
                <p className="text-sm text-neutral-500">No order placed in this conversation.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.orderIds.map((o) => (
                    <li key={o._id}>
                      <Link
                        href={`/admin/orders/${o._id}`}
                        className="flex items-center justify-between gap-2 rounded-sm border border-neutral-100 px-2 py-1.5 text-sm hover:border-neutral-300"
                      >
                        <span className="font-medium text-ink">#{o.orderNumber}</span>
                        <span className="text-neutral-500">{formatPrice(o.total)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-sm border border-neutral-200 bg-paper p-4">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">Status</h2>
              <Badge variant={data.status === "open" ? "muted" : "outline"} className="capitalize">
                {data.status}
              </Badge>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
