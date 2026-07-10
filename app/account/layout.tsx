import * as React from "react";
import { Navbar, Footer } from "@/components/layout";
import { AccountSidebar } from "./AccountSidebar";
import { AccountAuthGate } from "./AccountAuthGate";

/**
 * Shared shell for /account/*. Renders the standard storefront chrome plus a
 * left-rail navigation that links to the account sub-pages. The actual auth
 * gate is a client component so layout.tsx can stay a Server Component (and
 * `metadata` keeps working). The gate redirects unauth users to /login with a
 * preserved next= param.
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Navbar />
      <main className="container-screen flex-1 py-3">
        <AccountAuthGate>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
            <AccountSidebar />
            <div className="min-w-0">{children}</div>
          </div>
        </AccountAuthGate>
      </main>
      <Footer />
    </div>
  );
}
