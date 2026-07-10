import { apiClient } from "./client";
import type { ApiResponse } from "@/types/api";
import type {
  AnalyticsAttribution,
  AnalyticsConversion,
  AnalyticsFinancial,
  AnalyticsMarketing,
  AnalyticsOverview,
  ReportParams,
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
};
