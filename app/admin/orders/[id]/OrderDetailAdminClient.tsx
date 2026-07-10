"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Ban, CheckCircle2, Clock,
  CreditCard, Loader2, Printer, Trash2, Truck, Undo2, XCircle,
} from "lucide-react";
import { Badge, Button, Input, Spinner } from "@/components/ui";
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

const STATUS_TONES: Record<string, string> = {
  pending:   "bg-neutral-100 text-neutral-700",
  confirmed: "bg-blue-50 text-blue-700",
  packed:    "bg-violet-50 text-violet-700",
  shipped:   "bg-amber-50 text-amber-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-500",
  returned:  "bg-neutral-100 text-neutral-500",
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
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STATUS_TONES[status] ?? "bg-neutral-100 text-neutral-700")}>
      {status}
    </span>
  );
}

/* "" Timeline "" */

function TimelineCard({ events }: { events: OrderTimelineEvent[] }) {
  if (!events?.length) {
    return (
      <section className="rounded-sm border border-neutral-200 bg-paper p-3">
        <h2 className="text-sm font-semibold text-ink">Timeline</h2>
        <p className="mt-1 text-sm text-neutral-500">No events yet.</p>
      </section>
    );
  }
  const ordered = [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return (
    <section className="rounded-sm border border-neutral-200 bg-paper p-3">
      <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Clock className="h-4 w-4 text-neutral-400" aria-hidden /> Timeline
      </h2>
      <ol className="flex flex-col gap-3">
        {ordered.map((ev, idx) => (
          <li key={`${ev.status}-${ev.at}-${idx}`} className="flex items-start gap-3 border-l-2 border-neutral-200 pl-4 first:border-accent/40">
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={ev.status} />
                <span className="text-xs text-neutral-500">{formatDate(ev.at)}</span>
              </div>
              {ev.note ? <p className="text-sm text-neutral-700">{ev.note}</p> : null}
              {ev.by ? <span className="text-xs text-neutral-400">by {ev.by}</span> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
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
    <section className="rounded-sm border border-red-200 bg-red-50/40 p-3">
      <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
      <p className="mt-1 text-xs text-red-600/90">
        Deleting removes this order permanently.
        {stockRestores ? " Reserved stock is added back to inventory." : ""}
      </p>
      <Button
        size="sm"
        variant="ghost"
        onClick={onDelete}
        disabled={del.isPending}
        className="mt-2 text-red-700 hover:bg-red-100"
      >
        {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
        <span className="ml-1">Delete order</span>
      </Button>
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
      <section className="rounded-sm border border-neutral-200 bg-paper p-3">
        <h2 className="text-sm font-semibold text-ink">Status</h2>
        <p className="mt-1 text-sm text-neutral-500">This order is in a terminal state — no further transitions are available.</p>
      </section>
    );
  }

  const busy = updateStatus.isPending || cancel.isPending;

  return (
    <section className="rounded-sm border border-neutral-200 bg-paper p-3">
      <h2 className="mb-4 text-sm font-semibold text-ink">Status</h2>

      {advanceTargets.length > 0 ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-neutral-500">Note (optional)</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible in the timeline" />
          </label>
          <div className="flex flex-wrap gap-2">
            {advanceTargets.map((target) => (
              <Button key={target} size="sm" onClick={() => onAdvance(target)} disabled={busy}>
                {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />}
                <span className="ml-1 capitalize">Mark {target}</span>
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {canCancel ? (
        <div className="mt-4 border-t border-neutral-100 pt-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-neutral-500">Cancel reason (optional)</span>
            <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Why is this being cancelled?" />
          </label>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy} className="mt-2">
            {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Ban className="h-4 w-4" aria-hidden />}
            <span className="ml-1">Cancel order</span>
          </Button>
        </div>
      ) : null}
    </section>
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
    <section className="rounded-sm border border-neutral-200 bg-paper p-3">
      <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <CreditCard className="h-4 w-4 text-neutral-400" aria-hidden /> Payment
      </h2>
      <div className="mb-4 divide-y divide-neutral-50 rounded-sm border border-neutral-100 text-sm text-neutral-600">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-neutral-500">Method</span>
          <span className="font-medium uppercase text-ink">{order.payment.method}</span>
        </div>
        {order.payment.paidAt ? (
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-neutral-500">Paid at</span><span className="font-medium text-ink">{formatDate(order.payment.paidAt)}</span>
          </div>
        ) : null}
        {order.payment.refundedAt ? (
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-neutral-500">Refunded at</span><span className="font-medium text-ink">{formatDate(order.payment.refundedAt)}</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-500">Status</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)} options={PAYMENT_OPTIONS} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-500">Transaction ID</span>
          <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Gateway reference (optional)" />
        </label>
        {status === "refunded" ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-neutral-500">Refund amount ({order.currency})</span>
            <Input type="number" min={0} step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder={String(order.total)} />
          </label>
        ) : null}
        <Button size="sm" onClick={onSave} disabled={!dirty || update.isPending}>
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> :
           status === "paid" ? <CheckCircle2 className="h-4 w-4" aria-hidden /> :
           status === "refunded" ? <Undo2 className="h-4 w-4" aria-hidden /> :
           status === "failed" ? <XCircle className="h-4 w-4" aria-hidden /> :
           <Clock className="h-4 w-4" aria-hidden />}
          <span className="ml-1">Save payment</span>
        </Button>
      </div>
    </section>
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
    <section className="rounded-sm border border-neutral-200 bg-paper p-3">
      <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Truck className="h-4 w-4 text-neutral-400" aria-hidden /> Shipping
      </h2>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-500">Carrier</span>
          <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. Pathao, Sundarban, Steadfast" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-500">Tracking number</span>
          <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-500">Tracking URL</span>
          <Input type="url" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://" />
        </label>
        <Button size="sm" variant="secondary" onClick={onSave} disabled={!dirty || update.isPending}>
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Truck className="h-4 w-4" aria-hidden />}
          <span className="ml-1">Save tracking</span>
        </Button>
        {order.tracking?.shippedAt ? (
          <p className="text-xs text-neutral-500">
            Shipped {formatDate(order.tracking.shippedAt)}
            {order.tracking.deliveredAt ? ` · Delivered ${formatDate(order.tracking.deliveredAt)}` : ""}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/* "" Page "" */

export function OrderDetailAdminClient({ id }: { id: string }) {
  const { data: order, isLoading, isError, error, refetch } = useAdminOrder(id);

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center rounded-sm border border-neutral-200 bg-paper"><Spinner /></div>;
  }

  if (isError || !order) {
    const message = error instanceof AdminError ? error.message : "Couldn't load order.";
    return (
      <div className="flex flex-col items-center gap-3 rounded-sm border border-neutral-200 bg-paper py-12 text-center">
        <AlertTriangle className="h-6 w-6 text-neutral-300" aria-hidden />
        <p className="text-sm text-neutral-500">{message}</p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>Try again</Button>
          <Link href="/admin/orders" className="text-sm text-neutral-600 underline-offset-2 hover:underline">Back to orders</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-ink">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to orders
          </Link>
          <h1 className="font-mono text-2xl font-semibold text-ink">{order.orderNumber}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            <StatusPill status={order.status} />
            <Badge variant={order.payment.status === "paid" ? "solid" : "muted"}>{order.payment.status}</Badge>
            <span>·</span>
            <time dateTime={order.createdAt}>Placed {formatDate(order.createdAt)}</time>
            {order.cancelledAt ? <><span>·</span><span>Cancelled {formatDate(order.cancelledAt)}</span></> : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <Link href={`/admin/orders/${order._id}/invoice`} target="_blank" rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-sm border border-neutral-200 bg-paper px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50">
            <Printer className="h-3.5 w-3.5" aria-hidden /> Print invoice
          </Link>
          <div className="text-xs text-neutral-500">Total</div>
          <div className="text-2xl font-semibold tabular-nums text-ink">{formatMoney(order.total, order.currency)}</div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <OrderItemsEditor order={order} />
          <OrderCustomerEditor order={order} />
          <TimelineCard events={order.timeline ?? []} />
          {order.cancelReason ? (
            <section className="rounded-sm border border-neutral-200 bg-paper p-3">
              <h2 className="mb-2 text-sm font-semibold text-ink">Cancellation reason</h2>
              <p className="text-sm text-neutral-700">{order.cancelReason}</p>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-5">
          <StatusActions order={order} />
          <PaymentActions order={order} />
          <TrackingActions order={order} />
          <DangerZone order={order} />
        </aside>
      </section>
    </div>
  );
}


