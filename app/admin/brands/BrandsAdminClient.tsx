"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, ChevronRight, Plus, Search, Star, Tag, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { Pagination, Select } from "@/components/composed";
import { AdminListSkeleton } from "@/components/admin/Skeleton";
import { cn } from "@/lib/utils/cn";
import { useAdminBrands } from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import type { AdminBrandSummary, AdminListBrandsParams } from "@/types/admin";

const STATUS_FILTERS: { value: "all" | "active" | "inactive"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Hidden" },
];

const FEATURED_FILTERS: { value: "all" | "featured" | "regular"; label: string }[] = [
  { value: "all", label: "All brands" },
  { value: "featured", label: "Featured only" },
  { value: "regular", label: "Non-featured" },
];

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return iso; }
}

function BrandRow({ brand }: { brand: AdminBrandSummary }) {
  return (
    <tr className="bg-white transition duration-75 hover:bg-gray-50">
      <td className="px-[16px] py-[12px] align-middle">
        <div className="flex items-center gap-[12px]">
          {brand.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logo} alt="" className="h-[40px] w-[40px] shrink-0 rounded-[8px] border border-gray-100 bg-gray-50 object-contain p-[2px]" loading="lazy" />
          ) : (
            <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gray-50 text-gray-400">
              <Tag className="h-[16px] w-[16px]" aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            <Link href={`/admin/brands/${brand._id}`} className="block truncate text-[14px] font-semibold text-gray-900 underline-offset-2 hover:text-[#1A56DB] hover:underline">
              {brand.name}
            </Link>
            <p className="truncate text-[12px] text-gray-500">/{brand.slug}{brand.website ? ` · ${brand.website}` : ""}</p>
          </div>
        </div>
      </td>
      <td className="px-[16px] py-[12px] align-middle">
        <div className="flex flex-col gap-[4px]">
          {/* Flowbite badges */}
          <span className={cn(
            "inline-flex w-fit items-center rounded-[4px] px-[10px] py-[2px] text-[12px] font-medium",
            brand.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800",
          )}>
            {brand.isActive ? "Active" : "Hidden"}
          </span>
          {brand.isFeatured ? (
            <span className="inline-flex w-fit items-center gap-[4px] rounded-[4px] bg-yellow-100 px-[10px] py-[2px] text-[12px] font-medium text-yellow-800">
              <Star className="h-[12px] w-[12px]" aria-hidden /> Featured
            </span>
          ) : null}
        </div>
      </td>
      <td className="hidden px-[16px] py-[12px] align-middle tabular-nums text-[14px] text-gray-500 lg:table-cell">{brand.order}</td>
      <td className="hidden px-[16px] py-[12px] align-middle text-[13px] text-gray-500 lg:table-cell">{formatDate(brand.updatedAt)}</td>
      <td className="px-[16px] py-[12px] align-middle text-right">
        <Link href={`/admin/brands/${brand._id}`} className="inline-flex items-center gap-[6px] rounded-[8px] px-[10px] py-[8px] text-[13px] font-medium text-[#1A56DB] transition duration-75 hover:bg-gray-100 hover:underline">
          Edit <ArrowRight className="h-[16px] w-[16px]" aria-hidden />
        </Link>
      </td>
    </tr>
  );
}

/** Mobile card - native-app list cell, whole row taps through to edit. */
function BrandCardMobile({ brand }: { brand: AdminBrandSummary }) {
  return (
    <Link
      href={`/admin/brands/${brand._id}`}
      className="flex items-center gap-[12px] px-[16px] py-[12px] active:bg-gray-50"
    >
      {brand.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logo} alt="" className="h-[44px] w-[44px] shrink-0 rounded-[8px] border border-gray-100 bg-gray-50 object-contain p-[2px]" loading="lazy" />
      ) : (
        <div className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gray-50 text-gray-400">
          <Tag className="h-[18px] w-[18px]" aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-gray-900">{brand.name}</p>
        <p className="truncate text-[12px] text-gray-500">/{brand.slug}</p>
        <div className="mt-[6px] flex flex-wrap items-center gap-[6px]">
          <span className={cn(
            "rounded-[4px] px-[8px] py-[2px] text-[11px] font-medium",
            brand.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800",
          )}>
            {brand.isActive ? "Active" : "Hidden"}
          </span>
          {brand.isFeatured ? (
            <span className="inline-flex items-center gap-[4px] rounded-[4px] bg-yellow-100 px-[8px] py-[2px] text-[11px] font-medium text-yellow-800">
              <Star className="h-[11px] w-[11px]" aria-hidden /> Featured
            </span>
          ) : null}
          <span className="text-[11px] text-gray-400">Updated {formatDate(brand.updatedAt)}</span>
        </div>
      </div>
      <ChevronRight className="h-[16px] w-[16px] shrink-0 text-gray-300" aria-hidden />
    </Link>
  );
}

export function BrandsAdminClient() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const status = (search.get("status") ?? "all") as "all" | "active" | "inactive";
  const featured = (search.get("featured") ?? "all") as "all" | "featured" | "regular";
  const qFromUrl = search.get("q") ?? "";
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

  const params: AdminListBrandsParams = React.useMemo(
    () => ({
      isActive: status === "active" ? true : status === "inactive" ? false : undefined,
      isFeatured: featured === "featured" ? true : featured === "regular" ? false : undefined,
      search: qFromUrl || undefined,
      page,
      limit: 100,
    }),
    [status, featured, qFromUrl, page],
  );

  const { data, isLoading, isError, error, refetch } = useAdminBrands(params);
  const brands = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const filtersActive = status !== "all" || featured !== "all" || Boolean(qFromUrl);

  return (
    <div className="flex flex-col gap-[16px]">
      <header className="flex flex-wrap items-center justify-between gap-[12px]">
        <div>
          <h1 className="text-[20px] font-bold leading-tight text-gray-900 sm:text-[24px]">Brands</h1>
          <p className="mt-[4px] text-[13px] text-gray-500 sm:text-[14px]">Manage the brand directory products are tagged against. Featured brands surface in the homepage strip.</p>
        </div>
        <div className="flex items-center gap-[8px]">
          {meta ? <span className="text-[14px] text-gray-500">{meta.total.toLocaleString("en-US")} total</span> : null}
          {/* Flowbite primary button */}
          <Link
            href="/admin/brands/new"
            className="inline-flex h-[40px] items-center gap-[8px] rounded-[8px] bg-[#1A56DB] px-[16px] text-[14px] font-medium text-white transition duration-75 hover:bg-[#1E429F]"
          >
            <Plus className="h-[16px] w-[16px]" aria-hidden /> New brand
          </Link>
        </div>
      </header>

      {/* Filter bar - Flowbite table toolbar */}
      <div className="flex flex-col gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm lg:flex-row lg:items-center">
        <form onSubmit={onSubmitSearch} className="flex w-full min-w-0 flex-1 items-center gap-[8px]">
          <label htmlFor="brands-search" className="sr-only">Search brands</label>
          <div className="relative min-w-0 flex-1 lg:max-w-[420px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-[12px]">
              <Search className="h-[16px] w-[16px] text-gray-500" aria-hidden />
            </div>
            <Input id="brands-search" type="search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Name or slug" className="pl-[36px]" />
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
            <label htmlFor="brands-status" className="text-[13px] font-medium text-gray-500">Status</label>
            <Select id="brands-status" value={status} onChange={(e) => update({ status: e.target.value === "all" ? undefined : e.target.value })} options={STATUS_FILTERS} />
          </div>
          <div className="flex items-center gap-[8px]">
            <label htmlFor="brands-featured" className="text-[13px] font-medium text-gray-500">Featured</label>
            <Select id="brands-featured" value={featured} onChange={(e) => update({ featured: e.target.value === "all" ? undefined : e.target.value })} options={FEATURED_FILTERS} />
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
        <AdminListSkeleton rows={8} columns={3} withThumb />
      ) : isError ? (
        <div className="flex flex-col items-center gap-[12px] rounded-[8px] border border-gray-200 bg-white py-[48px] text-center shadow-sm">
          <AlertTriangle className="h-[24px] w-[24px] text-gray-400" aria-hidden />
          <p className="text-[14px] text-gray-500">{error instanceof AdminError ? error.message : "Couldn't load brands."}</p>
          <Button variant="secondary" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : brands.length === 0 ? (
        <div className="flex flex-col items-center gap-[8px] rounded-[8px] border border-dashed border-gray-300 bg-white py-[56px] text-center">
          <Tag className="h-[32px] w-[32px] text-gray-300" aria-hidden />
          <p className="text-[14px] font-medium text-gray-600">No brands match these filters.</p>
        </div>
      ) : (
        <>
          {/* Mobile - native-app card list */}
          <div className="overflow-hidden rounded-[8px] border border-gray-200 bg-white shadow-sm md:hidden">
            <ul className="divide-y divide-gray-100">
              {brands.map((b) => (
                <li key={b._id}>
                  <BrandCardMobile brand={b} />
                </li>
              ))}
            </ul>
          </div>

          {/* Desktop / tablet - full table */}
          <div className="hidden overflow-x-auto rounded-[8px] border border-gray-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Brand</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Status</th>
                  <th className="hidden px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400 lg:table-cell">Order</th>
                  <th className="hidden px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400 lg:table-cell">Updated</th>
                  <th className="px-3 py-2.5" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {brands.map((b) => <BrandRow key={b._id} brand={b} />)}
              </tbody>
            </table>
          </div>
        </>
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={(p) => update({ page: String(p) })} className="mt-2" /> : null}
    </div>
  );
}