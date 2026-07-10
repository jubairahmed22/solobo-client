import * as React from "react";
import { CategoryFormClient } from "../CategoryFormClient";

export default function NewCategoryPage() {
  return (
    <React.Suspense>
      <CategoryFormClient mode="create" />
    </React.Suspense>
  );
}
