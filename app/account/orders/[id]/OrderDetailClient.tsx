"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Printer, RotateCcw, X } from "lucide-react";
import { Spinner, Badge, Button } from "@/components/ui";
import { Modal } from "@/components/complex/Modal";
import {
  useOrder,
  useCancelOrder,
  useRequestReturn,
} from "@/hooks/useCommerce";
import { useUIStore } from "@/store/uiStore";
import { formatPrice, formatDateTime } from "@/lib/utils/format";
import type {
  Order,
  OrderItem,
  OrderStatus,
  ReturnRequest,
} from "@/types/commerce";

export interface OrderDetailClientProps {
  orderId: string;
}

const STATUS_STEPS: OrderStatus[] = ["pending", "confirmed", "packed", "shipped", "delivered"];
const CANCELLABLE: OrderStatus[] = ["pending", "confirmed"];

/**
 * Buyers can request a return up to this many days after delivery -
 * the server is the source of truth, this is just here to render a
 * friendly hint in the UI. Keep it in sync with `RETURN_WINDOW_DAYS`
 * in `backend/src/controllers/order.controller.ts`.
 */
const RETURN_WINDOW_DAYS = 14;

export function OrderDetailClient({ orderId }: OrderDetailClientProps) {
  const router = useRouter();
  const { status } = useSession();
  const toast = useUIStore((s) => s.toast);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=/account/orders/${orderId}`);
    }
  }, [status, router, orderId]);

  const { data: order, isLoading, isError } = useOrder(orderId);
  const cancelMut = useCancelOrder();
  const requestReturn = useRequestReturn();
  const [returnOpen, setReturnOpen] = React.useState(false);

  if (status === "loading" || isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="mt-4 flex flex-col items-center gap-1 rounded-md border border-neutral-200 bg-paper py-8 text-center">
        <p className="text-base font-medium">Order not found</p>
        <Link href="/account/orders" className="text-sm underline">Back to orders</Link>
      </div>
    );
  }

  const onCancel = () => {
    if (!confirm("Cancel this order? Stock will be released and any payment refunded.")) return;
    cancelMut.mutate(
      { id: order._id, reason: "Customer requested cancellation" },
      {
        onSuccess: () => toast({ title: "Order cancelled", tone: "success" }),
        onError: (e: unknown) =>
          toast({
            title: "Could not cancel",
            description: e instanceof Error ? e.message : undefined,
            tone: "error",
          }),
      },
    );
  };

  const isCancellable = CANCELLABLE.includes(order.status as OrderStatus);

  // Eligibility for a return request - server still validates strictly,
  // we just hide the button when there's no chance it'll succeed so the
  // UI doesn't dangle a useless CTA.
  const deliveredAt =
    order.tracking?.deliveredAt ??
    [...order.timeline]
      .reverse()
      .find((t) => t.status === "delivered" && t.at)?.at;
  const withinWindow = deliveredAt
    ? Date.now() - new Date(deliveredAt).getTime() <=
      RETURN_WINDOW_DAYS * 86400_000
    : false;
  const activeRequest =
    order.returnRequest &&
    (order.returnRequest.status === "requested" ||
      order.returnRequest.status === "approved");
  const isReturnable =
    order.status === "delivered" && withinWindow && !activeRequest;

  return (
    <div className="flex flex-col gap-2">
      <Link href="/account/orders" className="inline-flex w-fit items-center gap-1.5 text-sm text-neutral-600 transition-colors hover:text-ink hover:underline">
        <ArrowLeft className="h-4 w-4" /> All orders
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Order {order.orderNumber}</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Placed on {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/account/orders/${order._id}/invoice`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <Printer className="h-4 w-4" aria-hidden />
            Print invoice
          </Link>
          <Badge variant="outline">{order.status.toUpperCase()}</Badge>
        </div>
      </header>

      <StatusTimeline order={order} />

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_280px] lg:grid-cols-[1fr_320px]">
        {/* Left column - items */}
        <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-paper p-4">
          <h2 className="text-base font-semibold text-ink">Items</h2>
          <ul className="flex flex-col divide-y divide-neutral-100">
            {order.items.map((it) => (
              <li key={it._id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <Link
                  href={`/product/${it.slug}`}
                  className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50"
                >
                  {it.image ? (
                    <Image src={it.image} alt={it.title} fill sizes="64px" className="object-cover" />
                  ) : null}
                </Link>
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <Link href={`/product/${it.slug}`} className="line-clamp-2 text-sm font-semibold text-ink hover:underline">
                    {it.title}
                  </Link>
                  {it.options && Object.keys(it.options).length > 0 ? (
                    <p className="text-xs text-neutral-500">
                      {Object.entries(it.options).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                    </p>
                  ) : null}
                  <p className="text-xs text-neutral-500">Qty {it.qty}</p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <div className="font-semibold text-ink">{formatPrice(it.lineTotal, order.currency)}</div>
                  {it.originalPrice && it.originalPrice > it.price ? (
                    <div className="text-xs text-neutral-400 line-through">
                      {formatPrice(it.originalPrice * it.qty, order.currency)}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Right column - meta */}
        <aside className="flex flex-col gap-3 self-start md:sticky md:top-20">
          <Card title="Totals">
            <Row label="Subtotal" value={formatPrice(order.subtotal, order.currency)} />
            <Row label="Shipping" value={formatPrice(order.shippingCost, order.currency)} />
            {order.tax > 0 ? <Row label="Tax" value={formatPrice(order.tax, order.currency)} /> : null}
            {order.discount > 0 ? (
              <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`− ${formatPrice(order.discount, order.currency)}`} />
            ) : null}
            <Row label="Total" value={formatPrice(order.total, order.currency)} strong />
          </Card>

          <Card title="Shipping address">
            <div className="text-sm text-neutral-700">
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.district}
              {order.shippingAddress.postalCode ? ` ${order.shippingAddress.postalCode}` : ""}
              <br />
              {order.shippingAddress.country ?? "BD"}
              <br />
              {order.shippingAddress.phone}
            </div>
          </Card>

          <Card title="Payment">
            <div className="text-sm capitalize text-neutral-700">
              <div>{order.payment.method.replace("_", " ")}</div>
              <div className="text-neutral-500">Status: {order.payment.status}</div>
              {order.payment.transactionId ? (
                <div className="break-all text-xs text-neutral-500">Txn: {order.payment.transactionId}</div>
              ) : null}
            </div>
          </Card>

          {order.tracking?.trackingNumber ? (
            <Card title="Tracking">
              <div className="text-sm text-neutral-700">
                {order.tracking.carrier ? <div>{order.tracking.carrier}</div> : null}
                <div>{order.tracking.trackingNumber}</div>
                {order.tracking.trackingUrl ? (
                  <a
                    href={order.tracking.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline"
                  >
                    Track on carrier site →
                  </a>
                ) : null}
              </div>
            </Card>
          ) : null}

          {order.returnRequest ? (
            <ReturnStatusCard request={order.returnRequest} order={order} />
          ) : null}

          {isCancellable ? (
            <Button variant="secondary" onClick={onCancel} loading={cancelMut.isPending} fullWidth>
              <X className="h-4 w-4" />
              <span className="ml-1.5">Cancel order</span>
            </Button>
          ) : null}

          {isReturnable ? (
            <Button
              variant="secondary"
              onClick={() => setReturnOpen(true)}
              fullWidth
            >
              <RotateCcw className="h-4 w-4" />
              <span className="ml-1.5">Request return</span>
            </Button>
          ) : null}
        </aside>
      </div>

      <RequestReturnModal
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        order={order}
        loading={requestReturn.isPending}
        onSubmit={(input) => {
          requestReturn.mutate(
            { id: order._id, input },
            {
              onSuccess: () => {
                toast({ title: "Return request submitted", tone: "success" });
                setReturnOpen(false);
              },
              onError: (e: unknown) =>
                toast({
                  title: "Couldn't submit return",
                  description:
                    e instanceof Error ? e.message : undefined,
                  tone: "error",
                }),
            },
          );
        }}
      />
    </div>
  );
}

/* ───────────── Return status card ───────────── */

/**
 * Shown to the buyer whenever an order has a `returnRequest`. We render
 * a tone-appropriate badge ("Pending review" / "Approved - refund
 * issued" / "Rejected") plus the reason and decision note. After a
 * rejection the buyer can resubmit; we surface that affordance via the
 * normal "Request return" button which becomes available again because
 * `activeRequest` only blocks `requested` and `approved`.
 */
function ReturnStatusCard({
  request,
  order,
}: {
  request: ReturnRequest;
  order: Order;
}) {
  const headline =
    request.status === "requested"
      ? "Return requested"
      : request.status === "approved"
        ? "Return approved"
        : "Return rejected";
  const blurb =
    request.status === "requested"
      ? "The seller is reviewing your request. You'll get an email once they respond."
      : request.status === "approved"
        ? "Your refund has been processed. If you paid by COD, the seller will reach out about how to collect it."
        : "The seller rejected this return. You can submit a new request with more detail if needed.";

  // Map item ids back to titles so the buyer can see at a glance which
  // lines they asked back. Items not on the order anymore (shouldn't
  // happen, but just in case) get a generic fallback.
  const titleById = new Map(order.items.map((it) => [it._id, it.title]));

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-paper p-4">
      <h3 className="text-sm font-semibold text-ink">{headline}</h3>
      <p className="text-xs text-neutral-600">{blurb}</p>
      {request.reason ? (
        <div className="rounded-lg bg-neutral-50 px-3 py-2.5 text-xs text-neutral-700">
          <div className="mb-0.5 font-semibold text-ink">Your reason</div>
          <p className="whitespace-pre-line">{request.reason}</p>
        </div>
      ) : null}
      {request.items?.length ? (
        <ul className="flex flex-col gap-1 text-xs text-neutral-700">
          {request.items.map((li) => (
            <li key={li.itemId} className="flex items-center justify-between">
              <span className="line-clamp-1">{titleById.get(li.itemId) ?? "Item"}</span>
              <span className="tabular-nums text-neutral-600">× {li.qty}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {request.decisionNote ? (
        <div className="rounded-lg bg-neutral-50 px-3 py-2.5 text-xs text-neutral-700">
          <div className="mb-0.5 font-semibold text-ink">Seller note</div>
          <p className="whitespace-pre-line">{request.decisionNote}</p>
        </div>
      ) : null}
    </section>
  );
}

/* ───────────── Request return modal ───────────── */

interface RequestReturnModalProps {
  open: boolean;
  onClose: () => void;
  order: Order;
  loading?: boolean;
  onSubmit: (input: { reason: string; items: { itemId: string; qty: number }[] }) => void;
}

/**
 * Per-line return picker. Each row carries a checkbox (include / skip)
 * and a qty stepper capped at the original line qty. The submit button
 * stays disabled until at least one item is selected and the reason
 * field is non-empty - the same constraints the server enforces, so
 * the user doesn't bounce off a 400.
 */
function RequestReturnModal({
  open,
  onClose,
  order,
  loading = false,
  onSubmit,
}: RequestReturnModalProps) {
  const [reason, setReason] = React.useState("");
  const [picks, setPicks] = React.useState<Record<string, number>>({});

  // Reset state whenever the modal re-opens against a fresh order.
  React.useEffect(() => {
    if (!open) return;
    setReason("");
    setPicks({});
  }, [open, order._id]);

  const togglePick = (item: OrderItem) => {
    setPicks((prev) => {
      const next = { ...prev };
      if (item._id in next) delete next[item._id];
      else next[item._id] = item.qty;
      return next;
    });
  };

  const setQty = (item: OrderItem, qty: number) => {
    setPicks((prev) => ({
      ...prev,
      [item._id]: Math.max(1, Math.min(item.qty, qty)),
    }));
  };

  const selectedIds = Object.keys(picks);
  const canSubmit = selectedIds.length > 0 && reason.trim().length > 0 && !loading;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      reason: reason.trim(),
      items: selectedIds.map((id) => ({ itemId: id, qty: picks[id]! })),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request a return"
      description="Pick the items you'd like to return and tell us why. The seller has 14 days from delivery to honour returns."
      size="lg"
    >
      <div className="flex flex-col gap-3">
        <section className="flex flex-col gap-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Items to return</div>
          <ul className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {order.items.map((it) => {
              const checked = it._id in picks;
              const qty = picks[it._id] ?? it.qty;
              return (
                <li key={it._id} className="flex items-center gap-3 p-3">
                  <input
                    id={`pick-${it._id}`}
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePick(it)}
                    className="h-4 w-4 accent-ink"
                  />
                  <label
                    htmlFor={`pick-${it._id}`}
                    className="flex flex-1 min-w-0 cursor-pointer flex-col"
                  >
                    <span className="line-clamp-1 text-sm font-medium text-ink">{it.title}</span>
                    <span className="text-xs text-neutral-500">
                      Ordered {it.qty}
                      {it.options && Object.keys(it.options).length > 0
                        ? ` · ${Object.entries(it.options)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")}`
                        : ""}
                    </span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={it.qty}
                    value={qty}
                    onChange={(e) => setQty(it, Number(e.target.value) || 1)}
                    disabled={!checked}
                    aria-label={`Qty to return for ${it.title}`}
                    className="w-14 rounded-lg border border-neutral-200 bg-paper px-2 py-1.5 text-center text-sm focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1 disabled:bg-neutral-50 disabled:text-neutral-400"
                  />
                </li>
              );
            })}
          </ul>
        </section>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Reason</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What went wrong? The more detail you give the faster the seller can approve."
            rows={4}
            maxLength={1000}
            className="w-full rounded-xl border border-neutral-200 bg-paper px-3 py-2.5 text-sm placeholder:text-neutral-400 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1"
          />
        </label>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} loading={loading}>
            Submit request
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────── helpers ───────────── */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-paper p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${strong ? "border-t border-neutral-100 pt-2 font-bold text-ink" : ""}`}>
      <span className={strong ? "text-ink" : "text-neutral-600"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function StatusTimeline({ order }: { order: Order }) {
  if (order.status === "cancelled" || order.status === "returned") {
    return (
      <div className="rounded-xl border border-neutral-200 bg-paper p-4 text-sm">
        <div className="font-semibold capitalize text-ink">{order.status}</div>
        {order.cancelReason ? <div className="mt-0.5 text-neutral-600">Reason: {order.cancelReason}</div> : null}
      </div>
    );
  }

  const currentIdx = Math.max(0, STATUS_STEPS.indexOf(order.status as OrderStatus));
  return (
    <ol className="flex items-center overflow-x-auto rounded-xl border border-neutral-200 bg-paper px-4 py-3">
      {STATUS_STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const current = idx === currentIdx;
        return (
          <li key={step} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                  done ? "border-ink bg-ink text-paper" : "border-neutral-300 text-neutral-400"
                }`}
              >
                {idx + 1}
              </span>
              <span className={`text-[10px] capitalize sm:text-xs ${current ? "font-semibold text-ink" : "text-neutral-500"}`}>
                {step}
              </span>
            </div>
            {idx < STATUS_STEPS.length - 1 ? (
              <span className={`mx-1 h-px flex-1 ${done && idx < currentIdx ? "bg-ink" : "bg-neutral-200"}`} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
