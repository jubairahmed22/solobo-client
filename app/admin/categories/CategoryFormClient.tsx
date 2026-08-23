"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  FolderTree,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { AdminFormSkeleton } from "@/components/admin/Skeleton";
import { FormStickyBar } from "@/components/admin/FormStickyBar";
import { ImageUploader } from "@/components/composed/ImageUploader";
import {
  SizeChartEditor,
  sizeChartToDraft,
  draftToSizeChartInput,
  type SizeChartDraft,
} from "@/components/composed";
import { useUIStore } from "@/store/uiStore";
import {
  useAdminCategories,
  useAdminCategory,
  useCreateAdminCategory,
  useDeleteAdminCategory,
  useUpdateAdminCategory,
} from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import type {
  AdminCategoryCreate,
  AdminCategoryDetail,
  AdminCategoryPatch,
  AdminCategorySummary,
  AdminSizeChartInput,
} from "@/types/admin";
import type { UploadedImage } from "@/types/uploads";
import type { SizeChart } from "@/types/catalog";

/* ── Schema ── */

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
  image: z.string().trim().url("Must be a URL").or(z.literal("")),
  icon: z.string().trim().max(120).or(z.literal("")),
  parent: z.string().trim().or(z.literal("")),
  order: z.coerce.number().int().min(0).max(9999),
  isActive: z.boolean(),
  metaTitle: z.string().trim().max(180).or(z.literal("")),
  metaDescription: z.string().trim().max(320).or(z.literal("")),
});
type FormValues = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/* ── Payload builder ── */

function toPayload(
  values: FormOutput,
  sizeChart: SizeChartDraft | null,
  sizeChartRemoved: boolean,
): AdminCategoryCreate {
  let sizeChartValue: AdminSizeChartInput | null | undefined;
  if (sizeChartRemoved) sizeChartValue = null;
  else if (sizeChart) sizeChartValue = draftToSizeChartInput(sizeChart) ?? undefined;

  return {
    name: values.name,
    slug: values.slug || undefined,
    description: values.description || undefined,
    image: values.image || undefined,
    icon: values.icon || undefined,
    parent: values.parent ? values.parent : null,
    order: values.order,
    isActive: values.isActive,
    metaTitle: values.metaTitle || undefined,
    metaDescription: values.metaDescription || undefined,
    sizeChart: sizeChartValue,
  };
}

/* ── Page wrapper (handles loading / error) ── */

interface CategoryFormClientProps {
  mode: "create" | "edit";
  id?: string;
}

export function CategoryFormClient({ mode, id }: CategoryFormClientProps) {
  const {
    data: category,
    isLoading,
    isError,
    error,
    refetch,
  } = useAdminCategory(mode === "edit" ? id : undefined);

  if (mode === "edit" && isLoading) {
    return <AdminFormSkeleton sections={2} sidebarCards={2} />;
  }

  if (mode === "edit" && (isError || !category)) {
    const message =
      error instanceof AdminError ? error.message : "Could not load category.";
    return (
      <div className="flex flex-col items-center gap-[12px] rounded-[8px] border border-gray-200 bg-white py-[48px] text-center shadow-sm">
        <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
        <p className="text-sm text-neutral-500">{message}</p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
          <Link
            href="/admin/categories"
            className="text-sm text-neutral-600 underline-offset-2 hover:underline"
          >
            Back to categories
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CategoryForm
      key={category?._id ?? "new"}
      mode={mode}
      category={category ?? null}
    />
  );
}

/* ── Form ── */

interface CategoryFormProps {
  mode: "create" | "edit";
  category: AdminCategoryDetail | null;
}

function CategoryForm({ mode, category }: CategoryFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useUIStore((s) => s.toast);
  const create = useCreateAdminCategory();
  const update = useUpdateAdminCategory(category?._id ?? "noop");
  const remove = useDeleteAdminCategory();

  const parentFromUrl = mode === "create" ? (searchParams.get("parent") ?? "") : "";

  const { data: allCategoriesData } = useAdminCategories({ shape: "flat", limit: 300 });
  const allCategories: AdminCategorySummary[] = allCategoriesData?.data ?? [];

  const parentOptions = React.useMemo(() => {
    const excluded = new Set<string>();
    if (category) {
      excluded.add(category._id);
      for (const c of allCategories) {
        if (c.ancestors.includes(category._id)) excluded.add(c._id);
      }
    }
    return allCategories
      .filter((c) => !excluded.has(c._id))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [allCategories, category]);

  const parentName = React.useMemo(() => {
    if (!parentFromUrl) return null;
    return allCategories.find((c) => c._id === parentFromUrl)?.name ?? null;
  }, [allCategories, parentFromUrl]);

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
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
      image: category?.image ?? "",
      icon: category?.icon ?? "",
      parent: category?.parent ?? parentFromUrl,
      order: category?.order ?? 0,
      isActive: category?.isActive ?? true,
      metaTitle: category?.metaTitle ?? "",
      metaDescription: category?.metaDescription ?? "",
    },
  });

  /* Size chart local state */
  const [sizeChart, setSizeChart] = React.useState<SizeChartDraft | null>(() => {
    const raw = category?.sizeChart as SizeChart | undefined | null;
    return raw?.rows?.length ? sizeChartToDraft(raw) : null;
  });
  const [sizeChartDirty, setSizeChartDirty] = React.useState(false);
  const [sizeChartRemoved, setSizeChartRemoved] = React.useState(false);

  const onSizeChartChange = (next: SizeChartDraft | null) => {
    setSizeChart(next);
    setSizeChartDirty(true);
    setSizeChartRemoved(next === null);
  };

  const slugDraft = watch("slug");
  const nameDraft = watch("name");
  const metaTitleDraft = watch("metaTitle");

  const anyDirty = isDirty || sizeChartDirty;

  const onSubmit = handleSubmit(async (raw) => {
    const parsed = schema.parse(raw);
    const payload = toPayload(parsed, sizeChart, sizeChartRemoved);
    try {
      if (mode === "create") {
        const created = await create.mutateAsync(payload);
        toast({ title: "Category created", tone: "success" });
        router.push(`/admin/categories/${created._id}`);
      } else if (category) {
        const updated = await update.mutateAsync(payload as AdminCategoryPatch);
        toast({ title: "Category saved", tone: "success" });
        const updatedChart = updated.sizeChart as SizeChart | undefined | null;
        setSizeChart(updatedChart?.rows?.length ? sizeChartToDraft(updatedChart) : null);
        setSizeChartDirty(false);
        setSizeChartRemoved(false);
        reset({
          name: updated.name,
          slug: updated.slug,
          description: updated.description ?? "",
          image: updated.image ?? "",
          icon: updated.icon ?? "",
          parent: updated.parent ?? "",
          order: updated.order,
          isActive: updated.isActive,
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
    if (!category) return;
    if (
      !window.confirm(
        `Delete "${category.name}"? This fails if the category has children or products attached to it.`,
      )
    )
      return;
    try {
      await remove.mutateAsync(category._id);
      toast({ title: "Category deleted", tone: "success" });
      router.push("/admin/categories");
    } catch (err) {
      toast({
        title: err instanceof AdminError ? err.message : "Could not delete",
        tone: "error",
      });
    }
  };

  const heading =
    mode === "create"
      ? parentName
        ? `New subcategory of ${parentName}`
        : "New category"
      : (category?.name ?? "Edit category");

  const submitting = create.isPending || update.isPending;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-[16px]">

      {/* ── Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Link
            href="/admin/categories"
            className="inline-flex items-center gap-[6px] text-[14px] font-medium text-gray-500 transition duration-75 hover:text-[#1A56DB]"
          >
            <ArrowLeft className="h-[16px] w-[16px]" aria-hidden /> Back to categories
          </Link>
          <h1 className="text-[24px] font-bold leading-tight text-gray-900">{heading}</h1>
          <p className="text-sm text-neutral-500">
            {category
              ? `/${category.path} · Updated ${new Date(category.updatedAt).toLocaleDateString()}`
              : nameDraft
                ? `Will live at /category/${slugDraft || "auto"}`
                : "Pick a name to get started."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {category ? (
            <Link
              href={`/category/${category.path}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-[40px] items-center gap-[8px] rounded-[8px] border border-gray-300 bg-white px-[16px] text-[14px] font-medium text-gray-900 transition duration-75 hover:bg-gray-100"
            >
              <ExternalLink className="h-[16px] w-[16px]" aria-hidden /> Preview
            </Link>
          ) : null}
          {mode === "edit" && category ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={remove.isPending || submitting}
              className="inline-flex h-[40px] items-center gap-[8px] rounded-[8px] border border-red-300 bg-white px-[16px] text-[14px] font-medium text-red-600 transition duration-75 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {remove.isPending ? (
                <Loader2 className="h-[16px] w-[16px] animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-[16px] w-[16px]" aria-hidden />
              )}
              Delete
            </button>
          ) : null}
          <button
            type="submit"
            disabled={(mode === "edit" && !anyDirty) || submitting}
            className="inline-flex h-[40px] items-center gap-[8px] rounded-[8px] bg-[#1A56DB] px-[20px] text-[14px] font-medium text-white transition duration-75 hover:bg-[#1E429F] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-[16px] w-[16px] animate-spin" aria-hidden />
            ) : mode === "create" ? (
              <Plus className="h-[16px] w-[16px]" aria-hidden />
            ) : (
              <Save className="h-[16px] w-[16px]" aria-hidden />
            )}
            {mode === "create" ? "Create" : "Save changes"}
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-[1fr_320px]">

        {/* Main column */}
        <div className="flex flex-col gap-[16px]">

          {/* Basics */}
          <section className="flex flex-col gap-[16px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
            <h2 className="text-[18px] font-semibold text-gray-900">Basics</h2>
            <Field label="Name" error={errors.name?.message}>
              <Input invalid={!!errors.name} {...register("name")} />
            </Field>
            <Field
              label="Slug"
              error={errors.slug?.message}
              hint={
                category
                  ? `Storefront path: /${category.path}`
                  : "Leave blank to auto-derive from the name."
              }
            >
              <Input invalid={!!errors.slug} {...register("slug")} />
            </Field>
            <Field label="Description" error={errors.description?.message}>
              <textarea rows={4} {...register("description")} className={textareaClass} />
            </Field>
          </section>

          {/* Hierarchy */}
          <section className="flex flex-col gap-[16px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-neutral-400" aria-hidden />
              <h2 className="text-[18px] font-semibold text-gray-900">Hierarchy</h2>
            </div>
            <Field
              label="Parent category"
              error={errors.parent?.message}
              hint="Leave blank to make this a top-level category."
            >
              <select {...register("parent")} className={selectClass}>
                <option value="">- Top level -</option>
                {parentOptions.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.path}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Display order"
              error={errors.order?.message}
              hint="Lower numbers appear first among siblings."
            >
              <Input
                type="number"
                min={0}
                step={1}
                invalid={!!errors.order}
                {...register("order")}
              />
            </Field>
          </section>

          {/* Appearance */}
          <section className="flex flex-col gap-[16px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
            <h2 className="text-[18px] font-semibold text-gray-900">Appearance</h2>
            <Controller
              control={control}
              name="image"
              render={({ field }) => {
                const uploaderValue: UploadedImage[] = field.value
                  ? [{ url: field.value }]
                  : [];
                return (
                  <div className="flex flex-col gap-1.5">
                    <ImageUploader
                      label="Image"
                      hint="Used on category tiles and the landing header."
                      scope="category"
                      max={1}
                      hideAlt
                      value={uploaderValue}
                      onChange={(next) => field.onChange(next[0]?.url ?? "")}
                    />
                    {errors.image?.message ? (
                      <span className="text-[13px] font-medium text-red-600">{errors.image.message}</span>
                    ) : null}
                  </div>
                );
              }}
            />
            <Field
              label="Icon name"
              error={errors.icon?.message}
              hint={'Lucide icon name shown in the navbar (e.g. "shirt", "trophy").'}
            >
              <Input invalid={!!errors.icon} {...register("icon")} />
            </Field>
          </section>

          {/* Default size chart */}
          <section className="flex flex-col gap-[16px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[18px] font-semibold text-gray-900">Default size chart</h2>
              {sizeChart ? (
                <span className="text-xs text-neutral-400">
                  {sizeChart.rows.length} sizes &middot; {sizeChart.columns.length} measurements
                </span>
              ) : null}
            </div>
            <p className="text-sm text-neutral-500">
              Set a chart once here - then load it on any product in this category with one click.
              On the products list you can bulk-apply it to all products at once.
            </p>
            <SizeChartEditor value={sizeChart} onChange={onSizeChartChange} />
          </section>

          {/* SEO */}
          <section className="flex flex-col gap-[16px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
            <h2 className="text-[18px] font-semibold text-gray-900">SEO</h2>
            <Field
              label="Meta title"
              error={errors.metaTitle?.message}
              hint={`Overrides the default "${nameDraft || "Name"} | Solobo" title. Max 180 chars.`}
            >
              <div className="flex flex-col gap-1">
                <Input invalid={!!errors.metaTitle} {...register("metaTitle")} />
                <div className="flex justify-end">
                  <span
                    className={`text-xs tabular-nums ${
                      metaTitleDraft.length > 160 ? "text-amber-600" : "text-neutral-400"
                    }`}
                  >
                    {metaTitleDraft.length} / 180
                  </span>
                </div>
              </div>
            </Field>
            <Field label="Meta description" error={errors.metaDescription?.message}>
              <textarea rows={3} {...register("metaDescription")} className={textareaClass} />
            </Field>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-[16px]">

          {/* Visibility */}
          <section className="flex flex-col gap-[16px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
            <h2 className="text-[18px] font-semibold text-gray-900">Visibility</h2>
            <CheckboxField
              label="Active"
              hint="Hidden categories are excluded from the storefront nav and product filters."
              {...register("isActive")}
            />
          </section>

          {/* Category meta */}
          {category ? (
            <section className="flex flex-col gap-2 rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm text-xs text-neutral-500">
              <h2 className="text-[18px] font-semibold text-gray-900">Info</h2>
              <div className="flex items-center justify-between">
                <span>Depth</span>
                <span className="tabular-nums text-ink">{category.ancestors.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Path</span>
                <span className="text-ink">/{category.path}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Created</span>
                <span>{new Date(category.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Updated</span>
                <span>{new Date(category.updatedAt).toLocaleDateString()}</span>
              </div>
            </section>
          ) : null}

          {/* Create tips */}
          {mode === "create" ? (
            <section className="flex flex-col gap-2 rounded-sm border border-dashed border-gray-300 bg-paper p-3">
              <p className="text-sm font-medium text-neutral-700">Tips</p>
              <ul className="flex flex-col gap-1 text-xs text-neutral-500">
                <li>After creating, hover any row in the categories list to add a subcategory.</li>
                <li>Set a default size chart here so products can inherit it in one click.</li>
                <li>Slug auto-generates from the name - only override for SEO-critical URLs.</li>
              </ul>
            </section>
          ) : null}

        </aside>
      </div>

      <FormStickyBar
        mode={mode}
        isDirty={anyDirty}
        isSubmitting={submitting}
        submitLabel={mode === "create" ? "Create" : "Save"}
      />
    </form>
  );
}

/* ── Primitives ── */

const textareaClass =
  "block w-full rounded-sm border border-neutral-200 bg-paper px-2.5 py-1.5 text-sm text-ink placeholder:text-neutral-400 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1";

const selectClass =
  "block w-full rounded-sm border border-neutral-200 bg-paper px-2.5 py-1.5 text-sm text-ink focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, hint, error, children }: FieldProps) {
  return (
    <Label className="flex flex-col gap-1.5">
      <span className="text-[14px] font-medium text-gray-900">{label}</span>
      {children}
      {error ? (
        <span className="text-[13px] font-medium text-red-600">{error}</span>
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
