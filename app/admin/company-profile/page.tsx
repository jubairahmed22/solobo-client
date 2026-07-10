import * as React from "react";
import { CompanyProfileForm } from "./CompanyProfileForm";

/**
 * /admin/company-profile - singleton storefront identity editor.
 *
 * Lets admins manage the company name/title/logo/short description, the two
 * delivery charges (inside/outside Dhaka) plus a free-shipping threshold,
 * the contact card (email, phones, address, social URLs), the long-form
 * policy pages (terms, return, shipping), and the FAQ list.
 *
 * The form is a single client component (no SSR fetch) - admin surfaces are
 * never indexed and the form needs React Query + react-hook-form to drive
 * dirty-state and partial saves.
 */
export default function CompanyProfilePage() {
  return <CompanyProfileForm />;
}
