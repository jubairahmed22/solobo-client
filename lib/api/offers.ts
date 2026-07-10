import { apiClient } from "./client";
import type { ApiResponse, PaginationMeta } from "@/types/api";
import type {
  Offer,
  PublicListOffersParams,
  PublicListOffersResponse,
} from "@/types/offer";

/**
 * Public storefront offer endpoints. Anonymous-readable, no auth. The admin
 * CRUD surface lives in `lib/api/admin.ts` under the `/admin/offers/*` prefix
 * and uses the same `Offer` read type - only the writes and filtering knobs
 * differ.
 *
 * Both endpoints return only currently-live offers: status === "active" and
 * the validity window contains `now`. Filtering, pagination, and sort
 * happen server-side; this client just shapes the request and unwraps the
 * envelope.
 */

export class OffersError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await promise;
  if (res.data.success) return res.data.data;
  throw new OffersError(res.data.message, res.data.code ?? "ERROR");
}

async function unwrapWithMeta<T>(
  promise: Promise<{ data: ApiResponse<T> }>,
): Promise<{ data: T; meta?: PaginationMeta }> {
  const res = await promise;
  if (res.data.success) return { data: res.data.data, meta: res.data.meta };
  throw new OffersError(res.data.message, res.data.code ?? "ERROR");
}

export const offersApi = {
  /**
   * GET /offers - live offers, paginated. Used by the /offers index page, the
   * homepage hero carousel (with the showOnHomepage flag honored client-side
   * via the populated banner list), and the category page top strip.
   */
  list: (params: PublicListOffersParams = {}) =>
    unwrapWithMeta<PublicListOffersResponse>(
      apiClient.get("/offers", { params }),
    ),

  /**
   * GET /offers/:slug - single offer landing page, with `products` populated
   * (title/slug/price/compareAtPrice/images/ratings) so the page can render
   * a product grid without a follow-up round-trip.
   */
  get: (slug: string) =>
    unwrap<Offer>(apiClient.get(`/offers/${encodeURIComponent(slug)}`)),
};
