/**
 * Offer types - admin CRUD plus the public storefront shapes.
 *
 * The backend Offer doc has two audiences:
 *  - Admin dashboard (full CRUD, including draft + scheduled offers)
 *  - Storefront (only currently-live offers, no editing)
 *
 * Both consume the same wire row off /api/(admin/)?offers; the storefront
 * variant just has fewer fields populated (no audit metadata, banner-only
 * selects). We model the union as a single `Offer` read shape with
 * everything optional that's only present on the admin response.
 *
 * `discountType: "percentage"` means `discountValue` is an integer 1–100 to be
 * applied as a percent of base price. `discountType: "fixed"` means
 * `discountValue` is a currency amount in `currency` to be subtracted from
 * base (clamped at 0). The pricing engine applies offers FIRST, per-line,
 * with best-discount-wins across overlapping offers; coupons stack on the
 * resulting discounted subtotal.
 */

export type OfferDiscountType = "percentage" | "fixed";

/**
 * Lifecycle states the admin flips through. The pricing engine only applies
 * `active` offers whose window currently contains `now`:
 *  - "draft":     hidden from storefront, never priced in
 *  - "scheduled": admin staged the offer but hasn't launched it yet
 *  - "active":    live - applies between startsAt and endsAt
 *  - "ended":     kept for history; banner art can be reused on a future offer
 */
export type OfferStatus = "draft" | "scheduled" | "active" | "ended";

/* ───────────────────── Banner subdoc ───────────────────── */

/**
 * One slide in the offer's banner carousel. Stored inline on the Offer doc
 * so reorder + per-slide edits are a single document write. `_id` is server-
 * assigned and lets the dashboard's drag-drop list track which row is which
 * without inventing a synthetic key.
 *
 * `ctaHref` is free-form on purpose - admins point at internal Next routes
 * (`/products/abc`, `/categories/eid`) or absolute external URLs depending on
 * the campaign. The renderer decides between `<Link>` and `<a target="_blank">`
 * at draw time.
 */
export interface OfferBanner {
  _id: string;
  image: string;
  publicId?: string;
  /** Optional portrait image for mobile viewports (< 640 px). */
  mobileImage?: string;
  mobilePublicId?: string;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  order: number;
  isActive: boolean;
  fullWidth: boolean;
}

/* ───────────────────── Populated product ref ───────────────────── */

/**
 * Populated product shape on the admin detail + public detail responses.
 * The admin endpoint selects `title slug price compareAtPrice images`; the
 * public endpoint adds `ratingAverage ratingCount`. Both fit under this
 * superset - fields the admin doesn't get are optional.
 */
export interface OfferProductRef {
  _id: string;
  title: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  images?: Array<{ url: string; alt?: string }>;
  ratingAverage?: number;
  ratingCount?: number;
}

/* ───────────────────── Read shape ───────────────────── */

/**
 * Full offer row, returned by admin list/detail and public list/detail. The
 * `products` field carries either plain ids (list endpoints, where we keep
 * the payload light) or populated refs (detail endpoints) - consumers narrow
 * via `typeof products[0] === "string"` when needed.
 */
export interface Offer {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  discountType: OfferDiscountType;
  discountValue: number;
  status: OfferStatus;
  products: Array<OfferProductRef | string>;
  banners: OfferBanner[];
  currency: string;
  /**
   * Surfacing toggles. `showOnHomepage` drives the homepage hero banner
   * carousel; `showOnHomepageGrid` drives the 4-up tile grid below it. They
   * are independent - an admin can run a banner-only or grid-only campaign.
   */
  showOnHomepage: boolean;
  showOnHomepageGrid: boolean;
  showOnOffersPage: boolean;
  showOnCategoryStrip: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ───────────────────── Banner input ───────────────────── */

/**
 * Wire shape the banner manager submits per slide. `_id` is omitted on new
 * slides (server assigns one); on edits we still send the existing `_id` so
 * the server can preserve identity across the replace, though the backend
 * currently does a full overwrite and doesn't strictly require it.
 *
 * `order` is sent verbatim but the backend renumbers contiguous 0..n based
 * on array index, so the frontend just needs to send the array in the
 * desired final order.
 */
export interface OfferBannerInput {
  image: string;
  publicId?: string;
  mobileImage?: string;
  mobilePublicId?: string;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  order?: number;
  isActive?: boolean;
  fullWidth?: boolean;
}

/* ───────────────────── Admin payloads ───────────────────── */

export interface AdminListOffersParams {
  q?: string;
  status?: OfferStatus;
  /** Filter by validity relative to now, independent of `status`. */
  window?: "upcoming" | "live" | "past" | "all";
  page?: number;
  limit?: number;
  sort?:
    | "newest"
    | "oldest"
    | "name-asc"
    | "name-desc"
    | "ends-soonest"
    | "starts-soonest";
}

export interface AdminListOffersResponse {
  offers: Offer[];
}

export interface AdminCreateOfferBody {
  name: string;
  /** Optional - server slugifies the name when omitted. */
  slug?: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  discountType: OfferDiscountType;
  discountValue: number;
  status?: OfferStatus;
  /** Resolved product set from the selector panel. */
  products?: string[];
  banners?: OfferBannerInput[];
  currency?: string;
  showOnHomepage?: boolean;
  showOnHomepageGrid?: boolean;
  showOnOffersPage?: boolean;
  showOnCategoryStrip?: boolean;
}

/**
 * Admin update - every field is optional. Unlike coupons we don't freeze any
 * fields post-creation; the admin can rename, reslug, change discount math,
 * or extend the window at any time. The pricing engine reads the live doc on
 * each cart calc so edits propagate immediately.
 */
export type AdminUpdateOfferBody = Partial<AdminCreateOfferBody>;

/** PUT /admin/offers/:id/products - replace the whole product set. */
export interface AdminReplaceOfferProductsBody {
  products: string[];
}

/** PUT /admin/offers/:id/banners - replace the whole carousel. */
export interface AdminReplaceOfferBannersBody {
  banners: OfferBannerInput[];
}

/* ───────────────────── Public payloads ───────────────────── */

export interface PublicListOffersParams {
  /** Narrow to offers whose product set intersects this category id. */
  category?: string;
  page?: number;
  limit?: number;
  sort?: "ends-soonest" | "newest";
}

export interface PublicListOffersResponse {
  offers: Offer[];
}
