"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { sellerApi } from "@/lib/api/seller";
import type {
  AdminCreateCouponBody,
  AdminListCouponsParams,
  AdminUpdateCouponBody,
  SellerCreateCouponBody,
  SellerListCouponsParams,
  SellerUpdateCouponBody,
} from "@/types/coupon";

/**
 * Coupon hooks - admin + seller surfaces share this file because they're
 * symmetric over the same Coupon entity. The cart's apply/remove already
 * hangs off the existing cart hooks (useApplyCoupon / useRemoveCoupon in
 * useCommerce.ts), which surface the new envelope shape directly; we don't
 * duplicate those here.
 */

export const couponKeys = {
  admin: {
    list: (params: AdminListCouponsParams) =>
      ["admin", "coupons", params] as const,
    listAll: ["admin", "coupons"] as const,
    detail: (id: string) => ["admin", "coupon", id] as const,
  },
  seller: {
    list: (params: SellerListCouponsParams) =>
      ["seller", "coupons", params] as const,
    listAll: ["seller", "coupons"] as const,
    detail: (id: string) => ["seller", "coupon", id] as const,
  },
};

/* ───────────────────── Admin ───────────────────── */

export function useAdminCoupons(params: AdminListCouponsParams) {
  return useQuery({
    queryKey: couponKeys.admin.list(params),
    queryFn: () => adminApi.listCoupons(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useAdminCoupon(id: string | undefined) {
  return useQuery({
    queryKey: id ? couponKeys.admin.detail(id) : ["admin", "coupon", "noop"],
    queryFn: () => {
      if (!id) throw new Error("Coupon id is required");
      return adminApi.getCoupon(id);
    },
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

/**
 * Coupon mutations invalidate both the admin and seller list/detail caches
 * because an admin acting on a seller-scope coupon should be visible to the
 * seller dashboard immediately. We also nuke the cart envelope's appliedCoupon
 * cache key so a buyer who currently has that code applied refetches and
 * picks up the new state (e.g. an admin flipping isActive=false propagates
 * to the open cart without a hard refresh).
 */
function useInvalidateAdminCoupon(id?: string) {
  const qc = useQueryClient();
  return () => {
    if (id) qc.invalidateQueries({ queryKey: couponKeys.admin.detail(id) });
    qc.invalidateQueries({ queryKey: couponKeys.admin.listAll });
    qc.invalidateQueries({ queryKey: couponKeys.seller.listAll });
    qc.invalidateQueries({ queryKey: ["seller", "coupon"] });
    qc.invalidateQueries({ queryKey: ["cart"] });
  };
}

export function useCreateAdminCoupon() {
  const invalidate = useInvalidateAdminCoupon();
  return useMutation({
    mutationFn: (body: AdminCreateCouponBody) => adminApi.createCoupon(body),
    onSuccess: invalidate,
  });
}

export function useUpdateAdminCoupon(id: string) {
  const invalidate = useInvalidateAdminCoupon(id);
  return useMutation({
    mutationFn: (patch: AdminUpdateCouponBody) =>
      adminApi.updateCoupon(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteAdminCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteCoupon(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: couponKeys.admin.listAll });
      qc.invalidateQueries({ queryKey: ["admin", "coupon"] });
      qc.invalidateQueries({ queryKey: couponKeys.seller.listAll });
      qc.invalidateQueries({ queryKey: ["seller", "coupon"] });
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

/* ───────────────────── Seller ───────────────────── */

export function useSellerCoupons(params: SellerListCouponsParams) {
  return useQuery({
    queryKey: couponKeys.seller.list(params),
    queryFn: () => sellerApi.listCoupons(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useSellerCoupon(id: string | undefined) {
  return useQuery({
    queryKey: id ? couponKeys.seller.detail(id) : ["seller", "coupon", "noop"],
    queryFn: () => {
      if (!id) throw new Error("Coupon id is required");
      return sellerApi.getCoupon(id);
    },
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

/**
 * Seller-side invalidation also pokes the admin list/detail keys so a
 * watching admin sees changes in real time. The cart key is invalidated for
 * the same reason as the admin path - a buyer with the code applied should
 * see updates without a hard refresh.
 */
function useInvalidateSellerCoupon(id?: string) {
  const qc = useQueryClient();
  return () => {
    if (id) qc.invalidateQueries({ queryKey: couponKeys.seller.detail(id) });
    qc.invalidateQueries({ queryKey: couponKeys.seller.listAll });
    qc.invalidateQueries({ queryKey: couponKeys.admin.listAll });
    qc.invalidateQueries({ queryKey: ["admin", "coupon"] });
    qc.invalidateQueries({ queryKey: ["cart"] });
  };
}

export function useCreateSellerCoupon() {
  const invalidate = useInvalidateSellerCoupon();
  return useMutation({
    mutationFn: (body: SellerCreateCouponBody) => sellerApi.createCoupon(body),
    onSuccess: invalidate,
  });
}

export function useUpdateSellerCoupon(id: string) {
  const invalidate = useInvalidateSellerCoupon(id);
  return useMutation({
    mutationFn: (patch: SellerUpdateCouponBody) =>
      sellerApi.updateCoupon(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteSellerCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sellerApi.deleteCoupon(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: couponKeys.seller.listAll });
      qc.invalidateQueries({ queryKey: ["seller", "coupon"] });
      qc.invalidateQueries({ queryKey: couponKeys.admin.listAll });
      qc.invalidateQueries({ queryKey: ["admin", "coupon"] });
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}
