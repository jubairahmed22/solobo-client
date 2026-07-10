"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { offersApi } from "@/lib/api/offers";
import type {
  AdminCreateOfferBody,
  AdminListOffersParams,
  AdminReplaceOfferBannersBody,
  AdminReplaceOfferProductsBody,
  AdminUpdateOfferBody,
  PublicListOffersParams,
} from "@/types/offer";

/**
 * Offer hooks - admin CRUD + storefront read. Symmetric with `useCoupon.ts`
 * for the admin half; the public half mirrors `useCatalog.ts`'s structure
 * (anonymous reads, no mutations).
 *
 * Cache invalidation: every admin mutation nukes the cart envelope key
 * (`["cart"]`) and the public offers key (`["offers"]`). The pricing engine
 * reads the live offer doc on every cart calc, so when an offer goes
 * active / inactive / changes its discount, any open cart should refetch
 * and re-render strike-through prices without a hard refresh. The public
 * key invalidation likewise keeps the storefront offers index + landing
 * pages fresh after an admin save.
 */

export const offerKeys = {
  admin: {
    list: (params: AdminListOffersParams) =>
      ["admin", "offers", params] as const,
    listAll: ["admin", "offers"] as const,
    detail: (id: string) => ["admin", "offer", id] as const,
  },
  public: {
    list: (params: PublicListOffersParams) => ["offers", params] as const,
    listAll: ["offers"] as const,
    detail: (slug: string) => ["offer", slug] as const,
  },
};

/* ───────────────────── Admin ───────────────────── */

export function useAdminOffers(params: AdminListOffersParams) {
  return useQuery({
    queryKey: offerKeys.admin.list(params),
    queryFn: () => adminApi.listOffers(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useAdminOffer(id: string | undefined) {
  return useQuery({
    queryKey: id ? offerKeys.admin.detail(id) : ["admin", "offer", "noop"],
    queryFn: () => {
      if (!id) throw new Error("Offer id is required");
      return adminApi.getOffer(id);
    },
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

/**
 * Shared invalidation for all admin offer mutations. We invalidate:
 *  - the specific detail key (if we have an id, e.g. for update / replace)
 *  - the admin list family
 *  - the public offers family (storefront pages re-render after an edit)
 *  - the cart envelope (open carts re-resolve offers on the next fetch)
 *  - the catalog product family (decorated `price`/`compareAtPrice`/
 *    `activeOffer` on product listings reflects the new offer state)
 */
function useInvalidateAdminOffer(id?: string) {
  const qc = useQueryClient();
  return () => {
    if (id) qc.invalidateQueries({ queryKey: offerKeys.admin.detail(id) });
    qc.invalidateQueries({ queryKey: offerKeys.admin.listAll });
    qc.invalidateQueries({ queryKey: offerKeys.public.listAll });
    qc.invalidateQueries({ queryKey: ["offer"] });
    qc.invalidateQueries({ queryKey: ["cart"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["product"] });
  };
}

export function useCreateAdminOffer() {
  const invalidate = useInvalidateAdminOffer();
  return useMutation({
    mutationFn: (body: AdminCreateOfferBody) => adminApi.createOffer(body),
    onSuccess: invalidate,
  });
}

export function useUpdateAdminOffer(id: string) {
  const invalidate = useInvalidateAdminOffer(id);
  return useMutation({
    mutationFn: (patch: AdminUpdateOfferBody) =>
      adminApi.updateOffer(id, patch),
    onSuccess: invalidate,
  });
}

/**
 * Replace the offer's product allow-list. Separate hook from the generic
 * update because the product selector panel issues this as its own commit
 * (and the request shape is just `{ products: string[] }`, not a partial
 * offer patch).
 */
export function useReplaceOfferProducts(id: string) {
  const invalidate = useInvalidateAdminOffer(id);
  return useMutation({
    mutationFn: (body: AdminReplaceOfferProductsBody) =>
      adminApi.replaceOfferProducts(id, body),
    onSuccess: invalidate,
  });
}

/**
 * Replace the offer's banner carousel. Same reasoning as
 * `useReplaceOfferProducts` - the banner manager owns its own draft state
 * and commits the full ordered list on save.
 */
export function useReplaceOfferBanners(id: string) {
  const invalidate = useInvalidateAdminOffer(id);
  return useMutation({
    mutationFn: (body: AdminReplaceOfferBannersBody) =>
      adminApi.replaceOfferBanners(id, body),
    onSuccess: invalidate,
  });
}

export function useDeleteAdminOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteOffer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: offerKeys.admin.listAll });
      qc.invalidateQueries({ queryKey: ["admin", "offer"] });
      qc.invalidateQueries({ queryKey: offerKeys.public.listAll });
      qc.invalidateQueries({ queryKey: ["offer"] });
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product"] });
    },
  });
}

/* ───────────────────── Public storefront ───────────────────── */

/**
 * Live offers list for the storefront. Used by /offers, the homepage hero,
 * and the category page top strip (with `category` set to narrow). 60s
 * stale time - offers are slow-changing and the cart pricing engine doesn't
 * depend on these specific cache keys to stay fresh.
 */
export function useOffers(params: PublicListOffersParams = {}) {
  return useQuery({
    queryKey: offerKeys.public.list(params),
    queryFn: () => offersApi.list(params),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/**
 * Single offer landing page detail. `slug` may be undefined while the route
 * boots - the query stays disabled until it resolves.
 */
export function useOffer(slug: string | undefined) {
  return useQuery({
    queryKey: slug ? offerKeys.public.detail(slug) : ["offer", "noop"],
    queryFn: () => {
      if (!slug) throw new Error("Offer slug is required");
      return offersApi.get(slug);
    },
    enabled: Boolean(slug),
    staleTime: 60_000,
  });
}
