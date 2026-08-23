import { apiClient } from "./client";
import type { ApiResponse } from "@/types/api";
import type {
  AnalyticsAttribution,
  AnalyticsConversion,
  AnalyticsFinancial,
  AnalyticsMarketing,
  AnalyticsOverview,
  CourierEconomicsReport,
  CustomerMetricsReport,
  ReconciliationReport,
  ReportParams,
  SkuProfitabilityReport,
} from "@/types/analytics";

/**
 * Admin analytics report client. Thin wrappers over the gated
 * /api/admin/analytics/* endpoints. We reuse the shared `apiClient` so the
 * bearer-token + refresh interceptor applies; the unwrap mirrors adminApi.
 */

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await promise;
  if (res.data.success) return res.data.data;
  throw new Error(res.data.message || "Request failed");
}

/** Drop undefined keys so the React Query cache key stays stable. */
function clean(params: ReportParams): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (params.days != null) out.days = params.days;
  if (params.from) out.from = params.from;
  if (params.to) out.to = params.to;
  return out;
}

/**
 * Download a CSV export. Auth is a Bearer token (not just cookies), so a
 * plain `<a href>` can't carry it - fetch as a blob through the same
 * authenticated client, then trigger a browser download from an object URL.
 */
async function downloadCsv(path: string, params: ReportParams, fallbackName: string): Promise<void> {
  const res = await apiClient.get(path, { params: clean(params), responseType: "blob" });
  const disposition = String(res.headers?.["content-disposition"] ?? "");
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const analyticsApi = {
  overview: (params: ReportParams = {}) =>
    unwrap<AnalyticsOverview>(
      apiClient.get("/admin/analytics/overview", { params: clean(params) }),
    ),
  attribution: (params: ReportParams = {}) =>
    unwrap<AnalyticsAttribution>(
      apiClient.get("/admin/analytics/attribution", { params: clean(params) }),
    ),
  financial: (params: ReportParams = {}) =>
    unwrap<AnalyticsFinancial>(
      apiClient.get("/admin/analytics/financial", { params: clean(params) }),
    ),
  marketing: (params: ReportParams = {}) =>
    unwrap<AnalyticsMarketing>(
      apiClient.get("/admin/analytics/marketing", { params: clean(params) }),
    ),
  conversion: (params: ReportParams = {}) =>
    unwrap<AnalyticsConversion>(
      apiClient.get("/admin/analytics/conversion", { params: clean(params) }),
    ),
  skuProfitability: (params: ReportParams = {}) =>
    unwrap<SkuProfitabilityReport>(
      apiClient.get("/admin/analytics/sku-profitability", { params: clean(params) }),
    ),
  courierEconomics: (params: ReportParams = {}) =>
    unwrap<CourierEconomicsReport>(
      apiClient.get("/admin/analytics/courier-economics", { params: clean(params) }),
    ),
  customerMetrics: (params: ReportParams = {}) =>
    unwrap<CustomerMetricsReport>(
      apiClient.get("/admin/analytics/customers", { params: clean(params) }),
    ),
  reconciliation: (params: ReportParams = {}) =>
    unwrap<ReconciliationReport>(
      apiClient.get("/admin/analytics/reconciliation", { params: clean(params) }),
    ),
  exportFinancialCsv: (params: ReportParams = {}) =>
    downloadCsv("/admin/analytics/financial/export.csv", params, "financial-summary.csv"),
  exportSkuProfitabilityCsv: (params: ReportParams = {}) =>
    downloadCsv("/admin/analytics/sku-profitability/export.csv", params, "sku-profitability.csv"),
  exportCourierEconomicsCsv: (params: ReportParams = {}) =>
    downloadCsv("/admin/analytics/courier-economics/export.csv", params, "courier-economics.csv"),
  exportCustomersCsv: (params: ReportParams = {}) =>
    downloadCsv("/admin/analytics/customers/export.csv", params, "customers.csv"),
};
