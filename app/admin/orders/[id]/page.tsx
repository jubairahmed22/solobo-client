import * as React from "react";
import { OrderDetailAdminClient } from "./OrderDetailAdminClient";

export default function AdminOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <OrderDetailAdminClient id={params.id} />;
}
