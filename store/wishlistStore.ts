"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface WishlistItem {
  productId: string;
  slug: string;
  title: string;
  image: string;
  price: number;
  addedAt: number; // epoch ms
}

interface WishlistState {
  items: WishlistItem[];
  toggle: (item: Omit<WishlistItem, "addedAt">) => void;
  remove: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
  count: () => number;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (incoming) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === incoming.productId);
          if (existing) {
            return { items: state.items.filter((i) => i.productId !== incoming.productId) };
          }
          return { items: [{ ...incoming, addedAt: Date.now() }, ...state.items] };
        }),
      remove: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
      has: (productId) => get().items.some((i) => i.productId === productId),
      clear: () => set({ items: [] }),
      count: () => get().items.length,
    }),
    {
      name: "solobo-wishlist",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
