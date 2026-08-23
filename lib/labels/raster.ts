import type { RenderOptions } from "./types";
import { renderSymbology } from "./engine";

/**
 * Rasterizes the SVG that `renderSymbology()` already produced - never a
 * second, independent bwip-js `toCanvas` call - so PNG/PDF output can never
 * visually diverge from the on-screen SVG preview. 300/600 DPI minimum for
 * thermal printers, computed from the SVG's own physical (mm) size rather
 * than a fixed pixel count, so magnification/template size changes are
 * reflected automatically.
 */
export async function renderPng(opts: RenderOptions, dpi: 300 | 600 = 300): Promise<Blob> {
  const { svg, widthMM, heightMM } = await renderSymbology(opts);
  return svgToPng(svg, widthMM, heightMM, dpi);
}

/** Rasterize an arbitrary already-sized SVG string (used by pdf.ts for the same underlying image). */
export async function svgToPng(svg: string, widthMM: number, heightMM: number, dpi: 300 | 600): Promise<Blob> {
  const pxWidth = Math.max(1, Math.round((widthMM / 25.4) * dpi));
  const pxHeight = Math.max(1, Math.round((heightMM / 25.4) * dpi));

  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = pxWidth;
    canvas.height = pxHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, pxWidth, pxHeight);
    ctx.drawImage(img, 0, 0, pxWidth, pxHeight);
    return await canvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to rasterize SVG"));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png");
  });
}
