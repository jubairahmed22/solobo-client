"use client";

import * as React from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  Check,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
  Truck,
} from "lucide-react";
import { Button, Input, Label, Spinner } from "@/components/ui";
import { FormStickyBar } from "@/components/admin/FormStickyBar";
import { ImageUploader } from "@/components/composed/ImageUploader";
import { MarkdownEditor } from "@/components/composed";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils/cn";
import {
  useAdminSiteSettings,
  useUpdateSiteSettings,
} from "@/hooks/useSiteSettings";
import { AdminError } from "@/lib/api/admin";
import type {
  SiteSettings,
  UpdateSiteSettingsBody,
} from "@/types/siteSettings";
import type { UploadedImage } from "@/types/uploads";

/* "" Payment methods "" */

const PAYMENT_METHOD_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "cod", label: "Cash on delivery" },
  { id: "bkash", label: "bKash" },
  { id: "nagad", label: "Nagad" },
  { id: "rocket", label: "Rocket" },
  { id: "sslcommerz", label: "SSLCommerz" },
  { id: "stripe", label: "Stripe" },
  { id: "paypal", label: "PayPal" },
  { id: "card", label: "Card (direct)" },
  { id: "bank_transfer", label: "Bank transfer" },
];

const ALL_PAYMENT_IDS = PAYMENT_METHOD_OPTIONS.map((m) => m.id);

/* "" Schema "" */

const faqSchema = z.object({
  question: z.string().trim().min(1, "Required").max(500),
  answer: z.string().trim().min(1, "Required").max(5000),
});

const announcementItemSchema = z.object({
  text: z.string().trim().min(1, "Required").max(200),
});

const schema = z.object({
  companyName: z.string().trim().min(1, "Required").max(200),
  companyTitle: z.string().trim().max(200).or(z.literal("")),
  companyLogo: z.string().trim().url("Must be a URL").or(z.literal("")),
  shortDescription: z.string().trim().max(500).or(z.literal("")),
  insideDhaka: z.coerce.number().int().nonnegative("Must be 0 or more").max(100000),
  outsideDhaka: z.coerce.number().int().nonnegative("Must be 0 or more").max(100000),
  freeShippingThreshold: z.coerce.number().int().nonnegative("Must be 0 or more").max(10000000),
  contactEmail: z.string().trim().email("Invalid email").or(z.literal("")),
  contactPhone: z.string().trim().max(40).or(z.literal("")),
  contactWhatsapp: z.string().trim().max(40).or(z.literal("")),
  contactAddress: z.string().trim().max(500).or(z.literal("")),
  contactFacebook: z.string().trim().url("Must be a URL").or(z.literal("")),
  contactInstagram: z.string().trim().url("Must be a URL").or(z.literal("")),
  contactYoutube: z.string().trim().url("Must be a URL").or(z.literal("")),
  termsAndConditions: z.string().max(50000).or(z.literal("")),
  returnPolicy: z.string().max(50000).or(z.literal("")),
  shippingDetails: z.string().max(50000).or(z.literal("")),
  faqs: z.array(faqSchema).max(100),
  enabledPaymentMethods: z.array(z.string()),
});
type FormValues = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

function toDefaults(s: SiteSettings | null | undefined): FormValues {
  return {
    companyName: s?.companyName ?? "",
    companyTitle: s?.companyTitle ?? "",
    companyLogo: s?.companyLogo ?? "",
    shortDescription: s?.shortDescription ?? "",
    insideDhaka: s?.delivery?.insideDhaka ?? 0,
    outsideDhaka: s?.delivery?.outsideDhaka ?? 0,
    freeShippingThreshold: s?.delivery?.freeShippingThreshold ?? 0,
    contactEmail: s?.contact?.email ?? "",
    contactPhone: s?.contact?.phone ?? "",
    contactWhatsapp: s?.contact?.whatsapp ?? "",
    contactAddress: s?.contact?.address ?? "",
    contactFacebook: s?.contact?.facebook ?? "",
    contactInstagram: s?.contact?.instagram ?? "",
    contactYoutube: s?.contact?.youtube ?? "",
    termsAndConditions: s?.termsAndConditions ?? "",
    returnPolicy: s?.returnPolicy ?? "",
    shippingDetails: s?.shippingDetails ?? "",
    faqs: s?.faqs?.map((f) => ({ question: f.question, answer: f.answer })) ?? [],
    enabledPaymentMethods: s?.enabledPaymentMethods ?? ALL_PAYMENT_IDS,
  };
}

function toPayload(v: FormOutput): UpdateSiteSettingsBody {
  return {
    companyName: v.companyName,
    companyTitle: v.companyTitle,
    companyLogo: v.companyLogo,
    shortDescription: v.shortDescription,
    delivery: {
      insideDhaka: v.insideDhaka,
      outsideDhaka: v.outsideDhaka,
      freeShippingThreshold: v.freeShippingThreshold,
    },
    contact: {
      email: v.contactEmail,
      phone: v.contactPhone,
      whatsapp: v.contactWhatsapp,
      address: v.contactAddress,
      facebook: v.contactFacebook,
      instagram: v.contactInstagram,
      youtube: v.contactYoutube,
    },
    termsAndConditions: v.termsAndConditions,
    returnPolicy: v.returnPolicy,
    shippingDetails: v.shippingDetails,
    faqs: v.faqs,
    enabledPaymentMethods: v.enabledPaymentMethods,
  };
}

/* "" Page wrapper "" */

export function CompanyProfileForm() {
  const { data, isLoading, isError, error, refetch } = useAdminSiteSettings();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-sm border border-neutral-200 bg-paper">
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    const message =
      error instanceof AdminError ? error.message : "Couldn't load site settings.";
    return (
      <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
        <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
        <p className="text-sm text-neutral-500">{message}</p>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  return <Form key={data._id} settings={data} />;
}

/* "" Form "" */

interface FormProps {
  settings: SiteSettings;
}

function Form({ settings }: FormProps) {
  const toast = useUIStore((s) => s.toast);
  const update = useUpdateSiteSettings();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(settings),
  });

  const {
    fields: faqFields,
    append: appendFaq,
    remove: removeFaq,
    move: moveFaq,
  } = useFieldArray({ control, name: "faqs" });

  const [watchThreshold, watchInside, watchOutside] = useWatch({
    control,
    name: ["freeShippingThreshold", "insideDhaka", "outsideDhaka"],
  });
  const enabledMethods = useWatch({ control, name: "enabledPaymentMethods" }) ?? ALL_PAYMENT_IDS;
  const previewThreshold = Number(watchThreshold) || 0;
  const previewInside = Number(watchInside) || 0;
  const previewOutside = Number(watchOutside) || 0;

  const onSubmit = handleSubmit(async (raw) => {
    const parsed = schema.parse(raw);
    const payload = toPayload(parsed);
    try {
      const updated = await update.mutateAsync(payload);
      toast({ title: "Settings saved", tone: "success" });
      reset(toDefaults(updated));
    } catch (err) {
      if (err instanceof AdminError) {
        if (err.fieldErrors?.length) {
          for (const fe of err.fieldErrors) {
            const path = mapBackendPathToFormPath(fe.path);
            if (path) setError(path, { message: fe.message });
          }
        }
        toast({ title: "Could not save", description: err.message, tone: "error" });
      } else {
        toast({ title: "Could not save", tone: "error" });
      }
    }
  });

  const busy = update.isPending;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold text-ink">Company profile</h1>
          <p className="text-sm text-neutral-500">
            Storefront identity, delivery charges, contact card, and the long-form policy pages. Changes go live immediately.
          </p>
        </div>
        <Button type="submit" size="sm" disabled={!isDirty || busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          <span className="ml-1.5">Save changes</span>
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="flex flex-col gap-4">
          {/* Branding */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Branding</h2>
            <Field label="Company name" error={errors.companyName?.message}>
              <Input invalid={!!errors.companyName} {...register("companyName")} />
            </Field>
            <Field
              label="Company title"
              error={errors.companyTitle?.message}
              hint='Short tagline shown next to the logo (e.g. "Built to move").'
            >
              <Input invalid={!!errors.companyTitle} {...register("companyTitle")} />
            </Field>
            <Controller
              control={control}
              name="companyLogo"
              render={({ field }) => {
                const uploaderValue: UploadedImage[] = field.value ? [{ url: field.value }] : [];
                return (
                  <div className="flex flex-col gap-1.5">
                    <ImageUploader
                      label="Company logo"
                      hint="Used in the navbar, footer, invoices, and order emails."
                      scope="brand"
                      max={1}
                      hideAlt
                      value={uploaderValue}
                      onChange={(next) => field.onChange(next[0]?.url ?? "")}
                    />
                    {errors.companyLogo?.message ? (
                      <span className="text-xs text-ink">{errors.companyLogo.message}</span>
                    ) : null}
                  </div>
                );
              }}
            />
            <Field
              label="Short description"
              error={errors.shortDescription?.message}
              hint="One-line summary used in SEO meta and the footer."
            >
              <textarea rows={3} {...register("shortDescription")} className={textareaClass} />
            </Field>
          </section>

          {/* Delivery */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <div>
              <h2 className="text-base font-semibold text-ink">Delivery charges</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Flat rates applied at checkout based on the customer&apos;s district. Set a free delivery threshold to incentivise larger orders — the cart progress bar and product page nudge update automatically.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Inside Dhaka (৳)" error={errors.insideDhaka?.message}>
                <Input type="number" min={0} step={1} invalid={!!errors.insideDhaka} {...register("insideDhaka")} />
              </Field>
              <Field label="Outside Dhaka (৳)" error={errors.outsideDhaka?.message}>
                <Input type="number" min={0} step={1} invalid={!!errors.outsideDhaka} {...register("outsideDhaka")} />
              </Field>
              <Field
                label="Free delivery from (৳)"
                error={errors.freeShippingThreshold?.message}
                hint="Set to 0 to disable free delivery."
              >
                <Input type="number" min={0} step={1} invalid={!!errors.freeShippingThreshold} {...register("freeShippingThreshold")} />
              </Field>
            </div>

            {/* Live storefront preview */}
            <div className="rounded-sm border border-neutral-200 bg-neutral-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Storefront preview
              </p>
              <div className="flex flex-col gap-3">
                {/* Product page trust strip */}
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <Truck className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                  {previewThreshold > 0 ? (
                    <span>
                      Free delivery on orders over{" "}
                      <span className="font-semibold text-ink">
                        Tk {previewThreshold.toLocaleString("en-IN")}
                      </span>
                    </span>
                  ) : (
                    <span className="text-neutral-400 italic">
                      No free delivery threshold set — product page shows standard rates
                    </span>
                  )}
                </div>

                {/* Cart progress bar preview */}
                {previewThreshold > 0 ? (
                  <div className="flex flex-col gap-1.5 rounded-sm border border-neutral-200 bg-paper px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-neutral-600">
                        Add <span className="font-semibold text-ink">Tk {previewThreshold.toLocaleString("en-IN")}</span> for free delivery
                      </span>
                      <span className="text-neutral-400">Tk {previewThreshold.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                      <div className="h-full w-[40%] rounded-full bg-accent" />
                    </div>
                  </div>
                ) : null}

                {/* Shipping rates */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                  <span>
                    Inside Dhaka:{" "}
                    <span className="font-medium text-ink">
                      {previewInside > 0 ? `Tk ${previewInside.toLocaleString("en-IN")}` : "Free"}
                    </span>
                  </span>
                  <span>·</span>
                  <span>
                    Outside Dhaka:{" "}
                    <span className="font-medium text-ink">
                      {previewOutside > 0 ? `Tk ${previewOutside.toLocaleString("en-IN")}` : "Free"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Policy pages */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Policy pages</h2>
            <p className="text-sm text-neutral-500">
              Long-form content rendered on the public <strong>/terms</strong>, <strong>/returns</strong> and <strong>/shipping</strong> pages. Use the toolbar to format — headings, bold, lists and links — and the Preview tab to see exactly how it renders on the storefront.
            </p>
            <Field label="Terms and conditions" error={errors.termsAndConditions?.message}>
              <Controller
                control={control}
                name="termsAndConditions"
                render={({ field }) => (
                  <MarkdownEditor value={field.value} onChange={field.onChange} rows={12} />
                )}
              />
            </Field>
            <Field label="Return policy" error={errors.returnPolicy?.message}>
              <Controller
                control={control}
                name="returnPolicy"
                render={({ field }) => (
                  <MarkdownEditor value={field.value} onChange={field.onChange} rows={12} />
                )}
              />
            </Field>
            <Field label="Shipping details" error={errors.shippingDetails?.message}>
              <Controller
                control={control}
                name="shippingDetails"
                render={({ field }) => (
                  <MarkdownEditor value={field.value} onChange={field.onChange} rows={12} />
                )}
              />
            </Field>
          </section>

          {/* FAQ */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">FAQ ({faqFields.length})</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => appendFaq({ question: "", answer: "" })}
                disabled={faqFields.length >= 100}
              >
                <Plus className="h-4 w-4" aria-hidden />
                <span className="ml-1.5">Add FAQ</span>
              </Button>
            </div>
            {faqFields.length === 0 ? (
              <p className="rounded-sm border border-dashed border-neutral-200 p-4 text-center text-sm text-neutral-400">
                No FAQs yet. Click &ldquo;Add FAQ&rdquo; to create the first one.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {faqFields.map((field, i) => (
                  <li key={field.id} className="flex flex-col gap-3 rounded-sm border border-neutral-200 p-4">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                        <GripVertical className="h-3.5 w-3.5" aria-hidden />
                        FAQ #{i + 1}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => moveFaq(i, i - 1)}
                          disabled={i === 0}
                          className="rounded-sm border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:border-ink hover:text-ink disabled:opacity-40 disabled:hover:border-neutral-200 disabled:hover:text-neutral-700"
                          aria-label="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFaq(i, i + 1)}
                          disabled={i === faqFields.length - 1}
                          className="rounded-sm border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:border-ink hover:text-ink disabled:opacity-40 disabled:hover:border-neutral-200 disabled:hover:text-neutral-700"
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFaq(i)}
                          className="inline-flex items-center gap-1.5 rounded-sm border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:border-ink hover:text-ink"
                          aria-label="Remove FAQ"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                    <Field label="Question" error={errors.faqs?.[i]?.question?.message}>
                      <Input invalid={!!errors.faqs?.[i]?.question} {...register(`faqs.${i}.question` as const)} />
                    </Field>
                    <Field label="Answer" error={errors.faqs?.[i]?.answer?.message}>
                      <Controller
                        control={control}
                        name={`faqs.${i}.answer` as const}
                        render={({ field }) => (
                          <MarkdownEditor value={field.value} onChange={field.onChange} rows={5} />
                        )}
                      />
                    </Field>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Side column */}
        <aside className="flex flex-col gap-4">
          {/* Contact */}
          <section className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
            <h2 className="text-base font-semibold text-ink">Contact</h2>
            <Field label="Email" error={errors.contactEmail?.message}>
              <Input type="email" invalid={!!errors.contactEmail} {...register("contactEmail")} />
            </Field>
            <Field label="Phone" error={errors.contactPhone?.message}>
              <Input invalid={!!errors.contactPhone} {...register("contactPhone")} />
            </Field>
            <Field label="WhatsApp" error={errors.contactWhatsapp?.message}>
              <Input invalid={!!errors.contactWhatsapp} {...register("contactWhatsapp")} />
            </Field>
            <Field label="Address" error={errors.contactAddress?.message} hint="Shown in the footer and on invoices.">
              <textarea rows={3} {...register("contactAddress")} className={textareaClass} />
            </Field>
            <Field label="Facebook URL" error={errors.contactFacebook?.message}>
              <Input invalid={!!errors.contactFacebook} placeholder="https://facebook.com/yourpage" {...register("contactFacebook")} />
            </Field>
            <Field label="Instagram URL" error={errors.contactInstagram?.message}>
              <Input invalid={!!errors.contactInstagram} placeholder="https://instagram.com/yourhandle" {...register("contactInstagram")} />
            </Field>
            <Field label="YouTube URL" error={errors.contactYoutube?.message}>
              <Input invalid={!!errors.contactYoutube} placeholder="https://youtube.com/yourchannel" {...register("contactYoutube")} />
            </Field>
          </section>

          {/* Payment methods */}
          <section className="flex flex-col gap-3 rounded-sm border border-neutral-200 bg-paper p-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Payment methods</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Toggle which options appear at checkout. At least one must stay enabled.
              </p>
            </div>
            <ul className="flex flex-col gap-1">
              {PAYMENT_METHOD_OPTIONS.map((opt) => {
                const checked = enabledMethods.includes(opt.id);
                const isLast = enabledMethods.length === 1 && checked;
                return (
                  <li key={opt.id}>
                    <label className={cn("flex items-center gap-2 py-1 text-sm", isLast ? "cursor-default" : "cursor-pointer")}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        disabled={isLast}
                        onChange={() => {
                          const next = checked
                            ? enabledMethods.filter((m) => m !== opt.id)
                            : [...enabledMethods, opt.id];
                          setValue("enabledPaymentMethods", next, { shouldDirty: true });
                        }}
                      />
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                          checked ? "border-ink bg-ink" : "border-neutral-300 bg-white",
                        )}
                      >
                        {checked ? <Check className="h-2.5 w-2.5 text-white" aria-hidden /> : null}
                      </span>
                      <span className={isLast ? "text-neutral-400" : "text-neutral-700"}>
                        {opt.label}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="flex flex-col gap-2 rounded-sm border border-neutral-200 bg-paper p-3 text-xs text-neutral-500">
            <h2 className="text-sm font-semibold text-ink">Meta</h2>
            <div className="flex items-center justify-between">
              <span>Created</span>
              <span>{new Date(settings.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Updated</span>
              <span>{new Date(settings.updatedAt).toLocaleDateString()}</span>
            </div>
          </section>
        </aside>
      </div>

      <FormStickyBar
        mode="edit"
        isDirty={isDirty}
        isSubmitting={busy}
      />
    </form>
  );
}

/* "" Helpers "" */

const textareaClass =
  "block w-full rounded-sm border border-neutral-200 bg-paper px-2.5 py-1.5 text-sm text-ink placeholder:text-neutral-400 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1";

function mapBackendPathToFormPath(
  path: string,
): keyof FormValues | `faqs.${number}.${"question" | "answer"}` | null {
  if (path.startsWith("delivery.")) {
    const k = path.slice("delivery.".length);
    if (k === "insideDhaka" || k === "outsideDhaka" || k === "freeShippingThreshold") {
      return k as keyof FormValues;
    }
  }
  if (path.startsWith("contact.")) {
    const k = path.slice("contact.".length);
    const map: Record<string, keyof FormValues> = {
      email: "contactEmail",
      phone: "contactPhone",
      whatsapp: "contactWhatsapp",
      address: "contactAddress",
      facebook: "contactFacebook",
      instagram: "contactInstagram",
      youtube: "contactYoutube",
    };
    const hit = map[k];
    if (hit) return hit;
  }
  if (path.startsWith("faqs.")) {
    const m = path.match(/^faqs\.(\d+)\.(question|answer)$/);
    if (m) return `faqs.${Number(m[1])}.${m[2] as "question" | "answer"}`;
  }
  const direct = path as keyof FormValues;
  if (
    ["companyName", "companyTitle", "companyLogo", "shortDescription", "termsAndConditions", "returnPolicy", "shippingDetails"].includes(direct)
  ) {
    return direct;
  }
  return null;
}

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


