"use client";

import * as React from "react";
import { useAnalyticsOverview } from "@/hooks/useAnalytics";
import {
  BarList,
  FunnelChart,
  Panel,
  ReportHeader,
  ReportState,
  StatCard,
  StatGrid,
  TrendChart,
  formatMoney,
  formatNum,
  formatPct,
} from "./_components";

/**
 * Analytics → Overview. The landing report: traffic KPIs, the headline
 * conversion funnel, daily trends, and top-content / device breakdowns. One
 * fetch (`/admin/analytics/overview`) drives the whole page.
 */
export default function AnalyticsOverviewPage() {
  const [days, setDays] = React.useState(30);
  const { data, isLoading, isError } = useAnalyticsOverview({ days });

  const sessionsTrend =
    data?.timeseries.map((p) => ({ date: p.date, value: p.sessions })) ?? [];
  const revenueTrend =
    data?.timeseries.map((p) => ({ date: p.date, value: p.revenue })) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        title="Analytics overview"
        description="Traffic, engagement, and the top-line conversion funnel."
        days={days}
        onDays={setDays}
      />

      <ReportState
        isLoading={isLoading}
        isError={isError}
        isEmpty={!!data && data.totals.events === 0}
        emptyHint="Events will appear here as visitors browse the storefront."
      >
        {data ? (
          <>
            <StatGrid>
              <StatCard label="Sessions" value={formatNum(data.totals.sessions)} />
              <StatCard label="Unique visitors" value={formatNum(data.totals.visitors)} />
              <StatCard label="Page views" value={formatNum(data.totals.pageviews)} />
              <StatCard
                label="Conversion rate"
                value={formatPct(data.totals.conversionRate)}
                sub={`${formatNum(data.totals.purchases)} purchases`}
              />
            </StatGrid>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Sessions trend">
                <TrendChart points={sessionsTrend} />
              </Panel>
              <Panel title="Revenue trend">
                <TrendChart points={revenueTrend} />
                <p className="text-xs text-neutral-500">
                  Behavioural purchase value - see Financial for recognised revenue.
                </p>
              </Panel>
            </div>

            <Panel title="Conversion funnel">
              <FunnelChart steps={data.funnel} />
            </Panel>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Top pages">
                <BarList
                  rows={data.topPages.map((p) => ({
                    label: p.path,
                    value: p.views,
                    display: formatNum(p.views),
                  }))}
                  empty="No page views yet"
                />
              </Panel>
              <Panel title="Devices">
                <BarList
                  rows={data.deviceSplit.map((d) => ({
                    label: d.device,
                    value: d.sessions,
                    display: formatNum(d.sessions),
                  }))}
                  empty="No device data yet"
                />
              </Panel>
            </div>

            <Panel>
              <p className="text-xs text-neutral-400">
                Showing {formatMoney(data.totals.revenue)} behavioural revenue across{" "}
                {formatNum(data.totals.events)} events.
              </p>
            </Panel>
          </>
        ) : null}
      </ReportState>
    </div>
  );
}
