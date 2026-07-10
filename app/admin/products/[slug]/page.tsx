import * as React from "react";
import { ProductEditAdminClient } from "./ProductEditAdminClient";

export default function AdminProductEditPage({
  params,
}: {
  params: { slug: string };
}) {
  return <ProductEditAdminClient slug={params.slug} />;
}
