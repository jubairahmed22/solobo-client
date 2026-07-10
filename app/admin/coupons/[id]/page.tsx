import * as React from "react";
import { CouponFormClient } from "../CouponFormClient";

export default function EditCouponPage({
  params,
}: {
  params: { id: string };
}) {
  return <CouponFormClient mode="edit" id={params.id} />;
}
