import * as React from "react";
import { Navbar } from "./Navbar";
import { DashboardSidebar, type DashboardSidebarProps } from "./DashboardSidebar";
import { cn } from "@/lib/utils/cn";

export interface DashboardLayoutProps {
  role: DashboardSidebarProps["role"];
  children: React.ReactNode;
  /** Optional page header rendered above the main content. */
  header?: React.ReactNode;
  className?: string;
}

/**
 * Standard dashboard shell - Navbar across the top, role-based sidebar on md+,
 * children fill the rest. Mobile collapses sidebar; users navigate via the navbar drawer.
 */
export function DashboardLayout({ role, header, children, className }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Navbar />
      <div className="flex flex-1">
        <DashboardSidebar role={role} />
        <main className={cn("flex-1 px-2 py-3 md:px-4 md:py-4", className)}>
          {header ? <div className="mb-3">{header}</div> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
