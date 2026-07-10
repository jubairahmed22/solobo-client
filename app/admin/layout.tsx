import * as React from "react";
import type { Metadata } from "next";
import { AdminShell } from "./AdminShell";
import { COMPANY } from "@/lib/entity/company";
import { AdminAuthGate } from "./AdminAuthGate";

export const metadata: Metadata = {
  title: { template: `%s - ${COMPANY.name} Admin`, default: `Dashboard - ${COMPANY.name} Admin` },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGate>
      <AdminShell>{children}</AdminShell>
    </AdminAuthGate>
  );
}
