"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Loader2, MoreVertical, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Portal-based dropdown menu for admin table rows (products, orders, ...).
 * Renders to `document.body` and positions itself from the trigger's own
 * bounding rect rather than relying on in-flow `absolute` positioning,
 * because these menus live inside `overflow-x-auto` table wrappers - per
 * the CSS overflow spec, setting `overflow-x` to anything but `visible`
 * forces `overflow-y` to compute to `auto` too, so a plain in-flow dropdown
 * would get silently clipped for every row near the bottom of that
 * container. Flips above the trigger when there isn't enough room below.
 *
 * Defaults to a "..." icon trigger (the row-actions-menu use case); pass
 * `children` to render something else as the trigger (e.g. a status badge)
 * - the outer `<button>` (ref, click handling, aria attributes) stays
 * owned by this component either way.
 */

export interface FloatingMenuItem {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

export interface FloatingMenuProps {
  items: FloatingMenuItem[];
  children?: React.ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  menuWidth?: number;
  disabled?: boolean;
}

const DEFAULT_TRIGGER_CLASS =
  "inline-flex h-[32px] w-[32px] items-center justify-center rounded-[8px] text-gray-500 transition duration-75 hover:bg-gray-100 hover:text-gray-900";

export function FloatingMenu({
  items,
  children,
  triggerClassName,
  triggerLabel = "More actions",
  menuWidth = 192,
  disabled,
}: FloatingMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const estimatedHeight = items.length * 36 + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < estimatedHeight ? rect.top - estimatedHeight - 4 : rect.bottom + 4;
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    setCoords({ top, left });
    setOpen(true);
  };

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onViewportChange = () => setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          open ? setOpen(false) : openMenu();
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        className={cn(triggerClassName ?? DEFAULT_TRIGGER_CLASS, disabled && "cursor-not-allowed opacity-50")}
      >
        {children ?? <MoreVertical className="h-[16px] w-[16px]" aria-hidden />}
      </button>
      {mounted && open && coords
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ position: "fixed", top: coords.top, left: coords.left, width: menuWidth }}
              className="z-50 overflow-hidden rounded-[8px] border border-gray-200 bg-white py-[4px] shadow-lg"
            >
              {items.map((item, i) =>
                item.href ? (
                  <Link
                    key={i}
                    href={item.href}
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                    }}
                    className="flex items-center gap-[8px] px-[12px] py-[8px] text-[13px] font-medium text-gray-700 transition duration-75 hover:bg-gray-50"
                  >
                    <item.icon className="h-[14px] w-[14px]" aria-hidden />
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={i}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      item.onClick?.();
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-[8px] px-[12px] py-[8px] text-left text-[13px] font-medium transition duration-75 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50",
                      item.destructive ? "text-red-600" : "text-gray-700",
                    )}
                  >
                    {item.loading ? (
                      <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden />
                    ) : (
                      <item.icon className="h-[14px] w-[14px]" aria-hidden />
                    )}
                    {item.label}
                  </button>
                ),
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
