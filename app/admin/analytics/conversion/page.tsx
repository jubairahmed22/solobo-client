"use client";

import * as React from "react";
import { useAnalyticsConversion } from "@/hooks/useAnalytics";
import {
  FunnelChart,
  MiniTable,
  Panel,
  ReportHeader,
  ReportState,
  StatCard,
  StatGrid,
  TrendChart,
  formatNum,
  formatPct,
  type Column,
} from "../_components";
import type { ConversionSplit } from "@/types/analytics";

type DeviceRow = ConversionSplit & { device: string };
type ChannelRow = ConversionSplit & { channel: string };

/**
 * Analytics → Conversion tracking. The deep funnel: step-by-step dropoff,
 * cart-abandonment, conversion split by device and channel, and the daily
 * conversion-rate trend. Built from the behavioural event stream.
 */
export default function ConversionPage() {
  const [days, setDays] = React.useState(30);
  const { data, isLoading, isError } = useAnalyticsConversion({ days });

  const cvrTrend = data?.timeseries.map((p) => ({ date: p.date, value: p.conversionRate })) ?? [];

  const deviceCols: Column<DeviceRow>[] = [
    { header: "Device", cell: (r) => <span className="capitalize">{r.device}</span> },
    { header: "Sessions", align: "right", cell: (r) => formatNum(r.sessions) },
    { header: "Conversions", align: "right", cell: (r) => formatNum(r.conversions) },
    { header: "CVR", align: "right", cell: (r) => formatPct(r.conversionRate) },
  ];

  const channelCols: Column<ChannelRow>[] = [
    { header: "Channel", cell: (r) => <span className="capitalize">{r.channel}</span> },
    { header: "Sessions", align: "right", cell: (r) => formatNum(r.sessions) },
    { header: "Conversions", align: "right", cell: (r) => formatNum(r.conversions) },
    { header: "CVR", align: "right", cell: (r) => formatPct(r.conversionRate) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        title="Conversion tracking"
        description="Funnel dropoff, cart abandonment, and conversion by device and channel."
        days={days}
        onDays={setDays}
      />

      <ReportState
        isLoading={isLoading}
        isError={isError}
        isEmpty={!!data && data.funnel[0]?.sessions === 0}
        emptyHint="The funnel fills in as shoppers view products and check out."
      >
        {data ? (
          <>
            <StatGrid>
              <StatCard
                label="Carts created"
                value={formatNum(data.cartAbandonment.cartsCreated)}
              />
              <StatCard
                label="Checkouts started"
                value={formatNum(data.cartAbandonment.checkoutsStarted)}
              />
              <StatCard label="Purchases" value={formatNum(data.cartAbandonment.purchases)} />
              <StatCard
                label="Cart abandonment"
                value={formatPct(data.cartAbandonment.abandonmentRate)}
                tone="warn"
              />
            </StatGrid>

            <Panel title="Funnel & dropoff">
              <FunnelChart steps={data.funnel} />
            </Panel>

            <Panel title="Conversion rate trend">
              <TrendChart points={cvrTrend} label="Daily CVR (%)" />
            </Panel>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="By device">
                <MiniTable
                  columns={deviceCols}
                  rows={data.byDevice}
                  rowKey={(r) => r.device}
                  empty="No device data yet"
                />
              </Panel>
              <Panel title="By channel">
                <MiniTable
                  columns={channelCols}
                  rows={data.byChannel}
                  rowKey={(r) => r.channel}
                  empty="No channel data yet"
                />
              </Panel>
            </div>
          </>
        ) : null}
      </ReportState>
    </div>
  );
}
