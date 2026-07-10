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
import { Badge, Button, Input, Spinner } from "@/components/ui";
import { Select } from "@/components/composed";
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
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Barcodes</h1>
          <p className="text-sm text-neutral-500">
            Generate, print, and scan barcodes for products and variants.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="muted">
            <ScanLine className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
            USB scanner active
          </Badge>
          <Button size="sm" variant="secondary" onClick={() => setScannerOpen(true)}>
            <Camera className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Camera scan
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 rounded-sm border border-neutral-200 bg-paper p-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
              activeTab === id
                ? "bg-ink text-paper shadow-sm"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-ink",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

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
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-sm border border-neutral-200 bg-paper px-2.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="h-9 border-0 px-0 focus-visible:ring-0"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear" className="text-neutral-500 hover:text-ink">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value as AdminProductSort)}
          options={[
            { value: "newest", label: "Newest" },
            { value: "price-asc", label: "Price: low to high" },
            { value: "price-desc", label: "Price: high to low" },
            { value: "stock-desc", label: "Stock: high to low" },
          ]}
          className="w-36"
        />
        <Select
          value={sizeId}
          onChange={(e) => setSizeId(e.target.value)}
          options={LABEL_SIZES.map((s) => ({ value: s.id, label: `${s.label} — ${s.note}` }))}
          className="w-56"
        />
      </div>

      {/* Selection bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm">
        <button type="button" onClick={selectAll} className="flex items-center gap-1.5 text-neutral-600 hover:text-ink">
          <CheckSquare className="h-3.5 w-3.5" aria-hidden /> Select all
        </button>
        <button type="button" onClick={clearAll} className="flex items-center gap-1.5 text-neutral-600 hover:text-ink">
          <Square className="h-3.5 w-3.5" aria-hidden /> Clear
        </button>
        <span className="text-neutral-400">|</span>
        <span className="text-neutral-600">{selected.size} selected</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSheet((v) => !v)}
            disabled={selected.size === 0}
            className="flex items-center gap-1.5 rounded-sm border border-neutral-300 px-3 py-1 text-xs transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
          >
            <Printer className="h-3 w-3" aria-hidden />
            {showSheet ? "Hide preview" : "Preview labels"}
          </button>
          <Button size="sm" disabled={selected.size === 0} onClick={handlePrintSelected}>
            <Printer className="h-3.5 w-3.5 mr-1.5" aria-hidden />
            Print {selected.size > 0 ? `${selected.size}` : ""}
          </Button>
        </div>
      </div>

      {/* Label preview sheet */}
      {showSheet && labels.length > 0 && (
        <div className="rounded-sm border border-neutral-200 bg-paper p-3">
          <LabelSheet labels={labels} defaultSizeId={sizeId} />
        </div>
      )}

      {/* Product grid */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5", isFetching && "opacity-70")}>
          {products.map((p) => {
            const barcode = p._id.slice(-8).toUpperCase();
            const isSelected = selected.has(p._id);
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => toggleSelect(p._id)}
                className={cn(
                  "group relative flex flex-col gap-2 rounded-sm border p-3 text-left transition-all",
                  isSelected
                    ? "border-ink bg-ink/5 shadow-sm"
                    : "border-neutral-200 bg-paper hover:border-neutral-400",
                )}
              >
                {/* Checkmark */}
                <div className={cn(
                  "absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                  isSelected ? "border-ink bg-ink" : "border-neutral-300 bg-paper",
                )}>
                  {isSelected && <Check className="h-3 w-3 text-white" aria-hidden />}
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
        <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-xs text-neutral-600">
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
    <div className="flex flex-col gap-4">
      {/* Scanner input */}
      <div className="flex flex-col gap-3 rounded-sm border border-neutral-200 bg-paper p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Scan or enter barcode</h2>
          <button
            type="button"
            onClick={onOpenCamera}
            className="flex items-center gap-1.5 rounded-sm border border-neutral-300 px-3 py-1.5 text-xs transition-colors hover:border-ink hover:text-ink"
          >
            <Camera className="h-3.5 w-3.5" aria-hidden /> Camera
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Point your USB scanner at a label, or type a barcode / SKU below. USB scanner works anywhere on this page.
        </p>
        <div className="flex items-center gap-2 rounded-sm border border-neutral-300 bg-neutral-50 px-2.5">
          <ScanLine className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Barcode or SKU…"
            autoFocus
            className="h-10 border-0 bg-transparent px-0 font-mono focus-visible:ring-0"
          />
          {code && (
            <button type="button" onClick={() => { setCode(""); setScanResult(null); }} aria-label="Clear" className="text-neutral-500 hover:text-ink">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Result */}
      {code.length >= 3 && (
        <div className="flex flex-col gap-4">
          {/* Barcode display */}
          <div className="flex justify-center rounded-sm border border-neutral-200 bg-paper p-3">
            <BarcodeTag value={code} format={format} label={code} width={220} height={80} />
          </div>

          {/* Product lookup */}
          {(isLoading || isFetching) ? (
            <div className="flex h-20 items-center justify-center">
              <Spinner />
            </div>
          ) : results.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Products matching &ldquo;{code}&rdquo;
              </p>
              {results.map((p) => (
                <a
                  key={p._id}
                  href={`/admin/products/${p._id}`}
                  className="flex items-center gap-3 rounded-sm border border-neutral-200 bg-paper p-4 transition-colors hover:border-ink"
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
                  <Badge variant={p.isActive ? "solid" : "muted"}>
                    {p.isActive ? "Active" : "Hidden"}
                  </Badge>
                </a>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-sm border border-dashed border-neutral-300 p-5 text-sm text-neutral-500">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
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
  const [format, setFormat] = React.useState<"CODE128" | "EAN13" | "UPCA" | "EAN8" | "CODE39" | "QR">("CODE128");
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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      {/* Form */}
      <div className="flex flex-col gap-4 rounded-sm border border-neutral-200 bg-paper p-3">
        <h2 className="text-base font-semibold text-ink">Custom barcode</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs text-neutral-500 sm:col-span-2">
            Barcode value *
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="SKU-0001 or 5901234123457" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
            Format
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
              options={[
                { value: "CODE128", label: "Code 128 (universal)" },
                { value: "EAN13", label: "EAN-13 (13 digits)" },
                { value: "UPCA", label: "UPC-A (12 digits)" },
                { value: "EAN8", label: "EAN-8 (8 digits)" },
                { value: "CODE39", label: "Code 39 (alphanumeric)" },
                { value: "QR", label: "QR Code (2D)" },
              ]}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
            Copies
            <Input type="number" min={1} max={100} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(100, Number(e.target.value))))} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
            Product title
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional label text" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
            SKU (sub-label)
            <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. TSHIRT-L" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
            Price
            <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. Tk 1,499" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
            Label size
            <Select
              value={sizeId}
              onChange={(e) => setSizeId(e.target.value)}
              options={LABEL_SIZES.map((s) => ({ value: s.id, label: `${s.label} — ${s.note}` }))}
            />
          </label>
        </div>

        <Button disabled={!value} onClick={handleGenerate} className="w-full sm:w-auto self-start">
          {generated ? <Check className="mr-1.5 h-4 w-4" /> : <Printer className="mr-1.5 h-4 w-4" />}
          {generated ? "Sent to printer" : `Print ${qty} label${qty !== 1 ? "s" : ""}`}
        </Button>
      </div>

      {/* Live preview */}
      {value && (
        <div className="flex flex-col gap-3 rounded-sm border border-neutral-200 bg-paper p-3">
          <h2 className="text-sm font-semibold text-ink">Preview</h2>
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-sm border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <span>
          {isLoading
            ? "Loading products..."
            : `${products.length} product${products.length !== 1 ? "s" : ""} — open each to add or verify its SKU / barcode in the edit form.`}
        </span>
      </div>

      {isLoading && (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      )}

      {!isLoading && products.length > 0 && (
        <div className="flex flex-col gap-2">
          {products.map((p) => (
            <a
              key={p._id}
              href={`/admin/products/${p._id}`}
              className="flex items-center gap-3 rounded-sm border border-neutral-200 bg-paper p-4 transition-colors hover:border-ink"
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
              <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                Missing SKU
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}


