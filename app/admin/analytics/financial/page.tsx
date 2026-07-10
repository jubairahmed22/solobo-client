"use client";

import * as React from "react";
import { SalesChartSvg } from "@/components/composed/SalesChartSvg";
import { useAnalyticsFinancial } from "@/hooks/useAnalytics";
import {
  BarList,
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
import type { AnalyticsFinancial } from "@/types/analytics";

type StatusRow = AnalyticsFinancial["byStatus"][number];

/**
 * Analytics → Financial intelligence. The money view, built from Orders (not
 * behavioural events): recognised revenue, net of refunds, AOV, discounts,
 * tax/shipping collected, plus the daily revenue trend and method/status
 * splits. Recognised revenue = delivered orders.
 */
export default function FinancialPage() {
  const [days, setDays] = React.useState(30);
  const { data, isLoading, isError } = useAnalyticsFinancial({ days });

  // Reuse the platform sales chart renderer - it wants {date,revenue,orderCount}.
  const chartSeries =
    data?.timeseries.map((p) => ({ date: p.date, revenue: p.revenue, orderCount: p.orders })) ?? [];

  const statusCols: Column<StatusRow>[] = [
    { header: "Status", cell: (r) => <span className="capitalize">{r.status}</span> },
    { header: "Orders", align: "right", cell: (r) => formatNum(r.orders) },
    { header: "Value", align: "right", cell: (r) => formatMoney(r.revenue) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader
        title="Financial intelligence"
        description="Recognised revenue, margins on volume, discounts and refunds - from orders."
        days={days}
        onDays={setDays}
      />

      <ReportState
        isLoading={isLoading}
        isError={isError}
        isEmpty={!!data && data.summary.placedOrders === 0}
        emptyHint="Financial metrics populate as orders are placed and delivered."
      >
        {data ? (
          <>
            <StatGrid>
              <StatCard
                label="Gross revenue"
                value={formatMoney(data.summary.grossRevenue)}
                sub="Delivered orders"
              />
              <StatCard
                label="Net revenue"
                value={formatMoney(data.summary.netRevenue)}
                sub={`After ${formatMoney(data.summary.refundsTotal)} refunds`}
              />
              <StatCard label="Avg. order value" value={formatMoney(data.summary.aov)} />
              <StatCard
                label="Units sold"
                value={formatNum(data.summary.unitsSold)}
                sub={`${formatNum(data.summary.deliveredOrders)} delivered`}
              />
              <StatCard
                label="Discounts given"
                value={formatMoney(data.summary.discountsGiven)}
              />
              <StatCard label="Tax collected" value={formatMoney(data.summary.taxCollected)} />
              <StatCard
                label="Shipping collected"
                value={formatMoney(data.summary.shippingCollected)}
              />
              <StatCard
                label="Refund rate"
                value={formatPct(data.summary.refundRate)}
                sub={`${formatNum(data.summary.refundedOrders)} refunded`}
                tone="warn"
              />
            </StatGrid>

            <Panel title="Revenue & orders">
              {chartSeries.length > 0 ? (
                <SalesChartSvg series={chartSeries} windowDays={days} />
              ) : (
                <p className="py-4 text-center text-sm text-neutral-500">No revenue in this window.</p>
              )}
            </Panel>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Revenue by payment method">
                <BarList
                  rows={data.byPaymentMethod.map((m) => ({
                    label: m.method,
                    sub: `${formatNum(m.orders)} orders`,
                    value: m.revenue,
                    display: formatMoney(m.revenue),
                  }))}
                  empty="No delivered orders yet"
                />
              </Panel>
              <Panel title="Orders by status">
                <MiniTable
                  columns={statusCols}
                  rows={data.byStatus}
                  rowKey={(r) => r.status}
                  empty="No orders yet"
                />
              </Panel>
            </div>
          </>
        ) : null}
      </ReportState>
    </div>
  );
}
