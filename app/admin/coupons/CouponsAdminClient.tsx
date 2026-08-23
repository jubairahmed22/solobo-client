"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, BadgePercent, CheckCircle2, EyeOff, Plus, Search, Store, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { Pagination, Select } from "@/components/composed";
import { AdminListSkeleton } from "@/components/admin/Skeleton";
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
    <tr className="bg-white transition duration-75 hover:bg-gray-50">
      <td className="px-[16px] py-[12px] align-middle">
        <div className="flex flex-col gap-[2px]">
          <Link href={`/admin/coupons/${coupon._id}`} className="font-mono text-[14px] font-semibold text-gray-900 underline-offset-2 hover:text-[#1A56DB] hover:underline">
            {coupon.code}
          </Link>
          {coupon.description ? <span className="line-clamp-1 max-w-[280px] text-[12px] text-gray-500">{coupon.description}</span> : null}
        </div>
      </td>
      <td className="px-[16px] py-[12px] align-middle text-[14px] text-gray-700">{formatValue(coupon)}</td>
      <td className="px-[16px] py-[12px] align-middle">
        <div className="flex flex-col gap-[2px]">
          {/* Flowbite badges */}
          <span className={cn(
            "inline-flex w-fit items-center gap-[4px] rounded-[4px] px-[10px] py-[2px] text-[12px] font-medium",
            coupon.scope === "platform" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800",
          )}>
            {coupon.scope === "platform"
              ? <><BadgePercent className="h-[12px] w-[12px]" aria-hidden /> Platform</>
              : <><Store className="h-[12px] w-[12px]" aria-hidden /> Seller</>}
          </span>
          {coupon.scope === "seller" && ownerLabel ? (
            <span className="line-clamp-1 max-w-[160px] text-[11px] text-gray-500">{ownerLabel}</span>
          ) : null}
        </div>
      </td>
      <td className="px-[16px] py-[12px] align-middle">
        <span className={cn(
          "inline-flex items-center gap-[4px] rounded-[4px] px-[10px] py-[2px] text-[12px] font-medium",
          coupon.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800",
        )}>
          {coupon.isActive
            ? <><CheckCircle2 className="h-[12px] w-[12px]" aria-hidden /> Active</>
            : <><EyeOff className="h-[12px] w-[12px]" aria-hidden /> Inactive</>}
        </span>
      </td>
      <td className="px-[16px] py-[12px] align-middle tabular-nums text-[14px] text-gray-500">{redemptionLabel}</td>
      <td className={cn("px-[16px] py-[12px] align-middle text-[13px]", validity.cold ? "text-gray-400" : "text-gray-500")}>{validity.label}</td>
      <td className="px-[16px] py-[12px] align-middle text-right">
        <Link href={`/admin/coupons/${coupon._id}`} className="inline-flex items-center gap-[6px] rounded-[8px] px-[10px] py-[8px] text-[13px] font-medium text-[#1A56DB] transition duration-75 hover:bg-gray-100 hover:underline">
          Edit <ArrowRight className="h-[16px] w-[16px]" aria-hidden />
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
    <div className="flex flex-col gap-[16px]">
      <header className="flex flex-wrap items-center justify-between gap-[12px]">
        <div>
          <h1 className="text-[24px] font-bold leading-tight text-gray-900">Coupons</h1>
          <p className="mt-[4px] text-[14px] text-gray-500">Platform-wide promo codes and seller-scope overrides. Code, scope, and owner are frozen post-creation.</p>
        </div>
        <div className="flex items-center gap-[8px]">
          {meta ? <span className="text-[14px] text-gray-500">{meta.total.toLocaleString("en-US")} total</span> : null}
          {/* Flowbite primary button */}
          <Link
            href="/admin/coupons/new"
            className="inline-flex h-[40px] items-center gap-[8px] rounded-[8px] bg-[#1A56DB] px-[16px] text-[14px] font-medium text-white transition duration-75 hover:bg-[#1E429F]"
          >
            <Plus className="h-[16px] w-[16px]" aria-hidden /> New coupon
          </Link>
        </div>
      </header>

      {/* Filter bar - Flowbite table toolbar */}
      <div className="flex flex-col gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm xl:flex-row xl:items-center">
        <form onSubmit={onSubmitSearch} className="flex w-full min-w-0 flex-1 items-center gap-[8px]">
          <label htmlFor="coupons-search" className="sr-only">Search coupons</label>
          <div className="relative min-w-0 flex-1 xl:max-w-[360px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-[12px]">
              <Search className="h-[16px] w-[16px] text-gray-500" aria-hidden />
            </div>
            <Input id="coupons-search" type="search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Code or description" className="pl-[36px]" />
          </div>
          <button
            type="submit"
            className="h-[40px] shrink-0 rounded-[8px] bg-[#1A56DB] px-[20px] text-[14px] font-medium text-white transition duration-75 hover:bg-[#1E429F]"
          >
            Find
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-[12px] xl:ml-auto xl:shrink-0 xl:justify-end">
          <div className="flex items-center gap-[8px]">
            <label htmlFor="coupons-scope" className="text-[13px] font-medium text-gray-500">Scope</label>
            <Select id="coupons-scope" value={scope} onChange={(e) => update({ scope: e.target.value === "all" ? undefined : e.target.value })} options={SCOPE_FILTERS} />
          </div>
          <div className="flex items-center gap-[8px]">
            <label htmlFor="coupons-status" className="text-[13px] font-medium text-gray-500">Status</label>
            <Select id="coupons-status" value={active} onChange={(e) => update({ active: e.target.value === "all" ? undefined : e.target.value })} options={STATUS_FILTERS} />
          </div>
          <div className="flex items-center gap-[8px]">
            <label htmlFor="coupons-sort" className="text-[13px] font-medium text-gray-500">Sort</label>
            <Select id="coupons-sort" value={sort} onChange={(e) => update({ sort: e.target.value === "newest" ? undefined : e.target.value })} options={SORT_OPTIONS} />
          </div>
          <div className="flex items-center gap-[8px]">
            <label htmlFor="coupons-owner" className="text-[13px] font-medium text-gray-500">Owner</label>
            <Input id="coupons-owner" type="search" value={ownerDraft} onChange={(e) => setOwnerDraft(e.target.value)} placeholder="Seller user id" className="w-32" />
            {/* Flowbite alternative button */}
            <button
              type="button"
              onClick={() => update({ owner: ownerDraft.trim() || undefined })}
              className="inline-flex h-[40px] items-center rounded-[8px] border border-gray-300 bg-white px-[12px] text-[13px] font-medium text-gray-900 transition duration-75 hover:bg-gray-100"
            >
              Apply
            </button>
          </div>
          {filtersActive ? (
            <button
              type="button"
              onClick={() => router.replace(pathname, { scroll: false })}
              className="inline-flex h-[40px] items-center gap-[6px] rounded-[8px] border border-gray-200 bg-white px-[12px] text-[13px] font-medium text-gray-500 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
            >
              <X className="h-[14px] w-[14px]" aria-hidden /> Clear
            </button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <AdminListSkeleton rows={8} columns={5} withThumb={false} />
      ) : isError ? (
        <div className="flex flex-col items-center gap-[12px] rounded-[8px] border border-gray-200 bg-white py-[48px] text-center shadow-sm">
          <AlertTriangle className="h-[24px] w-[24px] text-gray-400" aria-hidden />
          <p className="text-[14px] text-gray-500">{error instanceof AdminError ? error.message : "Couldn't load coupons."}</p>
          <Button variant="secondary" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : coupons.length === 0 ? (
        <div className="flex flex-col items-center gap-[8px] rounded-[8px] border border-dashed border-gray-300 bg-white py-[56px] text-center">
          <BadgePercent className="h-[32px] w-[32px] text-gray-300" aria-hidden />
          <p className="text-[14px] font-medium text-gray-600">No coupons match these filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[8px] border border-gray-200 bg-white shadow-sm">
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