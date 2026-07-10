"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useCartStore } from "@/store/cartStore";
import { useMergeCart } from "@/hooks/useCommerce";

/**
 * CartSyncBridge - invisible component that runs once after the user authenticates.
 *
 * If the local Zustand cart has items, it pushes them up to the server cart via
 * /api/cart/merge and clears the local cart on success. After the first attempt
 * for a given auth session we never retry - a transient 429 or network blip is
 * preferable to a tight loop that hammers the backend.
 *
 * Design notes:
 *  - We read `items`, `clearLocal`, and `merge.mutate` via refs so the effect's
 *    only reactive dependency is `status`. Including the items array or the
 *    mutation object in the deps would re-run this effect on every store tick
 *    or every render and risk an infinite merge loop.
 *  - `attemptedRef` is one-way (false → true) for the lifetime of an authenticated
 *    session, and flips back to false only on logout, so the next sign-in can
 *    still merge a freshly-built anonymous cart.
 */
export function CartSyncBridge() {
  const { status } = useSession();
  const merge = useMergeCart();

  // Snapshot the latest store values without making the effect reactive to them.
  const storeRef = React.useRef(useCartStore.getState());
  React.useEffect(() => {
    storeRef.current = useCartStore.getState();
    return useCartStore.subscribe((state) => {
      storeRef.current = state;
    });
  }, []);

  // Keep a stable handle to the latest mutation object too - `useMergeCart`
  // returns a fresh object on every render and we don't want that churn to
  // re-trigger the effect.
  const mergeRef = React.useRef(merge);
  React.useEffect(() => {
    mergeRef.current = merge;
  }, [merge]);

  const attemptedRef = React.useRef(false);

  React.useEffect(() => {
    if (status !== "authenticated") {
      // Reset only when the user signs out so a future login can merge again.
      attemptedRef.current = false;
      return;
    }
    if (attemptedRef.current) return;

    const { items, clear } = storeRef.current;
    if (items.length === 0) {
      attemptedRef.current = true;
      return;
    }

    // Flip the flag BEFORE firing the mutation. Even if the request fails
    // (e.g., 429 from the rate-limiter), we don't retry - leaving the local
    // cart intact is better than burning a hole through the backend.
    attemptedRef.current = true;

    // Preference order on the wire:
    //   1. `variantId` - server matches the cart row directly, no option scan
    //   2. full `options` map - covers any axis (Storage, Material, …) the
    //      product defines, not just Size/Color
    //   3. legacy `{size, color}` - for carts persisted before cartStore v2
    //
    // The server's resolveLineItem is happy with any of these; we always
    // send the most specific one we have so it never falls back into
    // VARIANT_REQUIRED on a perfectly-good local row.
    const payload = items.map((it) => {
      if (it.variantId) {
        return { productId: it.productId, variantId: it.variantId, qty: it.qty };
      }
      if (it.options && Object.keys(it.options).length > 0) {
        return { productId: it.productId, options: it.options, qty: it.qty };
      }
      const legacyOptions: Record<string, string> = {};
      if (it.variant?.color) legacyOptions.Color = it.variant.color;
      if (it.variant?.size) legacyOptions.Size = it.variant.size;
      return {
        productId: it.productId,
        qty: it.qty,
        options: Object.keys(legacyOptions).length > 0 ? legacyOptions : undefined,
      };
    });

    mergeRef.current.mutate(payload, {
      onSuccess: () => {
        clear();
      },
    });
  }, [status]);

  return null;
}
