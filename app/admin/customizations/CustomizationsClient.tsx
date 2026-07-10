"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Image as ImageIcon,
  Package,
  Palette,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button, Badge, Input, Label, Spinner } from "@/components/ui";
import { uploadsApi, uploadToCloudinary } from "@/lib/api/uploads";
import { FormStickyBar } from "@/components/admin/FormStickyBar";
import { useUIStore } from "@/store/uiStore";
import {
  useAdminCustomizationConfig,
  useUpdateAdminCustomizationConfig,
  useAdminCategories,
  useAdminProducts,
} from "@/hooks/useAdmin";
import { AdminError } from "@/lib/api/admin";
import { cn } from "@/lib/utils/cn";
import type {
  CustomizationAssignmentDetail,
  CustomizationPatch,
} from "@/types/customization";

/* ─────────────────────────────────────────────────────────────── helpers */

function formatPrice(n: number) {
  return `Tk ${n.toLocaleString("en-IN")}`;
}

/* ─────────────────────────────────────────────────────────────── PatchEditor */

interface PatchDraft {
  _id?: string;
  name: string;
  abbreviation: string;
  color: string;
  imageUrl: string;
  price: number | "";
  isActive: boolean;
  order: number;
}

function emptyPatch(order: number): PatchDraft {
  return {
    name: "",
    abbreviation: "",
    color: "#333333",
    imageUrl: "",
    price: 0,
    isActive: true,
    order,
  };
}

function PatchEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  isNew,
}: {
  draft: PatchDraft;
  onChange: (d: PatchDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew: boolean;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError("Image must be under 8 MB.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    try {
      const sig = await uploadsApi.sign("product");
      const result = await uploadToCloudinary(file, sig, setUploadProgress);
      onChange({ ...draft, imageUrl: result.secure_url });
    } catch {
      setUploadError("Upload failed - please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const valid =
    draft.name.trim().length > 0 &&
    draft.abbreviation.trim().length > 0 &&
    draft.price !== "" &&
    Number(draft.price) >= 0;

  return (
    <div className="rounded-sm border border-neutral-200 bg-neutral-50 p-4">
      <p className="mb-3 text-sm font-semibold text-ink">
        {isNew ? "New patch" : "Edit patch"}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="p-name">Name</Label>
          <Input
            id="p-name"
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="Premier League"
            maxLength={100}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="p-abbr">Abbreviation (2-6 chars)</Label>
          <Input
            id="p-abbr"
            value={draft.abbreviation}
            onChange={(e) =>
              onChange({ ...draft, abbreviation: e.target.value.toUpperCase().slice(0, 6) })
            }
            placeholder="PL"
            maxLength={6}
            className="uppercase"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="p-price">Price (BDT)</Label>
          <Input
            id="p-price"
            type="number"
            min={0}
            max={100000}
            value={draft.price}
            onChange={(e) =>
              onChange({
                ...draft,
                price: e.target.value === "" ? "" : Number(e.target.value),
              })
            }
            placeholder="200"
          />
        </div>

        {/* Patch image - full width row */}
        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-2">
          <Label>
            Patch image
            <span className="ml-1.5 font-normal text-neutral-400">
              (recommended - shown on product page)
            </span>
          </Label>
          <div className="flex items-center gap-4">
            {draft.imageUrl ? (
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.imageUrl}
                  alt="Preview"
                  className="h-16 w-16 rounded-full border-2 border-neutral-200 object-cover shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => onChange({ ...draft, imageUrl: "" })}
                  aria-label="Remove image"
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </div>
            ) : (
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-full border-2 border-dashed border-neutral-300 bg-neutral-50 text-neutral-300">
                <ImageIcon className="h-5 w-5" aria-hidden />
                <span className="text-[9px] font-medium">No image</span>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={handleFileChange}
                className="hidden"
                aria-hidden
              />
              <Button
                type="button"
                size="sm"
                variant={draft.imageUrl ? "secondary" : "primary"}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <Upload className="h-3.5 w-3.5" aria-hidden />
                )}
                <span className="ml-1.5">
                  {uploading
                    ? `Uploading... ${uploadProgress}%`
                    : draft.imageUrl
                      ? "Replace image"
                      : "Upload image"}
                </span>
              </Button>
              {uploadError ? (
                <p className="text-xs text-red-500">{uploadError}</p>
              ) : (
                <p className="text-xs text-neutral-400">JPEG, PNG, WebP / max 8 MB</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="p-color">
            Badge colour
            <span className="ml-1 font-normal text-neutral-400">(fallback)</span>
          </Label>
          <div className="flex items-center gap-2">
            <div
              className="h-9 w-9 shrink-0 rounded-sm border border-neutral-200"
              style={{ backgroundColor: draft.color }}
            />
            <Input
              id="p-color"
              type="color"
              value={draft.color}
              onChange={(e) => onChange({ ...draft, color: e.target.value })}
              className="h-9 cursor-pointer px-1 py-1"
            />
          </div>
          <p className="text-xs text-neutral-400">Used when no image is uploaded</p>
        </div>
      </div>

      <label className="mt-3 flex cursor-pointer items-center gap-2">
        <div
          onClick={() => onChange({ ...draft, isActive: !draft.isActive })}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
            draft.isActive ? "border-ink bg-ink text-paper" : "border-neutral-300 bg-paper",
          )}
        >
          {draft.isActive ? <Check className="h-3 w-3" aria-hidden /> : null}
        </div>
        <span className="select-none text-sm text-neutral-700">Active (visible in storefront)</span>
      </label>

      <div className="mt-4 flex items-center gap-2">
        <Button type="button" size="sm" onClick={onSave} disabled={!valid || uploading}>
          <Check className="h-3.5 w-3.5" aria-hidden />
          <span className="ml-1">{isNew ? "Add patch" : "Save patch"}</span>
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── PatchRow */

function PatchRow({
  patch,
  index,
  total,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  patch: PatchDraft;
  index: number;
  total: number;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-sm border border-neutral-200 bg-paper px-4 py-3">
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="Move up"
          className="flex h-5 w-5 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-ink disabled:opacity-30"
        >
          <ChevronUp className="h-3 w-3" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label="Move down"
          className="flex h-5 w-5 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-ink disabled:opacity-30"
        >
          <ChevronDown className="h-3 w-3" aria-hidden />
        </button>
      </div>

      {patch.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={patch.imageUrl}
          alt={patch.name}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: patch.color }}
        >
          {patch.abbreviation}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{patch.name}</p>
        <p className="text-xs text-neutral-500">{formatPrice(Number(patch.price) || 0)}</p>
      </div>

      <Badge variant={patch.isActive ? "outline" : "muted"} className="shrink-0">
        {patch.isActive ? "Active" : "Inactive"}
      </Badge>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit patch"
          className="flex h-7 w-7 items-center justify-center rounded-sm text-neutral-400 hover:bg-neutral-100 hover:text-ink"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete patch"
          className="flex h-7 w-7 items-center justify-center rounded-sm text-neutral-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── AssignmentEditor */

interface AssignmentDraft {
  _id?: string;
  targetType: "product" | "category";
  targetId: string;
  targetLabel: string;
  targetImage?: string;
  allPatches: boolean;
  patchIds: string[];
  allowName: boolean;
  allowNumber: boolean;
}

function emptyAssignment(): AssignmentDraft {
  return {
    targetType: "product",
    targetId: "",
    targetLabel: "",
    allPatches: true,
    patchIds: [],
    allowName: true,
    allowNumber: true,
  };
}

function AssignmentEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  patches,
  allCategories,
  isNew,
}: {
  draft: AssignmentDraft;
  onChange: (d: AssignmentDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  patches: CustomizationPatch[];
  allCategories: Array<{ _id: string; name: string; slug: string; image?: string }>;
  isNew: boolean;
}) {
  const [productQuery, setProductQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(productQuery), 300);
    return () => clearTimeout(t);
  }, [productQuery]);

  const { data: productSearchData, isFetching: productSearching } = useAdminProducts({
    q: debouncedQuery || undefined,
    limit: 8,
  });
  const searchResults = productSearchData?.data?.products ?? [];

  React.useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const filteredCategories = allCategories.filter(
    (c) =>
      !productQuery ||
      c.name.toLowerCase().includes(productQuery.toLowerCase()) ||
      c.slug.includes(productQuery.toLowerCase()),
  );

  const targetSelected = draft.targetId.length > 0;
  const activePatchCount = patches.filter((p) => p.isActive).length;
  const valid = targetSelected;

  const selectProduct = (p: { _id: string; title: string; image?: string }) => {
    onChange({ ...draft, targetId: p._id, targetLabel: p.title, targetImage: p.image });
    setProductQuery("");
    setDropdownOpen(false);
  };

  const selectCategory = (c: { slug: string; name: string; image?: string }) => {
    onChange({ ...draft, targetId: c.slug, targetLabel: c.name, targetImage: c.image });
    setProductQuery("");
    setDropdownOpen(false);
  };

  const clearTarget = () => {
    onChange({ ...draft, targetId: "", targetLabel: "", targetImage: undefined });
    setProductQuery("");
  };

  const togglePatchId = (id: string) => {
    const next = draft.patchIds.includes(id)
      ? draft.patchIds.filter((x) => x !== id)
      : [...draft.patchIds, id];
    onChange({ ...draft, patchIds: next });
  };

  return (
    <div className="rounded-sm border border-neutral-200 bg-neutral-50 p-4">
      <p className="mb-4 text-sm font-semibold text-ink">
        {isNew ? "New assignment" : "Edit assignment"}
      </p>

      {/* Step 1: target type toggle */}
      <div className="mb-4">
        <p className="mb-1.5 text-xs font-medium text-neutral-500 uppercase tracking-wide">
          Assign to
        </p>
        <div className="inline-flex rounded-sm border border-neutral-200 bg-white p-0.5">
          {(["product", "category"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() =>
                onChange({ ...emptyAssignment(), targetType: t, allPatches: draft.allPatches, allowName: draft.allowName, allowNumber: draft.allowNumber })
              }
              className={cn(
                "flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-sm font-medium transition-colors",
                draft.targetType === t
                  ? "bg-ink text-paper"
                  : "text-neutral-500 hover:text-neutral-800",
              )}
            >
              {t === "product" ? (
                <Package className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <FolderOpen className="h-3.5 w-3.5" aria-hidden />
              )}
              {t === "product" ? "Specific product" : "Category"}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: search & select target */}
      <div className="mb-4">
        <p className="mb-1.5 text-xs font-medium text-neutral-500 uppercase tracking-wide">
          {draft.targetType === "product" ? "Search product" : "Select category"}
        </p>

        {targetSelected ? (
          // Selected target chip
          <div className="flex items-center gap-2 rounded-sm border border-neutral-200 bg-white px-3 py-2">
            {draft.targetImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draft.targetImage}
                alt=""
                className="h-8 w-8 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-neutral-100">
                {draft.targetType === "product" ? (
                  <Package className="h-4 w-4 text-neutral-400" aria-hidden />
                ) : (
                  <FolderOpen className="h-4 w-4 text-neutral-400" aria-hidden />
                )}
              </div>
            )}
            <span className="flex-1 text-sm font-medium text-ink">{draft.targetLabel}</span>
            <button
              type="button"
              onClick={clearTarget}
              aria-label="Change selection"
              className="text-xs text-neutral-400 hover:text-red-500"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : (
          // Search input + dropdown
          <div ref={dropdownRef} className="relative">
            <div
              className={cn(
                "flex items-center gap-2 rounded-sm border bg-white px-3 py-2 transition-colors",
                dropdownOpen ? "border-ink" : "border-neutral-200",
              )}
            >
              {draft.targetType === "product" && productSearching ? (
                <Spinner className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
              ) : (
                <Search className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
              )}
              <input
                value={productQuery}
                onChange={(e) => {
                  setProductQuery(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                placeholder={
                  draft.targetType === "product"
                    ? "Search by product name..."
                    : "Filter categories..."
                }
                className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
              />
              {productQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setProductQuery("");
                    setDropdownOpen(false);
                  }}
                >
                  <X className="h-3.5 w-3.5 text-neutral-400 hover:text-ink" aria-hidden />
                </button>
              ) : null}
            </div>

            {dropdownOpen ? (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-sm border border-neutral-200 bg-white shadow-lg">
                {draft.targetType === "product" ? (
                  searchResults.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-neutral-400">
                      {productQuery ? `No products found for "${productQuery}".` : "Type to search products."}
                    </p>
                  ) : (
                    searchResults.map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() =>
                          selectProduct({ _id: p._id, title: p.title, image: p.image })
                        }
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-neutral-50"
                      >
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-neutral-100">
                            <Package className="h-4 w-4 text-neutral-400" aria-hidden />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{p.title}</p>
                          {p.category?.name ? (
                            <p className="text-xs text-neutral-400">{p.category.name}</p>
                          ) : null}
                        </div>
                      </button>
                    ))
                  )
                ) : filteredCategories.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-neutral-400">No categories found.</p>
                ) : (
                  filteredCategories.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() =>
                        selectCategory({ slug: c.slug, name: c.name, image: c.image })
                      }
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-neutral-50"
                    >
                      {c.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.image}
                          alt=""
                          className="h-7 w-7 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-neutral-100">
                          <FolderOpen className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                        </div>
                      )}
                      <span className="text-sm text-neutral-800">{c.name}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Step 3: patches */}
      <div className="mb-4">
        <p className="mb-1.5 text-xs font-medium text-neutral-500 uppercase tracking-wide">
          Which patches to show
        </p>

        {patches.length === 0 ? (
          <p className="text-xs text-neutral-400">
            No patches in library yet - add some below first.
          </p>
        ) : (
          <>
            {/* All / select toggle */}
            <div className="mb-3 flex gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <div
                  onClick={() => onChange({ ...draft, allPatches: true })}
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors",
                    draft.allPatches ? "border-ink bg-ink" : "border-neutral-300",
                  )}
                >
                  {draft.allPatches ? <div className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                </div>
                <span className="select-none text-sm text-neutral-700">
                  All patches ({activePatchCount} active)
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <div
                  onClick={() => onChange({ ...draft, allPatches: false })}
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors",
                    !draft.allPatches ? "border-ink bg-ink" : "border-neutral-300",
                  )}
                >
                  {!draft.allPatches ? (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  ) : null}
                </div>
                <span className="select-none text-sm text-neutral-700">Select specific</span>
              </label>
            </div>

            {!draft.allPatches ? (
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {patches.map((p) => {
                  const checked = draft.patchIds.includes(p._id);
                  return (
                    <label
                      key={p._id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-sm border px-3 py-2 transition-colors",
                        checked
                          ? "border-ink/30 bg-ink/5"
                          : "border-neutral-200 bg-white hover:bg-neutral-50",
                        !p.isActive && "opacity-50",
                      )}
                    >
                      <div
                        onClick={() => togglePatchId(p._id)}
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                          checked ? "border-ink bg-ink text-paper" : "border-neutral-300 bg-paper",
                        )}
                      >
                        {checked ? <Check className="h-2.5 w-2.5" aria-hidden /> : null}
                      </div>
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-7 w-7 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                          style={{ backgroundColor: p.color }}
                        >
                          {p.abbreviation}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-ink">{p.name}</p>
                        <p className="text-[10px] text-neutral-500">
                          +{formatPrice(p.price)}
                          {!p.isActive ? " · inactive" : ""}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Step 4: options */}
      <div className="mb-5">
        <p className="mb-1.5 text-xs font-medium text-neutral-500 uppercase tracking-wide">
          Personalisation options
        </p>
        <div className="flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <div
              onClick={() => onChange({ ...draft, allowName: !draft.allowName })}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
                draft.allowName ? "border-ink bg-ink text-paper" : "border-neutral-300 bg-paper",
              )}
            >
              {draft.allowName ? <Check className="h-3 w-3" aria-hidden /> : null}
            </div>
            <span className="select-none text-sm text-neutral-700">Name on back</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <div
              onClick={() => onChange({ ...draft, allowNumber: !draft.allowNumber })}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
                draft.allowNumber
                  ? "border-ink bg-ink text-paper"
                  : "border-neutral-300 bg-paper",
              )}
            >
              {draft.allowNumber ? <Check className="h-3 w-3" aria-hidden /> : null}
            </div>
            <span className="select-none text-sm text-neutral-700">Squad number</span>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={onSave} disabled={!valid}>
          <Check className="h-3.5 w-3.5" aria-hidden />
          <span className="ml-1">{isNew ? "Add assignment" : "Save assignment"}</span>
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── AssignmentRow */

function AssignmentRow({
  assignment,
  patches,
  onEdit,
  onDelete,
}: {
  assignment: CustomizationAssignmentDetail;
  patches: CustomizationPatch[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const patchSummary = React.useMemo(() => {
    if (assignment.allPatches) {
      const n = patches.filter((p) => p.isActive).length;
      return `All patches (${n})`;
    }
    const names = assignment.patchIds
      .map((id) => patches.find((p) => p._id === id)?.name)
      .filter(Boolean) as string[];
    if (names.length === 0) return "No patches";
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  }, [assignment, patches]);

  return (
    <div className="flex items-center gap-3 rounded-sm border border-neutral-200 bg-paper px-4 py-3">
      {/* Thumbnail */}
      {assignment.targetImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={assignment.targetImage}
          alt=""
          className="h-10 w-10 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-neutral-100">
          {assignment.targetType === "product" ? (
            <Package className="h-5 w-5 text-neutral-400" aria-hidden />
          ) : (
            <FolderOpen className="h-5 w-5 text-neutral-400" aria-hidden />
          )}
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-ink">{assignment.targetLabel}</p>
          <Badge
            variant="muted"
            className="shrink-0 text-[10px] capitalize"
          >
            {assignment.targetType}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-neutral-500">
          {patchSummary}
          {assignment.allowName ? " · Name" : ""}
          {assignment.allowNumber ? " · Number" : ""}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit assignment"
          className="flex h-7 w-7 items-center justify-center rounded-sm text-neutral-400 hover:bg-neutral-100 hover:text-ink"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete assignment"
          className="flex h-7 w-7 items-center justify-center rounded-sm text-neutral-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── main */

export function CustomizationsClient() {
  const toast = useUIStore((s) => s.toast);
  const { data: config, isLoading } = useAdminCustomizationConfig();
  const update = useUpdateAdminCustomizationConfig();
  const { data: catData } = useAdminCategories({ page: 1, limit: 200 });
  const allCategories = catData?.data ?? [];

  /* -- Prices -- */
  const [blendedPrice, setBlendedPrice] = React.useState<number | "">(100);

  /* -- Assignments -- */
  const [assignments, setAssignments] = React.useState<CustomizationAssignmentDetail[]>([]);
  const [addingAssignment, setAddingAssignment] = React.useState(false);
  const [newAssignmentDraft, setNewAssignmentDraft] = React.useState<AssignmentDraft>(
    emptyAssignment,
  );
  const [editingAssignmentIdx, setEditingAssignmentIdx] = React.useState<number | null>(null);
  const [editAssignmentDraft, setEditAssignmentDraft] = React.useState<AssignmentDraft | null>(
    null,
  );

  /* -- Patch library -- */
  const [patches, setPatches] = React.useState<PatchDraft[]>([]);
  const [addingPatch, setAddingPatch] = React.useState(false);
  const [newPatchDraft, setNewPatchDraft] = React.useState<PatchDraft>(() => emptyPatch(0));
  const [editingPatchIdx, setEditingPatchIdx] = React.useState<number | null>(null);
  const [editPatchDraft, setEditPatchDraft] = React.useState<PatchDraft | null>(null);

  /* -- Dirty tracking -- */
  const [dirty, setDirty] = React.useState(false);

  /* -- Hydrate from server -- */
  React.useEffect(() => {
    if (!config) return;
    setBlendedPrice((config.addOnPrices?.name ?? 0) + (config.addOnPrices?.number ?? 0) || 100);
    setAssignments(config.assignments ?? []);
    setPatches(
      (config.patches ?? []).map((p) => ({
        _id: p._id,
        name: p.name,
        abbreviation: p.abbreviation,
        color: p.color,
        imageUrl: p.imageUrl ?? "",
        price: p.price,
        isActive: p.isActive,
        order: p.order,
      })),
    );
    setDirty(false);
  }, [config]);

  /* -- Patch ops -- */
  const commitAddPatch = () => {
    setPatches((p) => [...p, { ...newPatchDraft, order: p.length }]);
    setAddingPatch(false);
    setNewPatchDraft(emptyPatch(patches.length + 1));
    setDirty(true);
  };

  const commitEditPatch = () => {
    if (editingPatchIdx === null || !editPatchDraft) return;
    setPatches((p) => p.map((item, i) => (i === editingPatchIdx ? editPatchDraft : item)));
    setEditingPatchIdx(null);
    setEditPatchDraft(null);
    setDirty(true);
  };

  const deletePatch = (idx: number) => {
    const deletedId = patches[idx]?._id;
    setPatches((p) => p.filter((_, i) => i !== idx).map((item, i) => ({ ...item, order: i })));
    // remove this patch from any assignment's patchIds
    if (deletedId) {
      setAssignments((prev) =>
        prev.map((a) => ({ ...a, patchIds: a.patchIds.filter((id) => id !== deletedId) })),
      );
    }
    setDirty(true);
  };

  const movePatch = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= patches.length) return;
    const arr = [...patches];
    const tmp = arr[idx]!;
    arr[idx] = arr[next]!;
    arr[next] = tmp;
    setPatches(arr.map((item, i) => ({ ...item, order: i })));
    setDirty(true);
  };

  /* -- Assignment ops -- */
  const commitAddAssignment = () => {
    const d = newAssignmentDraft;
    setAssignments((prev) => [
      ...prev,
      {
        targetType: d.targetType,
        targetId: d.targetId,
        targetLabel: d.targetLabel,
        targetImage: d.targetImage,
        allPatches: d.allPatches,
        patchIds: d.patchIds,
        allowName: d.allowName,
        allowNumber: d.allowNumber,
      },
    ]);
    setAddingAssignment(false);
    setNewAssignmentDraft(emptyAssignment());
    setDirty(true);
  };

  const commitEditAssignment = () => {
    if (editingAssignmentIdx === null || !editAssignmentDraft) return;
    const d = editAssignmentDraft;
    setAssignments((prev) =>
      prev.map((item, i) =>
        i === editingAssignmentIdx
          ? {
              ...item,
              targetType: d.targetType,
              targetId: d.targetId,
              targetLabel: d.targetLabel,
              targetImage: d.targetImage,
              allPatches: d.allPatches,
              patchIds: d.patchIds,
              allowName: d.allowName,
              allowNumber: d.allowNumber,
            }
          : item,
      ),
    );
    setEditingAssignmentIdx(null);
    setEditAssignmentDraft(null);
    setDirty(true);
  };

  const deleteAssignment = (idx: number) => {
    setAssignments((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  /* -- Current patch library as CustomizationPatch[] for AssignmentEditor -- */
  const patchLibrary: CustomizationPatch[] = patches.map((p, i) => ({
    _id: p._id ?? `draft-${i}`,
    name: p.name,
    abbreviation: p.abbreviation,
    color: p.color,
    imageUrl: p.imageUrl || undefined,
    price: Number(p.price) || 0,
    isActive: p.isActive,
    order: p.order,
  }));

  /* -- Save -- */
  const onSave = async () => {
    try {
      await update.mutateAsync({
        assignments: assignments.map((a) => ({
          ...(a._id ? { _id: a._id } : {}),
          targetType: a.targetType,
          targetId: a.targetId,
          allPatches: a.allPatches,
          patchIds: a.patchIds,
          allowName: a.allowName,
          allowNumber: a.allowNumber,
        })),
        addOnPrices: {
          name: Number(blendedPrice) || 0,
          number: 0,
        },
        patches: patches.map((p, i) => ({
          ...(p._id ? { _id: p._id } : {}),
          name: p.name,
          abbreviation: p.abbreviation,
          color: p.color,
          imageUrl: p.imageUrl || undefined,
          price: Number(p.price) || 0,
          isActive: p.isActive,
          order: i,
        })),
      });
      toast({ title: "Customization settings saved", tone: "success" });
      setDirty(false);
    } catch (err) {
      const msg = err instanceof AdminError ? err.message : "Could not save";
      toast({ title: msg, tone: "error" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="mx-auto max-w-3xl space-y-6 pb-10"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">Customizations</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Assign patches and personalisation options to specific products or categories.
        </p>
      </div>

      {/* ── Section: Add-on prices ── */}
      <div className="rounded-sm border border-neutral-200 bg-paper p-5">
        <div className="mb-4 flex items-center gap-2">
          <Tag className="h-4 w-4 text-neutral-400" aria-hidden />
          <h2 className="text-sm font-semibold text-ink">Personalisation price</h2>
        </div>
        <div className="flex flex-col gap-1 max-w-xs">
          <Label htmlFor="price-blended">Name + Number (BDT)</Label>
          <Input
            id="price-blended"
            type="number"
            min={0}
            max={100000}
            value={blendedPrice}
            onChange={(e) => {
              setBlendedPrice(e.target.value === "" ? "" : Number(e.target.value));
              setDirty(true);
            }}
            placeholder="100"
          />
          <p className="text-xs text-neutral-400">Added when customer personalises with a name and/or number</p>
        </div>
      </div>

      {/* ── Section: Patch library ── */}
      <div className="rounded-sm border border-neutral-200 bg-paper p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-neutral-400" aria-hidden />
            <h2 className="text-sm font-semibold text-ink">Patch library</h2>
            {patches.length > 0 ? <Badge variant="muted">{patches.length}</Badge> : null}
          </div>
          {!addingPatch ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setAddingPatch(true);
                setNewPatchDraft(emptyPatch(patches.length));
              }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              <span className="ml-1">Add patch</span>
            </Button>
          ) : null}
        </div>

        {patches.length === 0 && !addingPatch ? (
          <div className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-neutral-200 py-10 text-center">
            <Palette className="h-8 w-8 text-neutral-300" aria-hidden />
            <p className="text-sm font-medium text-neutral-500">No patches yet</p>
            <p className="text-xs text-neutral-400">
              Add club crests, league badges, or any patch customers can add to their jersey.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-1"
              onClick={() => {
                setAddingPatch(true);
                setNewPatchDraft(emptyPatch(0));
              }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add first patch
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {patches.map((patch, idx) =>
              editingPatchIdx === idx ? (
                <PatchEditor
                  key={idx}
                  draft={editPatchDraft!}
                  onChange={(d) => setEditPatchDraft(d)}
                  onSave={commitEditPatch}
                  onCancel={() => {
                    setEditingPatchIdx(null);
                    setEditPatchDraft(null);
                  }}
                  isNew={false}
                />
              ) : (
                <PatchRow
                  key={patch._id ?? idx}
                  patch={patch}
                  index={idx}
                  total={patches.length}
                  onEdit={() => {
                    setEditingPatchIdx(idx);
                    setEditPatchDraft({ ...patch });
                  }}
                  onDelete={() => deletePatch(idx)}
                  onMoveUp={() => movePatch(idx, -1)}
                  onMoveDown={() => movePatch(idx, 1)}
                />
              ),
            )}
          </div>
        )}

        {addingPatch ? (
          <div className="mt-2">
            <PatchEditor
              draft={newPatchDraft}
              onChange={setNewPatchDraft}
              onSave={commitAddPatch}
              onCancel={() => setAddingPatch(false)}
              isNew
            />
          </div>
        ) : null}
      </div>

      {/* ── Section: Assignments ── */}
      <div className="rounded-sm border border-neutral-200 bg-paper p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-neutral-400" aria-hidden />
            <h2 className="text-sm font-semibold text-ink">Customisation assignments</h2>
            {assignments.length > 0 ? (
              <Badge variant="muted">{assignments.length}</Badge>
            ) : null}
          </div>
          {!addingAssignment ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setAddingAssignment(true);
                setNewAssignmentDraft(emptyAssignment());
              }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              <span className="ml-1">Add assignment</span>
            </Button>
          ) : null}
        </div>

        {assignments.length === 0 && !addingAssignment ? (
          <div className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-neutral-200 py-10 text-center">
            <Package className="h-8 w-8 text-neutral-300" aria-hidden />
            <p className="text-sm font-medium text-neutral-500">No assignments yet</p>
            <p className="max-w-xs text-xs text-neutral-400">
              Assign the customisation panel to specific products or whole categories. Each
              assignment can have its own patch selection and options.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-1"
              onClick={() => {
                setAddingAssignment(true);
                setNewAssignmentDraft(emptyAssignment());
              }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add first assignment
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {assignments.map((assignment, idx) =>
              editingAssignmentIdx === idx ? (
                <AssignmentEditor
                  key={idx}
                  draft={editAssignmentDraft!}
                  onChange={(d) => setEditAssignmentDraft(d)}
                  onSave={commitEditAssignment}
                  onCancel={() => {
                    setEditingAssignmentIdx(null);
                    setEditAssignmentDraft(null);
                  }}
                  patches={patchLibrary}
                  allCategories={allCategories}
                  isNew={false}
                />
              ) : (
                <AssignmentRow
                  key={assignment._id ?? idx}
                  assignment={assignment}
                  patches={patchLibrary}
                  onEdit={() => {
                    setEditingAssignmentIdx(idx);
                    setEditAssignmentDraft({
                      _id: assignment._id,
                      targetType: assignment.targetType,
                      targetId: assignment.targetId,
                      targetLabel: assignment.targetLabel,
                      targetImage: assignment.targetImage,
                      allPatches: assignment.allPatches,
                      patchIds: assignment.patchIds,
                      allowName: assignment.allowName,
                      allowNumber: assignment.allowNumber,
                    });
                  }}
                  onDelete={() => deleteAssignment(idx)}
                />
              ),
            )}
          </div>
        )}

        {addingAssignment ? (
          <div className="mt-2">
            <AssignmentEditor
              draft={newAssignmentDraft}
              onChange={setNewAssignmentDraft}
              onSave={commitAddAssignment}
              onCancel={() => setAddingAssignment(false)}
              patches={patchLibrary}
              allCategories={allCategories}
              isNew
            />
          </div>
        ) : null}
      </div>

      <FormStickyBar
        mode="edit"
        isDirty={dirty}
        isSubmitting={update.isPending}
        submitLabel="Save settings"
      />
    </form>
  );
}
