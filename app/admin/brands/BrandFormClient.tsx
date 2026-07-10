"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import { Button, Input, Label, Spinner } from "@/components/ui";
import { FormStickyBar } from "@/components/admin/FormStickyBar";
import { ImageUploader } from "@/components/composed/ImageUploader";
import { COMPANY } from "@/lib/entity/company";
import { useUIStore } from "@/store/uiStore";
import {
  useAdminBrand,
  useCreateAdminBrand,
  useDeleteAdminBrand,
  useUpdateAdminBrand,
} from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import type {
  AdminBrandCreate,
  AdminBrandDetail,
  AdminBrandPatch,
} from "@/types/admin";
import type { UploadedImage } from "@/types/uploads";

const schema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(140)
    .regex(/^[a-z0-9-]*$/, "Lowercase letters, numbers, hyphens")
    .or(z.literal("")),
  description: z.string().trim().max(2000).or(z.literal("")),
  logo: z.string().trim().url("Must be a URL").or(z.literal("")),
  banner: z.string().trim().url("Must be a URL").or(z.literal("")),
  website: z.string().trim().url("Must be a URL").or(z.literal("")),
  order: z.coerce.number().int().min(0).max(9999),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  metaTitle: z.string().trim().max(180).or(z.literal("")),
  metaDescription: z.string().trim().max(320).or(z.literal("")),
});
type FormValues = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

function toPayload(values: FormOutput): AdminBrandCreate {
  return {
    name: values.name,
    slug: values.slug || undefined,
    description: values.description || undefined,
    logo: values.logo || undefined,
    banner: values.banner || undefined,
    website: values.website || undefined,
    order: values.order,
    isActive: values.isActive,
    isFeatured: values.isFeatured,
    metaTitle: values.metaTitle || undefined,
    metaDescription: values.metaDescription || undefined,
  };
}

/* ── Page ── */

interface BrandFormClientProps {
  mode: "create" | "edit";
  id?: string;
}

export function BrandFormClient({ mode, id }: BrandFormClientProps) {
  const {
    data: brand,
    isLoading,
    isError,
    error,
    refetch,
  } = useAdminBrand(mode === "edit" ? id : undefined);

  if (mode === "edit" && isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-sm border border-neutral-200 bg-paper">
        <Spinner />
      </div>
    );
  }

  if (mode === "edit" && (isError || !brand)) {
    const message =
      error instanceof AdminError ? error.message : "Couldn't load brand.";
    return (
      <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
        <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
        <p className="text-sm text-neutral-500">{message}</p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
          <Link
            href="/admin/brands"
            className="text-sm text-neutral-600 underline-offset-2 hover:underline"
          >
            Back to brands
          </Link>
        </div>
      </div>
    );
  }

  return (
    <BrandForm
      key={brand?._id ?? "new"}
      mode={mode}
      brand={brand ?? null}
    />
  );
}

/* ── Form ── */

interface BrandFormProps {
  mode: "create" | "edit";
  brand: AdminBrandDetail | null;
}

function BrandForm({ mode, brand }: BrandFormProps) {
  const router = useRouter();
  const toast = useUIStore((s) => s.toast);
  const create = useCreateAdminBrand();
  const update = useUpdateAdminBrand(brand?._id ?? "noop");
  const remove = useDeleteAdminBrand();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    control,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: brand?.name ?? "",
      slug: brand?.slug ?? "",
      description: brand?.description ?? "",
      logo: brand?.logo ?? "",
      banner: brand?.banner ?? "",
      website: brand?.website ?? "",
      order: brand?.order ?? 0,
      isActive: brand?.isActive ?? true,
      isFeatured: brand?.isFeatured ?? false,
      metaTitle: brand?.metaTitle ?? "",
      metaDescription: brand?.metaDescription ?? "",
    },
  });

  const slugDraft = watch("slug");
  const nameDraft = watch("name");

  const onSubmit = handleSubmit(async (raw) => {
    const parsed = schema.parse(raw);
    const payload = toPayload(parsed);
    try {
      if (mode === "create") {
        const created = await create.mutateAsync(payload);
        toast({ title: "Brand created", tone: "success" });
        router.push(`/admin/brands/${created._id}`);
      } else if (brand) {
        const updated = await update.mutateAsync(payload as AdminBrandPatch);
        toast({ title: "Brand saved", tone: "success" });
        reset({
          name: updated.name,
          slug: updated.slug,
          description: updated.description ?? "",
          logo: updated.logo ?? "",
          banner: updated.banner ?? "",
          website: updated.website ?? "",
          order: updated.order,
          isActive: updated.isActive,
          isFeatured: updated.isFeatured,
          metaTitle: updated.metaTitle ?? "",
          metaDescription: updated.metaDescription ?? "",
        });
      }
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
    if (!brand) return;
    if (!window.confirm(`Delete "${brand.name}"? This fails if any products are still tagged with this brand.`)) return;
    try {
      await remove.mutateAsync(brand._id);
      toast({ title: "Brand deleted", tone: "success" });
      router.push("/admin/brands");
    } catch (err) {
      toast({ title: err instanceof AdminError ? err.message : "Couldn't delete", tone: "error" });
    }
  };

  const heading = mode === "create" ? "New brand" : brand?.name ?? "Edit brand";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Link
            href="/admin/brands"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to brands
          </Link>
          <h1 className="text-2xl font-semibold text-ink">{heading}</h1>
          {brand ? (
            <p className="text-sm text-neutral-500">
              /{brand.slug} · Updated {new Date(brand.updatedAt).toLocaleDateString()}
            </p>
          ) : (
            <p className="text-sm text-neutral-500">
              {nameDraft ? `Will live at /brand/${slugDraft || "…"}` : "Pick a name to get started."}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {brand ? (
            <Link
              href={`/brand/${brand.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-sm border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-ink hover:text-ink"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Preview
            </Link>
          ) : null}
          {mode === "edit" && brand ? (
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
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Basics</h2>
            <Field label="Name" error={errors.name?.message}>
              <Input invalid={!!errors.name} {...register("name")} />
            </Field>
            <Field
              label="Slug"
              error={errors.slug?.message}
              hint={brand ? `Storefront path: /brand/${brand.slug}` : "Leave blank to auto-derive from the name."}
            >
              <Input invalid={!!errors.slug} {...register("slug")} />
            </Field>
            <Field label="Description" error={errors.description?.message}>
              <textarea rows={5} {...register("description")} className={textareaClass} />
            </Field>
            <Field
              label="Website"
              error={errors.website?.message}
              hint="External brand homepage. Linked from the brand page header."
            >
              <Input invalid={!!errors.website} {...register("website")} />
            </Field>
          </section>

          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Imagery</h2>
            <Controller
              control={control}
              name="logo"
              render={({ field }) => {
                const uploaderValue: UploadedImage[] = field.value ? [{ url: field.value }] : [];
                return (
                  <div className="flex flex-col gap-1.5">
                    <ImageUploader
                      label="Logo"
                      hint="Drop or pick a file. Square logo shown on cards, filters, and product detail."
                      scope="brand"
                      max={1}
                      hideAlt
                      value={uploaderValue}
                      onChange={(next) => field.onChange(next[0]?.url ?? "")}
                    />
                    {errors.logo?.message ? (
                      <span className="text-xs text-ink">{errors.logo.message}</span>
                    ) : null}
                  </div>
                );
              }}
            />
            <Controller
              control={control}
              name="banner"
              render={({ field }) => {
                const uploaderValue: UploadedImage[] = field.value ? [{ url: field.value }] : [];
                return (
                  <div className="flex flex-col gap-1.5">
                    <ImageUploader
                      label="Banner"
                      hint="Drop or pick a file. Wide hero image used on the brand landing page."
                      scope="brand"
                      max={1}
                      hideAlt
                      value={uploaderValue}
                      onChange={(next) => field.onChange(next[0]?.url ?? "")}
                    />
                    {errors.banner?.message ? (
                      <span className="text-xs text-ink">{errors.banner.message}</span>
                    ) : null}
                  </div>
                );
              }}
            />
          </section>

          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">SEO</h2>
            <Field
              label="Meta title"
              error={errors.metaTitle?.message}
              hint={`Overrides the default \`<Name> | ${COMPANY.name}\` title.`}
            >
              <Input invalid={!!errors.metaTitle} {...register("metaTitle")} />
            </Field>
            <Field label="Meta description" error={errors.metaDescription?.message}>
              <textarea rows={3} {...register("metaDescription")} className={textareaClass} />
            </Field>
          </section>
        </div>

        {/* Side column */}
        <aside className="flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Visibility</h2>
            <CheckboxField
              label="Active"
              hint="Hidden brands disappear from filters and product cards."
              {...register("isActive")}
            />
            <CheckboxField
              label="Featured"
              hint="Surfaces in the homepage featured-brands strip."
              {...register("isFeatured")}
            />
            <Field label="Display order" error={errors.order?.message} hint="Lower numbers appear first in the brand index.">
              <Input type="number" min={0} step={1} invalid={!!errors.order} {...register("order")} />
            </Field>
          </section>

          {brand ? (
            <section className="flex flex-col gap-2 rounded-sm border border-neutral-200 bg-paper p-3 text-xs text-neutral-500">
              <h2 className="text-sm font-semibold text-ink">Meta</h2>
              <div className="flex items-center justify-between">
                <span>Created</span>
                <span>{new Date(brand.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Updated</span>
                <span>{new Date(brand.updatedAt).toLocaleDateString()}</span>
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      <FormStickyBar
        mode={mode}
        isDirty={isDirty}
        isSubmitting={create.isPending || update.isPending}
        submitLabel={mode === "create" ? "Create" : "Save"}
      />
    </form>
  );
}

/* ── Primitives ── */

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