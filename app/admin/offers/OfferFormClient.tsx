"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  EyeOff,
  Loader2,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button, Input, Label, Spinner } from "@/components/ui";
import {
  BannerCarouselManager,
  ProductSelector,
  type BannerDraft,
  type ProductChipSeed,
} from "@/components/composed";
import { useUIStore } from "@/store/uiStore";
import {
  useAdminOffer,
  useCreateAdminOffer,
  useDeleteAdminOffer,
  useUpdateAdminOffer,
} from "@/hooks/useOffer";
import { AdminError } from "@/lib/api/admin";
import type {
  AdminCreateOfferBody,
  AdminUpdateOfferBody,
  Offer,
  OfferProductRef,
  OfferStatus,
} from "@/types/offer";

/* "" Helpers "" */

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

function isoToLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string | undefined): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function productsToIds(products: ReadonlyArray<OfferProductRef | string> | undefined): string[] {
  if (!products?.length) return [];
  return Array.from(new Set(products.map((p) => (typeof p === "string" ? p : p._id))));
}

function productsToSeed(products: ReadonlyArray<OfferProductRef | string> | undefined): ProductChipSeed[] {
  if (!products?.length) return [];
  return products
    .filter((p): p is OfferProductRef => typeof p !== "string")
    .map((p) => ({
      _id: p._id,
      title: p.title,
      slug: p.slug,
      price: p.price,
      image: p.images?.[0]?.url,
    }));
}

const STATUS_OPTIONS: { value: OfferStatus; label: string; description: string }[] = [
  { value: "draft", label: "Draft", description: "Hidden from the storefront. The pricing engine ignores draft offers." },
  { value: "scheduled", label: "Scheduled", description: "Staged but not yet live. Flip to Active on launch day." },
  { value: "active", label: "Active", description: "Live — applies to qualifying products while the window is open." },
  { value: "ended", label: "Ended", description: "Kept for history. Banner art can be reused on the next offer." },
];

/* "" Schema "" */

const bannerSchema = z.object({
  image: z.string().trim().url("Must be a valid URL"),
  publicId: z.string().trim().max(200).or(z.literal("")),
  mobileImage: z.string().trim().or(z.literal("")).optional(),
  mobilePublicId: z.string().trim().max(200).or(z.literal("")).optional(),
  title: z.string().trim().max(120).or(z.literal("")),
  subtitle: z.string().trim().max(200).or(z.literal("")),
  ctaLabel: z.string().trim().max(40).or(z.literal("")),
  ctaHref: z.string().trim().max(500).or(z.literal("")),
  isActive: z.boolean(),
  fullWidth: z.boolean(),
});

const schema = z
  .object({
    name: z.string().trim().min(2, "At least 2 characters").max(120, "Too long"),
    slug: z
      .string()
      .trim()
      .or(z.literal(""))
      .refine(
        (v) => v === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v),
        "Lowercase letters, numbers, and hyphens only",
      ),
    description: z.string().trim().max(2000).or(z.literal("")),
    startsAt: z.string().min(1, "Required"),
    endsAt: z.string().min(1, "Required"),
    discountType: z.enum(["percentage", "fixed"]),
    discountValue: z.coerce.number().int().min(1, "Must be at least 1"),
    status: z.enum(["draft", "scheduled", "active", "ended"]),
    currency: z.string().trim().toUpperCase().length(3, "Use a 3-letter code"),
    showOnHomepage: z.boolean(),
    showOnHomepageGrid: z.boolean(),
    showOnOffersPage: z.boolean(),
    showOnCategoryStrip: z.boolean(),
    products: z.array(z.string().regex(OBJECT_ID_RE, "Invalid product id")),
    banners: z.array(bannerSchema),
  })
  .superRefine((val, ctx) => {
    if (val.discountType === "percentage") {
      if (val.discountValue < 1 || val.discountValue > 100) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Percentage discounts must be between 1 and 100" });
      }
    }
    if (val.startsAt && val.endsAt) {
      const from = new Date(val.startsAt);
      const until = new Date(val.endsAt);
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(until.getTime()) && from >= until) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "Must end after the start date" });
      }
    }
  });

type FormValues = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

function cleanBanner(b: FormOutput["banners"][number], idx: number) {
  return {
    image: b.image,
    publicId: b.publicId || undefined,
    mobileImage: b.mobileImage || undefined,
    mobilePublicId: b.mobilePublicId || undefined,
    title: b.title || undefined,
    subtitle: b.subtitle || undefined,
    ctaLabel: b.ctaLabel || undefined,
    ctaHref: b.ctaHref || undefined,
    isActive: b.isActive,
    fullWidth: b.fullWidth,
    order: idx,
  };
}

function toCreatePayload(values: FormOutput): AdminCreateOfferBody {
  return {
    name: values.name,
    slug: values.slug || undefined,
    description: values.description || undefined,
    startsAt: localInputToIso(values.startsAt)!,
    endsAt: localInputToIso(values.endsAt)!,
    discountType: values.discountType,
    discountValue: values.discountValue,
    status: values.status,
    currency: values.currency,
    showOnHomepage: values.showOnHomepage,
    showOnHomepageGrid: values.showOnHomepageGrid,
    showOnOffersPage: values.showOnOffersPage,
    showOnCategoryStrip: values.showOnCategoryStrip,
    products: values.products,
    banners: values.banners.map(cleanBanner),
  };
}

function toUpdatePayload(values: FormOutput): AdminUpdateOfferBody {
  return {
    name: values.name,
    slug: values.slug || undefined,
    description: values.description || undefined,
    startsAt: localInputToIso(values.startsAt),
    endsAt: localInputToIso(values.endsAt),
    discountType: values.discountType,
    discountValue: values.discountValue,
    status: values.status,
    currency: values.currency,
    showOnHomepage: values.showOnHomepage,
    showOnHomepageGrid: values.showOnHomepageGrid,
    showOnOffersPage: values.showOnOffersPage,
    showOnCategoryStrip: values.showOnCategoryStrip,
    products: values.products,
    banners: values.banners.map(cleanBanner),
  };
}

/* "" Page wrapper "" */

interface OfferFormClientProps {
  mode: "create" | "edit";
  id?: string;
}

export function OfferFormClient({ mode, id }: OfferFormClientProps) {
  const { data: offer, isLoading, isError, error, refetch } = useAdminOffer(
    mode === "edit" ? id : undefined,
  );

  if (mode === "edit" && isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-sm border border-neutral-200 bg-paper">
        <Spinner />
      </div>
    );
  }

  if (mode === "edit" && (isError || !offer)) {
    const message = error instanceof AdminError ? error.message : "Couldn't load offer.";
    return (
      <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
        <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
        <p className="text-sm text-neutral-500">{message}</p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>Try again</Button>
          <Link href="/admin/offers" className="text-sm text-neutral-600 underline-offset-2 hover:underline">
            Back to offers
          </Link>
        </div>
      </div>
    );
  }

  return <OfferForm key={offer?._id ?? "new"} mode={mode} offer={offer ?? null} />;
}

/* "" Form "" */

interface OfferFormProps {
  mode: "create" | "edit";
  offer: Offer | null;
}

function defaultEnd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return isoToLocalInput(d.toISOString());
}

function OfferForm({ mode, offer }: OfferFormProps) {
  const router = useRouter();
  const toast = useUIStore((s) => s.toast);
  const create = useCreateAdminOffer();
  const update = useUpdateAdminOffer(offer?._id ?? "noop");
  const remove = useDeleteAdminOffer();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: offer?.name ?? "",
      slug: offer?.slug ?? "",
      description: offer?.description ?? "",
      startsAt: offer ? isoToLocalInput(offer.startsAt) : isoToLocalInput(new Date().toISOString()),
      endsAt: offer ? isoToLocalInput(offer.endsAt) : defaultEnd(),
      discountType: offer?.discountType ?? "percentage",
      discountValue: offer?.discountValue ?? 10,
      status: offer?.status ?? "draft",
      currency: offer?.currency ?? "BDT",
      showOnHomepage: offer?.showOnHomepage ?? true,
      showOnHomepageGrid: offer?.showOnHomepageGrid ?? true,
      showOnOffersPage: offer?.showOnOffersPage ?? true,
      showOnCategoryStrip: offer?.showOnCategoryStrip ?? true,
      products: productsToIds(offer?.products),
      banners:
        offer?.banners?.map((b) => ({
          image: b.image,
          publicId: b.publicId ?? "",
          mobileImage: b.mobileImage ?? "",
          mobilePublicId: b.mobilePublicId ?? "",
          title: b.title ?? "",
          subtitle: b.subtitle ?? "",
          ctaLabel: b.ctaLabel ?? "",
          ctaHref: b.ctaHref ?? "",
          isActive: b.isActive,
          fullWidth: b.fullWidth,
        })) ?? [],
    },
  });

  const discountTypeDraft = watch("discountType");
  const discountValueDraft = watch("discountValue");
  const currencyDraft = watch("currency");
  const nameDraft = watch("name");
  const statusDraft = watch("status");
  const productsDraft = watch("products");
  const bannersDraft = watch("banners");

  const offerSeed = React.useMemo(() => productsToSeed(offer?.products), [offer?.products]);

  const onSubmit = handleSubmit(async (raw) => {
    const parsed = schema.parse(raw);
    try {
      if (mode === "create") {
        const created = await create.mutateAsync(toCreatePayload(parsed));
        toast({ title: "Offer created", tone: "success" });
        router.push(`/admin/offers/${created._id}`);
      } else if (offer) {
        const updated = await update.mutateAsync(toUpdatePayload(parsed));
        toast({ title: "Offer saved", tone: "success" });
        reset({
          name: updated.name,
          slug: updated.slug,
          description: updated.description ?? "",
          startsAt: isoToLocalInput(updated.startsAt),
          endsAt: isoToLocalInput(updated.endsAt),
          discountType: updated.discountType,
          discountValue: updated.discountValue,
          status: updated.status,
          currency: updated.currency,
          showOnHomepage: updated.showOnHomepage,
          showOnHomepageGrid: updated.showOnHomepageGrid,
          showOnOffersPage: updated.showOnOffersPage,
          showOnCategoryStrip: updated.showOnCategoryStrip,
          products: productsToIds(updated.products),
          banners: updated.banners.map((b) => ({
            image: b.image,
            publicId: b.publicId ?? "",
            title: b.title ?? "",
            subtitle: b.subtitle ?? "",
            ctaLabel: b.ctaLabel ?? "",
            ctaHref: b.ctaHref ?? "",
            isActive: b.isActive,
            fullWidth: b.fullWidth,
          })),
        });
      }
    } catch (err) {
      if (err instanceof AdminError) {
        if (err.fieldErrors?.length) {
          for (const fe of err.fieldErrors) {
            const head = fe.path.split(".")[0];
            if (head && head in raw) setError(head as keyof FormValues, { message: fe.message });
          }
        }
        toast({ title: "Could not save", description: err.message, tone: "error" });
      } else {
        toast({ title: "Could not save", tone: "error" });
      }
    }
  });

  const onDelete = async () => {
    if (!offer) return;
    if (!window.confirm(`Delete offer "${offer.name}"? Existing orders keep their applied discount snapshot, but the offer stops applying to new carts.`)) return;
    try {
      await remove.mutateAsync(offer._id);
      toast({ title: "Offer deleted", tone: "success" });
      router.push("/admin/offers");
    } catch (err) {
      toast({ title: err instanceof AdminError ? err.message : "Couldn't delete", tone: "error" });
    }
  };

  const heading = mode === "create" ? "New offer" : offer?.name ?? "Edit offer";
  const valueHint =
    discountTypeDraft === "percentage"
      ? "1–100. Applied as a percentage of each qualifying product's base price."
      : `Flat amount in ${currencyDraft || "BDT"} subtracted from each qualifying product's base price (clamped at 0).`;
  const valuePreview =
    discountTypeDraft === "percentage"
      ? `${discountValueDraft || 0}% off`
      : `${currencyDraft || "BDT"} ${discountValueDraft || 0} off`;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Link
            href="/admin/offers"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to offers
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-ink">
            <Sparkles className="h-5 w-5 text-neutral-400" aria-hidden /> {heading}
          </h1>
          {offer ? (
            <p className="text-sm text-neutral-500">
              Created {new Date(offer.createdAt).toLocaleDateString()} · /offers/{offer.slug}
            </p>
          ) : (
            <p className="text-sm text-neutral-500">
              {nameDraft
                ? `Will be saved as /offers/${nameDraft.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`
                : "Pick a name to get started."}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" && offer ? (
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
          ) : null}
          <Button
            type="submit"
            size="sm"
            disabled={(mode === "edit" && !isDirty) || create.isPending || update.isPending}
          >
            {create.isPending || update.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            <span className="ml-1.5">{mode === "create" ? "Create" : "Save"}</span>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="flex flex-col gap-4">
          {/* Identity */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Identity</h2>
            <Field label="Name" error={errors.name?.message}>
              <Input invalid={!!errors.name} placeholder="Eid Mubarak sale" {...register("name")} />
            </Field>
            <Field
              label="Slug"
              error={errors.slug?.message}
              hint="URL slug for the storefront. Leave blank to derive from the name. Editable post-creation."
            >
              <Input invalid={!!errors.slug} placeholder="auto from name" className="font-mono lowercase" {...register("slug")} />
            </Field>
            <Field label="Description" error={errors.description?.message}>
              <textarea
                rows={3}
                {...register("description")}
                placeholder="Shown on the /offers/[slug] landing page below the banner carousel."
                className={textareaClass}
              />
            </Field>
          </section>

          {/* Schedule */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Schedule</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Starts at"
                error={errors.startsAt?.message}
                hint="The pricing engine begins applying the offer from this moment."
              >
                <Input type="datetime-local" invalid={!!errors.startsAt} {...register("startsAt")} />
              </Field>
              <Field
                label="Ends at"
                error={errors.endsAt?.message}
                hint="Must be after the start. The engine stops applying past this moment."
              >
                <Input type="datetime-local" invalid={!!errors.endsAt} {...register("endsAt")} />
              </Field>
            </div>
            <Field
              label="Status"
              error={errors.status?.message}
              hint="Only Active offers actually price into the cart. Scheduled stays staged for launch day; Draft and Ended never price in."
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {STATUS_OPTIONS.map((opt) => (
                  <RadioOption
                    key={opt.value}
                    {...register("status")}
                    value={opt.value}
                    label={opt.label}
                    description={opt.description}
                    icon={<StatusIcon status={opt.value} />}
                  />
                ))}
              </div>
            </Field>
          </section>

          {/* Discount */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Discount</h2>
            <Field
              label="Type"
              error={errors.discountType?.message}
              hint="Percentage scales with each product's base price; fixed subtracts a constant amount."
            >
              <div className="flex gap-3">
                <RadioOption {...register("discountType")} value="percentage" label="Percentage" description="A share of each qualifying product's base price." />
                <RadioOption {...register("discountType")} value="fixed" label="Fixed" description="A flat currency amount per product, clamped at 0." />
              </div>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Value" error={errors.discountValue?.message} hint={valueHint}>
                <Input type="number" min={1} step={1} invalid={!!errors.discountValue} {...register("discountValue")} />
              </Field>
              <Field label="Currency" error={errors.currency?.message} hint="3-letter ISO code. Used only for fixed-amount discounts.">
                <Input invalid={!!errors.currency} className="uppercase" {...register("currency")} />
              </Field>
            </div>
            <div className="rounded-sm border border-neutral-100 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              Preview: <span className="font-medium text-ink">{valuePreview}</span> · per qualifying product
            </div>
          </section>

          {/* Products */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-ink">Products</h2>
              <span className="text-xs text-neutral-400">Filter by category, brand, or status · select cross-page</span>
            </div>
            <p className="text-sm text-neutral-500">
              The product allow-list. The pricing engine only applies this offer to items in here. Leave empty to keep the offer parked.
            </p>
            <Controller
              control={control}
              name="products"
              render={({ field, fieldState }) => (
                <ProductSelector
                  value={field.value}
                  onChange={field.onChange}
                  seed={offerSeed}
                  invalid={!!fieldState.error}
                  emptyHint="No products picked. Open the picker to filter the catalog and add some."
                />
              )}
            />
            {errors.products?.message ? (
              <p className="text-xs text-ink">{errors.products.message}</p>
            ) : null}
          </section>

          {/* Banners */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-ink">Banners</h2>
              <span className="text-xs text-neutral-400">Drop images, drag to reorder, preview live</span>
            </div>
            <p className="text-sm text-neutral-500">
              Carousel slides for the homepage hero, the /offers index, and category strips. Only "Active" slides render on the storefront.
            </p>
            <Controller
              control={control}
              name="banners"
              render={({ field }) => (
                <BannerCarouselManager
                  value={field.value as BannerDraft[]}
                  onChange={(next) => field.onChange(next)}
                  offerSlug={offer?.slug}
                  errors={
                    Array.isArray(errors.banners)
                      ? errors.banners.map((entry) =>
                          entry
                            ? {
                                image: entry.image?.message,
                                title: entry.title?.message,
                                subtitle: entry.subtitle?.message,
                                ctaLabel: entry.ctaLabel?.message,
                                ctaHref: entry.ctaHref?.message,
                                publicId: entry.publicId?.message,
                              }
                            : undefined,
                        )
                      : undefined
                  }
                  disabled={isSubmitting || create.isPending || update.isPending}
                />
              )}
            />
            {errors.banners && !Array.isArray(errors.banners) && errors.banners.message ? (
              <p className="text-xs text-ink">{errors.banners.message}</p>
            ) : null}
          </section>
        </div>

        {/* Side column */}
        <aside className="flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Storefront placements</h2>
            <CheckboxField
              label="Homepage hero"
              hint="Banners appear in the homepage hero carousel while the offer is active."
              {...register("showOnHomepage")}
            />
            <CheckboxField
              label="Homepage grid"
              hint="Offer surfaces as a tile in the 4-up grid below the homepage hero."
              {...register("showOnHomepageGrid")}
            />
            <CheckboxField
              label="Offers index"
              hint="Offer is listed on /offers and gets its own /offers/[slug] page."
              {...register("showOnOffersPage")}
            />
            <CheckboxField
              label="Category strips"
              hint="A top strip appears on any category page that overlaps the offer's product set."
              {...register("showOnCategoryStrip")}
            />
          </section>

          {offer ? (
            <section className="flex flex-col gap-2 rounded-sm border border-neutral-200 bg-paper p-3 text-xs text-neutral-500">
              <h2 className="text-sm font-semibold text-ink">Snapshot</h2>
              <div className="flex items-center justify-between">
                <span>Status</span>
                <span>{STATUS_OPTIONS.find((o) => o.value === statusDraft)?.label ?? statusDraft}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Products</span>
                <span className="tabular-nums">{productsDraft.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Banners</span>
                <span className="tabular-nums">{bannersDraft.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Created</span>
                <span>{new Date(offer.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Updated</span>
                <span>{new Date(offer.updatedAt).toLocaleDateString()}</span>
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-3 rounded-sm border border-neutral-200 bg-paper p-3 text-xs text-neutral-500">
            <h2 className="text-sm font-semibold text-ink">Notes</h2>
            <p>Offers auto-apply — buyers don&apos;t enter a code. The storefront renders strike-through pricing on qualifying products.</p>
            <p>When multiple offers overlap on the same product, the engine picks the one that yields the lowest unit price.</p>
            <p>Coupons stack <em>on top of</em> the offer-discounted subtotal at checkout, never under it.</p>
          </section>
        </aside>
      </div>
    </form>
  );
}

/* "" Primitives "" */

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

const RadioOption = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    description?: string;
    icon?: React.ReactNode;
  }
>(({ label, description, icon, ...props }, ref) => (
  <label className="group relative flex flex-1 cursor-pointer items-start gap-3 rounded-sm border border-neutral-200 p-3 hover:border-ink has-[:checked]:border-ink has-[:checked]:bg-neutral-50">
    <input
      ref={ref}
      type="radio"
      className="mt-0.5 h-4 w-4 border-neutral-300 text-ink focus-visible:ring-1 focus-visible:ring-ink focus-visible:ring-offset-1"
      {...props}
    />
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
        {icon}
        {label}
      </span>
      {description ? <span className="text-xs text-neutral-400">{description}</span> : null}
    </span>
  </label>
));
RadioOption.displayName = "RadioOption";

function StatusIcon({ status }: { status: OfferStatus }): React.ReactElement {
  switch (status) {
    case "active": return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />;
    case "scheduled": return <CalendarClock className="h-3.5 w-3.5" aria-hidden />;
    case "ended": return <Clock className="h-3.5 w-3.5" aria-hidden />;
    case "draft": default: return <EyeOff className="h-3.5 w-3.5" aria-hidden />;
  }
}


