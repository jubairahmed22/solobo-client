"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Ban, CheckCircle2, Clock,
  CreditCard, Loader2, Printer, Tag, Trash2, Truck, Undo2, XCircle,
} from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";
import { AdminDetailSkeleton } from "@/components/admin/Skeleton";
import { Select } from "@/components/composed";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/store/uiStore";
import {
  useAdminOrder, useCancelAdminOrder, useDeleteAdminOrder, useUpdateOrderPayment,
  useUpdateOrderStatus, useUpdateOrderTracking,
} from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import { OrderItemsEditor } from "./OrderItemsEditor";
import { OrderCustomerEditor } from "./OrderCustomerEditor";
import { OrderCourierPanel } from "./OrderCourierPanel";
import type { AdminOrderDetail } from "@/types/admin";
import type { OrderStatus, OrderTimelineEvent, PaymentStatus } from "@/types/commerce";

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:   ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed:    ["shipped", "cancelled"],
  shipped:   ["delivered"],
  delivered: ["returned"],
  cancelled: [],
  returned:  [],
};

const PAYMENT_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: "pending",  label: "Pending" },
  { value: "paid",     label: "Paid" },
  { value: "failed",   label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

/* Flowbite badge tones - bg-*-100 text-*-800. */
const STATUS_TONES: Record<string, string> = {
  pending:   "bg-gray-100 text-gray-800",
  confirmed: "bg-blue-100 text-blue-800",
  packed:    "bg-purple-100 text-purple-800",
  shipped:   "bg-yellow-100 text-yellow-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  returned:  "bg-gray-100 text-gray-800",
};

function formatMoney(amount: number, currency: string): string {
  if (currency === "BDT") return `Tk ${amount.toLocaleString("en-IN")}`;
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-US")}`; }
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  catch { return iso; }
}

function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-[4px] px-[10px] py-[2px] text-[12px] font-medium capitalize", STATUS_TONES[status] ?? "bg-gray-100 text-gray-800")}>
      {status}
    </span>
  );
}

/* Shared card shell - white, shadow-sm, gray-200 border, 16px padding. */
function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm", className)}>
      {children}
    </section>
  );
}

function CardTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="mb-[16px] flex items-center gap-[8px] text-[16px] font-semibold text-gray-900">
      {icon}
      {children}
    </h2>
  );
}

const fieldLabel = "text-[13px] font-medium text-gray-500";

/* "" Timeline "" */

function TimelineCard({ events }: { events: OrderTimelineEvent[] }) {
  if (!events?.length) {
    return (
      <Card>
        <CardTitle icon={<Clock className="h-[16px] w-[16px] text-gray-400" aria-hidden />}>Timeline</CardTitle>
        <p className="text-[14px] text-gray-500">No events yet.</p>
      </Card>
    );
  }
  const ordered = [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return (
    <Card>
      <CardTitle icon={<Clock className="h-[16px] w-[16px] text-gray-400" aria-hidden />}>Timeline</CardTitle>
      <ol className="flex flex-col gap-[12px]">
        {ordered.map((ev, idx) => (
          <li key={`${ev.status}-${ev.at}-${idx}`} className="flex items-start gap-[12px] border-l-2 border-gray-200 pl-[16px] first:border-[#1A56DB]/40">
            <div className="flex flex-1 flex-col gap-[2px]">
              <div className="flex flex-wrap items-center gap-[8px]">
                <StatusPill status={ev.status} />
                <span className="text-[12px] text-gray-500">{formatDate(ev.at)}</span>
              </div>
              {ev.note ? <p className="text-[14px] text-gray-700">{ev.note}</p> : null}
              {ev.by ? <span className="text-[12px] text-gray-400">by {ev.by}</span> : null}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* "" Danger zone — hard delete "" */

function DangerZone({ order }: { order: AdminOrderDetail }) {
  const toast = useUIStore((s) => s.toast);
  const router = useRouter();
  const del = useDeleteAdminOrder(order._id);

  // Stock only comes back for orders that haven't already had it returned.
  const stockRestores = order.status !== "cancelled" && order.status !== "returned";

  const onDelete = async () => {
    const warning = stockRestores
      ? `Permanently delete order ${order.orderNumber}? Stock will be restored. This cannot be undone.`
      : `Permanently delete order ${order.orderNumber}? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    try {
      await del.mutateAsync();
      toast({ title: "Order deleted", tone: "success" });
      router.push("/admin/orders");
    } catch (err) {
      toast({ title: err instanceof AdminError ? err.message : "Couldn't delete order", tone: "error" });
    }
  };

  return (
    <section className="rounded-[8px] border border-red-200 bg-red-50 p-[16px]">
      <h2 className="text-[16px] font-semibold text-red-700">Danger zone</h2>
      <p className="mt-[4px] text-[13px] text-red-600">
        Deleting removes this order permanently.
        {stockRestores ? " Reserved stock is added back to inventory." : ""}
      </p>
      {/* Flowbite destructive-outline button */}
      <button
        type="button"
        onClick={onDelete}
        disabled={del.isPending}
        className="mt-[12px] inline-flex h-[36px] items-center gap-[8px] rounded-[8px] border border-red-300 bg-white px-[12px] text-[13px] font-medium text-red-600 transition duration-75 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {del.isPending ? <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden /> : <Trash2 className="h-[14px] w-[14px]" aria-hidden />}
        Delete order
      </button>
    </section>
  );
}

/* "" Status actions "" */

function StatusActions({ order }: { order: AdminOrderDetail }) {
  const toast = useUIStore((s) => s.toast);
  const [note, setNote] = React.useState("");
  const [cancelReason, setCancelReason] = React.useState("");

  const updateStatus = useUpdateOrderStatus(order._id);
  const cancel = useCancelAdminOrder(order._id);

  const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
  const advanceTargets = allowed.filter((s) => s !== "cancelled");
  const canCancel = allowed.includes("cancelled");

  const onAdvance = async (next: OrderStatus) => {
    try {
      await updateStatus.mutateAsync({ status: next, note: note.trim() || undefined });
      toast({ title: `Order marked ${next}`, tone: "success" });
      setNote("");
    } catch (err) { toast({ title: err instanceof AdminError ? err.message : "Couldn't update status", tone: "error" }); }
  };

  const onCancel = async () => {
    if (!window.confirm("Cancel this order? Stock will be restored.")) return;
    try {
      await cancel.mutateAsync(cancelReason.trim() || undefined);
      toast({ title: "Order cancelled", tone: "success" });
      setCancelReason("");
    } catch (err) { toast({ title: err instanceof AdminError ? err.message : "Couldn't cancel order", tone: "error" }); }
  };

  if (advanceTargets.length === 0 && !canCancel) {
    return (
      <Card>
        <CardTitle>Status</CardTitle>
        <p className="text-[14px] text-gray-500">This order is in a terminal state — no further transitions are available.</p>
      </Card>
    );
  }

  const busy = updateStatus.isPending || cancel.isPending;

  return (
    <Card>
      <CardTitle>Status</CardTitle>

      {advanceTargets.length > 0 ? (
        <div className="flex flex-col gap-[12px]">
          <label className="flex flex-col gap-[6px]">
            <span className={fieldLabel}>Note (optional)</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible in the timeline" />
          </label>
          <div className="flex flex-wrap gap-[8px]">
            {advanceTargets.map((target) => (
              /* Flowbite primary button */
              <button
                key={target}
                type="button"
                onClick={() => onAdvance(target)}
                disabled={busy}
                className="inline-flex h-[36px] items-center gap-[8px] rounded-[8px] bg-[#1A56DB] px-[14px] text-[13px] font-medium capitalize text-white transition duration-75 hover:bg-[#1E429F] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updateStatus.isPending ? <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden /> : <ArrowRight className="h-[14px] w-[14px]" aria-hidden />}
                Mark {target}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {canCancel ? (
        <div className="mt-[16px] border-t border-gray-100 pt-[16px]">
          <label className="flex flex-col gap-[6px]">
            <span className={fieldLabel}>Cancel reason (optional)</span>
            <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Why is this being cancelled?" />
          </label>
          {/* Flowbite destructive-outline button */}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="mt-[8px] inline-flex h-[36px] items-center gap-[8px] rounded-[8px] border border-red-300 bg-white px-[14px] text-[13px] font-medium text-red-600 transition duration-75 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancel.isPending ? <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden /> : <Ban className="h-[14px] w-[14px]" aria-hidden />}
            Cancel order
          </button>
        </div>
      ) : null}
    </Card>
  );
}

/* "" Payment panel "" */

function PaymentActions({ order }: { order: AdminOrderDetail }) {
  const toast = useUIStore((s) => s.toast);
  const [status, setStatus] = React.useState<PaymentStatus>(order.payment.status);
  const [transactionId, setTransactionId] = React.useState(order.payment.transactionId ?? "");
  const [refundAmount, setRefundAmount] = React.useState<string>(
    order.payment.refundAmount ? String(order.payment.refundAmount) : "",
  );

  React.useEffect(() => {
    setStatus(order.payment.status);
    setTransactionId(order.payment.transactionId ?? "");
    setRefundAmount(order.payment.refundAmount ? String(order.payment.refundAmount) : "");
  }, [order.payment.status, order.payment.transactionId, order.payment.refundAmount]);

  const update = useUpdateOrderPayment(order._id);
  const dirty =
    status !== order.payment.status ||
    transactionId !== (order.payment.transactionId ?? "") ||
    (status === "refunded" && refundAmount !== (order.payment.refundAmount ? String(order.payment.refundAmount) : ""));

  const onSave = async () => {
    try {
      await update.mutateAsync({
        status,
        transactionId: transactionId.trim() || undefined,
        refundAmount: status === "refunded" && refundAmount ? Number(refundAmount) : undefined,
      });
      toast({ title: "Payment updated", tone: "success" });
    } catch (err) { toast({ title: err instanceof AdminError ? err.message : "Couldn't update payment", tone: "error" }); }
  };

  return (
    <Card>
      <CardTitle icon={<CreditCard className="h-[16px] w-[16px] text-gray-400" aria-hidden />}>Payment</CardTitle>
      <div className="mb-[16px] divide-y divide-gray-100 rounded-[8px] border border-gray-100 text-[14px] text-gray-600">
        <div className="flex items-center justify-between px-[12px] py-[8px]">
          <span className="text-gray-500">Method</span>
          <span className="font-medium uppercase text-gray-900">{order.payment.method}</span>
        </div>
        {order.payment.paidAt ? (
          <div className="flex items-center justify-between px-[12px] py-[8px]">
            <span className="text-gray-500">Paid at</span><span className="font-medium text-gray-900">{formatDate(order.payment.paidAt)}</span>
          </div>
        ) : null}
        {order.payment.refundedAt ? (
          <div className="flex items-center justify-between px-[12px] py-[8px]">
            <span className="text-gray-500">Refunded at</span><span className="font-medium text-gray-900">{formatDate(order.payment.refundedAt)}</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-[12px]">
        <label className="flex flex-col gap-[6px]">
          <span className={fieldLabel}>Status</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)} options={PAYMENT_OPTIONS} />
        </label>
        <label className="flex flex-col gap-[6px]">
          <span className={fieldLabel}>Transaction ID</span>
          <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Gateway reference (optional)" />
        </label>
        {status === "refunded" ? (
          <label className="flex flex-col gap-[6px]">
            <span className={fieldLabel}>Refund amount ({order.currency})</span>
            <Input type="number" min={0} step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder={String(order.total)} />
          </label>
        ) : null}
        {/* Flowbite primary button */}
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || update.isPending}
          className="inline-flex h-[36px] items-center gap-[8px] rounded-[8px] bg-[#1A56DB] px-[14px] text-[13px] font-medium text-white transition duration-75 hover:bg-[#1E429F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {update.isPending ? <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden /> :
           status === "paid" ? <CheckCircle2 className="h-[14px] w-[14px]" aria-hidden /> :
           status === "refunded" ? <Undo2 className="h-[14px] w-[14px]" aria-hidden /> :
           status === "failed" ? <XCircle className="h-[14px] w-[14px]" aria-hidden /> :
           <Clock className="h-[14px] w-[14px]" aria-hidden />}
          Save payment
        </button>
      </div>
    </Card>
  );
}

/* "" Tracking panel "" */

function TrackingActions({ order }: { order: AdminOrderDetail }) {
  const toast = useUIStore((s) => s.toast);
  const [carrier, setCarrier] = React.useState(order.tracking?.carrier ?? "");
  const [trackingNumber, setTrackingNumber] = React.useState(order.tracking?.trackingNumber ?? "");
  const [trackingUrl, setTrackingUrl] = React.useState(order.tracking?.trackingUrl ?? "");

  React.useEffect(() => {
    setCarrier(order.tracking?.carrier ?? "");
    setTrackingNumber(order.tracking?.trackingNumber ?? "");
    setTrackingUrl(order.tracking?.trackingUrl ?? "");
  }, [order.tracking?.carrier, order.tracking?.trackingNumber, order.tracking?.trackingUrl]);

  const update = useUpdateOrderTracking(order._id);
  const dirty =
    carrier !== (order.tracking?.carrier ?? "") ||
    trackingNumber !== (order.tracking?.trackingNumber ?? "") ||
    trackingUrl !== (order.tracking?.trackingUrl ?? "");

  const onSave = async () => {
    try {
      await update.mutateAsync({ carrier: carrier.trim() || undefined, trackingNumber: trackingNumber.trim() || undefined, trackingUrl: trackingUrl.trim() || undefined });
      toast({ title: "Tracking saved", tone: "success" });
    } catch (err) { toast({ title: err instanceof AdminError ? err.message : "Couldn't save tracking", tone: "error" }); }
  };

  return (
    <Card>
      <CardTitle icon={<Truck className="h-[16px] w-[16px] text-gray-400" aria-hidden />}>Shipping</CardTitle>
      <div className="flex flex-col gap-[12px]">
        <label className="flex flex-col gap-[6px]">
          <span className={fieldLabel}>Carrier</span>
          <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. Pathao, Sundarban, Steadfast" />
        </label>
        <label className="flex flex-col gap-[6px]">
          <span className={fieldLabel}>Tracking number</span>
          <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
        </label>
        <label className="flex flex-col gap-[6px]">
          <span className={fieldLabel}>Tracking URL</span>
          <Input type="url" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://" />
        </label>
        {/* Flowbite alternative button */}
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || update.isPending}
          className="inline-flex h-[36px] items-center gap-[8px] rounded-[8px] border border-gray-300 bg-white px-[14px] text-[13px] font-medium text-gray-900 transition duration-75 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {update.isPending ? <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden /> : <Truck className="h-[14px] w-[14px]" aria-hidden />}
          Save tracking
        </button>
        {order.tracking?.shippedAt ? (
          <p className="text-[13px] text-gray-500">
            Shipped {formatDate(order.tracking.shippedAt)}
            {order.tracking.deliveredAt ? ` · Delivered ${formatDate(order.tracking.deliveredAt)}` : ""}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

/* "" Page "" */

export function OrderDetailAdminClient({ id }: { id: string }) {
  const { data: order, isLoading, isError, error, refetch } = useAdminOrder(id);

  if (isLoading) {
    return <AdminDetailSkeleton lineItems={3} sidebarCards={3} />;
  }

  if (isError || !order) {
    const message = error instanceof AdminError ? error.message : "Couldn't load order.";
    return (
      <div className="flex flex-col items-center gap-[12px] rounded-[8px] border border-gray-200 bg-white py-[48px] text-center shadow-sm">
        <AlertTriangle className="h-[24px] w-[24px] text-gray-400" aria-hidden />
        <p className="text-[14px] text-gray-500">{message}</p>
        <div className="flex items-center gap-[8px]">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>Try again</Button>
          <Link href="/admin/orders" className="text-[14px] text-gray-600 underline-offset-2 hover:underline">Back to orders</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px]">
      <header className="flex flex-wrap items-start justify-between gap-[16px]">
        <div className="flex flex-col gap-[4px]">
          <Link href="/admin/orders" className="inline-flex items-center gap-[6px] text-[14px] font-medium text-gray-500 transition-colors hover:text-[#1A56DB]">
            <ArrowLeft className="h-[16px] w-[16px]" aria-hidden /> Back to orders
          </Link>
          <h1 className="font-mono text-[24px] font-bold text-gray-900">{order.orderNumber}</h1>
          <div className="flex flex-wrap items-center gap-[8px] text-[14px] text-gray-500">
            <StatusPill status={order.status} />
            <Badge variant={order.payment.status === "paid" ? "solid" : "muted"}>{order.payment.status}</Badge>
            <span>·</span>
            <time dateTime={order.createdAt}>Placed {formatDate(order.createdAt)}</time>
            {order.cancelledAt ? <><span>·</span><span>Cancelled {formatDate(order.cancelledAt)}</span></> : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-[8px] text-right">
          {/* Flowbite alternative buttons */}
          <div className="flex flex-wrap items-center justify-end gap-[8px]">
            <Link
              href={`/admin/orders/${order._id}/sticker`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-[36px] items-center gap-[8px] rounded-[8px] border border-gray-300 bg-white px-[12px] text-[13px] font-medium text-gray-900 transition duration-75 hover:bg-gray-100"
            >
              <Tag className="h-[14px] w-[14px]" aria-hidden /> Generate sticker
            </Link>
            <Link
              href={`/admin/orders/${order._id}/invoice`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-[36px] items-center gap-[8px] rounded-[8px] border border-gray-300 bg-white px-[12px] text-[13px] font-medium text-gray-900 transition duration-75 hover:bg-gray-100"
            >
              <Printer className="h-[14px] w-[14px]" aria-hidden /> Print invoice
            </Link>
          </div>
          <div className="text-[13px] text-gray-500">Total</div>
          <div className="text-[24px] font-bold tabular-nums text-gray-900">{formatMoney(order.total, order.currency)}</div>
        </div>
      </header>

      {/* Two independent scroll columns on lg: each is sticky and owns its
          own overflow, so the wheel only moves the column under the cursor
          while the other stays put. Below lg they stack and the page
          scrolls normally. 80px = topbar (64px) + main padding (16px). */}
      <section className="grid grid-cols-1 items-start gap-[16px] lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-[16px] lg:sticky lg:top-0 lg:max-h-[calc(100vh-80px)] lg:overflow-y-auto lg:pr-[4px] [scrollbar-width:thin]">
          <OrderItemsEditor order={order} />
          <OrderCustomerEditor order={order} />
          <TimelineCard events={order.timeline ?? []} />
          {order.cancelReason ? (
            <Card>
              <CardTitle>Cancellation reason</CardTitle>
              <p className="text-[14px] text-gray-700">{order.cancelReason}</p>
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-[16px] lg:sticky lg:top-0 lg:max-h-[calc(100vh-80px)] lg:overflow-y-auto lg:pr-[4px] [scrollbar-width:thin]">
          <StatusActions order={order} />
          <OrderCourierPanel order={order} />
          <PaymentActions order={order} />
          <TrackingActions order={order} />
          <DangerZone order={order} />
        </aside>
      </section>
    </div>
  );
}
