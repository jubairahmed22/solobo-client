import * as React from "react";
import { BrandFormClient } from "../BrandFormClient";

export default function EditBrandPage({
  params,
}: {
  params: { id: string };
}) {
  return <BrandFormClient mode="edit" id={params.id} />;
}
