"use client";

import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/analytics";
import type { ReportParams } from "@/types/analytics";

/**
 * React Query hooks for the admin analytics reports. Each report is keyed on
 * its params so switching the date-range window refetches cleanly. Reports are
 * aggregations that shift slowly, so we let them go stale after 2 minutes to
 * cut redundant round-trips while flipping between dashboard tabs.
 */

const STALE = 2 * 60_000;

export const analyticsKeys = {
  overview: (p: ReportParams) => ["admin", "analytics", "overview", p] as const,
  attribution: (p: ReportParams) => ["admin", "analytics", "attribution", p] as const,
  financial: (p: ReportParams) => ["admin", "analytics", "financial", p] as const,
  marketing: (p: ReportParams) => ["admin", "analytics", "marketing", p] as const,
  conversion: (p: ReportParams) => ["admin", "analytics", "conversion", p] as const,
};

export function useAnalyticsOverview(params: ReportParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.overview(params),
    queryFn: () => analyticsApi.overview(params),
    staleTime: STALE,
  });
}

export function useAnalyticsAttribution(params: ReportParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.attribution(params),
    queryFn: () => analyticsApi.attribution(params),
    staleTime: STALE,
  });
}

export function useAnalyticsFinancial(params: ReportParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.financial(params),
    queryFn: () => analyticsApi.financial(params),
    staleTime: STALE,
  });
}

export function useAnalyticsMarketing(params: ReportParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.marketing(params),
    queryFn: () => analyticsApi.marketing(params),
    staleTime: STALE,
  });
}

export function useAnalyticsConversion(params: ReportParams = {}) {
  return useQuery({
    queryKey: analyticsKeys.conversion(params),
    queryFn: () => analyticsApi.conversion(params),
    staleTime: STALE,
  });
}
