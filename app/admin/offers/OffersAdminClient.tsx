"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock, EyeOff, Image as ImageIcon, Plus, Search, Sparkles, X } from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { Pagination, Select } from "@/components/composed";
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

function StatusChip({ status }: { status: OfferStatus }) {
  switch (status) {
    case "active":
      return <span className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-2.5 w-2.5" aria-hidden /> Active</span>;
    case "scheduled":
      return <span className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700"><CalendarClock className="h-2.5 w-2.5" aria-hidden /> Scheduled</span>;
    case "ended":
      return <span className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold bg-neutral-100 text-neutral-500"><Clock className="h-2.5 w-2.5" aria-hidden /> Ended</span>;
    case "draft":
    default:
      return <span className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold bg-neutral-100 text-neutral-500"><EyeOff className="h-2.5 w-2.5" aria-hidden /> Draft</span>;
  }
}

function OfferRow({ offer }: { offer: Offer }) {
  const win = windowLabel(offer);
  return (
    <tr className="transition-colors hover:bg-neutral-50">
      <td className="px-3 py-2.5 align-middle">
        <div className="flex flex-col gap-0.5">
          <Link href={`/admin/offers/${offer._id}`} className="text-sm font-medium text-ink underline-offset-2 hover:underline">
            {offer.name}
          </Link>
          <span className="line-clamp-1 max-w-[280px] text-xs text-neutral-500">/offers/{offer.slug}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 align-middle text-sm text-neutral-700">{formatValue(offer)}</td>
      <td className="px-3 py-2.5 align-middle"><StatusChip status={offer.status} /></td>
      <td className={cn("px-3 py-2.5 align-middle text-xs", win.cold ? "text-neutral-400" : "text-neutral-600")}>{win.label}</td>
      <td className="px-3 py-2.5 align-middle tabular-nums text-sm text-neutral-600">{offer.products.length.toLocaleString("en-US")}</td>
      <td className="px-3 py-2.5 align-middle text-sm text-neutral-600">
        <span className="inline-flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5 text-neutral-400" aria-hidden />{offer.banners.length}</span>
      </td>
      <td className="px-3 py-2.5 align-middle text-right">
        <Link href={`/admin/offers/${offer._id}`} className="inline-flex items-center gap-1 rounded-sm px-2 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-ink">
          Edit <ArrowRight className="h-3.5 w-3.5" aria-hidden />
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
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Offers</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Auto-applied promotions with curated product sets and on-storefront banners. Best discount wins per product; offers stack with coupons at checkout.</p>
        </div>
        <div className="flex items-center gap-2">
          {meta ? <span className="text-sm text-neutral-400">{meta.total.toLocaleString("en-US")} total</span> : null}
          <Link href="/admin/offers/new" className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3 py-2 text-sm font-medium text-paper transition-colors hover:bg-neutral-800">
            <Plus className="h-4 w-4" aria-hidden /> New offer
          </Link>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-neutral-200 bg-paper px-4 py-3">
        <form onSubmit={onSubmitSearch} className="flex min-w-[180px] flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
            <Input type="search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Name, slug, or description" className="pl-8" />
          </div>
          <button type="submit" className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:text-ink">Find</button>
        </form>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">Status</span>
          <Select value={status} onChange={(e) => update({ status: e.target.value === "all" ? undefined : e.target.value })} options={STATUS_FILTERS} />
        </div>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">Window</span>
          <Select value={windowFilter} onChange={(e) => update({ window: e.target.value === "all" ? undefined : e.target.value })} options={WINDOW_FILTERS} />
        </div>
        <div className="h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-400">Sort</span>
          <Select value={sort} onChange={(e) => update({ sort: e.target.value === "newest" ? undefined : e.target.value })} options={SORT_OPTIONS} />
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
          <p className="text-sm text-neutral-500">{error instanceof AdminError ? error.message : "Couldn't load offers."}</p>
          <Button variant="secondary" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : offers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-neutral-200 bg-paper py-14 text-center">
          <Sparkles className="h-8 w-8 text-neutral-200" aria-hidden />
          <div>
            <p className="font-medium text-neutral-600">{filtersActive ? "No offers match these filters." : "No offers yet."}</p>
            {!filtersActive && (
              <p className="mt-0.5 text-sm text-neutral-400">
                <Link href="/admin/offers/new" className="underline underline-offset-2">Create your first offer</Link> to start running promotions.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-neutral-200 bg-paper">
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