"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Package } from "lucide-react";
import { Spinner, Badge } from "@/components/ui";
import { buttonVariants } from "@/components/ui/Button";
import { Pagination } from "@/components/composed";
import { useOrders } from "@/hooks/useCommerce";
import { formatPrice, formatDate } from "@/lib/utils/format";
import type { OrderStatus } from "@/types/commerce";

const PAGE_SIZE = 10;

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export function OrdersListClient() {
  const router = useRouter();
  const { status } = useSession();
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?next=/account/orders");
    }
  }, [status, router]);

  const { data, isLoading } = useOrders({ page, limit: PAGE_SIZE, sort: "newest" });

  if (status === "loading" || isLoading) {
    return (
      <div className="mt-3 flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const orders = data?.data ?? [];
  const meta = data?.meta;

  if (orders.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center gap-1 rounded-md border border-neutral-200 bg-paper py-8 text-center">
        <Package className="h-6 w-6 text-neutral-400" aria-hidden />
        <p className="text-base font-medium">No orders yet</p>
        <p className="text-sm text-neutral-600">When you place an order, it&apos;ll show up here.</p>
        <Link href="/all-products" className={buttonVariants({ variant: "primary", size: "md", className: "mt-1" })}>
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <ul className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-paper">
        {orders.map((o) => (
          <li key={o._id}>
            <Link
              href={`/account/orders/${o.orderNumber}`}
              className="flex flex-col gap-1 p-3 transition-colors hover:bg-neutral-50 sm:p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-ink">{o.orderNumber}</span>
                <Badge variant="outline">{STATUS_LABEL[o.status]}</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600">
                <span>
                  {formatDate(o.createdAt)} · {o.items.length} item{o.items.length === 1 ? "" : "s"}
                </span>
                <span className="font-medium text-ink">{formatPrice(o.total, o.currency)}</span>
              </div>
              <div className="line-clamp-1 text-xs text-neutral-500">
                {o.items.map((it) => it.title).join(", ")}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {meta && meta.totalPages > 1 ? (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
          className="mt-2 self-center"
        />
      ) : null}
    </div>
  );
}
