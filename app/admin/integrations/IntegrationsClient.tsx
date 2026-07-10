"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Save,
  Send,
} from "lucide-react";
import { Button, Input, Label, Spinner } from "@/components/ui";
import { FormStickyBar } from "@/components/admin/FormStickyBar";
import { useUIStore } from "@/store/uiStore";
import {
  useAdminSiteSettings,
  useUpdateAdminSiteSettings,
} from "@/hooks/useAdmin";
import { adminApi, AdminError } from "@/lib/api/admin";
import type { SiteSettingsWhatsApp } from "@/types/siteSettings";

/* "" Analytics integrations schema "" */

const schema = z.object({
  /* Google */
  gtmId: z.string().trim().max(30).or(z.literal("")),
  ga4Id: z.string().trim().max(30).or(z.literal("")),
  googleAdsId: z.string().trim().max(30).or(z.literal("")),
  googleAdsLabel: z.string().trim().max(60).or(z.literal("")),
  /* Meta */
  metaPixelId: z.string().trim().max(30).or(z.literal("")),
  /* TikTok */
  tiktokPixelId: z.string().trim().max(30).or(z.literal("")),
  /* Snapchat */
  snapchatPixelId: z.string().trim().max(40).or(z.literal("")),
  /* Pinterest */
  pinterestTagId: z.string().trim().max(30).or(z.literal("")),
  /* Twitter / X */
  twitterPixelId: z.string().trim().max(30).or(z.literal("")),
  /* Hotjar */
  hotjarSiteId: z.string().trim().max(20).or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

/* "" WhatsApp notifications schema "" */

const waSchema = z.object({
  provider: z.enum(["twilio", "wati", "ultramsg", "webhook", ""]),
  enabled: z.boolean(),
  twilioAccountSid: z.string().trim().max(60).or(z.literal("")),
  twilioAuthToken:  z.string().trim().max(60).or(z.literal("")),
  twilioFrom:       z.string().trim().max(40).or(z.literal("")),
  watiApiUrl:   z.string().trim().max(200).or(z.literal("")),
  watiApiToken: z.string().trim().max(200).or(z.literal("")),
  ultraMsgInstanceId: z.string().trim().max(60).or(z.literal("")),
  ultraMsgToken:      z.string().trim().max(60).or(z.literal("")),
  webhookUrl:   z.string().trim().max(500).or(z.literal("")),
  webhookToken: z.string().trim().max(200).or(z.literal("")),
  notifyOnConfirmed: z.boolean(),
  notifyOnShipped:   z.boolean(),
  notifyOnDelivered: z.boolean(),
});
type WaFormValues = z.infer<typeof waSchema>;

const WA_DEFAULTS: WaFormValues = {
  provider: "",
  enabled: false,
  twilioAccountSid: "", twilioAuthToken: "", twilioFrom: "",
  watiApiUrl: "", watiApiToken: "",
  ultraMsgInstanceId: "", ultraMsgToken: "",
  webhookUrl: "", webhookToken: "",
  notifyOnConfirmed: true,
  notifyOnShipped: false,
  notifyOnDelivered: false,
};

/* "" Shared sub-components "" */

interface IntegrationCardProps {
  logo: React.ReactNode;
  title: string;
  description: string;
  docsUrl?: string;
  children: React.ReactNode;
  active?: boolean;
}

function IntegrationCard({
  logo,
  title,
  description,
  docsUrl,
  children,
  active,
}: IntegrationCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-neutral-100 bg-neutral-50 text-lg">
            {logo}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-ink">{title}</h2>
              {active ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                  <CheckCircle2 className="h-3 w-3" aria-hidden /> Active
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
          </div>
        </div>
        {docsUrl ? (
          <a
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-neutral-400 hover:text-ink"
            aria-label={`${title} docs`}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <Label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="text-xs text-neutral-400">{hint}</span>
      ) : null}
    </Label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
        checked ? "bg-accent" : "bg-neutral-200"
      }`}
    >
      <span className="sr-only">{label}</span>
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/* "" WhatsApp section (self-contained) "" */

function WhatsAppSection() {
  const toast = useUIStore((s) => s.toast);
  const { data: settings } = useAdminSiteSettings();
  const update = useUpdateAdminSiteSettings();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    getValues,
    formState: { errors, isDirty },
  } = useForm<WaFormValues>({
    resolver: zodResolver(waSchema),
    defaultValues: WA_DEFAULTS,
  });

  React.useEffect(() => {
    if (!settings) return;
    const wa = settings.whatsappNotifications;
    reset({
      provider:           (wa?.provider ?? "") as WaFormValues["provider"],
      enabled:            wa?.enabled ?? false,
      twilioAccountSid:   wa?.twilioAccountSid ?? "",
      twilioAuthToken:    wa?.twilioAuthToken ?? "",
      twilioFrom:         wa?.twilioFrom ?? "",
      watiApiUrl:         wa?.watiApiUrl ?? "",
      watiApiToken:       wa?.watiApiToken ?? "",
      ultraMsgInstanceId: wa?.ultraMsgInstanceId ?? "",
      ultraMsgToken:      wa?.ultraMsgToken ?? "",
      webhookUrl:         wa?.webhookUrl ?? "",
      webhookToken:       wa?.webhookToken ?? "",
      notifyOnConfirmed:  wa?.notifyOnConfirmed ?? true,
      notifyOnShipped:    wa?.notifyOnShipped ?? false,
      notifyOnDelivered:  wa?.notifyOnDelivered ?? false,
    });
  }, [settings, reset]);

  const provider = watch("provider");

  const [testPhone, setTestPhone] = React.useState("");
  const [testState, setTestState] = React.useState<"idle" | "loading" | "ok" | "err">("idle");

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ whatsappNotifications: values });
      toast({ title: "WhatsApp settings saved", tone: "success" });
      reset(values);
    } catch (err) {
      toast({
        title: err instanceof AdminError ? err.message : "Could not save",
        tone: "error",
      });
    }
  });

  async function handleTestSend() {
    if (!testPhone.trim()) return;
    setTestState("loading");
    try {
      await adminApi.testWhatsApp(testPhone.trim(), getValues() as SiteSettingsWhatsApp);
      setTestState("ok");
      setTimeout(() => setTestState("idle"), 4000);
    } catch (err) {
      setTestState("err");
      toast({
        title: err instanceof AdminError ? err.message : "Test send failed",
        tone: "error",
      });
      setTimeout(() => setTestState("idle"), 4000);
    }
  }

  const submitting = update.isPending;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">WhatsApp Notifications</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Send automated order updates to customers via WhatsApp. Choose a provider,
            enter your credentials, and select which status changes trigger a message.
          </p>
        </div>
        <Button type="submit" size="sm" disabled={!isDirty || submitting}>
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          <span className="ml-1.5">Save</span>
        </Button>
      </header>

      <div className="flex flex-col gap-5 rounded-sm border border-neutral-200 bg-paper p-3">

        {/* Enable toggle */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">Enable WhatsApp notifications</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              Messages are only sent when this is on and a provider is configured.
            </p>
          </div>
          <Controller
            control={control}
            name="enabled"
            render={({ field }) => (
              <Toggle
                checked={field.value}
                onChange={field.onChange}
                label="Enable WhatsApp notifications"
              />
            )}
          />
        </div>

        <div className="h-px bg-neutral-100" />

        {/* Provider select */}
        <Field
          label="Provider"
          hint="The WhatsApp Business API service you have signed up with."
        >
          <div className="relative">
            <select
              {...register("provider")}
              className="h-9 w-full appearance-none rounded-sm border border-neutral-200 bg-paper px-2.5 pr-8 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 cursor-pointer"
            >
              <option value="">None (notifications disabled)</option>
              <option value="twilio">Twilio (global, enterprise-grade)</option>
              <option value="wati">WATI (popular in South Asia)</option>
              <option value="ultramsg">UltraMsg (affordable, easy setup)</option>
              <option value="webhook">Generic webhook (custom integration)</option>
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-neutral-400">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </span>
          </div>
        </Field>

        {/* "" Twilio "" */}
        {provider === "twilio" && (
          <>
            <Field label="Account SID" error={errors.twilioAccountSid?.message}>
              <Input
                {...register("twilioAccountSid")}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                invalid={!!errors.twilioAccountSid}
              />
            </Field>
            <Field label="Auth token" error={errors.twilioAuthToken?.message}>
              <Input
                {...register("twilioAuthToken")}
                type="password"
                placeholder="-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢"
                invalid={!!errors.twilioAuthToken}
              />
            </Field>
            <Field
              label="From number"
              hint="Twilio-registered WhatsApp sender, e.g. whatsapp:+14155238886"
              error={errors.twilioFrom?.message}
            >
              <Input
                {...register("twilioFrom")}
                placeholder="whatsapp:+14155238886"
                invalid={!!errors.twilioFrom}
              />
            </Field>
          </>
        )}

        {/* "" WATI "" */}
        {provider === "wati" && (
          <>
            <Field
              label="API URL"
              hint="Your WATI dashboard endpoint, e.g. https://live-server-1234.wati.io"
              error={errors.watiApiUrl?.message}
            >
              <Input
                {...register("watiApiUrl")}
                placeholder="https://live-server-XXXX.wati.io"
                invalid={!!errors.watiApiUrl}
              />
            </Field>
            <Field label="API token" error={errors.watiApiToken?.message}>
              <Input
                {...register("watiApiToken")}
                type="password"
                placeholder="-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢"
                invalid={!!errors.watiApiToken}
              />
            </Field>
          </>
        )}

        {/* "" UltraMsg "" */}
        {provider === "ultramsg" && (
          <>
            <Field
              label="Instance ID"
              hint="Found in your UltraMsg dashboard under instance details."
              error={errors.ultraMsgInstanceId?.message}
            >
              <Input
                {...register("ultraMsgInstanceId")}
                placeholder="instance12345"
                invalid={!!errors.ultraMsgInstanceId}
              />
            </Field>
            <Field label="Token" error={errors.ultraMsgToken?.message}>
              <Input
                {...register("ultraMsgToken")}
                type="password"
                placeholder="-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢-¢"
                invalid={!!errors.ultraMsgToken}
              />
            </Field>
          </>
        )}

        {/* "" Generic webhook "" */}
        {provider === "webhook" && (
          <>
            <Field
              label="Webhook URL"
              hint="POST endpoint that receives { to, message } in the request body."
              error={errors.webhookUrl?.message}
            >
              <Input
                {...register("webhookUrl")}
                placeholder="https://api.example.com/send-whatsapp"
                invalid={!!errors.webhookUrl}
              />
            </Field>
            <Field
              label="Auth token"
              hint="Optional bearer token sent in the Authorization header."
              error={errors.webhookToken?.message}
            >
              <Input
                {...register("webhookToken")}
                type="password"
                placeholder="Optional secret"
                invalid={!!errors.webhookToken}
              />
            </Field>
          </>
        )}

        {provider ? (
          <>
            <div className="h-px bg-neutral-100" />

            {/* Triggers */}
            <div>
              <p className="mb-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                Send message when order status changes to
              </p>
              <div className="flex flex-wrap gap-5">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink select-none">
                  <input
                    type="checkbox"
                    {...register("notifyOnConfirmed")}
                    className="h-4 w-4 rounded border-neutral-300 accent-accent"
                  />
                  <span>Confirmed</span>
                  <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">recommended</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink select-none">
                  <input
                    type="checkbox"
                    {...register("notifyOnShipped")}
                    className="h-4 w-4 rounded border-neutral-300 accent-accent"
                  />
                  Shipped
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink select-none">
                  <input
                    type="checkbox"
                    {...register("notifyOnDelivered")}
                    className="h-4 w-4 rounded border-neutral-300 accent-accent"
                  />
                  Delivered
                </label>
              </div>
            </div>

            <div className="h-px bg-neutral-100" />

            {/* Test send */}
            <div>
              <p className="mb-1 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                Test send
              </p>
              <p className="mb-3 text-xs text-neutral-400">
                Sends a sample confirmed-order message to verify your credentials.
                The phone must be registered with WhatsApp.
              </p>
              <div className="flex gap-2">
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="01XXXXXXXXX or +8801XXXXXXXXX"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!testPhone.trim() || testState === "loading"}
                  onClick={handleTestSend}
                >
                  {testState === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : testState === "ok" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden />
                  )}
                  <span className="ml-1.5">
                    {testState === "loading"
                      ? "Sending..."
                      : testState === "ok"
                      ? "Sent!"
                      : "Send test"}
                  </span>
                </Button>
              </div>
              {testState === "ok" && (
                <p className="mt-2 text-xs text-green-600">
                  Test message sent — check the phone for the WhatsApp message.
                </p>
              )}
              {testState === "err" && (
                <p className="mt-2 text-xs text-red-600">
                  Send failed — check your credentials above and try again.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-sm border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-center text-xs text-neutral-400">
            Select a provider above to configure credentials and test the integration.
          </div>
        )}
      </div>

      <FormStickyBar mode="edit" isDirty={isDirty} isSubmitting={submitting} />
    </form>
  );
}

/* "" Main component "" */

export function IntegrationsClient() {
  const toast = useUIStore((s) => s.toast);
  const { data: settings, isLoading, isError, error, refetch } = useAdminSiteSettings();
  const update = useUpdateAdminSiteSettings();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      gtmId: "",
      ga4Id: "",
      googleAdsId: "",
      googleAdsLabel: "",
      metaPixelId: "",
      tiktokPixelId: "",
      snapchatPixelId: "",
      pinterestTagId: "",
      twitterPixelId: "",
      hotjarSiteId: "",
    },
  });

  React.useEffect(() => {
    if (!settings) return;
    const i = settings.integrations ?? {};
    reset({
      gtmId: i.gtmId ?? "",
      ga4Id: i.ga4Id ?? "",
      googleAdsId: i.googleAdsId ?? "",
      googleAdsLabel: i.googleAdsLabel ?? "",
      metaPixelId: i.metaPixelId ?? "",
      tiktokPixelId: i.tiktokPixelId ?? "",
      snapchatPixelId: i.snapchatPixelId ?? "",
      pinterestTagId: i.pinterestTagId ?? "",
      twitterPixelId: i.twitterPixelId ?? "",
      hotjarSiteId: i.hotjarSiteId ?? "",
    });
  }, [settings, reset]);

  const watched = watch();
  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ integrations: values });
      toast({ title: "Integrations saved", tone: "success" });
      reset(values);
    } catch (err) {
      toast({
        title: err instanceof AdminError ? err.message : "Could not save",
        tone: "error",
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-sm border border-neutral-200 bg-paper">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
        <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
        <p className="text-sm text-neutral-500">
          {error instanceof AdminError ? error.message : "Could not load settings."}
        </p>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const submitting = update.isPending;

  return (
    <div className="flex flex-col gap-10">

      {/* "" Analytics & tracking integrations "" */}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">

        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Integrations</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Connect analytics, advertising, and tracking platforms. Keys are stored
              securely and injected into every storefront page automatically.
            </p>
          </div>
          <Button type="submit" size="sm" disabled={!isDirty || submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            <span className="ml-1.5">Save</span>
          </Button>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Google Tag Manager */}
          <IntegrationCard
            logo={<GoogleIcon />}
            title="Google Tag Manager"
            description="Deploy all your marketing and analytics tags from a single container. Add GTM once — manage everything else from inside GTM."
            docsUrl="https://support.google.com/tagmanager/answer/6103696"
            active={!!watched.gtmId}
          >
            <Field
              label="Container ID"
              hint="Looks like GTM-XXXXXXX. Leave blank to skip GTM entirely."
              error={errors.gtmId?.message}
            >
              <Input
                {...register("gtmId")}
                placeholder="GTM-XXXXXXX"
                invalid={!!errors.gtmId}
              />
            </Field>
          </IntegrationCard>

          {/* Google Analytics 4 */}
          <IntegrationCard
            logo={<GoogleIcon />}
            title="Google Analytics 4"
            description="Direct GA4 integration — use this only if you are not running GA4 as a tag inside GTM."
            docsUrl="https://support.google.com/analytics/answer/9304153"
            active={!!watched.ga4Id}
          >
            <Field
              label="Measurement ID"
              hint="Looks like G-XXXXXXXXXX."
              error={errors.ga4Id?.message}
            >
              <Input
                {...register("ga4Id")}
                placeholder="G-XXXXXXXXXX"
                invalid={!!errors.ga4Id}
              />
            </Field>
          </IntegrationCard>

          {/* Google Ads */}
          <IntegrationCard
            logo={<GoogleIcon />}
            title="Google Ads Conversion"
            description="Track purchase and add-to-cart conversions directly in Google Ads without GTM."
            docsUrl="https://support.google.com/google-ads/answer/6095821"
            active={!!watched.googleAdsId}
          >
            <Field
              label="Conversion ID"
              hint="Looks like AW-XXXXXXXXXX."
              error={errors.googleAdsId?.message}
            >
              <Input
                {...register("googleAdsId")}
                placeholder="AW-XXXXXXXXXX"
                invalid={!!errors.googleAdsId}
              />
            </Field>
            <Field
              label="Conversion label"
              hint="The label for your primary purchase conversion action."
              error={errors.googleAdsLabel?.message}
            >
              <Input
                {...register("googleAdsLabel")}
                placeholder="AbCdEfGhIjKlMnOp"
                invalid={!!errors.googleAdsLabel}
              />
            </Field>
          </IntegrationCard>

          {/* Meta Pixel */}
          <IntegrationCard
            logo={<MetaIcon />}
            title="Meta Pixel"
            description="Track events across Facebook and Instagram — PageView, AddToCart, Purchase, and more. Powers retargeting audiences."
            docsUrl="https://www.facebook.com/business/help/952192354843755"
            active={!!watched.metaPixelId}
          >
            <Field
              label="Pixel ID"
              hint="15-16 digit number from your Meta Events Manager."
              error={errors.metaPixelId?.message}
            >
              <Input
                {...register("metaPixelId")}
                placeholder="123456789012345"
                invalid={!!errors.metaPixelId}
              />
            </Field>
          </IntegrationCard>

          {/* TikTok */}
          <IntegrationCard
            logo={<TikTokIcon />}
            title="TikTok Pixel"
            description="Measure ad performance and optimise delivery for TikTok campaigns — PageView, AddToCart, Purchase."
            docsUrl="https://ads.tiktok.com/help/article/tiktok-pixel"
            active={!!watched.tiktokPixelId}
          >
            <Field
              label="Pixel ID"
              hint="Found in TikTok Ads Manager > Assets > Events."
              error={errors.tiktokPixelId?.message}
            >
              <Input
                {...register("tiktokPixelId")}
                placeholder="CXXXXXXXXXXXXXXXXX"
                invalid={!!errors.tiktokPixelId}
              />
            </Field>
          </IntegrationCard>

          {/* Snapchat */}
          <IntegrationCard
            logo={<SnapchatIcon />}
            title="Snapchat Pixel"
            description="Track conversions from Snapchat ads and build audiences for retargeting."
            docsUrl="https://businesshelp.snapchat.com/s/article/snap-pixel-about"
            active={!!watched.snapchatPixelId}
          >
            <Field
              label="Pixel ID"
              hint="Found in Snapchat Ads Manager > Events Manager."
              error={errors.snapchatPixelId?.message}
            >
              <Input
                {...register("snapchatPixelId")}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                invalid={!!errors.snapchatPixelId}
              />
            </Field>
          </IntegrationCard>

          {/* Pinterest */}
          <IntegrationCard
            logo={<PinterestIcon />}
            title="Pinterest Tag"
            description="Attribute sales to Pinterest ads and build audiences from site visitors."
            docsUrl="https://help.pinterest.com/en/business/article/install-the-pinterest-tag"
            active={!!watched.pinterestTagId}
          >
            <Field
              label="Tag ID"
              hint="Found in Pinterest Ads Manager > Conversions."
              error={errors.pinterestTagId?.message}
            >
              <Input
                {...register("pinterestTagId")}
                placeholder="2501234567890"
                invalid={!!errors.pinterestTagId}
              />
            </Field>
          </IntegrationCard>

          {/* Twitter / X */}
          <IntegrationCard
            logo={<TwitterIcon />}
            title="X (Twitter) Pixel"
            description="Measure conversions and build retargeting audiences from X ad campaigns."
            docsUrl="https://business.x.com/en/help/campaign-measurement-and-analytics/conversion-tracking-for-websites.html"
            active={!!watched.twitterPixelId}
          >
            <Field
              label="Pixel ID"
              hint="Found in X Ads Manager > Tools > Event Manager."
              error={errors.twitterPixelId?.message}
            >
              <Input
                {...register("twitterPixelId")}
                placeholder="oxxxxxx"
                invalid={!!errors.twitterPixelId}
              />
            </Field>
          </IntegrationCard>

          {/* Hotjar */}
          <IntegrationCard
            logo={<HotjarIcon />}
            title="Hotjar"
            description="Session recordings, heatmaps and user feedback. Understand how customers use the storefront."
            docsUrl="https://help.hotjar.com/hc/en-us/articles/115009336727"
            active={!!watched.hotjarSiteId}
          >
            <Field
              label="Site ID"
              hint="Numeric ID from Hotjar Dashboard > Tracking Code."
              error={errors.hotjarSiteId?.message}
            >
              <Input
                {...register("hotjarSiteId")}
                placeholder="1234567"
                invalid={!!errors.hotjarSiteId}
              />
            </Field>
          </IntegrationCard>

        </div>

        {/* Info */}
        <div className="rounded-sm border border-neutral-100 bg-neutral-50 p-4 text-xs text-neutral-500">
          <strong className="font-medium text-neutral-700">How it works:</strong>{" "}
          Keys are saved in your database and injected into every storefront page
          on the next page load — no deploy required. GTM takes precedence over
          standalone GA4 or Google Ads tags if both are configured. All pixels fire
          a{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono">PageView</code>{" "}
          event on each navigation, and purchase events are fired automatically
          at order confirmation.
        </div>

        <FormStickyBar
          mode="edit"
          isDirty={isDirty}
          isSubmitting={submitting}
        />
      </form>

      {/* "" WhatsApp notifications "" */}
      <WhatsAppSection />

    </div>
  );
}

/* "" Brand SVG icons "" */

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MetaIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="#1877F2">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="#000000">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.89a8.18 8.18 0 004.78 1.52V7a4.85 4.85 0 01-1.01-.31z"/>
    </svg>
  );
}

function SnapchatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="#FFFC00">
      <path d="M12.166 2C9.68 2 7.5 3.034 6.224 4.782c-.712.963-1.038 2.067-1.038 3.417v.888c-.406.17-.813.255-1.186.255-.237 0-.44-.034-.627-.085l-.204-.051-.17.153c-.12.12-.17.289-.12.441.272.881 1.084 1.49 2.1 1.695-.017.17-.017.34-.017.51 0 .306.017.612.068.9-.17.051-.34.068-.51.068-.458 0-.916-.17-1.22-.34l-.238-.136-.204.17c-.136.12-.17.306-.085.458.322.627 1.1 1.05 2.117 1.2.577 1.05 1.644 1.882 3.032 2.389.544.204 1.118.34 1.71.44-.017.068-.034.17-.085.288-.204.51-.577.9-1.05 1.135-.34.153-.696.238-1.05.306-.527.102-1.05.204-1.39.612-.068.085-.119.17-.153.255-.034.086-.05.17-.05.255 0 .153.05.29.136.408.238.306.696.51 1.288.51.237 0 .475-.034.713-.085.17-.034.34-.085.51-.102.51-.085 1.02.1 1.36.425.24.238.459.51.68.764.459.544.95 1.067 1.728 1.355.39.136.814.204 1.254.204.44 0 .866-.068 1.254-.204.779-.288 1.271-.81 1.729-1.355.22-.254.44-.526.678-.764.34-.324.85-.51 1.36-.424.17.016.34.067.51.101.237.051.475.085.712.085.594 0 1.051-.204 1.29-.51.085-.118.135-.255.135-.407a.98.98 0 00-.05-.255 1.13 1.13 0 00-.153-.255c-.34-.408-.865-.51-1.39-.612-.356-.068-.712-.153-1.051-.306-.475-.235-.847-.625-1.05-1.135-.05-.118-.068-.22-.085-.288.59-.1 1.166-.236 1.711-.44 1.39-.507 2.456-1.34 3.032-2.389 1.017-.15 1.796-.573 2.117-1.2.085-.152.051-.338-.085-.457l-.204-.17-.237.135c-.306.17-.763.34-1.22.34-.17 0-.34-.017-.51-.068.051-.288.068-.594.068-.9 0-.17 0-.34-.017-.51 1.017-.204 1.829-.814 2.1-1.695.051-.152 0-.322-.12-.44l-.17-.154-.203.051c-.187.051-.39.085-.628.085-.373 0-.78-.085-1.186-.255v-.888c0-1.35-.325-2.454-1.037-3.417C16.5 3.034 14.32 2 11.834 2H12.166z"/>
    </svg>
  );
}

function PinterestIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="#E60023">
      <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="#000000">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

function HotjarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="#FD3A5C">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-.5 14.5v-3h-3l4.5-8v3h3l-4.5 8z"/>
    </svg>
  );
}


