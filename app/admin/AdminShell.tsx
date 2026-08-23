"use client";

import * as React from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopBar } from "./AdminTopBar";
import { AdminCommandPalette } from "./AdminCommandPalette";

const STORAGE_KEY = "pm:admin:sidebar-collapsed";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "1") setCollapsed(true);
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed, hydrated]);

  const toggleCollapse = React.useCallback(() => setCollapsed((p) => !p), []);
  const toggleMobile = React.useCallback(() => setMobileOpen((p) => !p), []);
  const closeMobile = React.useCallback(() => setMobileOpen(false), []);

  /* The admin is a fixed-height app frame: only the inner <main> scrolls.
   * Globally-mounted storefront chrome (mounted from the root layout for
   * every route) can otherwise leave stray height on <body>, which lets the
   * whole shell scroll out of view and exposes a blank band beneath it.
   * Locking body overflow while the shell is mounted makes that impossible;
   * the storefront's scrolling is restored on unmount. */
  React.useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <AdminCommandPalette>
      {/* print:block + print:h-auto/overflow-visible release the fixed-
          viewport app-frame layout (flex/h-dvh/overflow-hidden) that's
          correct on screen but would otherwise clip or reflow print output
          to the current scroll position. Sidebar/topbar are print:hidden
          outright - no admin chrome belongs in a printed invoice/sticker. */}
      <div className="flex h-dvh overflow-hidden bg-neutral-50 print:block print:h-auto print:overflow-visible">
        <div className="print:hidden">
          <AdminSidebar
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            onMobileClose={closeMobile}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:block print:overflow-visible">
          <div className="print:hidden">
            <AdminTopBar
              collapsed={collapsed}
              onToggleCollapse={toggleCollapse}
              onToggleMobile={toggleMobile}
            />
          </div>
          <main className="admin-layout flex-1 overflow-y-auto p-[16px] print:overflow-visible print:p-0">
            {children}
          </main>
        </div>
      </div>
    </AdminCommandPalette>
  );
}
