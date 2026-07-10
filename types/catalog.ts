/**
 * Shared catalog types - mirror the backend models so the frontend has a single
 * source of truth for product/category/brand shapes returned by the API.
 */

export interface CategorySummary {
  _id: string;
  name: string;
  slug: string;
  path: string;
}

/**
 * Category summary with its ancestor chain populated. Returned by the product
 * detail endpoint so the PDP meta block can render the full hierarchy as
 * clickable breadcrumb-style links (e.g. Skin → Face → Serums).
 */
export interface CategorySummaryWithAncestors extends CategorySummary {
  ancestors?: CategorySummary[];
}

export interface CategoryTreeNode extends CategorySummary {
  parent: string | null;
  order: number;
  isActive: boolean;
  image?: string;
  icon?: string;
  children: CategoryTreeNode[];
}

export interface CategoryDetail extends CategorySummary {
  description?: string;
  image?: string;
  icon?: string;
  parent: string | null;
  ancestors: string[];
  order: number;
  isActive: boolean;
  metaTitle?: string;
  metaDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandSummary {
  _id: string;
  name: string;
  slug: string;
  logo?: string;
}

/**
 * Slim seller reference attached to product detail responses. `storeSlug` is
 * the public storefront slug - only present once the seller has published at
 * least one product. The frontend uses it to render the "by {seller}" line
 * as a link when available.
 */
export interface SellerRef {
  _id: string;
  name: string;
  avatar?: string;
  storeSlug?: string | null;
}

export interface BrandDetail extends BrandSummary {
  description?: string;
  banner?: string;
  website?: string;
  isActive: boolean;
  isFeatured: boolean;
  order: number;
  metaTitle?: string;
  metaDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SizeChartRow {
  size: string;
  values: string[];
}

export interface SizeChart {
  unit: "cm" | "inches";
  columns: string[];
  rows: SizeChartRow[];
  notes?: string;
}

export interface ProductImage {
  _id?: string;
  url: string;
  alt?: string;
  publicId?: string;
  width?: number;
  height?: number;
  order?: number;
}

export interface ProductVariant {
  _id?: string;
  sku: string;
  options?: Record<string, string>;
  price?: number;
  compareAtPrice?: number;
  stock: number;
  image?: string;
  isActive?: boolean;
}

/**
 * Snapshot of the best offer that currently applies to a product. The
 * pricing engine decorates list/detail responses by rewriting `price` to the
 * discounted unit price, setting `compareAtPrice` to the original, and
 * attaching this object so the UI can render an "X% off" badge and a
 * deep-link to the offer page.
 */
export interface ProductActiveOffer {
  id: string;
  name: string;
  slug: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  savedPerUnit: number;
}

export interface ProductSummary {
  _id: string;
  title: string;
  slug: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  stock: number;
  images: ProductImage[];
  ratingAverage: number;
  ratingCount: number;
  isFeatured: boolean;
  category: CategorySummary | string;
  brand?: BrandSummary | string;
  activeOffer?: ProductActiveOffer;
  /**
   * List responses ship the full variant array (the list endpoint doesn't
   * narrow fields), so cards can detect "needs a size/option choice" and
   * route to the PDP instead of adding a variant-less line that checkout
   * would reject with VARIANT_REQUIRED.
   */
  variants?: ProductVariant[];
}

export interface ProductDetail extends Omit<ProductSummary, "category"> {
  description?: string;
  /**
   * Primary category - populated with its ancestor chain on the detail
   * endpoint so the PDP can render the full breadcrumb (Skin → Face →
   * Serums) as clickable links.
   */
  category: CategorySummaryWithAncestors | string;
  /**
   * Extra/secondary categories the seller tagged the product with. Populated
   * to the slim `CategorySummary` shape on the detail endpoint; older list
   * responses may still ship raw IDs.
   */
  categories?: Array<CategorySummary | string>;
  variants: ProductVariant[];
  tags: string[];
  attributes?: Record<string, string>;
  trackStock: boolean;
  isActive: boolean;
  /** Lifecycle state - "discontinued" products are 301/410'd by middleware. */
  lifecycleStatus?: "active" | "discontinued";
  /** Replacement product (301 target) when discontinued - id or populated ref. */
  replacedBy?:
    | string
    | {
        _id: string;
        slug: string;
        title?: string;
        price?: number;
        images?: ProductImage[];
      }
    | null;
  metaTitle?: string;
  metaDescription?: string;
  /** Optional product-level code / base SKU. */
  sku?: string;
  /** Structured size chart for apparel, footwear, etc. */
  sizeChart?: SizeChart;
  seller: string | SellerRef;
  createdAt: string;
  updatedAt: string;
}

export type ProductSort =
  | "newest"
  | "price-asc"
  | "price-desc"
  | "rating-desc"
  | "popular"
  | "relevance";

/**
 * Public seller storefront - the response shape for `/api/sellers/:slug`.
 * `isSuspended` lets the storefront page render a polite "currently unavailable"
 * notice instead of a 404 when an admin has paused the seller.
 */
export interface PublicSellerProfile {
  id: string;
  name: string;
  avatar?: string;
  storeSlug: string;
  storeBio?: string | null;
  isSuspended: boolean;
  joinedAt: string;
}

export interface PublicSellerStore {
  profile: PublicSellerProfile;
  products: ProductSummary[];
}

export interface ProductListQuery {
  q?: string;
  category?: string;
  categoryPath?: string;
  brand?: string;
  brandSlug?: string;
  seller?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock?: boolean;
  isFeatured?: boolean;
  tags?: string;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

/**
 * Single suggestion entry returned by /products/suggest. Slimmed down from
 * ProductSummary because the predictive dropdown only renders an image,
 * name, and price - fewer fields keep the response payload small and the
 * Levenshtein backend query cheap.
 */
export interface SearchSuggestion {
  _id: string;
  name: string;
  slug: string;
  price: number;
  image?: string;
}

/**
 * Response shape for /products/suggest. When `corrected` is non-null the
 * backend rewrote the query because the original returned zero hits; the
 * client should surface "Showing results for {corrected} - Search instead
 * for [original]" so the user can recover from a mistype with one click.
 */
export interface SearchSuggestResponse {
  original: string;
  corrected: string | null;
  suggestions: SearchSuggestion[];
}
