"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, BadgePercent, CheckCircle2, EyeOff, Plus, Search, Store, X } from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { Pagination, Select } from "@/components/composed";
import { cn } from "@/lib/utils/cn";
import { useAdminCoupons } from "@/hooks/useCoupon";
import { AdminError } from "@/lib/api/admin";
import type { AdminListCouponsParams, Coupon, CouponOwnerRef } from "@/types/coupon";

const SCOPE_FILTERS: { value: "all" | "platform" | "seller"; label: string }[] = [
  { value: "all", label: "All scopes" },
  { value: "platform", label: "Platform" },
  { value: "seller", label: "Seller" },
];

const STATUS_FILTERS: { value: "all" | "true" | "false"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

const SORT_OPTIONS: { value: NonNullable<AdminListCouponsParams["sort"]>; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "code-asc", label: "Code A→Z" },
  { value: "code-desc", label: "Code Z→A" },
  { value: "redemptions-desc", label: "Most redeemed" },
];

function formatDate(iso: string | undefined): string {
  if (!iso) return "-";
  try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return iso; }
}

function isOwnerRef(o: Coupon["owner"] | undefined): o is CouponOwnerRef {
  return Boolean(o) && typeof o === "object" && "_id" in (o as object);
}

function formatValue(coupon: Coupon): string {
  if (coupon.type === "percent") {
    const base = `${coupon.value}% off`;
    return coupon.maxDiscount ? `${base} (max ${coupon.currency} ${coupon.maxDiscount})` : base;
  }
  return `${coupon.currency} ${coupon.value} off`;
}

function validityLabel(coupon: Coupon): { label: string; cold: boolean } {
  const now = Date.now();
  if (coupon.validFrom && now < new Date(coupon.validFrom).getTime()) return { label: `Starts ${formatDate(coupon.validFrom)}`, cold: true };
  if (coupon.validUntil && now > new Date(coupon.validUntil).getTime()) return { label: `Expired ${formatDate(coupon.validUntil)}`, cold: true };
  if (coupon.validUntil) return { label: `Until ${formatDate(coupon.validUntil)}`, cold: false };
  return { label: "No end date", cold: false };
}

function CouponRow({ coupon }: { coupon: Coupon }) {
  const owner = coupon.owner;
  const ownerLabel = isOwnerRef(owner) ? owner.name || owner.email || owner._id : typeof owner === "string" ? owner : null;
  const validity = validityLabel(coupon);
  const redemptionLabel = coupon.maxRedemptions ? `${coupon.redemptions}/${coupon.maxRedemptions}` : `${coupon.redemptions}`;

  return (
    <tr className="transition-colors hover:bg-neutral-50">
      <td className="px-3 py-2.5 align-middle">
        <div className="flex flex-col gap-0.5">
          <Link href={`/admin/coupons/${coupon._id}`} className="font-mono text-sm font-semibold text-ink underline-offset-2 hover:underline">
            {coupon.code}
          </Link>
          {coupon.description ? <span className="line-clamp-1 max-w-[280px] text-xs text-neutral-500">{coupon.description}</span> : null}
        </div>
      </td>
      <td className="px-3 py-2.5 align-middle text-sm text-neutral-700">{formatValue(coupon)}</td>
      <td className="px-3 py-2.5 align-middle">
        <div className="flex flex-col gap-0.5">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold",
            coupon.scope === "platform" ? "bg-ink text-paper" : "bg-neutral-100 text-neutral-600",
          )}>
            {coupon.scope === "platform"
              ? <><BadgePercent className="h-2.5 w-2.5" aria-hidden /> Platform</>
              : <><Store className="h-2.5 w-2.5" aria-hidden /> Seller</>}
          </span>
          {coupon.scope === "seller" && ownerLabel ? (
            <span className="line-clamp-1 max-w-[160px] text-[10px] text-neutral-500">{ownerLabel}</span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <span className={cn(
          "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold",
          coupon.isActive ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500",
        )}>
          {coupon.isActive
            ? <><CheckCircle2 className="h-2.5 w-2.5" aria-hidden /> Active</>
            : <><EyeOff className="h-2.5 w-2.5" aria-hidden /> Inactive</>}
        </span>
      </td>
      <td className="px-3 py-2.5 align-middle tabular-nums text-sm text-neutral-600">{redemptionLabel}</td>
      <td className={cn("px-3 py-2.5 align-middle text-xs", validity.cold ? "text-neutral-400" : "text-neutral-600")}>{validity.label}</td>
      <td className="px-3 py-2.5 align-middle text-right">
        <Link href={`/admin/coupons/${coupon._id}`} className="inline-flex items-center gap-1 rounded-sm px-2 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-ink">
          Edit <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </td>
    </tr>
  );
}

export function CouponsAdminClient() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const scope = (search.get("scope") ?? "all") as "all" | "platform" | "seller";
  const active = (search.get("active") ?? "all") as "all" | "true" | "false";
  const owner = search.get("owner") ?? "";
  const qFromUrl = search.get("q") ?? "";
  const sort = (search.get("sort") ?? "newest") as NonNullable<AdminListCouponsParams["sort"]>;
  const page = Math.max(1, Number(search.get("page") ?? "1"));

  const [qDraft, setQDraft] = React.useState(qFromUrl);
  React.useEffect(() => { setQDraft(qFromUrl); }, [qFromUrl]);
  const [ownerDraft, setOwnerDraft] = React.useState(owner);
  React.useEffect(() => { setOwnerDraft(owner); }, [owner]);

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k); else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    update({ q: qDraft.trim() || undefined, owner: ownerDraft.trim() || undefined });
  };

  const params: AdminListCouponsParams = React.useMemo(
    () => ({ q: qFromUrl || undefined, scope: scope === "all" ? undefined : scope, active: active === "all" ? undefined : active, owner: owner || undefined, sort, page, limit: 50 }),
    [qFromUrl, scope, active, owner, sort, page],
  );

  const { data, isLoading, isError, error, refetch } = useAdminCoupons(params);
  const coupons = data?.data.coupons ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const filtersActive = scope !== "all" || active !== "all" || Boolean(qFromUrl) || Boolean(owner) || sort !== "newest";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Coupons</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Platform-wide promo codes and seller-scope overrides. Code, scope, and owner are frozen post-creation.</p>
        </div>
        <div className="flex items-center gap-2">
          {meta ? <span className="text-sm text-neutral-400">{meta.total.toLocaleString("en-US")} total</span> : null}
          <Link href="/admin/coupons/new" className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3 py-2 text-sm font-medium text-paper transition-colors hover:bg-neutral-800">
            <Plus className="h-4 w-4" aria-hidden /> New coupon
          </Link>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-neutral-200 bg-paper px-4 py-3">
        <form onSubmit={onSubmitSearch} className="flex min-w-[160px] flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
            <Input type="search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Code or description" className="pl-8" />
          </div>
          <button type="submit" className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:text-ink">Find</button>
        </form>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">Scope</span>
          <Select value={scope} onChange={(e) => update({ scope: e.target.value === "all" ? undefined : e.target.value })} options={SCOPE_FILTERS} />
        </div>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">Status</span>
          <Select value={active} onChange={(e) => update({ active: e.target.value === "all" ? undefined : e.target.value })} options={STATUS_FILTERS} />
        </div>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">Sort</span>
          <Select value={sort} onChange={(e) => update({ sort: e.target.value === "newest" ? undefined : e.target.value })} options={SORT_OPTIONS} />
        </div>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-400">Owner</span>
          <Input type="search" value={ownerDraft} onChange={(e) => setOwnerDraft(e.target.value)} placeholder="Seller user id" className="w-32" />
          <button type="button" onClick={() => update({ owner: ownerDraft.trim() || undefined })} className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:text-ink">Apply</button>
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
          <p className="text-sm text-neutral-500">{error instanceof AdminError ? error.message : "Couldn't load coupons."}</p>
          <Button variant="secondary" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : coupons.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-neutral-200 bg-paper py-14 text-center">
          <BadgePercent className="h-8 w-8 text-neutral-200" aria-hidden />
          <p className="font-medium text-neutral-600">No coupons match these filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-neutral-200 bg-paper">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Code</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Value</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Scope</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Status</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Redemptions</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Validity</th>
                <th className="px-3 py-2.5" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {coupons.map((c) => <CouponRow key={c._id} coupon={c} />)}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={(p) => update({ page: String(p) })} className="mt-2" /> : null}
    </div>
  );
}