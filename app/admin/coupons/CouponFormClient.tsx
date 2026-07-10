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
  BadgePercent,
  Loader2,
  Save,
  Store,
  Trash2,
} from "lucide-react";
import { Button, Input, Label, Spinner } from "@/components/ui";
import { FormStickyBar } from "@/components/admin/FormStickyBar";
import { useUIStore } from "@/store/uiStore";
import {
  useAdminCoupon,
  useCreateAdminCoupon,
  useDeleteAdminCoupon,
  useUpdateAdminCoupon,
} from "@/hooks/useCoupon";
import { AdminError } from "@/lib/api/admin";
import type {
  AdminCreateCouponBody,
  AdminUpdateCouponBody,
  Coupon,
  CouponCategoryRef,
  CouponOwnerRef,
  CouponProductRef,
} from "@/types/coupon";

/* ── Helpers ── */

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

function refsToIdString(
  refs:
    | ReadonlyArray<CouponProductRef | string>
    | ReadonlyArray<CouponCategoryRef | string>
    | undefined,
): string {
  if (!refs?.length) return "";
  return refs.map((r) => (typeof r === "string" ? r : r._id)).join(", ");
}

function parseIdList(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const tokens = trimmed.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
  if (tokens.some((t) => !OBJECT_ID_RE.test(t))) return null;
  return Array.from(new Set(tokens));
}

function isOwnerRef(o: Coupon["owner"] | undefined): o is CouponOwnerRef {
  return Boolean(o) && typeof o === "object" && "_id" in (o as object);
}

/* ── Schema ── */

const schema = z
  .object({
    code: z.string().trim().toUpperCase().min(2, "At least 2 characters").max(40, "Too long")
      .regex(/^[A-Z0-9_-]+$/i, "Letters, numbers, hyphen, underscore"),
    description: z.string().trim().max(200).or(z.literal("")),
    scope: z.enum(["platform", "seller"]),
    owner: z.string().trim().or(z.literal("")),
    type: z.enum(["percent", "flat"]),
    value: z.coerce.number().int().min(1, "Must be at least 1"),
    maxDiscount: z.string().refine(
      (v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 0),
      "Must be a non-negative integer",
    ),
    minOrderTotal: z.coerce.number().int().min(0),
    maxRedemptions: z.string().refine(
      (v) => v === "" || (/^[1-9]\d*$/.test(v) && Number(v) >= 1),
      "Must be at least 1",
    ),
    perUserLimit: z.coerce.number().int().min(1),
    validFrom: z.string().or(z.literal("")),
    validUntil: z.string().or(z.literal("")),
    isActive: z.boolean(),
    applicableProductsRaw: z.string(),
    applicableCategoriesRaw: z.string(),
    currency: z.string().trim().toUpperCase().length(3, "Use a 3-letter ISO currency code"),
  })
  .superRefine((val, ctx) => {
    if (val.type === "percent" && (val.value < 1 || val.value > 100)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Percent coupons must be between 1 and 100" });
    }
    if (val.validFrom && val.validUntil) {
      const from = new Date(val.validFrom);
      const until = new Date(val.validUntil);
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(until.getTime()) && from >= until) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["validUntil"], message: "Must end after the start date" });
      }
    }
    if (val.scope === "seller") {
      if (!val.owner) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["owner"], message: "Required for seller-scope coupons" });
      } else if (!OBJECT_ID_RE.test(val.owner)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["owner"], message: "Must be a valid user id" });
      }
    } else if (val.scope === "platform" && val.owner) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["owner"], message: "Must be empty for platform-scope coupons" });
    }
    if (parseIdList(val.applicableProductsRaw) === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["applicableProductsRaw"], message: "One or more ids are invalid" });
    }
    if (parseIdList(val.applicableCategoriesRaw) === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["applicableCategoriesRaw"], message: "One or more ids are invalid" });
    }
  });

type FormValues = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

function toCreatePayload(values: FormOutput): AdminCreateCouponBody {
  const products = parseIdList(values.applicableProductsRaw) ?? [];
  const categories = parseIdList(values.applicableCategoriesRaw) ?? [];
  return {
    code: values.code,
    description: values.description || undefined,
    scope: values.scope,
    owner: values.scope === "seller" ? values.owner || undefined : undefined,
    type: values.type,
    value: values.value,
    maxDiscount: values.maxDiscount ? Number(values.maxDiscount) : undefined,
    minOrderTotal: values.minOrderTotal,
    maxRedemptions: values.maxRedemptions ? Number(values.maxRedemptions) : undefined,
    perUserLimit: values.perUserLimit,
    validFrom: localInputToIso(values.validFrom),
    validUntil: localInputToIso(values.validUntil),
    isActive: values.isActive,
    applicableProducts: products.length ? products : undefined,
    applicableCategories: categories.length ? categories : undefined,
    currency: values.currency,
  };
}

function toUpdatePayload(values: FormOutput): AdminUpdateCouponBody {
  const products = parseIdList(values.applicableProductsRaw) ?? [];
  const categories = parseIdList(values.applicableCategoriesRaw) ?? [];
  return {
    description: values.description || undefined,
    type: values.type,
    value: values.value,
    maxDiscount: values.maxDiscount ? Number(values.maxDiscount) : undefined,
    minOrderTotal: values.minOrderTotal,
    maxRedemptions: values.maxRedemptions ? Number(values.maxRedemptions) : undefined,
    perUserLimit: values.perUserLimit,
    validFrom: localInputToIso(values.validFrom),
    validUntil: localInputToIso(values.validUntil),
    isActive: values.isActive,
    applicableProducts: products,
    applicableCategories: categories,
    currency: values.currency,
  };
}

/* ── Page ── */

interface CouponFormClientProps {
  mode: "create" | "edit";
  id?: string;
}

export function CouponFormClient({ mode, id }: CouponFormClientProps) {
  const { data: coupon, isLoading, isError, error, refetch } = useAdminCoupon(
    mode === "edit" ? id : undefined,
  );

  if (mode === "edit" && isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-sm border border-neutral-200 bg-paper">
        <Spinner />
      </div>
    );
  }

  if (mode === "edit" && (isError || !coupon)) {
    const message = error instanceof AdminError ? error.message : "Couldn't load coupon.";
    return (
      <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
        <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
        <p className="text-sm text-neutral-500">{message}</p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>Try again</Button>
          <Link href="/admin/coupons" className="text-sm text-neutral-600 underline-offset-2 hover:underline">
            Back to coupons
          </Link>
        </div>
      </div>
    );
  }

  return <CouponForm key={coupon?._id ?? "new"} mode={mode} coupon={coupon ?? null} />;
}

/* ── Form ── */

interface CouponFormProps {
  mode: "create" | "edit";
  coupon: Coupon | null;
}

function CouponForm({ mode, coupon }: CouponFormProps) {
  const router = useRouter();
  const toast = useUIStore((s) => s.toast);
  const create = useCreateAdminCoupon();
  const update = useUpdateAdminCoupon(coupon?._id ?? "noop");
  const remove = useDeleteAdminCoupon();

  const initialOwnerId = isOwnerRef(coupon?.owner)
    ? (coupon!.owner as CouponOwnerRef)._id
    : typeof coupon?.owner === "string"
      ? coupon.owner
      : "";

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: coupon?.code ?? "",
      description: coupon?.description ?? "",
      scope: coupon?.scope ?? "platform",
      owner: initialOwnerId,
      type: coupon?.type ?? "percent",
      value: coupon?.value ?? 10,
      maxDiscount: coupon?.maxDiscount != null ? String(coupon.maxDiscount) : "",
      minOrderTotal: coupon?.minOrderTotal ?? 0,
      maxRedemptions: coupon?.maxRedemptions != null ? String(coupon.maxRedemptions) : "",
      perUserLimit: coupon?.perUserLimit ?? 1,
      validFrom: isoToLocalInput(coupon?.validFrom),
      validUntil: isoToLocalInput(coupon?.validUntil),
      isActive: coupon?.isActive ?? true,
      applicableProductsRaw: refsToIdString(coupon?.applicableProducts),
      applicableCategoriesRaw: refsToIdString(coupon?.applicableCategories),
      currency: coupon?.currency ?? "BDT",
    },
  });

  const scopeDraft = watch("scope");
  const typeDraft = watch("type");
  const valueDraft = watch("value");
  const codeDraft = watch("code");

  const onSubmit = handleSubmit(async (raw) => {
    const parsed = schema.parse(raw);
    try {
      if (mode === "create") {
        const created = await create.mutateAsync(toCreatePayload(parsed));
        toast({ title: "Coupon created", tone: "success" });
        router.push(`/admin/coupons/${created._id}`);
      } else if (coupon) {
        const updated = await update.mutateAsync(toUpdatePayload(parsed));
        toast({ title: "Coupon saved", tone: "success" });
        reset({
          code: updated.code,
          description: updated.description ?? "",
          scope: updated.scope,
          owner: isOwnerRef(updated.owner)
            ? updated.owner._id
            : typeof updated.owner === "string" ? updated.owner : "",
          type: updated.type,
          value: updated.value,
          maxDiscount: updated.maxDiscount != null ? String(updated.maxDiscount) : "",
          minOrderTotal: updated.minOrderTotal,
          maxRedemptions: updated.maxRedemptions != null ? String(updated.maxRedemptions) : "",
          perUserLimit: updated.perUserLimit,
          validFrom: isoToLocalInput(updated.validFrom),
          validUntil: isoToLocalInput(updated.validUntil),
          isActive: updated.isActive,
          applicableProductsRaw: refsToIdString(updated.applicableProducts),
          applicableCategoriesRaw: refsToIdString(updated.applicableCategories),
          currency: updated.currency,
        });
      }
    } catch (err) {
      if (err instanceof AdminError) {
        if (err.fieldErrors?.length) {
          for (const fe of err.fieldErrors) {
            const head = fe.path.split(".")[0];
            if (head === "applicableProducts") {
              setError("applicableProductsRaw", { message: fe.message });
            } else if (head === "applicableCategories") {
              setError("applicableCategoriesRaw", { message: fe.message });
            } else if (head && head in raw) {
              setError(head as keyof FormValues, { message: fe.message });
            }
          }
        }
        toast({ title: "Could not save", description: err.message, tone: "error" });
      } else {
        toast({ title: "Could not save", tone: "error" });
      }
    }
  });

  const onDelete = async () => {
    if (!coupon) return;
    if (!window.confirm(`Delete coupon "${coupon.code}"? Any existing redemptions stay on their orders, but the code becomes unredeemable.`)) return;
    try {
      await remove.mutateAsync(coupon._id);
      toast({ title: "Coupon deleted", tone: "success" });
      router.push("/admin/coupons");
    } catch (err) {
      toast({ title: err instanceof AdminError ? err.message : "Couldn't delete", tone: "error" });
    }
  };

  const heading = mode === "create" ? "New coupon" : coupon?.code ?? "Edit coupon";
  const valueHint =
    typeDraft === "percent"
      ? "1–100. The number is treated as a percentage of the eligible subtotal."
      : "Flat amount in the coupon's currency. Subtracted up to the eligible subtotal.";
  const valuePreview =
    typeDraft === "percent"
      ? `${valueDraft || 0}% off`
      : `${watch("currency") || "BDT"} ${valueDraft || 0} off`;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Link
            href="/admin/coupons"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to coupons
          </Link>
          <h1 className="font-mono text-2xl font-semibold text-ink">{heading}</h1>
          {coupon ? (
            <p className="text-sm text-neutral-500">
              Created {new Date(coupon.createdAt).toLocaleDateString()} · {coupon.redemptions} redemption{coupon.redemptions === 1 ? "" : "s"}
            </p>
          ) : (
            <p className="text-sm text-neutral-500">
              {codeDraft ? `Buyers will use code ${codeDraft}` : "Pick a code to get started."}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" && coupon ? (
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
            <h2 className="text-base font-semibold text-ink">Identity</h2>
            <Field
              label="Code"
              error={errors.code?.message}
              hint={
                mode === "create"
                  ? "Buyer-facing identifier. Uppercase letters, numbers, hyphen, underscore only. Frozen after creation."
                  : "Frozen after creation - once issued, buyers see this code on their cart and order."
              }
            >
              <Input
                invalid={!!errors.code}
                {...register("code")}
                readOnly={mode === "edit"}
                className="font-mono uppercase"
              />
            </Field>
            <Field label="Description" error={errors.description?.message}>
              <textarea
                rows={2}
                {...register("description")}
                placeholder="Internal note shown nowhere on the storefront."
                className={textareaClass}
              />
            </Field>
          </section>

          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Scope</h2>

            {mode === "create" ? (
              <Field
                label="Scope"
                error={errors.scope?.message}
                hint="Platform coupons apply to the whole cart subtotal; seller coupons only discount that seller's slice."
              >
                <div className="flex gap-3">
                  <RadioOption
                    {...register("scope")}
                    value="platform"
                    label="Platform"
                    description="Issued by ops; applies to any eligible cart."
                    icon={<BadgePercent className="h-3.5 w-3.5" aria-hidden />}
                  />
                  <RadioOption
                    {...register("scope")}
                    value="seller"
                    label="Seller"
                    description="Override on behalf of a seller; only their items qualify."
                    icon={<Store className="h-3.5 w-3.5" aria-hidden />}
                  />
                </div>
              </Field>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-neutral-500">Scope</span>
                <div>
                  {coupon?.scope === "platform" ? (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-paper">
                      <BadgePercent className="h-2.5 w-2.5" aria-hidden /> Platform
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-neutral-200 bg-paper px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
                      <Store className="h-2.5 w-2.5" aria-hidden /> Seller
                    </span>
                  )}
                </div>
                <span className="text-xs text-neutral-400">Frozen after creation.</span>
              </div>
            )}

            {scopeDraft === "seller" || coupon?.scope === "seller" ? (
              <Field
                label="Owner (seller user id)"
                error={errors.owner?.message}
                hint={
                  mode === "create"
                    ? "Paste the seller's user id (24-char ObjectId). Their store name will surface on the list page after save."
                    : "Frozen after creation."
                }
              >
                <Input
                  invalid={!!errors.owner}
                  {...register("owner")}
                  readOnly={mode === "edit"}
                  className="font-mono"
                />
                {mode === "edit" && isOwnerRef(coupon?.owner) ? (
                  <span className="mt-0.5 block text-xs text-neutral-400">
                    {(coupon!.owner as CouponOwnerRef).name || (coupon!.owner as CouponOwnerRef).email}
                    {(coupon!.owner as CouponOwnerRef).storeSlug
                      ? ` · /store/${(coupon!.owner as CouponOwnerRef).storeSlug}`
                      : ""}
                  </span>
                ) : null}
              </Field>
            ) : null}
          </section>

          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Discount</h2>
            <Field
              label="Type"
              error={errors.type?.message}
              hint="Percent caps with `Max discount`; flat subtracts a fixed amount."
            >
              <div className="flex gap-3">
                <RadioOption {...register("type")} value="percent" label="Percent" description="A share of the eligible subtotal." />
                <RadioOption {...register("type")} value="flat" label="Flat" description="A fixed currency amount off." />
              </div>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Value" error={errors.value?.message} hint={valueHint}>
                <Input type="number" min={1} step={1} invalid={!!errors.value} {...register("value")} />
              </Field>
              <Field
                label="Max discount (optional)"
                error={errors.maxDiscount?.message}
                hint={typeDraft === "percent" ? "Cap on the absolute discount for percent coupons." : "Ignored on flat coupons."}
              >
                <Input
                  type="number"
                  min={0}
                  step={1}
                  invalid={!!errors.maxDiscount}
                  disabled={typeDraft === "flat"}
                  {...register("maxDiscount")}
                />
              </Field>
            </div>
            <div className="rounded-sm border border-neutral-100 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              Preview: <span className="font-medium text-ink">{valuePreview}</span>
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Limits</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Minimum order" error={errors.minOrderTotal?.message} hint="Subtotal must reach this for the coupon to apply.">
                <Input type="number" min={0} step={1} invalid={!!errors.minOrderTotal} {...register("minOrderTotal")} />
              </Field>
              <Field label="Max total redemptions (optional)" error={errors.maxRedemptions?.message} hint="Leave blank for unlimited.">
                <Input type="number" min={1} step={1} invalid={!!errors.maxRedemptions} {...register("maxRedemptions")} />
              </Field>
              <Field label="Per-user limit" error={errors.perUserLimit?.message} hint="How many times a single buyer can redeem this code.">
                <Input type="number" min={1} step={1} invalid={!!errors.perUserLimit} {...register("perUserLimit")} />
              </Field>
              <Field label="Currency" error={errors.currency?.message} hint="3-letter ISO code. Must match the cart currency.">
                <Input invalid={!!errors.currency} {...register("currency")} className="uppercase" />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Validity window</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Valid from (optional)" error={errors.validFrom?.message} hint="Leave blank to make active immediately.">
                <Input type="datetime-local" invalid={!!errors.validFrom} {...register("validFrom")} />
              </Field>
              <Field label="Valid until (optional)" error={errors.validUntil?.message} hint="Leave blank for no end date.">
                <Input type="datetime-local" invalid={!!errors.validUntil} {...register("validUntil")} />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Eligibility</h2>
            <Field
              label="Applicable products (optional)"
              error={errors.applicableProductsRaw?.message}
              hint="Restrict to specific products. Comma- or whitespace-separated product ids. Leave blank to allow any."
            >
              <textarea
                rows={3}
                {...register("applicableProductsRaw")}
                placeholder="64a1b2c3..., 64a1b2d4..."
                className="block w-full rounded-sm border border-neutral-200 bg-paper px-2.5 py-1.5 font-mono text-xs text-ink placeholder:text-neutral-400 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1"
              />
            </Field>
            <Field
              label="Applicable categories (optional)"
              error={errors.applicableCategoriesRaw?.message}
              hint="Restrict to specific categories. Comma- or whitespace-separated category ids."
            >
              <textarea
                rows={2}
                {...register("applicableCategoriesRaw")}
                placeholder="64a1b2c3..."
                className="block w-full rounded-sm border border-neutral-200 bg-paper px-2.5 py-1.5 font-mono text-xs text-ink placeholder:text-neutral-400 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1"
              />
            </Field>
          </section>
        </div>

        {/* Side column */}
        <aside className="flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Status</h2>
            <CheckboxField
              label="Active"
              hint="Inactive coupons reject at apply time with a clear error."
              {...register("isActive")}
            />
          </section>

          {coupon ? (
            <section className="flex flex-col gap-2 rounded-sm border border-neutral-200 bg-paper p-3 text-xs text-neutral-500">
              <h2 className="text-sm font-semibold text-ink">Usage</h2>
              <div className="flex items-center justify-between">
                <span>Redemptions</span>
                <span className="tabular-nums">
                  {coupon.redemptions}{coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : " / ∞"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Created</span>
                <span>{new Date(coupon.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Updated</span>
                <span>{new Date(coupon.updatedAt).toLocaleDateString()}</span>
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-3 rounded-sm border border-neutral-200 bg-paper p-3 text-xs text-neutral-500">
            <h2 className="text-sm font-semibold text-ink">Notes</h2>
            <p>Code, scope, and owner are frozen after creation. To change them, delete and reissue.</p>
            <p>Seller-scope coupons only apply to the issuing seller&apos;s slice of the cart, even if buyers have items from multiple sellers.</p>
          </section>
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
      {description ? (
        <span className="text-xs text-neutral-400">{description}</span>
      ) : null}
    </span>
  </label>
));
RadioOption.displayName = "RadioOption";
