/**
 * Storefront site settings - singleton company profile, delivery charges,
 * contact card, and the long-form policy pages (terms, returns, shipping).
 *
 * Mirrors backend/src/models/SiteSettings.ts. The public read endpoint and
 * the admin read endpoint return the same shape; the only difference is who
 * may call the PUT.
 */
export interface SiteSettingsFaq {
  _id?: string;
  question: string;
  answer: string;
}

export interface SiteSettingsContact {
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
}

export interface SiteSettingsDelivery {
  insideDhaka: number;
  outsideDhaka: number;
  /** Order subtotal at or above which delivery is free (0 disables). */
  freeShippingThreshold: number;
}

export interface SiteSettingsAnnouncementBar {
  /** Editable ticker items. Free-delivery text is injected automatically from the threshold. */
  items: string[];
}

export interface SiteSettingsIntegrations {
  gtmId?: string;
  ga4Id?: string;
  googleAdsId?: string;
  googleAdsLabel?: string;
  metaPixelId?: string;
  tiktokPixelId?: string;
  snapchatPixelId?: string;
  pinterestTagId?: string;
  twitterPixelId?: string;
  hotjarSiteId?: string;
}

export type WhatsAppProvider = "twilio" | "wati" | "ultramsg" | "webhook" | "cloudapi" | "";

export interface SiteSettingsWhatsApp {
  provider: WhatsAppProvider;
  enabled: boolean;
  /* Twilio */
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFrom: string;
  /* WATI */
  watiApiUrl: string;
  watiApiToken: string;
  /* UltraMsg */
  ultraMsgInstanceId: string;
  ultraMsgToken: string;
  /* Generic webhook */
  webhookUrl: string;
  webhookToken: string;
  /* Triggers */
  notifyOnConfirmed: boolean;
  notifyOnShipped: boolean;
  notifyOnDelivered: boolean;
}

/**
 * Meta (Facebook/Instagram/Threads/WhatsApp) Platform credentials - grouped
 * exactly like Meta's own product taxonomy. Mirrors backend/src/models/
 * SiteSettings.ts's `metaSchema`. Every sub-object is optional/partial so
 * the admin form can save one product's credentials without touching any
 * other's.
 */
export interface SiteSettingsMeta {
  appId: string;
  appSecret: string;
  systemUserAccessToken: string;
  apiVersion: string;

  capi: { pixelId: string; accessToken: string; testEventCode: string };
  marketing: { adAccountId: string; accessToken: string };

  whatsapp: { phoneNumberId: string; businessAccountId: string; accessToken: string };
  messenger: { pageId: string; pageAccessToken: string; appSecret: string; verifyToken: string };
  instagramMessaging: { businessAccountId: string; accessToken: string };

  pagesGraph: { pageId: string; pageAccessToken: string };
  instagramGraph: { businessAccountId: string; accessToken: string };
  threads: { userId: string; accessToken: string };

  login: { appId: string; appSecret: string };
  business: { businessManagerId: string; systemUserAccessToken: string };

  webhooks: { verifyToken: string; appSecret: string };
  leadAds: { accessToken: string };
  adLibrary: { accessToken: string };
}

export interface MetaActionResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

/** One Lead Ads submission, ingested via the shared Meta webhook's `leadgen` field. */
export interface MetaLead {
  _id: string;
  leadgenId: string;
  formId?: string;
  adId?: string;
  pageId?: string;
  fields: Array<{ name: string; values: string[] }>;
  parsed: Record<string, string>;
  createdTime?: string;
  status: "new" | "contacted" | "converted" | "discarded";
  createdAt: string;
  updatedAt: string;
}

export interface SiteSettings {
  _id: string;
  key: string;
  companyName: string;
  companyTitle: string;
  companyLogo: string;
  /** Separate logo shown on printed invoices only - falls back to companyLogo when unset. */
  invoiceLogo: string;
  shortDescription: string;
  delivery: SiteSettingsDelivery;
  announcementBar?: SiteSettingsAnnouncementBar;
  contact: SiteSettingsContact;
  termsAndConditions: string;
  returnPolicy: string;
  shippingDetails: string;
  privacyPolicy: string;
  faqs: SiteSettingsFaq[];
  integrations?: SiteSettingsIntegrations;
  meta?: SiteSettingsMeta;
  whatsappNotifications?: SiteSettingsWhatsApp;
  enabledPaymentMethods?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * PUT body - every field is optional so the admin form can submit a partial
 * patch (just the delivery charge, for example) without re-sending every
 * other field. Nested objects are merged sub-document-deep on the server.
 */
type DeepPartialMeta = {
  [K in keyof SiteSettingsMeta]?: SiteSettingsMeta[K] extends object
    ? Partial<SiteSettingsMeta[K]>
    : SiteSettingsMeta[K];
};

export interface UpdateSiteSettingsBody {
  companyName?: string;
  companyTitle?: string;
  companyLogo?: string;
  invoiceLogo?: string;
  shortDescription?: string;
  delivery?: Partial<SiteSettingsDelivery>;
  announcementBar?: Partial<SiteSettingsAnnouncementBar>;
  contact?: Partial<SiteSettingsContact>;
  termsAndConditions?: string;
  returnPolicy?: string;
  shippingDetails?: string;
  privacyPolicy?: string;
  faqs?: Array<{ question: string; answer: string }>;
  integrations?: Partial<SiteSettingsIntegrations>;
  meta?: DeepPartialMeta;
  whatsappNotifications?: Partial<SiteSettingsWhatsApp>;
  enabledPaymentMethods?: string[];
}
