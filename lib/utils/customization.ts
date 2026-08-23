import type {
  CustomizationAssignment,
  CustomizationPatch,
  PublicCustomizationConfig,
} from "@/types/customization";

/**
 * Shared assignment-matching logic for the PDP and the POS configurator.
 * Mirrors the server's `priceCustomizations` resolution: a product-level
 * assignment wins, otherwise any category the product belongs to (including
 * ancestors - category `path` is the full slug chain) matches.
 */

interface CategoryLike {
  slug?: string;
  path?: string;
  ancestors?: Array<{ slug?: string; path?: string } | string>;
}

/**
 * Every category slug a product belongs to, directly or via ancestors:
 * the primary category chain plus the secondary `categories[]`. Splitting
 * `path` ("jerseys/club-kits/arsenal") also covers ancestors that aren't
 * populated on the response.
 */
export function collectCategorySlugs(product: {
  category?: CategoryLike | string | null;
  categories?: Array<CategoryLike | string> | null;
}): string[] {
  const slugs = new Set<string>();
  const addCategory = (c: CategoryLike | string | null | undefined) => {
    if (!c || typeof c !== "object") return;
    if (c.slug) slugs.add(c.slug);
    for (const seg of (c.path ?? "").split("/")) if (seg) slugs.add(seg);
  };
  const primary = typeof product.category === "object" ? product.category : undefined;
  addCategory(primary);
  for (const a of primary?.ancestors ?? []) addCategory(a as CategoryLike | string);
  for (const c of product.categories ?? []) addCategory(c);
  return Array.from(slugs);
}

/** Most specific matching assignment: product-level first, then category. */
export function matchAssignment(
  assignments: CustomizationAssignment[],
  productId: string,
  categorySlugs: string[],
): CustomizationAssignment | null {
  const productMatch = assignments.find(
    (a) => a.targetType === "product" && a.targetId === productId,
  );
  if (productMatch) return productMatch;
  return (
    assignments.find(
      (a) => a.targetType === "category" && categorySlugs.includes(a.targetId),
    ) ?? null
  );
}

/** Active patches the assignment permits, in display order. */
export function allowedPatches(
  config: PublicCustomizationConfig | null | undefined,
  assignment: CustomizationAssignment | null,
): CustomizationPatch[] {
  if (!config || !assignment) return [];
  const active = config.patches
    .filter((p) => p.isActive)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (assignment.allPatches) return active;
  return active.filter((p) => assignment.patchIds.includes(p._id));
}
