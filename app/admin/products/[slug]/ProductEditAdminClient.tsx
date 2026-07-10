"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Ruler,
  Save,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Badge, Button, Input, Label, Spinner } from "@/components/ui";
import { FormStickyBar } from "@/components/admin/FormStickyBar";
import { cn } from "@/lib/utils/cn";
import {
  SeoSection,
  Select,
  type SelectOption,
  ProductSelector,
  type ProductChipSeed,
  AttributesEditor,
  attributesToDrafts,
  draftsToAttributes,
  type AttributeDraft,
  ImageUploader,
  VariantsEditor,
  variantToDraft,
  draftsToVariantInputs,
  extractOptionDefs,
  type VariantDraft,
  type OptionDef,
  SizeChartEditor,
  sizeChartToDraft,
  draftToSizeChartInput,
  type SizeChartDraft,
} from "@/components/composed";
import type { UploadedImage } from "@/types/uploads";
import { useUIStore } from "@/store/uiStore";
import {
  useAdminCategory,
  useAdminProduct,
  useDeleteAdminProduct,
  useUpdateAdminProduct,
} from "@/hooks/useAdmin";
import { useBrands, useCategories } from "@/hooks/useCatalog";
import { AdminError } from "@/lib/api/admin";
import type {
  AdminProductDetail,
  AdminProductPatch,
  AdminProductVariantInput,
} from "@/types/admin";
import type { CategorySummary, CategoryTreeNode, SizeChart } from "@/types/catalog";

/* "" Schema "" */

const schema = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "At least 3 characters")
    .max(220)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens"),
  shortDescription: z.string().trim().max(280).or(z.literal("")),
  description: z.string().trim().max(8000).or(z.literal("")),
  price: z.coerce.number().min(0, "Must be 0 or more"),
  compareAtPrice: z
    .union([z.coerce.number().min(0), z.literal("")])
    .transform((v) => (v === "" ? undefined : v)),
  stock: z.coerce.number().int().min(0, "Must be 0 or more"),
  trackStock: z.boolean(),
  lowStockThreshold: z.coerce.number().int().min(0, "Must be 0 or more").max(10_000),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  /* Organization */
  sku: z.string().trim().toUpperCase().max(80).or(z.literal("")),
  tagsCsv: z.string().trim().max(800),
  category: z.string().trim().min(1, "Pick a category"),
  brand: z.string().trim(),
  /* SEO */
  metaTitle: z.string().trim().max(160, "Max 160 characters").or(z.literal("")),
  metaDescription: z.string().trim().max(320, "Max 320 characters").or(z.literal("")),
  lifecycleStatus: z.enum(["active", "discontinued"]),
  replacedBy: z.string().trim(),
});
type FormValues = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

function toPatch(
  values: FormOutput,
  attributes: AttributeDraft[],
  images: UploadedImage[],
  variants: VariantDraft[],
  categories: string[],
  sizeChart: SizeChartDraft | null,
  sizeChartRemoved: boolean,
): AdminProductPatch {
  const tags = values.tagsCsv
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  let sizeChartValue: AdminProductPatch["sizeChart"];
  if (sizeChartRemoved) {
    sizeChartValue = null;
  } else if (sizeChart) {
    sizeChartValue = draftToSizeChartInput(sizeChart) ?? undefined;
  }
  return {
    attributes: draftsToAttributes(attributes) ?? {},
    title: values.title,
    slug: values.slug,
    shortDescription: values.shortDescription || undefined,
    description: values.description || undefined,
    price: values.price,
    compareAtPrice: values.compareAtPrice ?? undefined,
    stock: values.stock,
    trackStock: values.trackStock,
    lowStockThreshold: values.lowStockThreshold,
    isActive: values.isActive,
    isFeatured: values.isFeatured,
    sku: values.sku || undefined,
    tags,
    category: values.category || undefined,
    categories: categories.length ? categories : [],
    brand: values.brand || undefined,
    metaTitle: values.metaTitle || undefined,
    metaDescription: values.metaDescription || undefined,
    lifecycleStatus: values.lifecycleStatus,
    replacedBy:
      values.lifecycleStatus === "discontinued" && values.replacedBy
        ? values.replacedBy
        : undefined,
    images,
    variants: draftsToVariantInputs(variants) as AdminProductVariantInput[],
    sizeChart: sizeChartValue,
  };
}

function replacedById(rb: AdminProductDetail["replacedBy"]): string {
  if (!rb) return "";
  return typeof rb === "string" ? rb : rb._id;
}

function categoryId(cat: AdminProductDetail["category"]): string {
  if (!cat) return "";
  return typeof cat === "string" ? cat : cat.id;
}

function brandId(b: AdminProductDetail["brand"]): string {
  if (!b) return "";
  return typeof b === "string" ? b : b.id;
}

function extractCategoryIds(cats: AdminProductDetail["categories"]): string[] {
  if (!cats?.length) return [];
  return cats
    .map((c): string => (typeof c === "string" ? c : (c as CategorySummary)._id))
    .filter(Boolean);
}

function flattenCategoryTree(nodes: CategoryTreeNode[], prefix = ""): SelectOption[] {
  const out: SelectOption[] = [];
  for (const node of nodes) {
    if (!node.isActive) continue;
    const label = prefix ? `${prefix} › ${node.name}` : node.name;
    out.push({ value: node._id, label });
    if (node.children?.length) out.push(...flattenCategoryTree(node.children, label));
  }
  return out;
}

/* "" Page wrapper "" */

export function ProductEditAdminClient({ slug }: { slug: string }) {
  const router = useRouter();
  const toast = useUIStore((s) => s.toast);
  const { data: product, isLoading, isError, error, refetch } = useAdminProduct(slug);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-sm border border-neutral-200 bg-paper">
        <Spinner />
      </div>
    );
  }

  if (isError || !product) {
    const message = error instanceof AdminError ? error.message : "Couldn't load product.";
    return (
      <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
        <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
        <p className="text-sm text-neutral-500">{message}</p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
          <Link
            href="/admin/products"
            className="text-sm text-neutral-600 underline-offset-2 hover:underline"
          >
            Back to products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ProductEditForm
      key={product._id}
      product={product}
      onDeleted={() => {
        toast({ title: "Product deleted", tone: "success" });
        router.push("/admin/products");
      }}
    />
  );
}

/* "" Form "" */

interface ProductEditFormProps {
  product: AdminProductDetail;
  onDeleted: () => void;
}

function ProductEditForm({ product, onDeleted }: ProductEditFormProps) {
  const toast = useUIStore((s) => s.toast);
  const update = useUpdateAdminProduct(product._id);
  const remove = useDeleteAdminProduct();

  const categoriesQuery = useCategories({ shape: "tree", isActive: true });
  const brandsQuery = useBrands({ isActive: true, limit: 100 });

  const flatCategories = React.useMemo<SelectOption[]>(() => {
    if (!categoriesQuery.data) return [];
    return flattenCategoryTree(categoriesQuery.data);
  }, [categoriesQuery.data]);

  const categoryOptions = React.useMemo<SelectOption[]>(
    () => [{ value: "", label: "-- Pick a category --" }, ...flatCategories],
    [flatCategories],
  );

  const brandOptions = React.useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [{ value: "", label: "-- No brand --" }];
    if (brandsQuery.data?.data) {
      for (const b of brandsQuery.data.data) opts.push({ value: b._id, label: b.name });
    }
    return opts;
  }, [brandsQuery.data]);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: product.title,
      slug: product.slug,
      shortDescription: product.shortDescription ?? "",
      description: product.description ?? "",
      price: product.price,
      compareAtPrice: product.compareAtPrice ?? "",
      stock: product.stock,
      trackStock: product.trackStock,
      lowStockThreshold: (product as AdminProductDetail & { lowStockThreshold?: number }).lowStockThreshold ?? 5,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      sku: (product as AdminProductDetail & { sku?: string }).sku ?? "",
      tagsCsv: (product.tags ?? []).join(", "),
      category: categoryId(product.category),
      brand: brandId(product.brand),
      metaTitle: product.metaTitle ?? "",
      metaDescription: product.metaDescription ?? "",
      lifecycleStatus: product.lifecycleStatus ?? "active",
      replacedBy: replacedById(product.replacedBy),
    },
  });

  /* Attributes */
  const [attributes, setAttributes] = React.useState<AttributeDraft[]>(() =>
    attributesToDrafts(product.attributes),
  );
  const [attributesDirty, setAttributesDirty] = React.useState(false);
  const onAttributesChange = (next: AttributeDraft[]) => {
    setAttributes(next);
    setAttributesDirty(true);
  };

  /* Images */
  const [images, setImages] = React.useState<UploadedImage[]>(() =>
    (product.images ?? []).map((img) => ({
      url: img.url,
      alt: img.alt ?? "",
      publicId: img.publicId,
    })),
  );
  const [imagesDirty, setImagesDirty] = React.useState(false);
  const onImagesChange = (next: UploadedImage[]) => {
    setImages(next);
    setImagesDirty(true);
  };

  /* Variants */
  const [variantOptions, setVariantOptions] = React.useState<OptionDef[]>(() =>
    extractOptionDefs((product.variants ?? []).map(variantToDraft)),
  );
  const [variants, setVariants] = React.useState<VariantDraft[]>(() =>
    (product.variants ?? []).map(variantToDraft),
  );
  const [variantsDirty, setVariantsDirty] = React.useState(false);
  const onVariantOptionsChange = (next: OptionDef[]) => {
    setVariantOptions(next);
    setVariantsDirty(true);
  };
  const onVariantsChange = (next: VariantDraft[]) => {
    setVariants(next);
    setVariantsDirty(true);
  };

  /* Secondary categories */
  const [secondaryCategories, setSecondaryCategories] = React.useState<string[]>(() =>
    extractCategoryIds(product.categories),
  );
  const [categoriesDirty, setCategoriesDirty] = React.useState(false);
  const addSecondaryCategory = (id: string) => {
    setSecondaryCategories((prev) => [...prev, id]);
    setCategoriesDirty(true);
  };
  const removeSecondaryCategory = (id: string) => {
    setSecondaryCategories((prev) => prev.filter((c) => c !== id));
    setCategoriesDirty(true);
  };

  /* Size chart */
  const [sizeChart, setSizeChart] = React.useState<SizeChartDraft | null>(() => {
    const raw = (product as AdminProductDetail & { sizeChart?: SizeChart }).sizeChart;
    return raw ? sizeChartToDraft(raw) : null;
  });
  const [sizeChartDirty, setSizeChartDirty] = React.useState(false);
  const [sizeChartRemoved, setSizeChartRemoved] = React.useState(false);
  const onSizeChartChange = (next: SizeChartDraft | null) => {
    setSizeChart(next);
    setSizeChartDirty(true);
    if (next === null) setSizeChartRemoved(true);
    else setSizeChartRemoved(false);
  };

  /* Watches */
  const slugDraft = watch("slug");
  const priceDraft = watch("price");
  const metaTitleDraft = watch("metaTitle");
  const metaDescriptionDraft = watch("metaDescription");
  const lifecycleDraft = watch("lifecycleStatus");
  const replacedByDraft = watch("replacedBy");
  const categoryDraft = watch("category");
  const { data: primaryCategory } = useAdminCategory(categoryDraft || undefined);

  const availableSecondary = React.useMemo(
    () =>
      flatCategories.filter(
        (c) => c.value !== categoryDraft && !secondaryCategories.includes(c.value),
      ),
    [flatCategories, categoryDraft, secondaryCategories],
  );

  const replacementSeed: ProductChipSeed[] =
    product.replacedBy && typeof product.replacedBy === "object"
      ? [
          {
            _id: product.replacedBy._id,
            title: product.replacedBy.title ?? "Replacement product",
            slug: product.replacedBy.slug,
            price: product.replacedBy.price,
            image: product.replacedBy.images?.[0]?.url,
          },
        ]
      : [];

  const anyDirty =
    isDirty ||
    attributesDirty ||
    imagesDirty ||
    variantsDirty ||
    categoriesDirty ||
    sizeChartDirty;

  const onSubmit = handleSubmit(async (raw) => {
    const parsed = schema.parse(raw);
    try {
      const updated = await update.mutateAsync(
        toPatch(
          parsed,
          attributes,
          images,
          variants,
          secondaryCategories,
          sizeChart,
          sizeChartRemoved,
        ),
      );
      toast({ title: "Product saved", tone: "success" });

      setAttributes(attributesToDrafts(updated.attributes));
      setAttributesDirty(false);

      setVariantsDirty(false);

      setImages(
        (updated.images ?? []).map((img) => ({
          url: img.url,
          alt: img.alt ?? "",
          publicId: img.publicId,
        })),
      );
      setImagesDirty(false);

      const updatedCats = extractCategoryIds(updated.categories);
      setSecondaryCategories(updatedCats);
      setCategoriesDirty(false);

      const updatedChart = (updated as AdminProductDetail & { sizeChart?: SizeChart }).sizeChart;
      setSizeChart(updatedChart ? sizeChartToDraft(updatedChart) : null);
      setSizeChartDirty(false);
      setSizeChartRemoved(false);

      reset({
        title: updated.title,
        slug: updated.slug,
        shortDescription: updated.shortDescription ?? "",
        description: updated.description ?? "",
        price: updated.price,
        compareAtPrice: updated.compareAtPrice ?? "",
        stock: updated.stock,
        trackStock: updated.trackStock,
        lowStockThreshold:
          (updated as AdminProductDetail & { lowStockThreshold?: number }).lowStockThreshold ?? 5,
        isActive: updated.isActive,
        isFeatured: updated.isFeatured,
        sku: (updated as AdminProductDetail & { sku?: string }).sku ?? "",
        tagsCsv: (updated.tags ?? []).join(", "),
        category: categoryId(updated.category),
        brand: brandId(updated.brand),
        metaTitle: updated.metaTitle ?? "",
        metaDescription: updated.metaDescription ?? "",
        lifecycleStatus: updated.lifecycleStatus ?? "active",
        replacedBy: replacedById(updated.replacedBy),
      });
    } catch (err) {
      if (err instanceof AdminError) {
        if (err.fieldErrors?.length) {
          for (const fe of err.fieldErrors) {
            const path = fe.path.split(".").pop() as keyof FormValues | undefined;
            if (path && path in raw) setError(path, { message: fe.message });
          }
        }
        toast({ title: "Could not save", description: err.message, tone: "error" });
      } else {
        toast({ title: "Could not save", tone: "error" });
      }
    }
  });

  const onDelete = async () => {
    if (
      !window.confirm(
        `Delete "${product.title}"? This cannot be undone — orders that reference it will keep their snapshot copy.`,
      )
    ) {
      return;
    }
    try {
      await remove.mutateAsync(product._id);
      onDeleted();
    } catch (err) {
      toast({
        title: err instanceof AdminError ? err.message : "Couldn't delete",
        tone: "error",
      });
    }
  };

  const variantsCount = variants.length;
  const variantsStock = variants.reduce(
    (s, v) => s + (Number.isFinite(Number(v.stock)) ? Number(v.stock) : 0),
    0,
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to products
          </Link>
          <h1 className="text-2xl font-semibold text-ink">{product.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <Badge variant={product.isActive ? "solid" : "muted"}>
              {product.isActive ? "Active" : "Hidden"}
            </Badge>
            {product.isFeatured ? (
              <Badge variant="outline" className="gap-1">
                <Star className="h-3 w-3" aria-hidden /> Featured
              </Badge>
            ) : null}
            <span>·</span>
            <span>
              {product.category?.name ?? "Uncategorised"}
              {product.brand?.name ? ` · ${product.brand.name}` : ""}
            </span>
            <span>·</span>
            <span>Seller: {product.seller?.name ?? "-"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/product/${slugDraft || product.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-sm border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-ink hover:text-ink"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Preview
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={remove.isPending || update.isPending}
          >
            {remove.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden />
            )}
            <span className="ml-1.5">Delete</span>
          </Button>
          <Button type="submit" size="sm" disabled={!anyDirty || update.isPending}>
            {update.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            <span className="ml-1.5">Save</span>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* "" Main column "" */}
        <div className="flex flex-col gap-4">

          {/* Basics */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Basics</h2>
            <Field label="Title" error={errors.title?.message}>
              <Input invalid={!!errors.title} {...register("title")} />
            </Field>
            <Field
              label="Slug"
              error={errors.slug?.message}
              hint={`Visible at /product/${slugDraft || "..."}`}
            >
              <Input invalid={!!errors.slug} {...register("slug")} />
            </Field>
            <Field
              label="Short description"
              error={errors.shortDescription?.message}
              hint="Shown on cards and search results (max 280 chars)."
            >
              <Input invalid={!!errors.shortDescription} {...register("shortDescription")} />
            </Field>
            <Field label="Description" error={errors.description?.message}>
              <textarea rows={6} {...register("description")} className={textareaClass} />
            </Field>
          </section>

          {/* Photos */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-ink">Photos</h2>
              <span className="text-xs text-neutral-400">{images.length} / 8</span>
            </div>
            <p className="text-sm text-neutral-500">
              First image is the product card hero. Drag to reorder. Add alt text for SEO &amp; accessibility.
            </p>
            <ImageUploader
              value={images}
              onChange={onImagesChange}
              scope="product"
              max={8}
              hint="Up to 8 images · JPG, PNG, WEBP or AVIF · max 8 MB each"
            />
          </section>

          {/* Pricing + Inventory */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
              <h2 className="text-base font-semibold text-ink">Pricing</h2>
              <Field label={`Price (${product.currency})`} error={errors.price?.message}>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  invalid={!!errors.price}
                  {...register("price")}
                />
              </Field>
              <Field
                label="Compare-at price (Was)"
                error={errors.compareAtPrice?.message}
                hint="Shown as strikethrough on the product card. Fill manually or use the helper below."
              >
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  invalid={!!errors.compareAtPrice}
                  {...register("compareAtPrice")}
                />
              </Field>
              <DiscountHelper
                price={priceDraft}
                onSet={(v) => setValue("compareAtPrice", v, { shouldDirty: true })}
                currency={product.currency}
              />
            </section>

            <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
              <h2 className="text-base font-semibold text-ink">Inventory</h2>
              <Field label="Stock" error={errors.stock?.message}>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  invalid={!!errors.stock}
                  disabled={variantsCount > 0}
                  {...register("stock")}
                />
              </Field>
              {variantsCount > 0 ? (
                <p className="text-xs text-neutral-500">
                  Summed from {variantsCount} variants —{" "}
                  <span className="tabular-nums text-ink">{variantsStock}</span> total.
                </p>
              ) : null}
              <CheckboxField
                label="Track stock"
                hint="Disable for digital goods or services."
                {...register("trackStock")}
              />
              <Field
                label="Low-stock alert"
                error={errors.lowStockThreshold?.message}
                hint="Set 0 to disable."
              >
                <Input
                  type="number"
                  min={0}
                  step={1}
                  invalid={!!errors.lowStockThreshold}
                  {...register("lowStockThreshold")}
                />
              </Field>
            </section>
          </div>

          {/* Variants */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-ink">Variants</h2>
              {variantsCount > 0 ? (
                <span className="text-xs text-neutral-400">
                  {variantsCount} variants · {variantsStock} total stock
                </span>
              ) : null}
            </div>
            <p className="text-sm text-neutral-500">
              Define options like Size or Color — variants are generated automatically. Each variant can have its own price and stock.
            </p>
            <VariantsEditor
              options={variantOptions}
              onOptionsChange={onVariantOptionsChange}
              variants={variants}
              onVariantsChange={onVariantsChange}
              currency={product.currency}
              max={100}
            />
          </section>

          {/* Attributes */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Attributes &amp; specifications</h2>
            <p className="text-sm text-neutral-500">
              Industry-standard specs like Fabric, Material, Fit, Technology — or anything custom. Improves search &amp; AI discoverability.
            </p>
            <AttributesEditor value={attributes} onChange={onAttributesChange} max={30} />
          </section>

          {/* Size chart */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-3">
                <h2 className="text-base font-semibold text-ink">Size chart</h2>
                {sizeChart ? (
                  <span className="text-xs text-neutral-400">
                    {sizeChart.rows.length} sizes · {sizeChart.columns.length} measurements
                  </span>
                ) : null}
              </div>
              {primaryCategory?.sizeChart ? (
                <button
                  type="button"
                  onClick={() => {
                    if (primaryCategory.sizeChart) {
                      onSizeChartChange(sizeChartToDraft(primaryCategory.sizeChart));
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-600 hover:border-ink hover:text-ink"
                >
                  <Ruler className="h-3.5 w-3.5" aria-hidden />
                  Use {primaryCategory.name}&apos;s chart
                </button>
              ) : null}
            </div>
            <p className="text-sm text-neutral-500">
              A measurement table shown on the product page. Use presets for jerseys, shoes, or kids apparel — or build your own. Save as a template to reuse on similar products.
            </p>
            <SizeChartEditor value={sizeChart} onChange={onSizeChartChange} />
          </section>

          {/* SEO */}
          <SeoSection
            register={register}
            errors={errors}
            metaTitle={metaTitleDraft}
            metaDescription={metaDescriptionDraft}
            titleFallback={watch("title")}
            descriptionFallback={watch("shortDescription")}
            slug={slugDraft}
          />
        </div>

        {/* "" Sidebar "" */}
        <aside className="flex flex-col gap-4">

          {/* Status */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Status</h2>
            <CheckboxField
              label="Active"
              hint="Hidden products don't appear in storefront listings or search."
              {...register("isActive")}
            />
            <CheckboxField
              label="Featured"
              hint="Surfaces in the homepage featured row."
              {...register("isFeatured")}
            />
          </section>

          {/* Lifecycle */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Lifecycle &amp; SEO status</h2>
            <Field
              label="Status"
              hint={
                lifecycleDraft === "discontinued"
                  ? "Discontinued products are removed from listings. Visitors are 301-redirected to the replacement below, or shown a 410 Gone page when none is set."
                  : "Active products resolve normally (200). Out-of-stock is handled automatically."
              }
            >
              <Select
                options={[
                  { value: "active", label: "Active" },
                  { value: "discontinued", label: "Discontinued" },
                ]}
                {...register("lifecycleStatus")}
              />
            </Field>
            {lifecycleDraft === "discontinued" ? (
              <ProductSelector
                label="Replacement product (301 target)"
                value={replacedByDraft ? [replacedByDraft] : []}
                onChange={(ids) =>
                  setValue("replacedBy", ids[0] ?? "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                seed={replacementSeed}
                max={1}
                emptyHint="No replacement set — visitors will get a 410 Gone page. Pick one to 301-redirect them instead."
              />
            ) : null}
          </section>

          {/* Meta */}
          <section className="flex flex-col gap-2 rounded-sm border border-neutral-200 bg-paper p-3 text-xs text-neutral-500">
            <h2 className="text-sm font-semibold text-ink">Meta</h2>
            <div className="flex items-center justify-between">
              <span>Rating</span>
              <span className="tabular-nums text-ink">
                {product.ratingAverage.toFixed(1)} ({product.ratingCount.toLocaleString("en-US")})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Variants</span>
              <span className="tabular-nums text-ink">{product.variants?.length ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Created</span>
              <span>{new Date(product.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Updated</span>
              <span>{new Date(product.updatedAt).toLocaleDateString()}</span>
            </div>
          </section>

          {/* Organization */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Organization</h2>

            <Field
              label="Product code (SKU)"
              error={errors.sku?.message}
              hint="Optional base code. Variant SKUs are set per-variant above."
            >
              <Input
                invalid={!!errors.sku}
                placeholder="ARGENTINA_2026_WC_HOME_JERSEY"
                className="font-mono uppercase"
                {...register("sku")}
              />
            </Field>

            <Field
              label="Primary category"
              error={errors.category?.message}
              hint={categoriesQuery.isError ? "Couldn't load categories." : "Required."}
            >
              <Select
                options={categoryOptions}
                invalid={!!errors.category}
                disabled={categoriesQuery.isLoading}
                {...register("category")}
              />
            </Field>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-neutral-500">Secondary categories</span>
              {secondaryCategories.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {secondaryCategories.map((id) => {
                    const cat = flatCategories.find((c) => c.value === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-sm bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                      >
                        <Tag className="h-3 w-3 text-neutral-400" aria-hidden />
                        {cat?.label ?? id}
                        <button
                          type="button"
                          onClick={() => removeSecondaryCategory(id)}
                          className="text-neutral-400 hover:text-ink"
                          aria-label="Remove category"
                        >
                          <X className="h-2.5 w-2.5" aria-hidden />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : null}
              {availableSecondary.length > 0 ? (
                <select
                  className="block w-full rounded-sm border border-neutral-200 bg-paper px-2.5 py-1.5 text-sm text-ink focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1"
                  value=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) addSecondaryCategory(id);
                  }}
                >
                  <option value="">+ Add secondary category...</option>
                  {availableSecondary.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              ) : null}
              <p className="text-xs text-neutral-400">
                Cross-list under additional categories for broader discovery.
              </p>
            </div>

            <Field
              label="Brand"
              error={errors.brand?.message}
              hint={brandsQuery.isError ? "Couldn't load brands." : "Optional."}
            >
              <Select
                options={brandOptions}
                invalid={!!errors.brand}
                disabled={brandsQuery.isLoading}
                {...register("brand")}
              />
            </Field>

            <Field
              label="Tags"
              error={errors.tagsCsv?.message}
              hint="Comma-separated. Used for search and merchandising."
            >
              <Input
                invalid={!!errors.tagsCsv}
                placeholder="argentina, world-cup-2026, adidas, jersey"
                {...register("tagsCsv")}
              />
            </Field>
          </section>

        </aside>
      </div>

      <FormStickyBar
        mode="edit"
        isDirty={anyDirty}
        isSubmitting={update.isPending}
      />
    </form>
  );
}

/* "" Primitives "" */

function DiscountHelper({
  price,
  onSet,
  currency = "BDT",
}: {
  price: number;
  onSet: (compareAt: number) => void;
  currency?: string;
}) {
  const [mode, setMode] = React.useState<"pct" | "amt">("pct");
  const [input, setInput] = React.useState("");
  const numPrice = Number(price);

  const calculated = React.useMemo(() => {
    const n = parseFloat(input);
    if (!n || !numPrice || n <= 0) return undefined;
    if (mode === "pct") {
      if (n >= 100) return undefined;
      return Math.round(numPrice / (1 - n / 100));
    }
    return Math.round(numPrice + n);
  }, [mode, input, numPrice]);

  const preview =
    calculated !== undefined
      ? currency === "BDT"
        ? `Was Tk ${calculated.toLocaleString("en-IN")}`
        : `Was ${currency} ${calculated}`
      : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-sm border border-dashed border-neutral-200 bg-neutral-50 px-2.5 py-1.5">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
        Quick discount
      </span>
      <div className="flex overflow-hidden rounded-sm border border-neutral-200 text-[11px]">
        <button
          type="button"
          onClick={() => { setMode("pct"); setInput(""); }}
          className={cn(
            "px-2 py-0.5 transition-colors",
            mode === "pct" ? "bg-ink text-paper" : "bg-paper text-neutral-500 hover:text-ink",
          )}
        >
          % off
        </button>
        <button
          type="button"
          onClick={() => { setMode("amt"); setInput(""); }}
          className={cn(
            "px-2 py-0.5 transition-colors",
            mode === "amt" ? "bg-ink text-paper" : "bg-paper text-neutral-500 hover:text-ink",
          )}
        >
          {currency === "BDT" ? "Tk" : currency} off
        </button>
      </div>
      <input
        type="number"
        min={0}
        max={mode === "pct" ? 99 : undefined}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={mode === "pct" ? "e.g. 20" : "e.g. 200"}
        className="w-24 rounded-sm border border-neutral-200 bg-paper px-2 py-0.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-ink"
      />
      {preview ? (
        <span className="text-[11px] text-neutral-500">{preview}</span>
      ) : null}
      <button
        type="button"
        onClick={() => {
          if (calculated !== undefined) {
            onSet(calculated);
            setInput("");
          }
        }}
        disabled={calculated === undefined || !numPrice}
        className="ml-auto rounded-sm bg-ink px-2 py-0.5 text-[11px] font-medium text-paper transition-colors hover:bg-neutral-800 disabled:opacity-40"
      >
        Set
      </button>
    </div>
  );
}

const textareaClass =
  "block w-full rounded-sm border border-neutral-200 bg-paper px-2.5 py-1.5 text-sm text-ink placeholder:text-neutral-400 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, hint, error, children }: FieldProps) {
  return (
    <Label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-ink">{error}</span>
      ) : hint ? (
        <span className="text-xs text-neutral-400">{hint}</span>
      ) : null}
    </Label>
  );
}

const CheckboxField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }
>(({ label, hint, ...props }, ref) => (
  <label className="flex items-start gap-3">
    <input
      ref={ref}
      type="checkbox"
      className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-ink focus-visible:ring-1 focus-visible:ring-ink focus-visible:ring-offset-1"
      {...props}
    />
    <span className="flex flex-col gap-0.5">
      <span className="text-sm text-ink">{label}</span>
      {hint ? <span className="text-xs text-neutral-400">{hint}</span> : null}
    </span>
  </label>
));
CheckboxField.displayName = "CheckboxField";


