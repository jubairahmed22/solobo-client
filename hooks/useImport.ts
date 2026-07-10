"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { importApi } from "@/lib/api/import";
import { sellerKeys } from "./useSeller";
import type {
  ImportCommitResponse,
  ImportPreviewResponse,
  ImportRequestBody,
} from "@/types/import";

/**
 * Hooks for the seller-facing bulk product import.
 *
 * Both endpoints are mutations rather than queries: even preview has the
 * "send a body, get a response" shape and the seller actively triggers
 * each run (no auto-refetch on focus etc). Modelling them as mutations
 * also keeps the loading state isolated per-button on the page.
 *
 * On a successful commit we invalidate the seller's product list +
 * dashboard stats so the new products show up immediately.
 */

export function usePreviewImport() {
  return useMutation<ImportPreviewResponse, Error, ImportRequestBody>({
    mutationFn: (body) => importApi.preview(body),
  });
}

export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation<ImportCommitResponse, Error, ImportRequestBody>({
    mutationFn: (body) => importApi.commit(body),
    onSuccess: (data) => {
      // Only fan out invalidations when we actually wrote something. A
      // commit that landed zero rows (atomic refusal still returns 201
      // shouldn't happen but be defensive) doesn't change the catalog.
      if (data.createdCount > 0) {
        qc.invalidateQueries({ queryKey: sellerKeys.productsAll });
        qc.invalidateQueries({ queryKey: sellerKeys.stats });
        // Storefront product list - new items are public the moment
        // they save with isActive=true, so refresh those too.
        qc.invalidateQueries({ queryKey: ["products"] });
        // Admin product list, in case an admin/seller has both panels
        // open at once.
        qc.invalidateQueries({ queryKey: ["admin", "products"] });
        qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      }
    },
  });
}
