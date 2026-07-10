"use client";

import * as React from "react";
import { useAnalyticsMarketing } from "@/hooks/useAnalytics";
import {
  MiniTable,
  Panel,
  ReportHeader,
  ReportState,
  StatCard,
  StatGrid,
  formatMoney,
  formatNum,
  formatPct,
  type Column,
} from "../_components";
import type { CouponPerf, OfferPerf, TopCampaign } from "@/types/analytics";

/**
 * Analytics → Marketing intelligence. Promotion ROI: coupon performance and
 * auto-applied offer performance (from orders), plus the top campaigns by
 * behavioural conversion (from events). Answers "which promo actually paid?".
 */
export default function MarketingPage() {
  const [days, setDays] = React.useState(30);
  const { data, isLoading, isError } = useAnalyticsMarketing({ days });

  const couponCols: Column<CouponPerf>[] = [
    { header: "Code", cell: (r) => <span className="font-mono">{r.code}</span> },
    { header: "Orders", align: "right", cell: (r) => formatNum(r.orders) },
    { header: "Revenue", align: "right", cell: (r) => formatMoney(r.revenue) },
    { header: "Discount", align: "right", cell: (r) => formatMoney(r.discount) },
    {
      header: "ROI",
      align: "right",
      cell: (r) => <span title="Revenue generated per unit of discount">{r.roi}×</span>,
    },
  ];

  const offerCols: Column<OfferPerf>[] = [
    { header: "Offer", cell: (r) => r.name },
    { header: "Units", align: "right", cell: (r) => formatNum(r.units) },
    { header: "Revenue", align: "right", cell: (r) => formatMoney(r.revenue) },
    { header: "Saved buyers", align: "right", cell: (r) => formatMoney(r.savings) },
  ];

  const campaignCols: Column<TopCampaign>[] = [
    { header: "Campaign", cell: (r) => r.campaign },
    { header: "Source", cell: (r) => <span className="text-neutral-600">{r.source}</span> },
    { header: "Sessions", align: "right", cell: (r) => formatNum(r.sessions) },
    { header: "Conv.", align: "right", cell: (r) => formatNum(r.conversions) },
    { header: "CVR", align: "right", cell: (r) => formatPct(r.conversionRate) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        title="Marketing intelligence"
        description="Coupon and offer ROI, and the campaigns converting your traffic."
        days={days}
        onDays={setDays}
      />

      <ReportState
        isLoading={isLoading}
        isError={isError}
        isEmpty={
          !!data &&
          data.coupons.length === 0 &&
          data.offers.length === 0 &&
          data.topCampaigns.length === 0
        }
        emptyHint="Run a coupon, offer, or UTM-tagged campaign to populate this report."
      >
        {data ? (
          <>
            <StatGrid>
              <StatCard
                label="Coupon revenue"
                value={formatMoney(data.summary.couponRevenue)}
                sub={`${formatNum(data.summary.couponOrders)} orders`}
              />
              <StatCard
                label="Coupon discount"
                value={formatMoney(data.summary.couponDiscount)}
              />
              <StatCard
                label="Offer revenue"
                value={formatMoney(data.summary.offerRevenue)}
                sub={`${formatNum(data.summary.offerUnits)} units`}
              />
              <StatCard
                label="Offer savings"
                value={formatMoney(data.summary.offerSavings)}
                sub="Passed to buyers"
              />
            </StatGrid>

            <Panel title="Coupon performance">
              <MiniTable
                columns={couponCols}
                rows={data.coupons}
                rowKey={(r) => r.code}
                empty="No coupon redemptions in this window"
              />
            </Panel>

            <Panel title="Offer performance">
              <MiniTable
                columns={offerCols}
                rows={data.offers}
                rowKey={(r) => r.slug}
                empty="No auto-applied offers in this window"
              />
            </Panel>

            <Panel title="Top campaigns">
              <MiniTable
                columns={campaignCols}
                rows={data.topCampaigns}
                rowKey={(r, i) => `${r.campaign}-${r.source}-${i}`}
                empty="No tagged campaigns yet - add utm_campaign to your links"
              />
            </Panel>
          </>
        ) : null}
      </ReportState>
    </div>
  );
}
