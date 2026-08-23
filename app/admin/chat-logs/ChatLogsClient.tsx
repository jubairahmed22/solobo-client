"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, Bot, Search, X } from "lucide-react";
import { Button, Input, Badge } from "@/components/ui";
import { AdminListSkeleton } from "@/components/admin/Skeleton";
import { Pagination } from "@/components/composed";
import { AdminError } from "@/lib/api/admin";
import { useAdminChatSessions } from "@/hooks/useAdmin";
import type { AdminListChatSessionsParams } from "@/types/chat";

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

export function ChatLogsClient() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const q = search.get("q") ?? "";
  const page = Math.max(1, Number(search.get("page") ?? "1"));

  const [qDraft, setQDraft] = React.useState(q);
  React.useEffect(() => setQDraft(q), [q]);
  React.useEffect(() => {
    if (qDraft === q) return;
    const t = setTimeout(() => update({ q: qDraft || undefined }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDraft]);

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const params: AdminListChatSessionsParams = React.useMemo(
    () => ({ q: q || undefined, page, limit: 20 }),
    [q, page],
  );

  const { data, isLoading, isError, error, refetch } = useAdminChatSessions(params);
  const sessions = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-[16px]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Chat Logs</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Conversations with the AI shopping assistant - browse questions, leads, and orders placed via chat.
          </p>
        </div>
        {meta ? <span className="text-sm text-neutral-400">{meta.total.toLocaleString("en-US")} total</span> : null}
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-neutral-200 bg-paper px-4 py-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
          <Input
            placeholder="Search message text"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            className="pl-8"
          />
        </div>
        {q ? (
          <button
            type="button"
            onClick={() => router.replace(pathname, { scroll: false })}
            className="flex items-center gap-1 text-xs text-neutral-400 hover:text-ink"
          >
            <X className="h-3 w-3" aria-hidden /> Clear
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <AdminListSkeleton rows={6} columns={3} />
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
          <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
          <p className="text-sm text-neutral-500">
            {error instanceof AdminError ? error.message : "Couldn't load chat logs."}
          </p>
          <Button variant="secondary" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-neutral-200 bg-paper py-14 text-center">
          <Bot className="h-8 w-8 text-neutral-200" aria-hidden />
          <p className="font-medium text-neutral-600">
            {q ? "No conversations match that search." : "No chat conversations yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-sm border border-neutral-200 bg-paper px-3">
          <ul>
            {sessions.map((s) => (
              <li key={s._id} className="border-b border-neutral-100 py-3 last:border-b-0">
                <button
                  type="button"
                  onClick={() => router.push(`/admin/chat-logs/${s._id}`)}
                  className="flex w-full flex-col gap-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-ink">{s.sessionId.slice(0, 8)}…</span>
                    {s.orderIds.length > 0 ? (
                      <Badge className="bg-emerald-50 text-emerald-700">
                        {s.orderIds.length} order{s.orderIds.length > 1 ? "s" : ""}
                      </Badge>
                    ) : null}
                    <span className="text-xs text-neutral-400">·</span>
                    <time dateTime={s.lastMessageAt} className="text-xs text-neutral-500">
                      {formatDate(s.lastMessageAt)}
                    </time>
                    <span className="text-xs text-neutral-400">· {s.messageCount} messages</span>
                  </div>
                  {s.lastMessage ? (
                    <p className="line-clamp-1 text-sm text-neutral-600">{s.lastMessage}</p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={(p) => update({ page: String(p) })} className="mt-2" />
      ) : null}
    </div>
  );
}
