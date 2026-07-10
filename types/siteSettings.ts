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

export type WhatsAppProvider = "twilio" | "wati" | "ultramsg" | "webhook" | "";

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

export interface SiteSettings {
  _id: string;
  key: string;
  companyName: string;
  companyTitle: string;
  companyLogo: string;
  shortDescription: string;
  delivery: SiteSettingsDelivery;
  announcementBar?: SiteSettingsAnnouncementBar;
  contact: SiteSettingsContact;
  termsAndConditions: string;
  returnPolicy: string;
  shippingDetails: string;
  faqs: SiteSettingsFaq[];
  integrations?: SiteSettingsIntegrations;
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
export interface UpdateSiteSettingsBody {
  companyName?: string;
  companyTitle?: string;
  companyLogo?: string;
  shortDescription?: string;
  delivery?: Partial<SiteSettingsDelivery>;
  announcementBar?: Partial<SiteSettingsAnnouncementBar>;
  contact?: Partial<SiteSettingsContact>;
  termsAndConditions?: string;
  returnPolicy?: string;
  shippingDetails?: string;
  faqs?: Array<{ question: string; answer: string }>;
  integrations?: Partial<SiteSettingsIntegrations>;
  whatsappNotifications?: Partial<SiteSettingsWhatsApp>;
  enabledPaymentMethods?: string[];
}
