import * as React from "react";
import { AdminDashboardClient } from "./AdminDashboardClient";

/**
 * /admin - landing for the admin section. The actual fetch is client-side so
 * we can render the AdminAuthGate first; an unauth user should never trigger
 * a privileged data fetch.
 */
export default function AdminHomePage() {
  return <AdminDashboardClient />;
}
