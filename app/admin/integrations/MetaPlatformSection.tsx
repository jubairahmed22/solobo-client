"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Facebook,
  Instagram,
  MessageCircle,
  Send,
  Radio,
  Users,
  Megaphone,
  ShieldCheck,
  Building2,
  Rss,
  AtSign,
  Webhook,
  UserPlus,
  Search,
  AlertTriangle,
} from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { FormStickyBar } from "@/components/admin/FormStickyBar";
import { useUIStore } from "@/store/uiStore";
import { useAdminSiteSettings, useUpdateAdminSiteSettings } from "@/hooks/useAdmin";
import { adminApi, AdminError } from "@/lib/api/admin";
import { IntegrationCard } from "./IntegrationsClient";
import type { MetaActionResult, SiteSettingsMeta } from "@/types/siteSettings";

/**
 * "Meta Platform" card - every credential Solobo needs across Meta's product
 * suite, saved in one place (SiteSettings.meta) and each individually
 * test-able against the live Graph API via metaGraph.service.ts on the
 * backend. Grouped exactly as Meta's own taxonomy: Advertising, Messaging,
 * Publishing, Identity, and Real-Time Data.
 *
 * Test/action buttons always run against whatever is currently SAVED in the
 * database (not the unsaved form draft) - the backend reads SiteSettings.meta
 * fresh on every call, so unlike the WhatsApp notification section above,
 * you save first, then test.
 */

const str = () => z.string().trim().or(z.literal(""));

const schema = z.object({
  appId: str(),
  appSecret: str(),
  systemUserAccessToken: str(),
  apiVersion: str(),
  capi: z.object({ pixelId: str(), accessToken: str(), testEventCode: str() }),
  marketing: z.object({ adAccountId: str(), accessToken: str() }),
  whatsapp: z.object({ phoneNumberId: str(), businessAccountId: str(), accessToken: str() }),
  messenger: z.object({ pageId: str(), pageAccessToken: str(), appSecret: str(), verifyToken: str() }),
  instagramMessaging: z.object({ businessAccountId: str(), accessToken: str() }),
  pagesGraph: z.object({ pageId: str(), pageAccessToken: str() }),
  instagramGraph: z.object({ businessAccountId: str(), accessToken: str() }),
  threads: z.object({ userId: str(), accessToken: str() }),
  login: z.object({ appId: str(), appSecret: str() }),
  business: z.object({ businessManagerId: str(), systemUserAccessToken: str() }),
  webhooks: z.object({ verifyToken: str(), appSecret: str() }),
  leadAds: z.object({ accessToken: str() }),
  adLibrary: z.object({ accessToken: str() }),
});
type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  appId: "", appSecret: "", systemUserAccessToken: "", apiVersion: "v21.0",
  capi: { pixelId: "", accessToken: "", testEventCode: "" },
  marketing: { adAccountId: "", accessToken: "" },
  whatsapp: { phoneNumberId: "", businessAccountId: "", accessToken: "" },
  messenger: { pageId: "", pageAccessToken: "", appSecret: "", verifyToken: "" },
  instagramMessaging: { businessAccountId: "", accessToken: "" },
  pagesGraph: { pageId: "", pageAccessToken: "" },
  instagramGraph: { businessAccountId: "", accessToken: "" },
  threads: { userId: "", accessToken: "" },
  login: { appId: "", appSecret: "" },
  business: { businessManagerId: "", systemUserAccessToken: "" },
  webhooks: { verifyToken: "", appSecret: "" },
  leadAds: { accessToken: "" },
  adLibrary: { accessToken: "" },
};

function fromSettings(meta: SiteSettingsMeta | undefined): FormValues {
  if (!meta) return DEFAULTS;
  return {
    appId: meta.appId ?? "", appSecret: meta.appSecret ?? "",
    systemUserAccessToken: meta.systemUserAccessToken ?? "", apiVersion: meta.apiVersion || "v21.0",
    capi: { pixelId: meta.capi?.pixelId ?? "", accessToken: meta.capi?.accessToken ?? "", testEventCode: meta.capi?.testEventCode ?? "" },
    marketing: { adAccountId: meta.marketing?.adAccountId ?? "", accessToken: meta.marketing?.accessToken ?? "" },
    whatsapp: { phoneNumberId: meta.whatsapp?.phoneNumberId ?? "", businessAccountId: meta.whatsapp?.businessAccountId ?? "", accessToken: meta.whatsapp?.accessToken ?? "" },
    messenger: { pageId: meta.messenger?.pageId ?? "", pageAccessToken: meta.messenger?.pageAccessToken ?? "", appSecret: meta.messenger?.appSecret ?? "", verifyToken: meta.messenger?.verifyToken ?? "" },
    instagramMessaging: { businessAccountId: meta.instagramMessaging?.businessAccountId ?? "", accessToken: meta.instagramMessaging?.accessToken ?? "" },
    pagesGraph: { pageId: meta.pagesGraph?.pageId ?? "", pageAccessToken: meta.pagesGraph?.pageAccessToken ?? "" },
    instagramGraph: { businessAccountId: meta.instagramGraph?.businessAccountId ?? "", accessToken: meta.instagramGraph?.accessToken ?? "" },
    threads: { userId: meta.threads?.userId ?? "", accessToken: meta.threads?.accessToken ?? "" },
    login: { appId: meta.login?.appId ?? "", appSecret: meta.login?.appSecret ?? "" },
    business: { businessManagerId: meta.business?.businessManagerId ?? "", systemUserAccessToken: meta.business?.systemUserAccessToken ?? "" },
    webhooks: { verifyToken: meta.webhooks?.verifyToken ?? "", appSecret: meta.webhooks?.appSecret ?? "" },
    leadAds: { accessToken: meta.leadAds?.accessToken ?? "" },
    adLibrary: { accessToken: meta.adLibrary?.accessToken ?? "" },
  };
}

/* ───────────────────── small building blocks ───────────────────── */

const Field = React.forwardRef<
  HTMLInputElement,
  { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>
>(function Field({ label, hint, ...props }, ref) {
  // Must forwardRef - react-hook-form's register() returns a `ref` alongside
  // onChange/onBlur/name, and it's load-bearing: without it attached to the
  // actual <input>, RHF can't read the field's live value at submit time and
  // silently falls back to the default for that field. A plain (non-ref)
  // wrapper here previously ate every field's typed value on save.
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-neutral-600">{label}</Label>
      <Input ref={ref} {...props} />
      {hint ? <p className="text-[11px] text-neutral-400">{hint}</p> : null}
    </div>
  );
});
Field.displayName = "Field";

/** Generic "Test connection" / action button - runs an async call and shows the result inline. */
function ActionButton({
  label, run, variant = "secondary",
}: { label: string; run: () => Promise<MetaActionResult>; variant?: "primary" | "secondary" }) {
  const [state, setState] = React.useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = React.useState("");

  async function handleClick() {
    setState("loading");
    setMessage("");
    try {
      const result = await run();
      setState(result.success ? "ok" : "err");
      setMessage(result.message);
    } catch (err) {
      setState("err");
      setMessage(err instanceof AdminError ? err.message : "Request failed");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" size="sm" variant={variant} onClick={handleClick} disabled={state === "loading"}>
        {state === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
        <span className={state === "loading" ? "ml-1" : ""}>{label}</span>
      </Button>
      {message ? (
        <p className={`flex items-start gap-1 text-[11px] ${state === "ok" ? "text-emerald-600" : "text-red-600"}`}>
          {state === "ok" ? <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> : <XCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />}
          {message}
        </p>
      ) : null}
    </div>
  );
}

function ProductBlock({ icon, title, purpose, children }: { icon: React.ReactNode; title: string; purpose: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-[13px] font-semibold text-gray-800">{title}</h3>
      </div>
      <p className="text-[11px] text-neutral-500">{purpose}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

/* ───────────────────── main component ───────────────────── */

export function MetaPlatformSection() {
  const toast = useUIStore((s) => s.toast);
  const { data: settings } = useAdminSiteSettings();
  const update = useUpdateAdminSiteSettings();

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  React.useEffect(() => {
    if (!settings) return;
    reset(fromSettings(settings.meta));
  }, [settings, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ meta: values });
      toast({ title: "Meta Platform settings saved", tone: "success" });
      reset(values);
    } catch (err) {
      toast({ title: err instanceof AdminError ? err.message : "Could not save", tone: "error" });
    }
  });

  const submitting = update.isPending;

  // Ad-hoc inputs for actions that need a value the saved form doesn't carry
  // (who to message, what to post) - kept local, not part of the saved form.
  const [testPhone, setTestPhone] = React.useState("");
  const [postMessage, setPostMessage] = React.useState("");
  const [igImageUrl, setIgImageUrl] = React.useState("");
  const [igCaption, setIgCaption] = React.useState("");
  const [threadsText, setThreadsText] = React.useState("");
  const [dmPlatform, setDmPlatform] = React.useState<"messenger" | "instagram">("messenger");
  const [dmRecipient, setDmRecipient] = React.useState("");
  const [dmText, setDmText] = React.useState("");
  const [adLibraryQuery, setAdLibraryQuery] = React.useState("");

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-[16px]">
      <div className="flex flex-col gap-3 rounded-[8px] border border-amber-200 bg-amber-50 px-[16px] py-[12px] text-[13px] text-amber-900 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <span>
            <strong>Save first, then test.</strong> Every Test/Send/Publish button below checks
            the credentials currently <em>saved</em> to the database - not what you&apos;ve just
            typed. This form has one Save that covers every product below.
          </span>
        </p>
        <Button type="submit" size="sm" disabled={!isDirty || submitting} className="shrink-0">
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          <span className={submitting ? "ml-1" : ""}>{isDirty ? "Save changes now" : "All changes saved"}</span>
        </Button>
      </div>

      <IntegrationCard
        logo={<Facebook className="h-5 w-5 text-[#1877F2]" aria-hidden />}
        title="Meta Platform"
        description="Facebook, Instagram, Threads, and WhatsApp - every API in one place. Save your credentials, then use each Test button below to confirm the connection live."
        docsUrl="https://developers.facebook.com/apps"
        active={Boolean(settings?.meta?.appId)}
      >
        {/* Shared App credentials */}
        <ProductBlock icon={<ShieldCheck className="h-4 w-4 text-neutral-500" aria-hidden />} title="Shared App Credentials" purpose="One Meta App's ID/Secret and a long-lived System User token drive most products below - Login, Business Manager, and any product that doesn't have its own dedicated token.">
          <Field label="App ID" {...register("appId")} name="appId" />
          <Field label="App Secret" type="password" {...register("appSecret")} name="appSecret" />
          <Field label="System User Access Token" type="password" {...register("systemUserAccessToken")} name="systemUserAccessToken" hint="Business Settings → System Users → Generate Token" />
          <Field label="Graph API Version" {...register("apiVersion")} name="apiVersion" placeholder="v21.0" />
        </ProductBlock>
      </IntegrationCard>

      {/* ── 1. Advertising & Conversion Tracking ── */}
      <IntegrationCard logo={<Megaphone className="h-5 w-5 text-[#1877F2]" aria-hidden />} title="1. Advertising & Conversion Tracking" description="Server-side conversion events and programmatic ad campaign management.">
        <ProductBlock icon={<Radio className="h-4 w-4 text-neutral-500" aria-hidden />} title="Conversions API (CAPI)" purpose="Sends server-side conversion events (purchases, leads, sign-ups) directly to Meta - bypasses ad blockers and browser tracking limits to keep ad targeting and attribution accurate.">
          <Field label="Pixel ID" {...register("capi.pixelId")} name="capi.pixelId" />
          <Field label="Conversions API Access Token" type="password" {...register("capi.accessToken")} name="capi.accessToken" />
          <Field label="Test Event Code (optional)" {...register("capi.testEventCode")} name="capi.testEventCode" hint="Events Manager → Test Events" />
          <div className="flex items-end"><ActionButton label="Send test event" run={() => adminApi.testMetaCapi()} /></div>
        </ProductBlock>
        <ProductBlock icon={<Users className="h-4 w-4 text-neutral-500" aria-hidden />} title="Marketing API" purpose="Programmatic management of ad campaigns, ad sets, creatives, budgets, custom audiences, and ad reporting.">
          <Field label="Ad Account ID" {...register("marketing.adAccountId")} name="marketing.adAccountId" placeholder="act_123456789 (or just the number)" />
          <Field label="Access Token (optional)" type="password" {...register("marketing.accessToken")} name="marketing.accessToken" hint="Falls back to the System User token above" />
          <div className="col-span-full flex flex-wrap items-end gap-3">
            <ActionButton label="List ad accounts" run={() => adminApi.listMetaAdAccounts()} />
            <ActionButton label="List campaigns" run={() => adminApi.listMetaCampaigns()} />
            <ActionButton label="Create test campaign (paused)" run={() => adminApi.createMetaTestCampaign()} />
          </div>
        </ProductBlock>
      </IntegrationCard>

      {/* ── 2. Messaging & Conversational AI ── */}
      <IntegrationCard logo={<MessageCircle className="h-5 w-5 text-[#25D366]" aria-hidden />} title="2. Messaging & Conversational AI" description="WhatsApp, Messenger, and Instagram DMs - sending, receiving, and AI chatbot automation.">
        <ProductBlock icon={<MessageCircle className="h-4 w-4 text-[#25D366]" aria-hidden />} title="WhatsApp Business Cloud API" purpose="Send/receive WhatsApp messages, dispatch utility alerts/OTPs, handle support, and power AI chatbots. Once saved, select 'WhatsApp Cloud API' as the provider in the WhatsApp Notifications card above to use it for order updates.">
          <Field label="Phone Number ID" {...register("whatsapp.phoneNumberId")} name="whatsapp.phoneNumberId" />
          <Field label="Business Account ID (WABA)" {...register("whatsapp.businessAccountId")} name="whatsapp.businessAccountId" />
          <Field label="Access Token" type="password" {...register("whatsapp.accessToken")} name="whatsapp.accessToken" hint="Falls back to the System User token above" />
          <div className="col-span-full flex flex-wrap items-end gap-3">
            <ActionButton label="Test connection" run={() => adminApi.testMetaWhatsAppCloud()} />
            <div className="flex items-end gap-2">
              <Field label="Send test to (E.164, e.g. 8801XXXXXXXXX)" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} name="testPhone" />
              <ActionButton label="Send test message" run={() => adminApi.sendMetaWhatsAppCloudTest(testPhone)} />
            </div>
          </div>
        </ProductBlock>
        <ProductBlock icon={<Send className="h-4 w-4 text-[#0084FF]" aria-hidden />} title="Messenger Platform API" purpose="Connects Facebook Page inbox messages to the storefront's AI chatbot (already live - see Chat Logs). These credentials also drive the Callback URL webhook.">
          <Field label="Page ID" {...register("messenger.pageId")} name="messenger.pageId" />
          <Field label="Page Access Token" type="password" {...register("messenger.pageAccessToken")} name="messenger.pageAccessToken" />
          <Field label="App Secret (webhook signature)" type="password" {...register("messenger.appSecret")} name="messenger.appSecret" hint="Falls back to the shared App Secret above" />
          <Field label="Webhook Verify Token" {...register("messenger.verifyToken")} name="messenger.verifyToken" />
          <div className="col-span-full"><ActionButton label="Test connection" run={() => adminApi.testMetaMessenger()} /></div>
        </ProductBlock>
        <ProductBlock icon={<Instagram className="h-4 w-4 text-[#E4405F]" aria-hidden />} title="Instagram Messaging API" purpose="Manages Instagram Direct Messages, automated quick replies, and customer interactions - shares the same webhook as Messenger, routed by platform.">
          <Field label="Instagram Business Account ID" {...register("instagramMessaging.businessAccountId")} name="instagramMessaging.businessAccountId" />
          <Field label="Access Token (optional)" type="password" {...register("instagramMessaging.accessToken")} name="instagramMessaging.accessToken" hint="Falls back to the Messenger Page token above" />
          <div className="col-span-full"><ActionButton label="Test connection" run={() => adminApi.testMetaInstagramMessaging()} /></div>
        </ProductBlock>
        <ProductBlock icon={<Send className="h-4 w-4 text-neutral-500" aria-hidden />} title="Send a test DM (Messenger or Instagram)" purpose="Uses the Send API to message a specific PSID/IGSID that has already messaged your Page - useful for confirming the whole pipeline end-to-end.">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-neutral-600">Platform</Label>
            <select value={dmPlatform} onChange={(e) => setDmPlatform(e.target.value as "messenger" | "instagram")} className="flex h-5 w-full rounded-lg border border-neutral-300 bg-paper px-2 text-sm text-ink">
              <option value="messenger">Messenger</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
          <Field label="Recipient PSID/IGSID" value={dmRecipient} onChange={(e) => setDmRecipient(e.target.value)} name="dmRecipient" />
          <Field label="Message text" value={dmText} onChange={(e) => setDmText(e.target.value)} name="dmText" />
          <div className="flex items-end"><ActionButton label="Send DM" run={() => adminApi.sendMetaPlatformMessageTest(dmPlatform, dmRecipient, dmText)} /></div>
        </ProductBlock>
      </IntegrationCard>

      {/* ── 3. Social Management & Content Publishing ── */}
      <IntegrationCard logo={<Rss className="h-5 w-5 text-[#1877F2]" aria-hidden />} title="3. Social Management & Content Publishing" description="Read/write Page feed data and publish to Instagram and Threads directly from the admin.">
        <ProductBlock icon={<Facebook className="h-4 w-4 text-[#1877F2]" aria-hidden />} title="Facebook Graph API (Pages & Feed)" purpose="Read/write data for Facebook Pages, schedule/publish posts, manage comments, fetch post analytics.">
          <Field label="Page ID (optional)" {...register("pagesGraph.pageId")} name="pagesGraph.pageId" hint="Falls back to the Messenger Page ID above" />
          <Field label="Page Access Token (optional)" type="password" {...register("pagesGraph.pageAccessToken")} name="pagesGraph.pageAccessToken" hint="Falls back to the Messenger Page token above" />
          <div className="col-span-full flex flex-wrap items-end gap-3">
            <ActionButton label="Get Page info" run={() => adminApi.getMetaPageInfo()} />
            <div className="flex items-end gap-2">
              <Field label="Post message" value={postMessage} onChange={(e) => setPostMessage(e.target.value)} name="postMessage" />
              <ActionButton label="Publish post" run={() => adminApi.publishMetaFacebookPost(postMessage)} />
            </div>
          </div>
        </ProductBlock>
        <ProductBlock icon={<Instagram className="h-4 w-4 text-[#E4405F]" aria-hidden />} title="Instagram Graph API" purpose="Publish photos/Reels to Instagram Business/Creator accounts, read media insights, fetch comments.">
          <Field label="Instagram Business Account ID" {...register("instagramGraph.businessAccountId")} name="instagramGraph.businessAccountId" />
          <Field label="Access Token (optional)" type="password" {...register("instagramGraph.accessToken")} name="instagramGraph.accessToken" hint="Falls back to the System User token above" />
          <div className="col-span-full flex flex-wrap items-end gap-3">
            <ActionButton label="Get insights" run={() => adminApi.getMetaInstagramInsights()} />
            <div className="flex items-end gap-2">
              <Field label="Image URL (public HTTPS)" value={igImageUrl} onChange={(e) => setIgImageUrl(e.target.value)} name="igImageUrl" />
              <Field label="Caption" value={igCaption} onChange={(e) => setIgCaption(e.target.value)} name="igCaption" />
              <ActionButton label="Publish post" run={() => adminApi.publishMetaInstagramPost(igImageUrl, igCaption)} />
            </div>
          </div>
        </ProductBlock>
        <ProductBlock icon={<AtSign className="h-4 w-4 text-neutral-800" aria-hidden />} title="Threads API" purpose="Programmatically publish text/image/video to Threads, fetch replies, and manage account analytics.">
          <Field label="Threads User ID" {...register("threads.userId")} name="threads.userId" />
          <Field label="Threads Access Token" type="password" {...register("threads.accessToken")} name="threads.accessToken" hint="Threads has its own OAuth - not the same token type as the Graph token above" />
          <div className="col-span-full flex flex-wrap items-end gap-3">
            <ActionButton label="Test connection" run={() => adminApi.testMetaThreads()} />
            <div className="flex items-end gap-2">
              <Field label="Post text" value={threadsText} onChange={(e) => setThreadsText(e.target.value)} name="threadsText" />
              <ActionButton label="Publish post" run={() => adminApi.publishMetaThreadsPost(threadsText)} />
            </div>
          </div>
        </ProductBlock>
      </IntegrationCard>

      {/* ── 4. Identity & Authentication ── */}
      <IntegrationCard logo={<ShieldCheck className="h-5 w-5 text-[#1877F2]" aria-hidden />} title="4. Identity & Authentication" description="Facebook Login for the storefront, and Business Manager asset/permission management.">
        <ProductBlock icon={<Users className="h-4 w-4 text-neutral-500" aria-hidden />} title="Facebook Login / Meta Connect" purpose="Lets shoppers sign up or log in with Facebook via OAuth 2.0. The actual login flow runs through the frontend's NextAuth config - these fields keep every Meta credential visible in one place and let you verify the App ID/Secret pair is valid.">
          <Field label="Login App ID" {...register("login.appId")} name="login.appId" hint="Also set FACEBOOK_CLIENT_ID in the frontend's env" />
          <Field label="Login App Secret" type="password" {...register("login.appSecret")} name="login.appSecret" hint="Also set FACEBOOK_CLIENT_SECRET in the frontend's env" />
          <div className="col-span-full"><ActionButton label="Validate App ID/Secret" run={() => adminApi.testMetaFacebookLogin()} /></div>
        </ProductBlock>
        <ProductBlock icon={<Building2 className="h-4 w-4 text-neutral-500" aria-hidden />} title="Business Platform API (Business Manager)" purpose="Programmatically manage permissions, access tokens, ad accounts, and assets within your Meta Business Portfolio.">
          <Field label="Business Manager ID" {...register("business.businessManagerId")} name="business.businessManagerId" />
          <Field label="System User Access Token (optional)" type="password" {...register("business.systemUserAccessToken")} name="business.systemUserAccessToken" hint="Falls back to the System User token above" />
          <div className="col-span-full"><ActionButton label="List owned Pages" run={() => adminApi.listMetaBusinessAssets()} /></div>
        </ProductBlock>
      </IntegrationCard>

      {/* ── 5. Real-Time Data Ingestion & Transparency ── */}
      <IntegrationCard logo={<Webhook className="h-5 w-5 text-[#1877F2]" aria-hidden />} title="5. Real-Time Data Ingestion & Transparency" description="Inbound webhooks, Lead Ads capture, and Ad Library research.">
        <ProductBlock icon={<Webhook className="h-4 w-4 text-neutral-500" aria-hidden />} title="Meta Webhooks" purpose="Real-time push notifications to this server whenever events occur (new message, lead form submission, comment). One Callback URL handles Messenger, Instagram, and Lead Ads.">
          <Field label="Webhook Verify Token (optional)" {...register("webhooks.verifyToken")} name="webhooks.verifyToken" hint="Falls back to the Messenger verify token above" />
          <Field label="App Secret (optional)" type="password" {...register("webhooks.appSecret")} name="webhooks.appSecret" hint="Falls back to the shared App Secret above" />
          <div className="col-span-full"><ActionButton label="Check webhook config" run={() => adminApi.testMetaWebhooks()} /></div>
        </ProductBlock>
        <ProductBlock icon={<UserPlus className="h-4 w-4 text-neutral-500" aria-hidden />} title="Lead Ads API" purpose="Automatically fetches contact details submitted via Meta's native Lead Gen ad forms into your database the instant someone submits one. Captured leads appear in Admin → Chat Logs' sibling Meta Leads inbox.">
          <Field label="Access Token (optional)" type="password" {...register("leadAds.accessToken")} name="leadAds.accessToken" hint="Falls back to the System User token above" />
          <div className="col-span-full"><ActionButton label="Test connection" run={() => adminApi.testMetaLeadAds()} /></div>
        </ProductBlock>
        <ProductBlock icon={<Search className="h-4 w-4 text-neutral-500" aria-hidden />} title="Meta Ad Library API" purpose="Access to active and historical ad data running across Meta platforms, for compliance, transparency, and competitor research.">
          <Field label="Access Token (optional)" type="password" {...register("adLibrary.accessToken")} name="adLibrary.accessToken" hint="Falls back to the System User token above" />
          <div className="col-span-full flex items-end gap-2">
            <Field label="Search terms" value={adLibraryQuery} onChange={(e) => setAdLibraryQuery(e.target.value)} name="adLibraryQuery" />
            <ActionButton label="Search" run={() => adminApi.searchMetaAdLibrary(adLibraryQuery)} />
          </div>
        </ProductBlock>
      </IntegrationCard>

      <FormStickyBar mode="edit" isDirty={isDirty} isSubmitting={submitting} />
    </form>
  );
}
