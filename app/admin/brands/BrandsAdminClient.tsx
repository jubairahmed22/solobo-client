"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Plus, Search, Star, Tag, X } from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { Pagination, Select } from "@/components/composed";
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
    <tr className="transition-colors hover:bg-neutral-50">
      <td className="px-3 py-2.5 align-middle">
        <div className="flex items-center gap-2.5">
          {brand.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logo} alt="" className="h-8 w-8 shrink-0 rounded-sm border border-neutral-200 object-contain p-0.5" loading="lazy" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-neutral-200 bg-neutral-50 text-neutral-400">
              <Tag className="h-3.5 w-3.5" aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            <Link href={`/admin/brands/${brand._id}`} className="block truncate text-sm font-medium text-ink underline-offset-2 hover:underline">
              {brand.name}
            </Link>
            <p className="truncate text-xs text-neutral-500">/{brand.slug}{brand.website ? ` · ${brand.website}` : ""}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <div className="flex flex-col gap-0.5">
          <span className={cn(
            "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold",
            brand.isActive ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500",
          )}>
            {brand.isActive ? "Active" : "Hidden"}
          </span>
          {brand.isFeatured ? (
            <span className="inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold bg-accent/20 text-ink">
              <Star className="h-2.5 w-2.5" aria-hidden /> Featured
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2.5 align-middle tabular-nums text-sm text-neutral-600">{brand.order}</td>
      <td className="px-3 py-2.5 align-middle text-xs text-neutral-400">{formatDate(brand.updatedAt)}</td>
      <td className="px-3 py-2.5 align-middle text-right">
        <Link href={`/admin/brands/${brand._id}`} className="inline-flex items-center gap-1 rounded-sm px-2 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-ink">
          Edit <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </td>
    </tr>
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
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Brands</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Manage the brand directory products are tagged against. Featured brands surface in the homepage strip.</p>
        </div>
        <div className="flex items-center gap-2">
          {meta ? <span className="text-sm text-neutral-400">{meta.total.toLocaleString("en-US")} total</span> : null}
          <Link href="/admin/brands/new" className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3 py-2 text-sm font-medium text-paper transition-colors hover:bg-neutral-800">
            <Plus className="h-4 w-4" aria-hidden /> New brand
          </Link>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-neutral-200 bg-paper px-4 py-3">
        <form onSubmit={onSubmitSearch} className="flex min-w-[180px] flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
            <Input type="search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Name or slug" className="pl-8" />
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
          <span className="text-xs font-medium text-neutral-400">Featured</span>
          <Select value={featured} onChange={(e) => update({ featured: e.target.value === "all" ? undefined : e.target.value })} options={FEATURED_FILTERS} />
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
          <p className="text-sm text-neutral-500">{error instanceof AdminError ? error.message : "Couldn't load brands."}</p>
          <Button variant="secondary" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : brands.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-neutral-200 bg-paper py-14 text-center">
          <Tag className="h-8 w-8 text-neutral-200" aria-hidden />
          <p className="font-medium text-neutral-600">No brands match these filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-neutral-200 bg-paper">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Brand</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Status</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Order</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Updated</th>
                <th className="px-3 py-2.5" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {brands.map((b) => <BrandRow key={b._id} brand={b} />)}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={(p) => update({ page: String(p) })} className="mt-2" /> : null}
    </div>
  );
}