"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { AlertTriangle, ArrowRight, ExternalLink, History, Search, X } from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { Pagination, Select } from "@/components/composed";
import { useAdminAuditEvents } from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import { cn } from "@/lib/utils/cn";
import type { AdminListAuditEventsParams, AuditEvent, AuditTargetKind } from "@/types/admin";

const ACTION_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Any action" },
  { value: "order.status_changed", label: "Order status changed" },
  { value: "order.cancelled", label: "Order cancelled" },
  { value: "order.refunded", label: "Order refunded" },
  { value: "order.payment_changed", label: "Order payment changed" },
  { value: "review.approved", label: "Review approved" },
  { value: "review.hidden", label: "Review hidden" },
  { value: "review.deleted", label: "Review deleted" },
  { value: "user.role_changed", label: "User role changed" },
  { value: "user.suspended", label: "User suspended" },
  { value: "user.reinstated", label: "User reinstated" },
  { value: "coupon.created", label: "Coupon created" },
  { value: "coupon.updated", label: "Coupon updated" },
  { value: "coupon.activated", label: "Coupon activated" },
  { value: "coupon.deactivated", label: "Coupon deactivated" },
  { value: "coupon.deleted", label: "Coupon deleted" },
];

const TARGET_KIND_FILTERS: { value: AuditTargetKind | ""; label: string }[] = [
  { value: "", label: "Any target" },
  { value: "Order", label: "Order" },
  { value: "Product", label: "Product" },
  { value: "User", label: "User" },
  { value: "Review", label: "Review" },
  { value: "Question", label: "Question" },
  { value: "Coupon", label: "Coupon" },
  { value: "Category", label: "Category" },
  { value: "Brand", label: "Brand" },
];

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function actionLabel(action: string): string {
  const hit = ACTION_FILTERS.find((f) => f.value === action);
  if (hit) return hit.label;
  const [target, ...rest] = action.split(".");
  if (!target || rest.length === 0) return action;
  const suffix = rest.join(".").replace(/_/g, " ").toLowerCase();
  const head = target.charAt(0).toUpperCase() + target.slice(1);
  return `${head} ${suffix}`;
}

function targetHref(kind: AuditTargetKind, id: string): string | null {
  switch (kind) {
    case "Order": return `/admin/orders/${id}`;
    case "User": return `/admin/users/${id}`;
    case "Coupon": return `/admin/coupons/${id}`;
    case "Category": return `/admin/categories/${id}`;
    case "Brand": return `/admin/brands/${id}`;
    case "Product":
    case "Review":
    case "Question":
    default: return null;
  }
}

function formatScalar(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 40);
  return String(v);
}

function DiffCell({ diff, note }: { diff: Record<string, unknown> | undefined | null; note: string | undefined }) {
  const d = diff ?? {};
  const keys = Object.keys(d);

  if (keys.length === 2 && "from" in d && "to" in d) {
    return (
      <span className="font-mono text-xs text-neutral-700">
        {String(d.from)} <ArrowRight className="inline h-3 w-3" aria-hidden /> {String(d.to)}
        {note ? <span className="ml-1 text-neutral-500">· {note}</span> : null}
      </span>
    );
  }

  if (keys.length === 2 && "before" in d && "after" in d && typeof d.before === "object" && typeof d.after === "object") {
    const before = (d.before ?? {}) as Record<string, unknown>;
    const after = (d.after ?? {}) as Record<string, unknown>;
    const changed = Object.keys({ ...before, ...after }).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    if (changed.length === 0) {
      return <span className="text-xs text-neutral-500">No field changes recorded{note ? ` · ${note}` : ""}</span>;
    }
    return (
      <ul className="m-0 list-none space-y-0.5 p-0 font-mono text-xs text-neutral-700">
        {changed.slice(0, 4).map((k) => (
          <li key={k} className="truncate">
            <span className="text-neutral-500">{k}:</span> {String(before[k] ?? "-")} <ArrowRight className="inline h-3 w-3" aria-hidden /> {String(after[k] ?? "-")}
          </li>
        ))}
        {changed.length > 4 ? <li className="text-neutral-500">+{changed.length - 4} more</li> : null}
        {note ? <li className="text-neutral-500">{note}</li> : null}
      </ul>
    );
  }

  if (keys.length > 0) {
    return (
      <span className="font-mono text-xs text-neutral-700">
        {keys.slice(0, 3).map((k) => `${k}: ${formatScalar(d[k])}`).join(" · ")}
        {keys.length > 3 ? " …" : ""}
        {note ? <span className="ml-1 text-neutral-500">· {note}</span> : null}
      </span>
    );
  }

  return <span className="text-xs text-neutral-500">{note ?? "-"}</span>;
}

function AuditRow({ event }: { event: AuditEvent }) {
  const href = targetHref(event.targetKind, event.targetId);
  return (
    <tr className="transition-colors hover:bg-neutral-50">
      <td className="px-3 py-2.5 align-middle text-xs text-neutral-500">{formatDateTime(event.createdAt)}</td>
      <td className="px-3 py-2.5 align-middle">
        <span className="inline-flex items-center rounded-sm border border-neutral-200 bg-paper px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-700">
          {actionLabel(event.action)}
        </span>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <div className="min-w-0">
          <p className="truncate text-sm text-ink">{event.actor.name}</p>
          <p className="truncate text-xs text-neutral-500">
            {event.actor.email}{event.actor.role !== "admin" ? ` · ${event.actor.role}` : ""}
          </p>
        </div>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex shrink-0 items-center rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
            {event.targetKind}
          </span>
          {href ? (
            <Link href={href} className="inline-flex items-center gap-1 truncate text-sm text-ink underline-offset-2 hover:underline" title={event.targetLabel}>
              <span className="truncate">{event.targetLabel}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </Link>
          ) : (
            <span className="truncate text-sm text-neutral-700" title={event.targetLabel}>{event.targetLabel}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <DiffCell diff={event.diff} note={event.note} />
      </td>
    </tr>
  );
}

export function AuditLogAdminClient() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const action = search.get("action") ?? "";
  const targetKind = (search.get("targetKind") ?? "") as AuditTargetKind | "";
  const qFromUrl = search.get("q") ?? "";
  const from = search.get("from") ?? "";
  const to = search.get("to") ?? "";
  const page = Math.max(1, Number(search.get("page") ?? "1"));

  const [qDraft, setQDraft] = React.useState(qFromUrl);
  React.useEffect(() => { setQDraft(qFromUrl); }, [qFromUrl]);

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k); else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onSubmitSearch = (e: React.FormEvent) => { e.preventDefault(); update({ q: qDraft.trim() || undefined }); };

  const params: AdminListAuditEventsParams = React.useMemo(
    () => ({ action: action || undefined, targetKind: targetKind || undefined, q: qFromUrl || undefined, from: from || undefined, to: to || undefined, page, limit: 25 }),
    [action, targetKind, qFromUrl, from, to, page],
  );

  const { data, isLoading, isError, error, refetch } = useAdminAuditEvents(params);
  const events = data?.data.events ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const filtersActive = Boolean(action) || Boolean(targetKind) || Boolean(qFromUrl) || Boolean(from) || Boolean(to);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Audit Log</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Every order, user, review, and coupon mutation by an admin is recorded here. Read-only.</p>
        </div>
        {meta ? <span className="text-sm text-neutral-400">{meta.total.toLocaleString("en-US")} events</span> : null}
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-neutral-200 bg-paper px-4 py-3">
        <form onSubmit={onSubmitSearch} className="flex min-w-[180px] flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
            <Input type="search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Actor, email, or target" className="pl-8" />
          </div>
          <button type="submit" className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:text-ink">Find</button>
        </form>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">Action</span>
          <Select value={action} onChange={(e) => update({ action: e.target.value || undefined })} options={ACTION_FILTERS} />
        </div>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">Target</span>
          <Select value={targetKind} onChange={(e) => update({ targetKind: e.target.value || undefined })} options={TARGET_KIND_FILTERS} />
        </div>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">From</span>
          <Input type="date" value={from} onChange={(e) => update({ from: e.target.value || undefined })} className="w-36" />
        </div>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">To</span>
          <Input type="date" value={to} onChange={(e) => update({ to: e.target.value || undefined })} className="w-36" />
        </div>
        {filtersActive ? (
          <>
            <div className="h-5 w-px bg-neutral-200" />
            <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-ink">
              <X className="h-3 w-3" aria-hidden /> Clear
            </button>
          </>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-sm border border-neutral-200 bg-paper"><Spinner /></div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
          <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
          <p className="text-sm text-neutral-500">{error instanceof AdminError ? error.message : "Couldn't load audit log."}</p>
          <Button variant="secondary" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-neutral-200 bg-paper py-14 text-center">
          <History className="h-8 w-8 text-neutral-200" aria-hidden />
          <p className="font-medium text-neutral-600">
            {filtersActive ? "No events match these filters." : "No admin actions have been recorded yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-neutral-200 bg-paper">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">When</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Action</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Actor</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Target</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {events.map((e) => <AuditRow key={e._id} event={e} />)}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={(p) => update({ page: String(p) })} className="mt-2" /> : null}
    </div>
  );
}