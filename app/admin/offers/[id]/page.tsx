import * as React from "react";
import { OfferFormClient } from "../OfferFormClient";

export default function EditOfferPage({ params }: { params: { id: string } }) {
  return <OfferFormClient mode="edit" id={params.id} />;
}
