/**
 * Frontend mirrors of the admin analytics report payloads. These must stay in
 * sync with src/controllers/analytics-report.controller.ts on the backend.
 * All monetary values are integers in the store currency (BDT minor units are
 * not used - amounts are whole Taka). Rates are percentages with 2dp.
 */

export interface ReportRange {
  from: string;
  to: string;
  days: number;
}

/** Shared query knobs for every report endpoint. */
export interface ReportParams {
  days?: number;
  from?: string;
  to?: string;
}

/* ── Overview ── */

export interface FunnelStep {
  step: string;
  label: string;
  sessions: number;
  rateFromTop: number;
  rateFromPrev: number;
}

export interface OverviewTotals {
  sessions: number;
  visitors: number;
  pageviews: number;
  events: number;
  purchases: number;
  revenue: number;
  conversionRate: number;
}

export interface OverviewPoint {
  date: string;
  sessions: number;
  pageviews: number;
  purchases: number;
  revenue: number;
}

export interface AnalyticsOverview {
  range: ReportRange;
  totals: OverviewTotals;
  funnel: FunnelStep[];
  timeseries: OverviewPoint[];
  topPages: Array<{ path: string; views: number }>;
  deviceSplit: Array<{ device: string; sessions: number }>;
}

/* ── Attribution ── */

export interface ChannelRow {
  channel: string;
  sessions: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
}

export interface SourceRow {
  source: string;
  medium: string;
  sessions: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
}

export interface CampaignRow {
  campaign: string;
  sessions: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
}

export interface AnalyticsAttribution {
  range: ReportRange;
  channels: ChannelRow[];
  sources: SourceRow[];
  campaigns: CampaignRow[];
}

/* ── Financial ── */

export interface FinancialSummary {
  grossRevenue: number;
  netRevenue: number;
  placedOrders: number;
  deliveredOrders: number;
  unitsSold: number;
  aov: number;
  discountsGiven: number;
  taxCollected: number;
  shippingCollected: number;
  refundsTotal: number;
  refundedOrders: number;
  refundRate: number;
}

export interface FinancialPoint {
  date: string;
  revenue: number;
  orders: number;
  discount: number;
}

export interface AnalyticsFinancial {
  range: ReportRange;
  summary: FinancialSummary;
  timeseries: FinancialPoint[];
  byPaymentMethod: Array<{ method: string; orders: number; revenue: number }>;
  byStatus: Array<{ status: string; orders: number; revenue: number }>;
}

/* ── Marketing ── */

export interface CouponPerf {
  code: string;
  orders: number;
  revenue: number;
  discount: number;
  roi: number;
}

export interface OfferPerf {
  slug: string;
  name: string;
  units: number;
  revenue: number;
  savings: number;
}

export interface TopCampaign {
  campaign: string;
  source: string;
  sessions: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
}

export interface AnalyticsMarketing {
  range: ReportRange;
  summary: {
    couponOrders: number;
    couponRevenue: number;
    couponDiscount: number;
    offerUnits: number;
    offerRevenue: number;
    offerSavings: number;
  };
  coupons: CouponPerf[];
  offers: OfferPerf[];
  topCampaigns: TopCampaign[];
}

/* ── Conversion ── */

export interface ConversionFunnelStep extends FunnelStep {
  dropoff: number;
}

export interface ConversionSplit {
  sessions: number;
  conversions: number;
  conversionRate: number;
}

export interface AnalyticsConversion {
  range: ReportRange;
  funnel: ConversionFunnelStep[];
  byDevice: Array<ConversionSplit & { device: string }>;
  byChannel: Array<ConversionSplit & { channel: string }>;
  cartAbandonment: {
    cartsCreated: number;
    checkoutsStarted: number;
    purchases: number;
    abandonmentRate: number;
  };
  timeseries: Array<{ date: string; sessions: number; conversions: number; conversionRate: number }>;
}
