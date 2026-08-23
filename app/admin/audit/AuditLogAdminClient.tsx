"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { AlertTriangle, ArrowRight, ExternalLink, History, Search, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { Pagination, Select } from "@/components/composed";
import { AdminListSkeleton } from "@/components/admin/Skeleton";
import { useAdminAuditEvents } from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
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

/* The table splits date and time onto two lines - the one-line form is the
   widest cell in the row and forces the whole table to scroll on tablets. */
function formatDatePart(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch { return iso; }
}

function formatTimePart(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
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

/* Flowbite bordered badge - the action verb */
function ActionBadge({ action }: { action: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-[4px] border border-gray-300 bg-white px-[10px] py-[2px] font-mono text-[11px] font-medium text-gray-700">
      {actionLabel(action)}
    </span>
  );
}

/* Flowbite subtle badge - the target's model name */
function TargetKindBadge({ kind }: { kind: AuditTargetKind }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-[4px] bg-gray-100 px-[10px] py-[2px] text-[12px] font-medium text-gray-800">
      {kind}
    </span>
  );
}

function TargetLink({ event }: { event: AuditEvent }) {
  const href = targetHref(event.targetKind, event.targetId);
  if (!href) {
    return <span className="truncate text-[14px] text-gray-700" title={event.targetLabel}>{event.targetLabel}</span>;
  }
  return (
    <Link
      href={href}
      className="inline-flex min-w-0 items-center gap-[4px] text-[14px] font-medium text-gray-900 underline-offset-2 hover:text-[#1A56DB] hover:underline"
      title={event.targetLabel}
    >
      <span className="truncate">{event.targetLabel}</span>
      <ExternalLink className="h-[14px] w-[14px] shrink-0" aria-hidden />
    </Link>
  );
}

function ActorIdentity({ actor }: { actor: AuditEvent["actor"] }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[14px] font-medium text-gray-900">{actor.name}</p>
      <p className="truncate text-[12px] text-gray-500">
        {actor.email}{actor.role !== "admin" ? ` · ${actor.role}` : ""}
      </p>
    </div>
  );
}

function DiffCell({ diff, note }: { diff: Record<string, unknown> | undefined | null; note: string | undefined }) {
  const d = diff ?? {};
  const keys = Object.keys(d);

  if (keys.length === 2 && "from" in d && "to" in d) {
    return (
      <span className="font-mono text-[12px] text-gray-700">
        {String(d.from)} <ArrowRight className="inline h-[12px] w-[12px]" aria-hidden /> {String(d.to)}
        {note ? <span className="ml-1 text-gray-500">· {note}</span> : null}
      </span>
    );
  }

  if (keys.length === 2 && "before" in d && "after" in d && typeof d.before === "object" && typeof d.after === "object") {
    const before = (d.before ?? {}) as Record<string, unknown>;
    const after = (d.after ?? {}) as Record<string, unknown>;
    const changed = Object.keys({ ...before, ...after }).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    if (changed.length === 0) {
      return <span className="text-[12px] text-gray-500">No field changes recorded{note ? ` · ${note}` : ""}</span>;
    }
    return (
      <ul className="m-0 list-none space-y-0.5 p-0 font-mono text-[12px] text-gray-700">
        {changed.slice(0, 4).map((k) => (
          <li key={k} className="truncate">
            <span className="text-gray-500">{k}:</span> {String(before[k] ?? "-")} <ArrowRight className="inline h-[12px] w-[12px]" aria-hidden /> {String(after[k] ?? "-")}
          </li>
        ))}
        {changed.length > 4 ? <li className="text-gray-500">+{changed.length - 4} more</li> : null}
        {note ? <li className="text-gray-500">{note}</li> : null}
      </ul>
    );
  }

  if (keys.length > 0) {
    return (
      <span className="font-mono text-[12px] text-gray-700">
        {keys.slice(0, 3).map((k) => `${k}: ${formatScalar(d[k])}`).join(" · ")}
        {keys.length > 3 ? " …" : ""}
        {note ? <span className="ml-1 text-gray-500">· {note}</span> : null}
      </span>
    );
  }

  return <span className="text-[12px] text-gray-500">{note ?? "-"}</span>;
}

/* Desktop table row. Details collapses below xl, actor below lg - the audit
   story still reads without them at narrow widths. */
function AuditRow({ event }: { event: AuditEvent }) {
  return (
    <tr className="bg-white transition duration-75 hover:bg-gray-50">
      <td className="px-[16px] py-[12px] align-middle">
        <time className="block whitespace-nowrap text-[13px] text-gray-900" dateTime={event.createdAt}>
          {formatDatePart(event.createdAt)}
        </time>
        <span className="block whitespace-nowrap text-[12px] text-gray-500">
          {formatTimePart(event.createdAt)}
        </span>
      </td>
      <td className="px-[16px] py-[12px] align-middle">
        <ActionBadge action={event.action} />
      </td>
      <td className="hidden px-[16px] py-[12px] align-middle lg:table-cell">
        <ActorIdentity actor={event.actor} />
      </td>
      {/* Below xl this cell takes the slack (w-full) and max-w-0 gives the inner
          truncate a bound, so a long label ellipsizes instead of scrolling the
          table. At xl, Details takes the slack instead and this caps at 300px -
          a max-width rather than a width, so it can't fight Details for space. */}
      <td className="w-full max-w-0 px-[16px] py-[12px] align-middle xl:w-auto xl:max-w-[300px]">
        <div className="flex min-w-0 items-center gap-[8px]">
          <TargetKindBadge kind={event.targetKind} />
          <TargetLink event={event} />
        </div>
      </td>
      <td className="hidden px-[16px] py-[12px] align-middle xl:table-cell">
        <DiffCell diff={event.diff} note={event.note} />
      </td>
    </tr>
  );
}

/* Mobile card. Vertical space is free here, so nothing is dropped - every
   column from the table is present, stacked by importance. */
function AuditCardMobile({ event }: { event: AuditEvent }) {
  return (
    <div className="flex flex-col gap-[10px] p-[16px]">
      <div className="flex items-start justify-between gap-[8px]">
        <ActionBadge action={event.action} />
        <time className="shrink-0 text-[12px] text-gray-500" dateTime={event.createdAt}>
          {formatDateTime(event.createdAt)}
        </time>
      </div>

      <div className="flex min-w-0 items-center gap-[8px]">
        <TargetKindBadge kind={event.targetKind} />
        <TargetLink event={event} />
      </div>

      <div className="min-w-0">
        <DiffCell diff={event.diff} note={event.note} />
      </div>

      <div className="border-t border-gray-100 pt-[10px]">
        <ActorIdentity actor={event.actor} />
      </div>
    </div>
  );
}

/* Flowbite form field - label stacked above the control so each filter keeps
   its full width at every breakpoint. */
function FilterField({ htmlFor, label, className, children }: {
  htmlFor: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-[6px] block text-[13px] font-medium text-gray-900">
        {label}
      </label>
      {children}
    </div>
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
    <div className="flex flex-col gap-[16px]">
      <header className="flex flex-wrap items-start justify-between gap-x-[12px] gap-y-[4px]">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold leading-tight text-gray-900 sm:text-[24px]">Audit Log</h1>
          <p className="mt-[4px] text-[13px] text-gray-500 sm:text-[14px]">
            Every order, user, review, and coupon mutation by an admin is recorded here. Read-only.
          </p>
        </div>
        {meta ? (
          <span className="shrink-0 text-[13px] text-gray-500 sm:text-[14px]">
            {meta.total.toLocaleString("en-US")} events
          </span>
        ) : null}
      </header>

      {/* Filter bar - Flowbite table toolbar */}
      <div className="rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
        <div className="flex flex-col gap-[12px] xl:flex-row xl:items-end">
          <form onSubmit={onSubmitSearch} className="w-full min-w-0 xl:w-[300px] xl:shrink-0">
            <label htmlFor="audit-search" className="mb-[6px] block text-[13px] font-medium text-gray-900">
              Search
            </label>
            <div className="flex items-center gap-[8px]">
              <div className="relative min-w-0 flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-[12px]">
                  <Search className="h-[16px] w-[16px] text-gray-500" aria-hidden />
                </div>
                <Input
                  id="audit-search"
                  type="search"
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  placeholder="Actor, email, or target"
                  className="pl-[36px]"
                />
              </div>
              <Button type="submit" variant="primary" size="md" className="shrink-0">Find</Button>
            </div>
          </form>

          {/* Stays 2-up until xl: the 256px sidebar means the content column is
              far narrower than the viewport, so a 4-up row only fits at xl. */}
          <div className="grid grid-cols-2 gap-[12px] xl:ml-auto xl:flex xl:items-end">
            <FilterField htmlFor="audit-action" label="Action" className="col-span-2 min-w-0 sm:col-span-1 xl:w-[168px]">
              <Select
                id="audit-action"
                value={action}
                onChange={(e) => update({ action: e.target.value || undefined })}
                options={ACTION_FILTERS}
              />
            </FilterField>
            <FilterField htmlFor="audit-target" label="Target" className="col-span-2 min-w-0 sm:col-span-1 xl:w-[140px]">
              <Select
                id="audit-target"
                value={targetKind}
                onChange={(e) => update({ targetKind: e.target.value || undefined })}
                options={TARGET_KIND_FILTERS}
              />
            </FilterField>
            <FilterField htmlFor="audit-from" label="From" className="min-w-0 xl:w-[150px]">
              <Input id="audit-from" type="date" value={from} onChange={(e) => update({ from: e.target.value || undefined })} />
            </FilterField>
            <FilterField htmlFor="audit-to" label="To" className="min-w-0 xl:w-[150px]">
              <Input id="audit-to" type="date" value={to} onChange={(e) => update({ to: e.target.value || undefined })} />
            </FilterField>
          </div>
        </div>

        {filtersActive ? (
          <div className="mt-[12px] flex justify-end border-t border-gray-100 pt-[12px]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => router.replace(pathname, { scroll: false })}
              className="gap-[6px]"
            >
              <X className="h-[14px] w-[14px]" aria-hidden /> Clear filters
            </Button>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <AdminListSkeleton rows={10} columns={4} withThumb={false} />
      ) : isError ? (
        <div className="flex flex-col items-center gap-[12px] rounded-[8px] border border-gray-200 bg-white px-[16px] py-[48px] text-center shadow-sm">
          <AlertTriangle className="h-[24px] w-[24px] text-gray-400" aria-hidden />
          <p className="text-[14px] text-gray-500">{error instanceof AdminError ? error.message : "Couldn't load audit log."}</p>
          <Button variant="secondary" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-[8px] rounded-[8px] border border-dashed border-gray-300 bg-white px-[16px] py-[56px] text-center">
          <History className="h-[32px] w-[32px] text-gray-300" aria-hidden />
          <p className="text-[14px] font-medium text-gray-600">
            {filtersActive ? "No events match these filters." : "No admin actions have been recorded yet."}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile - one card per event */}
          <div className="overflow-hidden rounded-[8px] border border-gray-200 bg-white shadow-sm md:hidden">
            <ul className="divide-y divide-gray-100">
              {events.map((e) => (
                <li key={e._id}>
                  <AuditCardMobile event={e} />
                </li>
              ))}
            </ul>
          </div>

          {/* Tablet / desktop - Flowbite table */}
          <div className="hidden overflow-hidden rounded-[8px] border border-gray-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[14px] text-gray-500">
                <thead className="bg-gray-50 text-[12px] uppercase text-gray-500">
                  <tr>
                    <th scope="col" className="px-[16px] py-[12px] font-medium">When</th>
                    <th scope="col" className="px-[16px] py-[12px] font-medium">Action</th>
                    <th scope="col" className="hidden px-[16px] py-[12px] font-medium lg:table-cell">Actor</th>
                    <th scope="col" className="px-[16px] py-[12px] font-medium">Target</th>
                    {/* Takes the slack at xl so the diff has room instead of wrapping */}
                    <th scope="col" className="hidden px-[16px] py-[12px] font-medium xl:table-cell xl:w-full">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {events.map((e) => <AuditRow key={e._id} event={e} />)}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={(p) => update({ page: String(p) })} className="mt-2" /> : null}
    </div>
  );
}
