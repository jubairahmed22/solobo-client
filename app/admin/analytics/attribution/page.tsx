"use client";

import * as React from "react";
import { useAnalyticsAttribution } from "@/hooks/useAnalytics";
import {
  BarList,
  MiniTable,
  Panel,
  ReportHeader,
  ReportState,
  formatMoney,
  formatNum,
  formatPct,
  type Column,
} from "../_components";
import type { CampaignRow, SourceRow } from "@/types/analytics";

/**
 * Analytics → Attribution. Where sessions, conversions and revenue originate -
 * by marketing channel, by source/medium pair, and by campaign. First-touch
 * attribution (the snapshot captured on the visitor's first ever visit).
 */
export default function AttributionPage() {
  const [days, setDays] = React.useState(30);
  const { data, isLoading, isError } = useAnalyticsAttribution({ days });

  const sourceCols: Column<SourceRow>[] = [
    { header: "Source", cell: (r) => r.source },
    { header: "Medium", cell: (r) => <span className="text-neutral-600">{r.medium}</span> },
    { header: "Sessions", align: "right", cell: (r) => formatNum(r.sessions) },
    { header: "Conv.", align: "right", cell: (r) => formatNum(r.conversions) },
    { header: "CVR", align: "right", cell: (r) => formatPct(r.conversionRate) },
    { header: "Revenue", align: "right", cell: (r) => formatMoney(r.revenue) },
  ];

  const campaignCols: Column<CampaignRow>[] = [
    { header: "Campaign", cell: (r) => r.campaign },
    { header: "Sessions", align: "right", cell: (r) => formatNum(r.sessions) },
    { header: "Conv.", align: "right", cell: (r) => formatNum(r.conversions) },
    { header: "CVR", align: "right", cell: (r) => formatPct(r.conversionRate) },
    { header: "Revenue", align: "right", cell: (r) => formatMoney(r.revenue) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        title="Attribution"
        description="Channels, sources and campaigns driving sessions and revenue (first-touch)."
        days={days}
        onDays={setDays}
      />

      <ReportState
        isLoading={isLoading}
        isError={isError}
        isEmpty={!!data && data.channels.length === 0}
        emptyHint="Attribution builds up as visitors arrive from search, social, and campaigns."
      >
        {data ? (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Sessions by channel">
                <BarList
                  rows={data.channels.map((c) => ({
                    label: c.channel,
                    sub: `${formatPct(c.conversionRate)} CVR`,
                    value: c.sessions,
                    display: formatNum(c.sessions),
                  }))}
                />
              </Panel>
              <Panel title="Revenue by channel">
                <BarList
                  rows={data.channels
                    .filter((c) => c.revenue > 0)
                    .map((c) => ({
                      label: c.channel,
                      value: c.revenue,
                      display: formatMoney(c.revenue),
                    }))}
                  empty="No attributed revenue yet"
                />
              </Panel>
            </div>

            <Panel title="Top sources / mediums">
              <MiniTable
                columns={sourceCols}
                rows={data.sources}
                rowKey={(r, i) => `${r.source}-${r.medium}-${i}`}
                empty="No source data yet"
              />
            </Panel>

            <Panel title="Top campaigns">
              <MiniTable
                columns={campaignCols}
                rows={data.campaigns}
                rowKey={(r, i) => `${r.campaign}-${i}`}
                empty="No tagged campaigns yet - add utm_campaign to your marketing links."
              />
            </Panel>
          </>
        ) : null}
      </ReportState>
    </div>
  );
}
