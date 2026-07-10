export interface CustomizationPatch {
  _id: string;
  name: string;
  abbreviation: string;
  color: string;
  imageUrl?: string;
  price: number;
  isActive: boolean;
  order: number;
}

export interface CustomizationAddOnPrices {
  name: number;
  number: number;
}

/**
 * Links a product or category to a customisation rule.
 * targetType="product"  → targetId is the Product ObjectId
 * targetType="category" → targetId is the category slug
 */
export interface CustomizationAssignment {
  _id?: string;
  targetType: "product" | "category";
  targetId: string;
  allPatches: boolean;
  patchIds: string[];
  allowName: boolean;
  allowNumber: boolean;
}

/** Enriched version returned by the admin GET - includes display info */
export interface CustomizationAssignmentDetail extends CustomizationAssignment {
  targetLabel: string;
  targetImage?: string;
  targetSlug?: string;
}

export interface CustomizationConfig {
  assignments: CustomizationAssignmentDetail[];
  addOnPrices: CustomizationAddOnPrices;
  patches: CustomizationPatch[];
}

export interface UpdateCustomizationConfigBody {
  assignments?: Array<Omit<CustomizationAssignment, "_id"> & { _id?: string }>;
  addOnPrices?: Partial<CustomizationAddOnPrices>;
  patches?: Array<Omit<CustomizationPatch, "_id"> & { _id?: string }>;
}

/** Public storefront response - only active patches, stripped assignments */
export interface PublicCustomizationConfig {
  assignments: CustomizationAssignment[];
  addOnPrices: CustomizationAddOnPrices;
  patches: CustomizationPatch[];
}

// kept for any legacy references
export interface EnabledProductSummary {
  _id: string;
  title: string;
  slug: string;
  image?: string;
}
