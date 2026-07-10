"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, Plus, Ruler, Tag, X } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { FormStickyBar } from "@/components/admin/FormStickyBar";
import { cn } from "@/lib/utils/cn";
import {
  ImageUploader,
  Select,
  type SelectOption,
  SeoSection,
  ProductSelector,
  VariantsEditor,
  draftsToVariantInputs,
  type VariantDraft,
  type OptionDef,
  AttributesEditor,
  draftsToAttributes,
  type AttributeDraft,
  SizeChartEditor,
  sizeChartToDraft,
  draftToSizeChartInput,
  type SizeChartDraft,
} from "@/components/composed";
import { useUIStore } from "@/store/uiStore";
import { useAdminCategory, useCreateAdminProduct } from "@/hooks/useAdmin";
import { useBrands, useCategories } from "@/hooks/useCatalog";
import { AdminError } from "@/lib/api/admin";
import type {
  AdminProductCreate,
  AdminProductVariantInput,
} from "@/types/admin";
import type { UploadedImage } from "@/types/uploads";
import type { CategoryTreeNode } from "@/types/catalog";

/* "" Schema "" */

const schema = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(220)
    .regex(/^$|^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens"),
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

const EMPTY_DEFAULTS: FormValues = {
  title: "",
  slug: "",
  shortDescription: "",
  description: "",
  price: 0,
  compareAtPrice: "",
  stock: 0,
  trackStock: true,
  lowStockThreshold: 5,
  isActive: true,
  isFeatured: false,
  sku: "",
  tagsCsv: "",
  category: "",
  brand: "",
  metaTitle: "",
  metaDescription: "",
  lifecycleStatus: "active",
  replacedBy: "",
};

function toCreateBody(
  values: FormOutput,
  images: UploadedImage[],
  variants: VariantDraft[],
  attributes: AttributeDraft[],
  categories: string[],
  sizeChart: SizeChartDraft | null,
): AdminProductCreate {
  const tags = values.tagsCsv
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const variantInputs = draftsToVariantInputs(variants) as AdminProductVariantInput[];
  const sizeChartInput = sizeChart ? draftToSizeChartInput(sizeChart) : undefined;
  return {
    title: values.title,
    slug: values.slug || undefined,
    shortDescription: values.shortDescription || undefined,
    description: values.description || undefined,
    price: values.price,
    compareAtPrice: values.compareAtPrice ?? undefined,
    stock: values.stock,
    isActive: values.isActive,
    isFeatured: values.isFeatured,
    trackStock: values.trackStock,
    lowStockThreshold: values.lowStockThreshold,
    sku: values.sku || undefined,
    tags: tags.length ? tags : undefined,
    category: values.category,
    categories: categories.length ? categories : undefined,
    brand: values.brand || undefined,
    metaTitle: values.metaTitle || undefined,
    metaDescription: values.metaDescription || undefined,
    lifecycleStatus: values.lifecycleStatus,
    replacedBy:
      values.lifecycleStatus === "discontinued" && values.replacedBy
        ? values.replacedBy
        : undefined,
    images: images.length
      ? images.map((img) => ({ url: img.url, alt: img.alt || undefined, publicId: img.publicId }))
      : undefined,
    variants: variantInputs.length ? variantInputs : undefined,
    attributes: draftsToAttributes(attributes),
    sizeChart: sizeChartInput,
  };
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

/* "" Page "" */

export function AdminProductCreateClient() {
  const router = useRouter();
  const toast = useUIStore((s) => s.toast);
  const create = useCreateAdminProduct();

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
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_DEFAULTS,
  });

  const [images, setImages] = React.useState<UploadedImage[]>([]);
  const [variantOptions, setVariantOptions] = React.useState<OptionDef[]>([]);
  const [variants, setVariants] = React.useState<VariantDraft[]>([]);
  const [attributes, setAttributes] = React.useState<AttributeDraft[]>([]);
  const [secondaryCategories, setSecondaryCategories] = React.useState<string[]>([]);
  const [sizeChart, setSizeChart] = React.useState<SizeChartDraft | null>(null);

  const titleDraft = watch("title");
  const slugDraft = watch("slug");
  const priceDraft = watch("price");
  const metaTitleDraft = watch("metaTitle");
  const metaDescriptionDraft = watch("metaDescription");
  const lifecycleDraft = watch("lifecycleStatus");
  const replacedByDraft = watch("replacedBy");
  const categoryDraft = watch("category");
  const { data: primaryCategory } = useAdminCategory(categoryDraft || undefined);
  const previewSlug = slugDraft || "auto-generated";

  const variantsCount = variants.length;
  const variantsStock = variants.reduce(
    (sum, v) => sum + (Number.isFinite(Number(v.stock)) ? Number(v.stock) : 0),
    0,
  );

  /* Secondary categories — exclude primary + already selected */
  const availableSecondary = React.useMemo(
    () => flatCategories.filter((c) => c.value !== categoryDraft && !secondaryCategories.includes(c.value)),
    [flatCategories, categoryDraft, secondaryCategories],
  );

  const onSubmit = handleSubmit(async (raw) => {
    const parsed = schema.parse(raw);
    try {
      const created = await create.mutateAsync(
        toCreateBody(parsed, images, variants, attributes, secondaryCategories, sizeChart),
      );
      toast({
        title: "Product published",
        description: created.isActive ? "Your listing is live." : "Saved as hidden - toggle Active when ready.",
        tone: "success",
      });
      router.push(`/admin/products/${created.slug}`);
    } catch (err) {
      if (err instanceof AdminError) {
        const offRhfMessages: string[] = [];
        if (err.fieldErrors?.length) {
          for (const fe of err.fieldErrors) {
            const head = fe.path.split(".")[0];
            if (head && head in raw) {
              setError(head as keyof FormValues, { message: fe.message });
            } else if (head === "variants" || head === "images") {
              offRhfMessages.push(`${fe.path}: ${fe.message}`);
            }
          }
        }
        toast({
          title: "Could not publish",
          description: offRhfMessages.length
            ? `${err.message} (${offRhfMessages.join("; ")})`
            : err.message,
          tone: "error",
        });
      } else {
        toast({ title: "Could not publish", tone: "error" });
      }
    }
  });

  const submitting = create.isPending;

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
          <h1 className="text-2xl font-semibold text-ink">{titleDraft || "New product"}</h1>
          <p className="text-sm text-neutral-500">
            Fill in the basics and hit Publish. Everything else — images, variants, size chart — can be added now or later.
          </p>
        </div>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          <span className="ml-1.5">Publish</span>
        </Button>
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
              hint={`Leave blank to auto-generate. Preview: /product/${previewSlug}`}
            >
              <Input invalid={!!errors.slug} {...register("slug")} />
            </Field>
            <Field
              label="Short description"
              error={errors.shortDescription?.message}
              hint="Shown on product cards and search results (max 280 chars)."
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
            <ImageUploader
              value={images}
              onChange={setImages}
              scope="product"
              max={8}
              hint="First image is the card hero. Drag to reorder; add alt text for SEO."
            />
          </section>

          {/* Pricing + Inventory */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
              <h2 className="text-base font-semibold text-ink">Pricing</h2>
              <Field label="Price (BDT)" error={errors.price?.message}>
                <Input type="number" min={0} step="0.01" invalid={!!errors.price} {...register("price")} />
              </Field>
              <Field
                label="Compare-at price (Was)"
                error={errors.compareAtPrice?.message}
                hint="Shown as strikethrough on the product card. Fill manually or use the helper below."
              >
                <Input type="number" min={0} step="0.01" invalid={!!errors.compareAtPrice} {...register("compareAtPrice")} />
              </Field>
              <DiscountHelper
                price={priceDraft}
                onSet={(v) => setValue("compareAtPrice", v, { shouldDirty: true })}
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
              <Field label="Low-stock alert" error={errors.lowStockThreshold?.message} hint="Set 0 to disable.">
                <Input type="number" min={0} step={1} invalid={!!errors.lowStockThreshold} {...register("lowStockThreshold")} />
              </Field>
            </section>
          </div>

          {/* Variants */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Variants</h2>
            <p className="text-sm text-neutral-500">
              Use variants when the same product comes in multiple sizes, shades, or volumes. Each variant has its own SKU, stock, and optional price override.
            </p>
            <VariantsEditor
              options={variantOptions}
              onOptionsChange={setVariantOptions}
              variants={variants}
              onVariantsChange={setVariants}
              currency="BDT"
              max={100}
            />
          </section>

          {/* Attributes */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Attributes &amp; specifications</h2>
            <p className="text-sm text-neutral-500">
              Structured specs — Fabric, Material, Fit, Technology. Improves search and storefront filtering.
            </p>
            <AttributesEditor value={attributes} onChange={setAttributes} max={30} />
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
                      setSizeChart(sizeChartToDraft(primaryCategory.sizeChart));
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
              A measurement table shown on the product page. Use presets for jerseys, shoes, or kids apparel — or build your own. Save your chart as a template and load it on similar products.
            </p>
            <SizeChartEditor value={sizeChart} onChange={setSizeChart} />
          </section>

          {/* SEO */}
          <SeoSection
            register={register}
            errors={errors}
            metaTitle={metaTitleDraft}
            metaDescription={metaDescriptionDraft}
            titleFallback={titleDraft}
            descriptionFallback={watch("shortDescription")}
            slug={previewSlug}
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
            <h2 className="text-base font-semibold text-ink">Lifecycle</h2>
            <Field
              label="SEO state"
              hint={
                lifecycleDraft === "discontinued"
                  ? "301-redirects visitors to the replacement below, or returns 410 Gone when none is set."
                  : "Active products return 200. Out-of-stock is shown automatically."
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
                label="Replacement product"
                value={replacedByDraft ? [replacedByDraft] : []}
                onChange={(ids) => setValue("replacedBy", ids[0] ?? "", { shouldValidate: true })}
                max={1}
                emptyHint="No replacement set — visitors get a 410. Pick one to 301-redirect."
              />
            ) : null}
          </section>

          {/* Organization */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Organization</h2>

            <Field
              label="Product code (SKU)"
              error={errors.sku?.message}
              hint="Optional base code for this product. Variant SKUs are set per-variant above."
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
                          onClick={() => setSecondaryCategories((prev) => prev.filter((c) => c !== id))}
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
                    if (id) setSecondaryCategories((prev) => [...prev, id]);
                  }}
                >
                  <option value="">+ Add secondary category...</option>
                  {availableSecondary.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              ) : null}
              <p className="text-xs text-neutral-400">Cross-list under additional categories for broader discovery.</p>
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
        mode="create"
        isDirty={true}
        isSubmitting={submitting}
        submitLabel="Publish"
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


