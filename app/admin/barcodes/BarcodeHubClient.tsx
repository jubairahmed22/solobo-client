"use client";

import * as React from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckSquare,
  Package,
  Printer,
  ScanLine,
  Search,
  Square,
  Tag,
  X,
} from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";
import { AdminInlineSkeleton, AdminProductGridSkeleton } from "@/components/admin/Skeleton";
import { Select } from "@/components/composed";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { cn } from "@/lib/utils/cn";
import { useAdminProducts } from "@/hooks/useAdmin";
import { useUsbScanner } from "@/hooks/useUsbScanner";
import { BarcodeTag } from "@/components/barcodes/BarcodeTag";
import { BarcodeScanner } from "@/components/barcodes/BarcodeScanner";
import { LabelSheet } from "@/components/barcodes/LabelSheet";
import {
  detectFormat,
  LABEL_SIZES,
  buildSheetHtml,
  printHtml,
  type LabelData,
  type LabelSize,
} from "@/lib/barcode";
import type { Symbology } from "@/lib/labels/types";
import type { AdminProductSort } from "@/types/admin";

/* -- Tabs -- */

type Tab = "browse" | "scan" | "generate" | "missing";

const TABS: Array<{ id: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: "browse", label: "Browse & Print", Icon: Printer },
  { id: "scan", label: "Scan Lookup", Icon: Camera },
  { id: "generate", label: "Generate", Icon: Tag },
  { id: "missing", label: "Missing Barcodes", Icon: AlertTriangle },
];

/* -- Main -- */

export function BarcodeHubClient() {
  const [activeTab, setActiveTab] = React.useState<Tab>("browse");
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [scannedCode, setScannedCode] = React.useState("");
  const [scanResult, setScanResult] = React.useState<{ code: string; productTitle?: string; found: boolean } | null>(null);

  // USB scanner - globally active on this page
  useUsbScanner({
    onScan: (code) => {
      setScannedCode(code);
      setScanResult(null);
      setActiveTab("scan");
    },
  });

  const handleScan = (code: string) => {
    setScannedCode(code);
    setScanResult(null);
    setScannerOpen(false);
    setActiveTab("scan");
  };

  return (
    <div className="flex flex-col gap-[16px]">
      <header className="flex flex-col gap-[12px] sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[20px] font-bold leading-tight text-gray-900 sm:text-[24px]">Barcodes</h1>
          <p className="mt-[4px] text-[14px] text-gray-500">
            Generate, print, and scan barcodes for products and variants.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-[8px]">
          <span className="inline-flex items-center gap-[6px] rounded-[6px] bg-gray-100 px-[10px] py-[4px] text-[12px] font-medium text-gray-800">
            <ScanLine className="h-[14px] w-[14px]" aria-hidden />
            USB scanner active
          </span>
          {/* Flowbite "alternative" button */}
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex h-[40px] items-center gap-[8px] rounded-[8px] border border-gray-300 bg-white px-[16px] text-[14px] font-medium text-gray-900 transition duration-75 hover:bg-gray-100"
          >
            <Camera className="h-[16px] w-[16px]" aria-hidden />
            Camera scan
          </button>
        </div>
      </header>

      {/* Tabs - Flowbite underline tabs with icons */}
      <AdminTabs
        ariaLabel="Barcode tools"
        items={TABS.map(({ id, label, Icon }) => ({
          value: id,
          label: (
            <span className="flex items-center gap-[8px]">
              <Icon className="h-[16px] w-[16px]" />
              <span className="hidden sm:inline">{label}</span>
            </span>
          ),
        }))}
        value={activeTab}
        onChange={(v) => setActiveTab(v as Tab)}
      />

      {/* Tab content */}
      {activeTab === "browse" && <BrowseTab />}
      {activeTab === "scan" && (
        <ScanTab
          initialCode={scannedCode}
          onOpenCamera={() => setScannerOpen(true)}
          setScanResult={setScanResult}
        />
      )}
      {activeTab === "generate" && <GenerateTab />}
      {activeTab === "missing" && <MissingTab />}

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        prompt="Point camera at product barcode or QR code"
      />
    </div>
  );
}

/* -- Browse & Print tab -- */

function BrowseTab() {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [sort, setSort] = React.useState<AdminProductSort>("newest");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [sizeId, setSizeId] = React.useState("sm");
  const [showSheet, setShowSheet] = React.useState(false);

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  React.useEffect(() => setPage(1), [debouncedSearch, sort]);

  const { data, isLoading, isFetching } = useAdminProducts({
    q: debouncedSearch || undefined,
    sort,
    limit: 20,
    page,
  });
  const products = data?.data?.products ?? [];
  const meta = data?.meta;

  const size: LabelSize = LABEL_SIZES.find((s) => s.id === sizeId) ?? LABEL_SIZES[1]!;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(products.map((p) => p._id)));
  const clearAll = () => setSelected(new Set());

  const selectedProducts = products.filter((p) => selected.has(p._id));

  const labels: LabelData[] = selectedProducts.flatMap((p) => {
    const barcode = p._id.slice(-8).toUpperCase();
    const format = detectFormat(barcode);
    return [{
      barcode,
      format,
      title: p.title,
      price: `Tk ${p.price.toLocaleString("en-IN")}`,
    }];
  });

  const handlePrintSelected = async () => {
    if (labels.length === 0) return;
    const { enrichLabels } = await import("./enrichLabels");
    const enriched = await enrichLabels(labels, size);
    printHtml(buildSheetHtml(enriched, size));
  };

  return (
    <div className="flex flex-col gap-[16px]">
      {/* Controls - Flowbite table toolbar */}
      <div className="flex flex-col gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1 lg:max-w-[480px]">
          <label htmlFor="barcodes-search" className="sr-only">
            Search products
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-[12px]">
            <Search className="h-[16px] w-[16px] text-gray-500" aria-hidden />
          </div>
          <Input
            id="barcodes-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="pl-[36px] pr-[40px]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear"
              className="absolute inset-y-0 right-[8px] my-auto flex h-[28px] w-[28px] items-center justify-center rounded-[6px] text-gray-500 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
            >
              <X className="h-[16px] w-[16px]" aria-hidden />
            </button>
          )}
        </div>
        <div className="flex flex-col gap-[12px] sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:shrink-0">
          <div className="flex items-center gap-[8px]">
            <label htmlFor="barcodes-sort" className="shrink-0 text-[13px] font-medium text-gray-500">
              Sort
            </label>
            <Select
              id="barcodes-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as AdminProductSort)}
              options={[
                { value: "newest", label: "Newest" },
                { value: "price-asc", label: "Price: low to high" },
                { value: "price-desc", label: "Price: high to low" },
                { value: "stock-desc", label: "Stock: high to low" },
              ]}
              containerClassName="min-w-0 flex-1 sm:flex-none"
              className="sm:w-36"
            />
          </div>
          <div className="flex items-center gap-[8px]">
            <label htmlFor="barcodes-size" className="shrink-0 text-[13px] font-medium text-gray-500">
              Label size
            </label>
            <Select
              id="barcodes-size"
              value={sizeId}
              onChange={(e) => setSizeId(e.target.value)}
              options={LABEL_SIZES.map((s) => ({ value: s.id, label: `${s.label} — ${s.note}` }))}
              containerClassName="min-w-0 flex-1 sm:flex-none"
              className="sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Selection bar */}
      <div className="flex flex-col gap-[12px] rounded-[8px] border border-gray-200 bg-gray-50 px-[16px] py-[12px] text-[14px] sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap items-center gap-[12px]">
          <button
            type="button"
            onClick={selectAll}
            className="flex items-center gap-[6px] font-medium text-gray-500 transition duration-75 hover:text-gray-900"
          >
            <CheckSquare className="h-[16px] w-[16px]" aria-hidden /> Select all
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-[6px] font-medium text-gray-500 transition duration-75 hover:text-gray-900"
          >
            <Square className="h-[16px] w-[16px]" aria-hidden /> Clear
          </button>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">
            <strong className="font-semibold text-gray-900">{selected.size}</strong> selected
          </span>
        </div>
        <div className="flex items-center gap-[8px] sm:ml-auto">
          {/* Flowbite alternative button */}
          <button
            type="button"
            onClick={() => setShowSheet((v) => !v)}
            disabled={selected.size === 0}
            className="inline-flex h-[36px] flex-1 items-center justify-center gap-[8px] rounded-[8px] border border-gray-300 bg-white px-[12px] text-[13px] font-medium text-gray-900 transition duration-75 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
          >
            <Printer className="h-[16px] w-[16px]" aria-hidden />
            {showSheet ? "Hide preview" : "Preview labels"}
          </button>
          {/* Flowbite primary button */}
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={handlePrintSelected}
            className="inline-flex h-[36px] flex-1 items-center justify-center gap-[8px] rounded-[8px] bg-[#1A56DB] px-[16px] text-[13px] font-medium text-white transition duration-75 hover:bg-[#1E429F] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
          >
            <Printer className="h-[16px] w-[16px]" aria-hidden />
            Print {selected.size > 0 ? `${selected.size}` : ""}
          </button>
        </div>
      </div>

      {/* Label preview sheet */}
      {showSheet && labels.length > 0 && (
        <div className="rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
          <LabelSheet labels={labels} defaultSizeId={sizeId} />
        </div>
      )}

      {/* Product grid */}
      {isLoading ? (
        <AdminProductGridSkeleton count={8} />
      ) : (
        <div className={cn("grid grid-cols-2 gap-[16px] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5", isFetching && "opacity-70")}>
          {products.map((p) => {
            const barcode = p._id.slice(-8).toUpperCase();
            const isSelected = selected.has(p._id);
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => toggleSelect(p._id)}
                className={cn(
                  "group relative flex flex-col gap-[8px] rounded-[8px] border p-[12px] text-left shadow-sm transition duration-150",
                  isSelected
                    ? "border-[#1A56DB] bg-blue-50"
                    : "border-gray-200 bg-white hover:bg-gray-50",
                )}
              >
                {/* Checkmark */}
                <div className={cn(
                  "absolute right-[8px] top-[8px] flex h-[20px] w-[20px] items-center justify-center rounded-full border-2 transition-colors",
                  isSelected ? "border-[#1A56DB] bg-[#1A56DB]" : "border-gray-300 bg-white",
                )}>
                  {isSelected && <Check className="h-[12px] w-[12px] text-white" aria-hidden />}
                </div>

                {/* Barcode preview */}
                <BarcodeTag
                  value={barcode}
                  format={detectFormat(barcode)}
                  label={barcode}
                  width={120}
                  height={40}
                  showActions={false}
                  className="pointer-events-none w-full"
                />

                <div className="flex flex-col gap-0.5">
                  <p className="line-clamp-1 text-xs font-semibold text-ink">{p.title}</p>
                  <p className="font-mono text-[10px] text-neutral-500">{barcode}</p>
                  <p className="text-[10px] text-neutral-500">Tk {p.price.toLocaleString("en-IN")} · {p.stock} in stock</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta && (meta.totalPages ?? 1) > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-[8px] border-t border-neutral-200 pt-3 text-xs text-neutral-600">
          <span>Page {meta.page} of {meta.totalPages} · {meta.total} products</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <Button size="sm" variant="secondary" disabled={page >= (meta.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -- Scan Lookup tab -- */

interface ScanTabProps {
  initialCode: string;
  onOpenCamera: () => void;
  setScanResult: React.Dispatch<React.SetStateAction<{ code: string; productTitle?: string; found: boolean } | null>>;
}

function ScanTab({ initialCode, onOpenCamera, setScanResult }: ScanTabProps) {
  const [code, setCode] = React.useState(initialCode);

  React.useEffect(() => {
    if (initialCode) setCode(initialCode);
  }, [initialCode]);

  const { data: searchData, isLoading, isFetching } = useAdminProducts(
    code.length >= 3 ? { q: code, limit: 5 } : { limit: 0 },
  );
  const results = searchData?.data?.products ?? [];

  React.useEffect(() => {
    if (code.length < 3) { setScanResult(null); return; }
    if (!isLoading && !isFetching) {
      setScanResult(results.length > 0
        ? { code, productTitle: results[0]!.title, found: true }
        : { code, found: false });
    }
  }, [code, isLoading, isFetching, results, setScanResult]);

  const format = detectFormat(code);

  return (
    <div className="flex flex-col gap-[16px]">
      {/* Scanner input */}
      <div className="flex flex-col gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
        <div className="flex items-center justify-between gap-[8px]">
          <h2 className="text-[18px] font-semibold text-gray-900">Scan or enter barcode</h2>
          {/* Flowbite alternative button */}
          <button
            type="button"
            onClick={onOpenCamera}
            className="inline-flex h-[36px] items-center gap-[8px] rounded-[8px] border border-gray-300 bg-white px-[12px] text-[13px] font-medium text-gray-900 transition duration-75 hover:bg-gray-100"
          >
            <Camera className="h-[16px] w-[16px]" aria-hidden /> Camera
          </button>
        </div>
        <p className="text-[13px] text-gray-500">
          Point your USB scanner at a label, or type a barcode / SKU below. USB scanner works anywhere on this page.
        </p>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-[12px]">
            <ScanLine className="h-[16px] w-[16px] text-gray-500" aria-hidden />
          </div>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Barcode or SKU…"
            autoFocus
            className="pl-[36px] pr-[40px] font-mono"
          />
          {code && (
            <button
              type="button"
              onClick={() => { setCode(""); setScanResult(null); }}
              aria-label="Clear"
              className="absolute inset-y-0 right-[8px] my-auto flex h-[28px] w-[28px] items-center justify-center rounded-[6px] text-gray-500 transition duration-75 hover:bg-gray-100 hover:text-gray-900"
            >
              <X className="h-[16px] w-[16px]" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Result */}
      {code.length >= 3 && (
        <div className="flex flex-col gap-[16px]">
          {/* Barcode display */}
          <div className="flex justify-center rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
            <BarcodeTag value={code} format={format} label={code} width={220} height={80} />
          </div>

          {/* Product lookup */}
          {(isLoading || isFetching) ? (
            <AdminInlineSkeleton rows={3} withThumb />
          ) : results.length > 0 ? (
            <div className="flex flex-col gap-[8px]">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-gray-500">
                Products matching &ldquo;{code}&rdquo;
              </p>
              {results.map((p) => (
                <a
                  key={p._id}
                  href={`/admin/products/${p._id}`}
                  className="flex items-center gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm transition duration-75 hover:bg-gray-50"
                >
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="h-[40px] w-[40px] shrink-0 rounded-[8px] border border-gray-200 object-cover" />
                  ) : (
                    <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[8px] bg-gray-100">
                      <Package className="h-[20px] w-[20px] text-gray-400" />
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-ink">{p.title}</span>
                    <span className="text-xs text-neutral-500">Tk {p.price.toLocaleString("en-IN")} · {p.stock} in stock</span>
                  </div>
                  <Badge variant={p.isActive ? "solid" : "muted"}>
                    {p.isActive ? "Active" : "Hidden"}
                  </Badge>
                </a>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-[12px] rounded-[8px] border border-dashed border-gray-300 bg-white p-[20px] text-[14px] text-gray-500">
              <AlertTriangle className="h-[16px] w-[16px] shrink-0 text-yellow-500" aria-hidden />
              No product found for barcode &ldquo;{code}&rdquo;. Check if the SKU is correct or create a new product.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -- Generate tab -- */

function GenerateTab() {
  const [value, setValue] = React.useState("");
  const [format, setFormat] = React.useState<Symbology>("CODE128");
  const [title, setTitle] = React.useState("");
  const [sku, setSku] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [sizeId, setSizeId] = React.useState("sm");
  const [qty, setQty] = React.useState(1);
  const [generated, setGenerated] = React.useState(false);

  const labels: LabelData[] = value
    ? Array.from({ length: qty }, () => ({
        barcode: value,
        format,
        title: title || value,
        sku: sku || undefined,
        price: price || undefined,
      }))
    : [];

  const handleGenerate = async () => {
    if (!value) return;
    const { enrichLabels } = await import("./enrichLabels");
    const size = LABEL_SIZES.find((s) => s.id === sizeId) ?? LABEL_SIZES[1]!;
    const enriched = await enrichLabels(labels, size);
    printHtml(buildSheetHtml(enriched, size));
    setGenerated(true);
    setTimeout(() => setGenerated(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-[1fr_320px]">
      {/* Form */}
      <div className="flex flex-col gap-[16px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
        <h2 className="text-[18px] font-semibold text-gray-900">Custom barcode</h2>
        <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
          <label className="flex flex-col gap-[8px] text-[14px] font-medium text-gray-900 sm:col-span-2">
            Barcode value *
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="SKU-0001 or 5901234123457" />
          </label>
          <label className="flex flex-col gap-[8px] text-[14px] font-medium text-gray-900">
            Format
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value as Symbology)}
              options={[
                { value: "CODE128", label: "Code 128 (universal)" },
                { value: "EAN13", label: "EAN-13 (13 digits)" },
                { value: "UPCA", label: "UPC-A (12 digits)" },
                { value: "EAN8", label: "EAN-8 (8 digits)" },
                { value: "CODE39", label: "Code 39 (alphanumeric)" },
                { value: "ITF14", label: "ITF-14 (14 digits, bearer box)" },
                { value: "QR", label: "QR Code (2D)" },
                { value: "DATAMATRIX", label: "DataMatrix (2D)" },
              ]}
            />
          </label>
          <label className="flex flex-col gap-[8px] text-[14px] font-medium text-gray-900">
            Copies
            <Input type="number" min={1} max={100} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(100, Number(e.target.value))))} />
          </label>
          <label className="flex flex-col gap-[8px] text-[14px] font-medium text-gray-900">
            Product title
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional label text" />
          </label>
          <label className="flex flex-col gap-[8px] text-[14px] font-medium text-gray-900">
            SKU (sub-label)
            <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. TSHIRT-L" />
          </label>
          <label className="flex flex-col gap-[8px] text-[14px] font-medium text-gray-900">
            Price
            <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. Tk 1,499" />
          </label>
          <label className="flex flex-col gap-[8px] text-[14px] font-medium text-gray-900">
            Label size
            <Select
              value={sizeId}
              onChange={(e) => setSizeId(e.target.value)}
              options={LABEL_SIZES.map((s) => ({ value: s.id, label: `${s.label} — ${s.note}` }))}
            />
          </label>
        </div>

        {/* Flowbite primary button */}
        <button
          type="button"
          disabled={!value}
          onClick={handleGenerate}
          className="inline-flex h-[40px] items-center gap-[8px] self-start rounded-[8px] bg-[#1A56DB] px-[20px] text-[14px] font-medium text-white transition duration-75 hover:bg-[#1E429F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generated ? (
            <Check className="h-[16px] w-[16px]" aria-hidden />
          ) : (
            <Printer className="h-[16px] w-[16px]" aria-hidden />
          )}
          {generated ? "Sent to printer" : `Print ${qty} label${qty !== 1 ? "s" : ""}`}
        </button>
      </div>

      {/* Live preview */}
      {value && (
        <div className="flex flex-col gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm">
          <h2 className="text-[18px] font-semibold text-gray-900">Preview</h2>
          <div className="flex justify-center">
            <BarcodeTag value={value} format={format} label={title || value} width={200} height={70} />
          </div>
        </div>
      )}
    </div>
  );
}

/* -- Missing Barcodes tab -- */

function MissingTab() {
  const { data, isLoading } = useAdminProducts({ limit: 100, sort: "newest" });
  const products = data?.data?.products ?? [];

  return (
    <div className="flex flex-col gap-[16px]">
      {/* Flowbite yellow alert */}
      <div className="flex items-center gap-[12px] rounded-[8px] border border-yellow-300 bg-yellow-50 p-[16px] text-[14px] text-yellow-800">
        <AlertTriangle className="h-[16px] w-[16px] shrink-0" aria-hidden />
        <span>
          {isLoading
            ? "Loading products..."
            : `${products.length} product${products.length !== 1 ? "s" : ""} — open each to add or verify its SKU / barcode in the edit form.`}
        </span>
      </div>

      {isLoading && <AdminInlineSkeleton rows={6} withThumb />}

      {!isLoading && products.length > 0 && (
        <div className="flex flex-col gap-[8px]">
          {products.map((p) => (
            <a
              key={p._id}
              href={`/admin/products/${p._id}`}
              className="flex items-center gap-[12px] rounded-[8px] border border-gray-200 bg-white p-[16px] shadow-sm transition duration-75 hover:bg-gray-50"
            >
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="h-10 w-10 shrink-0 rounded-sm border border-neutral-200 object-cover" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-neutral-100">
                  <Package className="h-4 w-4 text-neutral-400" />
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-ink">{p.title}</span>
                <span className="text-xs text-neutral-500">Tk {p.price.toLocaleString("en-IN")} · {p.stock} in stock</span>
              </div>
              <span className="shrink-0 rounded-[4px] bg-yellow-100 px-[10px] py-[2px] text-[12px] font-medium text-yellow-800">
                Missing SKU
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}


