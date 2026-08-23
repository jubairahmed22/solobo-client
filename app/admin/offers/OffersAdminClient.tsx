"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock, EyeOff, Image as ImageIcon, Plus, Search, Sparkles, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { Pagination, Select } from "@/components/composed";
import { AdminListSkeleton } from "@/components/admin/Skeleton";
import { cn } from "@/lib/utils/cn";
import { useAdminOffers } from "@/hooks/useOffer";
import { AdminError } from "@/lib/api/admin";
import type { AdminListOffersParams, Offer, OfferStatus } from "@/types/offer";

const STATUS_FILTERS: { value: "all" | OfferStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "active", label: "Active" },
  { value: "ended", label: "Ended" },
];

const WINDOW_FILTERS: { value: NonNullable<AdminListOffersParams["window"]>; label: string }[] = [
  { value: "all", label: "Any window" },
  { value: "live", label: "Window open now" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Window passed" },
];

const SORT_OPTIONS: { value: NonNullable<AdminListOffersParams["sort"]>; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name-asc", label: "Name A→Z" },
  { value: "name-desc", label: "Name Z→A" },
  { value: "ends-soonest", label: "Ends soonest" },
  { value: "starts-soonest", label: "Starts soonest" },
];

function formatDate(iso: string | undefined): string {
  if (!iso) return "-";
  try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return iso; }
}

function formatValue(offer: Offer): string {
  if (offer.discountType === "percentage") return `${offer.discountValue}% off`;
  return `${offer.currency} ${offer.discountValue} off`;
}

function windowLabel(offer: Offer): { label: string; cold: boolean } {
  const now = Date.now();
  const start = new Date(offer.startsAt).getTime();
  const end = new Date(offer.endsAt).getTime();
  if (now < start) return { label: `Starts ${formatDate(offer.startsAt)}`, cold: true };
  if (now > end) return { label: `Ended ${formatDate(offer.endsAt)}`, cold: true };
  return { label: `Until ${formatDate(offer.endsAt)}`, cold: false };
}

/* Flowbite badges: bg-*-100 text-*-800, 12px medium, 4px radius. */
function StatusChip({ status }: { status: OfferStatus }) {
  switch (status) {
    case "active":
      return <span className="inline-flex items-center gap-[4px] rounded-[4px] bg-green-100 px-[10px] py-[2px] text-[12px] font-medium text-green-800"><CheckCircle2 className="h-[12px] w-[12px]" aria-hidden /> Active</span>;
    case "scheduled":
      return <span className="inline-flex items-center gap-[4px] rounded-[4px] bg-blue-100 px-[10px] py-[2px] text-[12px] font-medium text-blue-800"><CalendarClock className="h-[12px] w-[12px]" aria-hidden /> Scheduled</span>;
    case "ended":
      return <span className="inline-flex items-center gap-[4px] rounded-[4px] bg-gray-100 px-[10px] py-[2px] text-[12px] font-medium text-gray-800"><Clock className="h-[12px] w-[12px]" aria-hidden /> Ended</span>;
    case "draft":
    default:
      return <span className="inline-flex items-center gap-[4px] rounded-[4px] bg-gray-100 px-[10px] py-[2px] text-[12px] font-medium text-gray-800"><EyeOff className="h-[12px] w-[12px]" aria-hidden /> Draft</span>;
  }
}

function OfferRow({ offer }: { offer: Offer }) {
  const win = windowLabel(offer);
  return (
    <tr className="bg-white transition duration-75 hover:bg-gray-50">
      <td className="px-[16px] py-[12px] align-middle">
        <div className="flex flex-col gap-[2px]">
          <Link href={`/admin/offers/${offer._id}`} className="text-[14px] font-semibold text-gray-900 underline-offset-2 hover:text-[#1A56DB] hover:underline">
            {offer.name}
          </Link>
          <span className="line-clamp-1 max-w-[280px] text-[12px] text-gray-500">/offers/{offer.slug}</span>
        </div>
      </td>
      <td className="px-[16px] py-[12px] align-middle text-[14px] text-gray-700">{formatValue(offer)}</td>
      <td className="px-[16px] py-[12px] align-middle"><StatusChip status={offer.status} /></td>
      <td className={cn("px-[16px] py-[12px] align-middle text-[13px]", win.cold ? "text-gray-400" : "text-gray-500")}>{win.label}</td>
      <td className="px-[16px] py-[12px] align-middle tabular-nums text-[14px] text-gray-500">{offer.products.length.toLocaleString("en-US")}</td>
      <td className="px-[16px] py-[12px] align-middle text-[14px] text-gray-500">
        <span className="inline-flex items-center gap-[4px]"><ImageIcon className="h-[16px] w-[16px] text-gray-400" aria-hidden />{offer.banners.length}</span>
      </td>
      <td className="px-[16px] py-[12px] align-middle text-right">
        <Link href={`/admin/offers/${offer._id}`} className="inline-flex items-center gap-[6px] rounded-[8px] px-[10px] py-[8px] text-[13px] font-medium text-[#1A56DB] transition duration-75 hover:bg-gray-100 hover:underline">
          Edit <ArrowRight className="h-[16px] w-[16px]" aria-hidden />
        </Link>
      </td>
    </tr>
  );
}

export function OffersAdminClient() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const status = (search.get("status") ?? "all") as "all" | OfferStatus;
  const windowFilter = (search.get("window") ?? "all") as NonNullable<AdminListOffersParams["window"]>;
  const qFromUrl = search.get("q") ?? "";
  const sort = (search.get("sort") ?? "newest") as NonNullable<AdminListOffersParams["sort"]>;
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

  const params: AdminListOffersParams = React.useMemo(
    () => ({ q: qFromUrl || undefined, status: status === "all" ? undefined : status, window: windowFilter === "all" ? undefined : windowFilter, sort, page, limit: 50 }),
    [qFromUrl, status, windowFilter, sort, page],
  );

  const { data, isLoading, isError, error, refetch } = useAdminOffers(params);
  const offers = data?.data.offers ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const filtersActive = status !== "all" || windowFilter !== "all" || Boolean(qFromUrl) || sort !== "newest";

  return (
    <div className="flex flex-col gap-[16px]">
      <header className="flex flex-wrap items-center justify-between gap-[12px]">
        <div>
          <h1 className="text-[24px] font-bold leading-tight text-gray-900">Offers</h1>
          <p className="mt-[4px] text-[14px] text-gray-500">Auto-applied promotions with curated product sets and on-storefront banners. Best discount wins per product; offers stack with coupons at checkout.</p>
        </div>
        <div className="flex items-center gap-[8px]">
          {meta ? <span className="text-[14px] text-gray-500">{meta.total.toLocaleString("en-US")} total</span> : null}
          {/* Flowbite primary button */}
          <Link
            href="/admin/offers/new"
            className="inline-flex h-[40px] items-center gap-[8px] rounded-[8px] bg-[#1A56DB] px-[16px] text-[14px] font-medium text-white transition duration-75 hover:bg-[#1E429F]"
          >
            <Plus className="h-[16px] w-[16px]" aria-hidden /> New offer
          </Link>
        </div>
      </header>

      {/* Filter bar - Flowbite table toolbar */}
      <div className="flex flex-col gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm lg:flex-row lg:items-center">
        <form onSubmit={onSubmitSearch} className="flex w-full min-w-0 flex-1 items-center gap-[8px]">
          <label htmlFor="offers-search" className="sr-only">Search offers</label>
          <div className="relative min-w-0 flex-1 lg:max-w-[420px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-[12px]">
              <Search className="h-[16px] w-[16px] text-gray-500" aria-hidden />
            </div>
            <Input id="offers-search" type="search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Name, slug, or description" className="pl-[36px]" />
          </div>
          <button
            type="submit"
            className="h-[40px] shrink-0 rounded-[8px] bg-[#1A56DB] px-[20px] text-[14px] font-medium text-white transition duration-75 hover:bg-[#1E429F]"
          >
            Find
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-[12px] lg:ml-auto lg:shrink-0 lg:justify-end">
          <div className="flex items-center gap-[8px]">
            <label htmlFor="offers-status" className="text-[13px] font-medium text-gray-500">Status</label>
            <Select id="offers-status" value={status} onChange={(e) => update({ status: e.target.value === "all" ? undefined : e.target.value })} options={STATUS_FILTERS} />
          </div>
          <div className="flex items-center gap-[8px]">
            <label htmlFor="offers-window" className="text-[13px] font-medium text-gray-500">Window</label>
            <Select id="offers-window" value={windowFilter} onChange={(e) => update({ window: e.target.value === "all" ? undefined : e.target.value })} options={WINDOW_FILTERS} />
          </div>
          <div className="flex items-center gap-[8px]">
            <label htmlFor="offers-sort" className="text-[13px] font-medium text-gray-500">Sort</label>
            <Select id="offers-sort" value={sort} onChange={(e) => update({ sort: e.target.value === "newest" ? undefined : e.target.value })} options={SORT_OPTIONS} />
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
          <p className="text-[14px] text-gray-500">{error instanceof AdminError ? error.message : "Couldn't load offers."}</p>
          <Button variant="secondary" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : offers.length === 0 ? (
        <div className="flex flex-col items-center gap-[12px] rounded-[8px] border border-dashed border-gray-300 bg-white py-[56px] text-center">
          <Sparkles className="h-[32px] w-[32px] text-gray-300" aria-hidden />
          <div>
            <p className="text-[14px] font-medium text-gray-600">{filtersActive ? "No offers match these filters." : "No offers yet."}</p>
            {!filtersActive && (
              <p className="mt-[4px] text-[14px] text-gray-400">
                <Link href="/admin/offers/new" className="font-medium text-[#1A56DB] hover:underline">Create your first offer</Link> to start running promotions.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[8px] border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Name</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Discount</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Status</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Window</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Products</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Banners</th>
                <th className="px-3 py-2.5" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {offers.map((o) => <OfferRow key={o._id} offer={o} />)}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={(p) => update({ page: String(p) })} className="mt-2" /> : null}
    </div>
  );
}