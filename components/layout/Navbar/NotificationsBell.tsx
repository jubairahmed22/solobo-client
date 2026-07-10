"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Check,
  Info,
  Package,
  RotateCcw,
  ShoppingBag,
  Star,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/hooks/useAuth";
import { useEscape } from "@/hooks/useEscape";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/hooks/useNotifications";
import type { Notification } from "@/types/notification";

/**
 * Navbar bell - opens a panel listing recent in-app notifications.
 *
 * The list query is mounted lazily (only when the panel is open) so we don't
 * hammer /notifications for the 99% of the time the panel is closed. The
 * unread-count query keeps polling at 60s in the background to drive the
 * badge - that endpoint is a single indexed countDocuments call so it's
 * effectively free.
 *
 * For unauthenticated users we render nothing (a bell with no notifications
 * is just noise on the marketing pages, and we don't want the polling
 * heartbeat to fire 401s into the console).
 */
export function NotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // Gate the polling heartbeat on authenticated sessions. Anonymous users
  // skip the request entirely.
  const { data: unread } = useUnreadNotificationCount({ enabled: !!user });
  const unreadCount = unread?.count ?? 0;

  useEscape(() => setOpen(false), open);

  // Close on outside click - same pattern as the Dropdown complex component
  // but inlined here because the panel has a richer body than DropdownMenu.
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!user) return null;

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Notifications - ${unreadCount} unread`
            : "Notifications"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-[40px] w-[40px] items-center justify-center rounded-full text-paper transition-colors hover:bg-white/10"
      >
        <Bell className="h-[22px] w-[22px]" aria-hidden />
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 inline-flex h-2 w-2 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-paper tabular-nums"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-40 mt-1 w-[20rem] overflow-hidden rounded-xl border border-neutral-200 bg-paper shadow-lg sm:w-[22rem]"
          >
            <NotificationsPanel onItemClick={() => setOpen(false)} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Panel body - mounted only when the bell is open so the list endpoint is
 * idle the rest of the time. React Query's cache means re-opening within
 * staleTime (15s) returns instantly from cache without a network round-trip.
 */
function NotificationsPanel({ onItemClick }: { onItemClick: () => void }) {
  const { data, isLoading, isError } = useNotifications({ limit: 20 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.data.notifications ?? [];
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2.5">
        <span className="text-sm font-semibold text-ink">Notifications</span>
        <button
          type="button"
          disabled={!hasUnread || markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-neutral-700 transition-colors duration-hover ease-out hover:bg-neutral-100 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
          Mark all read
        </button>
      </div>

      <div className="max-h-[24rem] overflow-y-auto">
        {isLoading ? (
          <div className="px-1.5 py-2 text-sm text-neutral-500">Loading…</div>
        ) : isError ? (
          <div className="px-1.5 py-2 text-sm text-neutral-500">
            Couldn&apos;t load notifications.
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-1.5 py-3 text-center text-sm text-neutral-500">
            No notifications yet.
          </div>
        ) : (
          <ul className="flex flex-col">
            {notifications.map((n) => {
              const { Icon, title, body, href } = describe(n);
              // Click handler: mark the row read (fire-and-forget) and close
              // the panel. Navigation, if any, is handled by the Link wrapper.
              const onClick = () => {
                if (!n.read) markRead.mutate(n._id);
                onItemClick();
              };
              const inner = (
                <div
                  className={cn(
                    "flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors duration-hover ease-out",
                    "hover:bg-neutral-100",
                    n.read ? "text-neutral-700" : "bg-neutral-50 text-ink",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      n.read
                        ? "bg-neutral-100 text-neutral-500"
                        : "bg-ink text-paper",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm",
                        n.read ? "font-medium" : "font-semibold",
                      )}
                    >
                      {title}
                    </p>
                    {body ? (
                      <p className="truncate text-xs text-neutral-500">{body}</p>
                    ) : null}
                    <p className="text-[10px] text-neutral-400">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </div>
              );
              return (
                <li
                  key={n._id}
                  className="border-b border-neutral-100 last:border-b-0"
                >
                  {href ? (
                    <Link href={href} onClick={onClick} className="block">
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={onClick}
                      className="block w-full"
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ───────────────────── Renderer helpers ───────────────────── */

/**
 * Time-ago label tuned for the notifications list - we want recency, not
 * precision. Anything older than a week falls back to weeks; older than that
 * is rare enough in practice we don't bother with months/years here.
 */
function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, Date.now() - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  return `${wk}w ago`;
}

function formatMoney(amount: number, currency: string): string {
  if (currency === "BDT") return `Tk ${amount.toLocaleString("en-IN")}`;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US")}`;
  }
}

interface DescribedNotification {
  // See AccountSidebar.tsx for why we use `LucideIcon` here rather than a
  // hand-rolled ComponentType - Booleanish vs boolean variance on aria-hidden.
  Icon: LucideIcon;
  title: string;
  body?: string;
  href?: string;
}

/**
 * Map a notification onto presentation primitives. Each type is handled
 * defensively - we only narrow `payload` after the type check, and every
 * field access goes through optional chaining because the server is the
 * source of truth and we don't want a malformed legacy row to crash the
 * panel for the whole user.
 *
 * Deep-link destinations:
 *   - order_placed   → /admin/orders/[id] (admin now owns fulfilment)
 *   - order_status   → /account/orders/[id] (sent to buyers)
 *   - review_new     → /admin/reviews (admin moderation surface)
 *   - return_update  → /admin/orders/[id] when `requested` (operator audience),
 *                      /account/orders/[id] when `approved`/`rejected` (buyer)
 *   - stock_low      → /admin/products/[slug] (admin product detail -
 *                      restock happens here now that the seller surface is gone)
 *   - system         → no link (button surface, marks read in place)
 */
function describe(n: Notification): DescribedNotification {
  switch (n.type) {
    case "order_placed": {
      const p = n.payload as {
        orderNumber?: string;
        itemCount?: number;
        subtotal?: number;
        currency?: string;
      };
      const items = p.itemCount ?? 0;
      const itemsLabel = `${items} ${items === 1 ? "item" : "items"}`;
      const money =
        typeof p.subtotal === "number" && p.currency
          ? formatMoney(p.subtotal, p.currency)
          : undefined;
      return {
        Icon: ShoppingBag,
        title: p.orderNumber ? `New order ${p.orderNumber}` : "New order",
        body: money ? `${itemsLabel} · ${money}` : itemsLabel,
        href: n.order ? `/admin/orders/${n.order}` : undefined,
      };
    }
    case "order_status": {
      const p = n.payload as { orderNumber?: string; newStatus?: string };
      const label = p.newStatus ?? "updated";
      return {
        Icon: Package,
        title: p.orderNumber
          ? `Order ${p.orderNumber} is now ${label}`
          : `Order is now ${label}`,
        href: n.order ? `/account/orders/${n.order}` : undefined,
      };
    }
    case "review_new": {
      const p = n.payload as { productTitle?: string; rating?: number };
      const star = typeof p.rating === "number" ? `${p.rating}★ ` : "";
      return {
        Icon: Star,
        title: `New ${star}review`.trim(),
        body: p.productTitle,
        href: "/admin/reviews",
      };
    }
    case "return_update": {
      // Two audiences hit this same notification type:
      //   - `requested` is fanned out to sellers when a buyer files an RMA
      //   - `approved`/`rejected` is sent to the buyer when a decision lands
      // We branch the deep link on returnStatus so each side lands on the
      // page where they can actually act on it. Copy is kept terse - the
      // detail (reason vs. note) goes in the body line.
      const p = n.payload as {
        orderNumber?: string;
        returnStatus?: "requested" | "approved" | "rejected";
        reason?: string;
        note?: string;
      };
      const audienceIsSeller = p.returnStatus === "requested";
      const titleMap = {
        requested: "Return requested",
        approved: "Return approved",
        rejected: "Return rejected",
      } as const;
      const base = p.returnStatus ? titleMap[p.returnStatus] : "Return update";
      return {
        Icon: RotateCcw,
        title: p.orderNumber ? `${base} - ${p.orderNumber}` : base,
        body: p.note ?? p.reason,
        href: n.order
          ? audienceIsSeller
            ? `/admin/orders/${n.order}`
            : `/account/orders/${n.order}`
          : undefined,
      };
    }
    case "stock_low": {
      // Seller-only alert. Out-of-stock (remaining === 0) gets a slightly
      // more urgent headline; otherwise we say "Low stock" + remaining
      // count. Variant label is appended after the title when present so
      // sellers with many variants can identify the SKU at a glance.
      const p = n.payload as {
        productId?: string;
        productTitle?: string;
        variantLabel?: string;
        remaining?: number;
        threshold?: number;
      };
      const remaining = typeof p.remaining === "number" ? p.remaining : -1;
      const head = remaining === 0 ? "Out of stock" : "Low stock";
      const productLabel = p.productTitle
        ? `${p.productTitle}${p.variantLabel ? ` · ${p.variantLabel}` : ""}`
        : "a product";
      const remainingLabel =
        remaining < 0
          ? undefined
          : remaining === 0
            ? "0 units left"
            : remaining === 1
              ? "1 unit left"
              : `${remaining} units left`;
      return {
        Icon: AlertTriangle,
        title: `${head} - ${productLabel}`,
        body: remainingLabel,
        href: p.productId ? `/admin/products/${p.productId}` : undefined,
      };
    }
    case "system": {
      const p = n.payload as { title?: string; message?: string };
      return {
        Icon: Info,
        title: p.title ?? "Notice",
        body: p.message,
      };
    }
    default:
      return { Icon: Info, title: "Notification" };
  }
}
