"use client";

import { create } from "zustand";

export type ToastTone = "default" | "success" | "error" | "info";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  duration: number; // ms
}

interface UIState {
  // toasts
  toasts: Toast[];
  toast: (input: Partial<Omit<Toast, "id">> & { title: string }) => string;
  dismissToast: (id: string) => void;

  // mobile menu
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;

  // generic drawer (e.g. cart drawer)
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
}

const genId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  toast: (input) => {
    const id = genId();
    const toast: Toast = {
      id,
      title: input.title,
      description: input.description,
      tone: input.tone ?? "default",
      duration: input.duration ?? 4000,
    };
    set((state) => ({ toasts: [...state.toasts, toast] }));
    if (toast.duration > 0) {
      setTimeout(() => get().dismissToast(id), toast.duration);
    }
    return id;
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

  cartDrawerOpen: false,
  setCartDrawerOpen: (open) => set({ cartDrawerOpen: open }),
}));
