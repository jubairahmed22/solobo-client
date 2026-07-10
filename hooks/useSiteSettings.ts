"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { apiClient } from "@/lib/api/client";
import type { ApiResponse } from "@/types/api";
import type { SiteSettings, UpdateSiteSettingsBody } from "@/types/siteSettings";

/**
 * React Query bindings for the singleton SiteSettings document.
 *
 * The admin form reads + writes via /admin/site-settings; the storefront's
 * public read mirrors the same shape at /api/site-settings. We deliberately
 * use a stable `["site-settings"]` key (no params) because there's exactly
 * one document - pagination and filter knobs don't apply.
 */
export const siteSettingsKeys = {
  admin: ["admin", "site-settings"] as const,
  public: ["site-settings"] as const,
};

/**
 * Public-side read - used by storefront chrome (footer, floating WhatsApp
 * button) to surface contact info without an admin token. Long staleTime
 * because the company profile barely changes between visits.
 */
export function usePublicSiteSettings() {
  return useQuery<SiteSettings>({
    queryKey: siteSettingsKeys.public,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<SiteSettings>>("/site-settings");
      if (!res.data.success) {
        throw new Error(res.data.message ?? "Failed to load site settings");
      }
      return res.data.data;
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Admin-side read. 60s staleTime because the form is the only writer and
 * we always invalidate after a successful PUT, so background refetches on
 * focus would be wasted work.
 */
export function useAdminSiteSettings() {
  return useQuery<SiteSettings>({
    queryKey: siteSettingsKeys.admin,
    queryFn: adminApi.getSiteSettings,
    staleTime: 60_000,
  });
}

/**
 * Partial update. On success we drop the public key as well so any
 * storefront component (footer, contact page, policy pages) using the
 * same React Query cache picks up the change without a hard reload.
 */
export function useUpdateSiteSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateSiteSettingsBody) => adminApi.updateSiteSettings(body),
    onSuccess: (updated) => {
      // Seed both caches with the server-returned doc so the form reflects
      // the canonical state (incl. server-side defaults / mongoose timestamps)
      // without an extra round-trip.
      qc.setQueryData(siteSettingsKeys.admin, updated);
      qc.setQueryData(siteSettingsKeys.public, updated);
      qc.invalidateQueries({ queryKey: siteSettingsKeys.admin });
      qc.invalidateQueries({ queryKey: siteSettingsKeys.public });
    },
  });
}
