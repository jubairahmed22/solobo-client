"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Storefront-wide deterrent against casual image saving/copying: blocks the
 * right-click context menu and native drag-and-drop specifically on <img>
 * elements. Paired with the global CSS in globals.css (`-webkit-user-drag`,
 * `-webkit-touch-callout`) that stops Safari/Chrome drag-to-desktop saves
 * and the iOS long-press "Save Image" menu.
 *
 * Be honest about what this is: a deterrent, not real protection. A
 * browser must download an image's bytes to display it at all, so
 * DevTools' Network tab, "View Page Source", a screenshot, or simply
 * disabling JavaScript all bypass this trivially. It only raises the bar
 * against a casual right-click-save by an ordinary visitor - it cannot stop
 * a determined one, and nothing client-side ever can.
 *
 * Skipped on /admin/* - staff need normal access to their own uploaded
 * images (e.g. the image uploader's own drag-to-reorder, or just verifying
 * what was uploaded).
 */
export function ImageProtection() {
  const pathname = usePathname() ?? "/";
  const enabled = !pathname.startsWith("/admin");

  React.useEffect(() => {
    if (!enabled) return;

    const isImage = (target: EventTarget | null) =>
      target instanceof HTMLElement && target.closest("img") !== null;

    const onContextMenu = (e: MouseEvent) => {
      if (isImage(e.target)) e.preventDefault();
    };
    const onDragStart = (e: DragEvent) => {
      if (isImage(e.target)) e.preventDefault();
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
    };
  }, [enabled]);

  return null;
}
