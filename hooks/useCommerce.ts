"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { cartApi, addressApi, orderApi } from "@/lib/api/commerce";
import type {
  AddCartItemInput,
  AddressInput,
  CheckoutInput,
  DecideReturnInput,
  MergeCartItem,
  OrderListQuery,
  OrderStatus,
  PaymentStatus,
  RequestReturnInput,
} from "@/types/commerce";

export const commerceKeys = {
  cart: ["commerce", "cart"] as const,
  addresses: ["commerce", "addresses"] as const,
  orders: (params?: OrderListQuery) => ["commerce", "orders", params ?? {}] as const,
  order: (id: string) => ["commerce", "order", id] as const,
};

/* ───────────── Cart hooks ───────────── */

export function useServerCart(enabled = true) {
  return useQuery({
    queryKey: commerceKeys.cart,
    queryFn: () => cartApi.get(),
    enabled,
    staleTime: 30_000,
  });
}

export function useAddCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddCartItemInput) => cartApi.addItem(input),
    onSuccess: (cart) => qc.setQueryData(commerceKeys.cart, cart),
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, qty }: { itemId: string; qty: number }) =>
      cartApi.updateItem(itemId, qty),
    onSuccess: (cart) => qc.setQueryData(commerceKeys.cart, cart),
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => cartApi.removeItem(itemId),
    onSuccess: (cart) => qc.setQueryData(commerceKeys.cart, cart),
  });
}

export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cartApi.clear(),
    onSuccess: (cart) => qc.setQueryData(commerceKeys.cart, cart),
  });
}

export function useApplyCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => cartApi.applyCoupon(code),
    onSuccess: (cart) => qc.setQueryData(commerceKeys.cart, cart),
  });
}

export function useRemoveCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cartApi.removeCoupon(),
    onSuccess: (cart) => qc.setQueryData(commerceKeys.cart, cart),
  });
}

export function useMergeCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: MergeCartItem[]) => cartApi.merge(items),
    onSuccess: (cart) => qc.setQueryData(commerceKeys.cart, cart),
  });
}

/* ───────────── Address hooks ───────────── */

export function useAddresses(enabled = true) {
  return useQuery({
    queryKey: commerceKeys.addresses,
    queryFn: () => addressApi.list(),
    enabled,
    staleTime: 60_000,
  });
}

export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddressInput) => addressApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: commerceKeys.addresses }),
  });
}

export function useUpdateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<AddressInput> }) =>
      addressApi.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: commerceKeys.addresses }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => addressApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: commerceKeys.addresses }),
  });
}

export function useSetDefaultAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => addressApi.setDefault(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: commerceKeys.addresses }),
  });
}

/* ───────────── Order hooks ───────────── */

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckoutInput) => orderApi.checkout(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commerceKeys.cart });
      qc.invalidateQueries({ queryKey: ["commerce", "orders"] });
    },
  });
}

export function useOrders(params?: OrderListQuery) {
  return useQuery({
    queryKey: commerceKeys.orders(params),
    queryFn: () => orderApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: commerceKeys.order(id ?? ""),
    queryFn: () => orderApi.get(id!),
    enabled: !!id,
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      orderApi.cancel(id, reason),
    onSuccess: (order) => {
      qc.setQueryData(commerceKeys.order(order._id), order);
      qc.invalidateQueries({ queryKey: ["commerce", "orders"] });
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: OrderStatus; note?: string }) =>
      orderApi.updateStatus(id, status, note),
    onSuccess: (order) => {
      qc.setQueryData(commerceKeys.order(order._id), order);
      qc.invalidateQueries({ queryKey: ["commerce", "orders"] });
    },
  });
}

export function useUpdatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      transactionId,
      refundAmount,
    }: {
      id: string;
      status: PaymentStatus;
      transactionId?: string;
      refundAmount?: number;
    }) => orderApi.updatePayment(id, status, transactionId, refundAmount),
    onSuccess: (order) => qc.setQueryData(commerceKeys.order(order._id), order),
  });
}

/* ───────────── Returns / RMA ───────────── */

/**
 * Buyer opens a return on a delivered order. Eligibility and
 * idempotency are enforced server-side - the hook just relays the
 * 409 (`RETURN_EXISTS`) / 400 (`INELIGIBLE_FOR_RETURN`,
 * `RETURN_WINDOW_CLOSED`) error code through `CommerceError` so the
 * UI can render a precise message. On success the order cache is
 * updated in place so the detail view re-renders with the new
 * `returnRequest` block.
 */
export function useRequestReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RequestReturnInput }) =>
      orderApi.requestReturn(id, input),
    onSuccess: (order) => {
      qc.setQueryData(commerceKeys.order(order._id), order);
      qc.invalidateQueries({ queryKey: ["commerce", "orders"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/**
 * Seller or admin approves / rejects an open return. Approving is
 * terminal on the backend; we mirror that here by also invalidating
 * the seller-side caches so the seller order detail re-fetches and
 * picks up the new payment.status + order.status + returnRequest.
 */
export function useDecideReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DecideReturnInput }) =>
      orderApi.decideReturn(id, input),
    onSuccess: (order) => {
      qc.setQueryData(commerceKeys.order(order._id), order);
      qc.invalidateQueries({ queryKey: ["commerce", "orders"] });
      qc.invalidateQueries({ queryKey: ["seller", "order", order._id] });
      qc.invalidateQueries({ queryKey: ["seller", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "order", order._id] });
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
