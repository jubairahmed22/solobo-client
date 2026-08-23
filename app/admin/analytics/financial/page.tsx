"use client";

import * as React from "react";
import { SalesChartSvg } from "@/components/composed/SalesChartSvg";
import {
  useAnalyticsFinancial,
  useCourierEconomics,
  useCustomerMetrics,
  useReconciliation,
  useSkuProfitability,
} from "@/hooks/useAnalytics";
import { analyticsApi } from "@/lib/api/analytics";
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
import type {
  AnalyticsFinancial,
  CategoryProfitabilityRow,
  CourierEconomicsRow,
  CustomerRow,
  SkuProfitabilityRow,
} from "@/types/analytics";

type StatusRow = AnalyticsFinancial["byStatus"][number];

/**
 * Analytics → Financial intelligence. The money view, built entirely from
 * services/finance.service.ts on the backend - every figure below is a
 * shared, tested calculation, never a page-local re-derivation. Delivery
 * charge is NEVER part of revenue/AOV; it's its own line (Delivery revenue /
 * cost / margin). Recognised = delivered ∪ returned orders (a returned order
 * was delivered first) - see the dataGaps note for what's structurally 0
 * pending schema work (payment gateway fee, COD fee, marketing spend).
 */
export default function FinancialPage() {
  const [days, setDays] = React.useState(30);
  const params = { days };
  const { data, isLoading, isError } = useAnalyticsFinancial(params);
  const sku = useSkuProfitability(params);
  const courier = useCourierEconomics(params);
  const customers = useCustomerMetrics(params);
  const reconciliation = useReconciliation(params);

  const chartSeries =
    data?.timeseries.map((p) => ({ date: p.date, revenue: p.revenue, orderCount: p.orders })) ?? [];

  const statusCols: Column<StatusRow>[] = [
    { header: "Status", cell: (r) => <span className="capitalize">{r.status}</span> },
    { header: "Orders", align: "right", cell: (r) => formatNum(r.orders) },
    { header: "Order value", align: "right", cell: (r) => formatMoney(r.orderValue) },
  ];

  const skuCols: Column<SkuProfitabilityRow>[] = [
    {
      header: "Product",
      cell: (r) => (
        <span>
          {r.title}
          {!r.costDataComplete ? (
            <span className="ml-1 text-[11px] font-medium text-yellow-700" title="Cost missing on some units - margin understates true cost">
              (cost gap)
            </span>
          ) : null}
        </span>
      ),
    },
    { header: "SKU", cell: (r) => r.sku || "—" },
    { header: "Category", cell: (r) => r.categoryName },
    { header: "Units", align: "right", cell: (r) => formatNum(r.unitsSold) },
    { header: "Net revenue", align: "right", cell: (r) => formatMoney(r.netRevenue) },
    { header: "COGS", align: "right", cell: (r) => formatMoney(r.cogs) },
    { header: "Contribution", align: "right", cell: (r) => formatMoney(r.contributionMargin) },
  ];

  const categoryCols: Column<CategoryProfitabilityRow>[] = [
    { header: "Category", cell: (r) => r.categoryName },
    { header: "Units", align: "right", cell: (r) => formatNum(r.unitsSold) },
    { header: "Net revenue", align: "right", cell: (r) => formatMoney(r.netRevenue) },
    { header: "Contribution", align: "right", cell: (r) => formatMoney(r.contributionMargin) },
    { header: "Margin %", align: "right", cell: (r) => formatPct(r.contributionMarginPct) },
  ];

  const courierCols: Column<CourierEconomicsRow>[] = [
    { header: "Courier", cell: (r) => <span className="capitalize">{r.provider.replace(/_/g, " ")}</span> },
    { header: "Orders", align: "right", cell: (r) => formatNum(r.recognizedOrders) },
    { header: "Delivery revenue", align: "right", cell: (r) => formatMoney(r.deliveryRevenue) },
    { header: "Delivery cost", align: "right", cell: (r) => formatMoney(r.deliveryCost) },
    {
      header: "Margin",
      align: "right",
      cell: (r) => (
        <span className={r.deliveryMargin < 0 ? "text-red-600" : ""}>
          {formatMoney(r.deliveryMargin)} ({formatPct(r.deliveryMarginPct)})
        </span>
      ),
    },
  ];

  const customerCols: Column<CustomerRow>[] = [
    { header: "Customer ID", cell: (r) => <span className="font-mono text-[12px]">{r.userId}</span> },
    { header: "Orders", align: "right", cell: (r) => formatNum(r.orders) },
    { header: "Net revenue", align: "right", cell: (r) => formatMoney(r.netRevenue) },
    { header: "AOV", align: "right", cell: (r) => formatMoney(r.aov) },
  ];

  return (
    <div className="flex flex-col gap-[16px]">
      <ReportHeader
        title="Financial intelligence"
        description="Recognised revenue, margins, delivery economics and reconciliation - from orders."
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
            <div className="flex items-start justify-between gap-[12px] rounded-[8px] border border-yellow-200 bg-yellow-50 p-[12px] text-[13px] text-yellow-800">
              <p>{data.dataGaps.note}</p>
              <button
                type="button"
                onClick={() => void analyticsApi.exportFinancialCsv(params)}
                className="shrink-0 rounded-[6px] border border-yellow-300 bg-white px-[10px] py-[6px] text-[12px] font-medium text-yellow-800 hover:bg-yellow-100"
              >
                Export CSV
              </button>
            </div>

            <StatGrid>
              <StatCard
                label="Gross revenue"
                value={formatMoney(data.summary.grossRevenue)}
                sub="Item value, delivery excluded"
              />
              <StatCard
                label="Net revenue"
                value={formatMoney(data.summary.netRevenue)}
                sub={`After ${formatMoney(data.summary.returnedNetValueThisPeriod)} returns (this period)`}
              />
              <StatCard label="Avg. order value" value={formatMoney(data.summary.aov)} sub="Delivery excluded" />
              <StatCard
                label="Units sold"
                value={formatNum(data.summary.unitsSold)}
                sub={`${formatNum(data.summary.recognizedOrders)} recognised orders`}
              />
              <StatCard
                label="Gross profit"
                value={formatMoney(data.summary.grossProfit)}
                sub={`${formatPct(data.summary.grossMargin)} margin`}
              />
              <StatCard
                label="Net profit (ex. opex)"
                value={formatMoney(data.summary.netProfit)}
                sub="Gateway/COD fees not tracked - see banner"
                tone="warn"
              />
              <StatCard
                label="Delivery margin"
                value={formatMoney(data.summary.deliveryMargin)}
                sub={`${formatMoney(data.summary.shippingCollected)} charged vs cost`}
              />
              <StatCard
                label="COGS"
                value={formatMoney(data.summary.cogs)}
                sub={`${formatPct(data.summary.marginCoverage)} of units have known cost`}
              />
              <StatCard label="Discounts given" value={formatMoney(data.summary.discountsGiven)} />
              <StatCard label="Tax collected" value={formatMoney(data.summary.taxCollected)} />
              <StatCard
                label="Contribution margin (avg/order)"
                value={formatMoney(data.summary.contributionMarginAvg)}
              />
              <StatCard
                label="Returns this period"
                value={formatNum(data.summary.returnsDecidedCount)}
                sub={formatMoney(data.summary.returnedNetValueThisPeriod)}
                tone="warn"
              />
            </StatGrid>

            <Panel title="Revenue & orders">
              {chartSeries.length > 0 ? (
                <SalesChartSvg series={chartSeries} windowDays={days} />
              ) : (
                <p className="py-4 text-center text-sm text-gray-500">No revenue in this window.</p>
              )}
            </Panel>

            <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-2">
              <Panel title="Revenue by payment method">
                <BarList
                  rows={data.byPaymentMethod.map((m) => ({
                    label: m.method,
                    sub: `${formatNum(m.orders)} orders`,
                    value: m.revenue,
                    display: formatMoney(m.revenue),
                  }))}
                  empty="No recognised orders yet"
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

            <Panel
              title="Cash vs. recognised revenue reconciliation"
              action={
                reconciliation.data ? (
                  <span className={reconciliation.data.gap < 0 ? "text-[13px] text-red-600" : "text-[13px] text-gray-500"}>
                    Gap: {formatMoney(reconciliation.data.gap)}
                  </span>
                ) : null
              }
            >
              {reconciliation.data ? (
                <div className="flex flex-col gap-[12px]">
                  <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
                    <div className="rounded-[6px] border border-gray-200 p-[12px]">
                      <p className="text-[13px] font-medium text-gray-500">Cash received</p>
                      <p className="text-[20px] font-bold text-gray-900">
                        {formatMoney(reconciliation.data.cashReceived.total)}
                      </p>
                      <p className="text-[12px] text-gray-500">
                        Prepaid {formatMoney(reconciliation.data.cashReceived.prepaid)} · COD settled{" "}
                        {formatMoney(reconciliation.data.cashReceived.codSettled)}
                      </p>
                    </div>
                    <div className="rounded-[6px] border border-gray-200 p-[12px]">
                      <p className="text-[13px] font-medium text-gray-500">Recognised revenue (comparable)</p>
                      <p className="text-[20px] font-bold text-gray-900">
                        {formatMoney(reconciliation.data.recognizedRevenueComponents.total)}
                      </p>
                      <p className="text-[12px] text-gray-500">
                        Net revenue + delivery + tax collected
                      </p>
                    </div>
                  </div>
                  <p className="text-[13px] text-gray-500">
                    COD pending settlement: {formatMoney(reconciliation.data.codPendingSettlement)}
                  </p>
                  <ul className="list-disc space-y-1 pl-[18px] text-[12px] text-gray-500">
                    {reconciliation.data.gapExplanation.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="py-2 text-center text-sm text-gray-500">Loading reconciliation…</p>
              )}
            </Panel>

            <Panel
              title="Per-courier delivery economics"
              action={
                <button
                  type="button"
                  onClick={() => void analyticsApi.exportCourierEconomicsCsv(params)}
                  className="text-[12px] font-medium text-blue-700 hover:underline"
                >
                  Export CSV
                </button>
              }
            >
              <MiniTable
                columns={courierCols}
                rows={courier.data?.couriers ?? []}
                rowKey={(r) => r.provider}
                empty="No recognised orders yet"
              />
            </Panel>

            <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-2">
              <Panel
                title="Top products by net revenue"
                action={
                  <button
                    type="button"
                    onClick={() => void analyticsApi.exportSkuProfitabilityCsv(params)}
                    className="text-[12px] font-medium text-blue-700 hover:underline"
                  >
                    Export CSV
                  </button>
                }
              >
                <MiniTable
                  columns={skuCols}
                  rows={(sku.data?.skus ?? []).slice(0, 15)}
                  rowKey={(r) => r.productId || r.sku}
                  empty="No recognised orders yet"
                />
              </Panel>
              <Panel title="Profitability by category">
                <MiniTable
                  columns={categoryCols}
                  rows={sku.data?.categories ?? []}
                  rowKey={(r) => r.categoryId ?? "uncategorised"}
                  empty="No recognised orders yet"
                />
              </Panel>
            </div>

            <Panel
              title="Customer metrics"
              action={
                <button
                  type="button"
                  onClick={() => void analyticsApi.exportCustomersCsv(params)}
                  className="text-[12px] font-medium text-blue-700 hover:underline"
                >
                  Export CSV
                </button>
              }
            >
              {customers.data ? (
                <div className="flex flex-col gap-[12px]">
                  <StatGrid>
                    <StatCard
                      label="Repeat purchase rate"
                      value={formatPct(customers.data.repeatPurchaseRate)}
                      sub={`${formatNum(customers.data.repeatCustomersInPeriod)} of ${formatNum(customers.data.registeredCustomersInPeriod)} registered customers`}
                    />
                    <StatCard
                      label="Avg. AOV across customers"
                      value={formatMoney(customers.data.avgAovAcrossCustomers)}
                    />
                    <StatCard
                      label="Guest orders"
                      value={formatNum(customers.data.guestOrdersInPeriod)}
                      sub="Excluded from repeat-rate (no stable identity)"
                    />
                    <StatCard label="CAC" value="—" sub={customers.data.cacGapReason} tone="warn" />
                  </StatGrid>
                  <MiniTable
                    columns={customerCols}
                    rows={customers.data.topCustomers}
                    rowKey={(r) => r.userId}
                    empty="No registered-customer orders yet"
                  />
                </div>
              ) : (
                <p className="py-2 text-center text-sm text-gray-500">Loading customer metrics…</p>
              )}
            </Panel>
          </>
        ) : null}
      </ReportState>
    </div>
  );
}
