import * as React from "react";
import { CategoryFormClient } from "../CategoryFormClient";

export default function EditCategoryPage({
  params,
}: {
  params: { id: string };
}) {
  return <CategoryFormClient mode="edit" id={params.id} />;
}
