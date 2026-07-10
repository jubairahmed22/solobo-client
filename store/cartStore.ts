"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Legacy variant shape - only carries Size/Color. Kept on `CartItem` for
 * backward compatibility with carts persisted before v2 of this store
 * (when we started storing the resolved `variantId` and full `options`
 * map). New writes should always populate `variantId`/`options`; this
 * field is preserved only so old localStorage payloads keep rendering.
 */
export interface CartVariant {
  size?: string;
  color?: string;
}

export interface CartItem {
  productId: string;
  /**
   * Server-side variant id resolved at the time the user picked the
   * variant. When present, this is the deterministic key the backend
   * uses to match the cart row on merge - every other identifying
   * field is decorative.
   */
  variantId?: string;
  /**
   * Full variant option map (e.g. `{Size: "M", Color: "Red", Storage: "128GB"}`).
   * Used as the merge fallback when the variantId is missing (e.g. the
   * product was edited server-side and the old id no longer exists)
   * so any axis the product defines - not just Size/Color - survives
   * the local→server round trip.
   */
  options?: Record<string, string>;
  slug: string;
  title: string;
  image: string;
  price: number; // selling price after discount
  originalPrice?: number;
  qty: number;
  /** Available inventory at the time of add - used to cap qty locally. May be stale; backend is authoritative. */
  stock?: number;
  /** @deprecated Use `options` instead. Retained for v1 cart rehydration. */
  variant?: CartVariant;
  /** Composite key - see `lineKey` below - so same product with different variant is a separate row. */
  lineId: string;
}

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, "lineId">) => void;
  remove: (lineId: string) => void;
  setQty: (lineId: string, qty: number) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
}

/**
 * Build a stable identifier for a cart line. Preference order:
 *   1. `variantId` - deterministic, survives variant rename / option-axis additions
 *   2. Sorted hash of `options` - covers any axis the product defines
 *   3. Legacy `{size, color}` - only for v1 carts that haven't been rewritten yet
 *   4. Bare productId - last resort for products with no variants
 *
 * Sorting option keys is important: `{Size:"M", Color:"Red"}` and
 * `{Color:"Red", Size:"M"}` must hash to the same row.
 */
function lineKey(
  productId: string,
  variantId?: string,
  options?: Record<string, string>,
  legacy?: CartVariant,
): string {
  if (variantId) return `${productId}::v::${variantId}`;
  if (options && Object.keys(options).length > 0) {
    const parts = Object.keys(options)
      .sort()
      .map((k) => `${k}=${options[k]}`)
      .join("|");
    return `${productId}::o::${parts}`;
  }
  if (legacy && (legacy.size || legacy.color)) {
    return `${productId}::l::${legacy.size ?? ""}::${legacy.color ?? ""}`;
  }
  return `${productId}::base`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (incoming) => {
        const id = lineKey(
          incoming.productId,
          incoming.variantId,
          incoming.options,
          incoming.variant,
        );
        set((state) => {
          const existing = state.items.find((i) => i.lineId === id);
          const maxStock = typeof incoming.stock === "number" ? incoming.stock : Infinity;
          if (existing) {
            const newQty = Math.min(existing.qty + incoming.qty, maxStock);
            return {
              items: state.items.map((i) =>
                i.lineId === id
                  ? { ...i, qty: newQty, stock: incoming.stock ?? i.stock }
                  : i,
              ),
            };
          }
          return {
            items: [
              ...state.items,
              { ...incoming, qty: Math.min(incoming.qty, maxStock), lineId: id },
            ],
          };
        });
      },
      remove: (lineId) => set((state) => ({ items: state.items.filter((i) => i.lineId !== lineId) })),
      setQty: (lineId, qty) =>
        set((state) => ({
          items: state.items
            .map((i) => {
              if (i.lineId !== lineId) return i;
              const cap = typeof i.stock === "number" ? i.stock : 99;
              return { ...i, qty: Math.max(0, Math.min(qty, cap)) };
            })
            .filter((i) => i.qty > 0),
        })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((n, i) => n + i.qty, 0),
      subtotal: () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
    }),
    {
      name: "solobo-cart",
      storage: createJSONStorage(() => localStorage),
      // Bumped from 1 → 2 when we added `variantId`/`options`. v1 carts
      // are evicted (rather than migrated) because the legacy {size,color}
      // shape can't synthesise a real variantId - the user re-adds the
      // item once and the new row lands with full identifying data.
      version: 2,
    },
  ),
);
