"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { ApiResponse } from "@/types/api";
import type { PublicCustomizationConfig } from "@/types/customization";

/**
 * Public storefront read of the customization config (patches +
 * personalization prices + assignments). Used by the cart to reconstruct
 * the add-on cost breakdown for server-cart lines, which only persist the
 * final unit price. Long staleTime - admins rarely touch this mid-session.
 */
export function usePublicCustomizations(enabled = true) {
  return useQuery<PublicCustomizationConfig>({
    queryKey: ["customizations"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PublicCustomizationConfig>>("/customizations");
      if (!res.data.success) {
        throw new Error(res.data.message ?? "Failed to load customizations");
      }
      return res.data.data;
    },
    staleTime: 5 * 60_000,
    enabled,
  });
}
