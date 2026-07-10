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

  return (
    <AdminCommandPalette>
      <div className="flex h-screen overflow-hidden bg-neutral-50">
        <AdminSidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onMobileClose={closeMobile}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AdminTopBar
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
            onToggleMobile={toggleMobile}
          />
          <main className="admin-layout flex-1 overflow-y-auto p-4 md:p-5 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </AdminCommandPalette>
  );
}
