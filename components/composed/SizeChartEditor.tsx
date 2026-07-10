"use client";

import * as React from "react";
import { ChevronDown, Plus, Ruler, Save, Trash2, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

/* ── Types ── */

export interface SizeChartRowDraft {
  _key: string;
  size: string;
  values: string[];
}

export interface SizeChartDraft {
  unit: "cm" | "inches";
  columns: string[];
  rows: SizeChartRowDraft[];
  notes: string;
}

export interface SizeChartInput {
  unit: "cm" | "inches";
  columns: string[];
  rows: Array<{ size: string; values: string[] }>;
  notes?: string;
}

/* ── Converters ── */

export function sizeChartToDraft(chart: {
  unit?: string;
  columns?: string[];
  rows?: Array<{ size?: string; values?: string[] }>;
  notes?: string;
}): SizeChartDraft {
  return {
    unit: chart.unit === "inches" ? "inches" : "cm",
    columns: [...(chart.columns ?? [])],
    rows: (chart.rows ?? []).map((r, i) => ({
      _key: `h${i}_${Date.now()}`,
      size: r.size ?? "",
      values: [...(r.values ?? [])],
    })),
    notes: chart.notes ?? "",
  };
}

export function draftToSizeChartInput(draft: SizeChartDraft): SizeChartInput | undefined {
  const filledRows = draft.rows.filter((r) => r.size.trim());
  if (draft.columns.length === 0 || filledRows.length === 0) return undefined;
  return {
    unit: draft.unit,
    columns: draft.columns,
    rows: filledRows.map((r) => ({ size: r.size, values: r.values })),
    notes: draft.notes.trim() || undefined,
  };
}

/* ── Template helpers (localStorage) ── */

const LS_KEY = "solobo_sc_tpl";

function loadUserTemplates(): Record<string, SizeChartDraft> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}"); }
  catch { return {}; }
}

function saveUserTemplate(name: string, draft: SizeChartDraft): void {
  const t = loadUserTemplates();
  t[name] = draft;
  localStorage.setItem(LS_KEY, JSON.stringify(t));
}

function deleteUserTemplate(name: string): void {
  const t = loadUserTemplates();
  delete t[name];
  localStorage.setItem(LS_KEY, JSON.stringify(t));
}

/* ── Key factory ── */

let _seq = 0;
function newKey(): string { return `k${++_seq}_${Date.now()}`; }

/* ── Built-in presets ── */

type Preset = { unit: "cm" | "inches"; columns: string[]; rows: SizeChartRowDraft[] };

const PRESETS: Record<string, Preset> = {
  "Football Jersey (XS–XXXL)": {
    unit: "cm",
    columns: ["Chest", "Length"],
    rows: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"].map((s, i) => ({ _key: `fj${i}`, size: s, values: ["", ""] })),
  },
  "Apparel (XS–XXXL)": {
    unit: "cm",
    columns: ["Chest", "Waist", "Hip", "Length"],
    rows: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"].map((s, i) => ({ _key: `ap${i}`, size: s, values: ["", "", "", ""] })),
  },
  "Shorts & Bottoms (XS–XXXL)": {
    unit: "cm",
    columns: ["Waist", "Hip", "Inseam", "Length"],
    rows: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"].map((s, i) => ({ _key: `bt${i}`, size: s, values: ["", "", "", ""] })),
  },
  "Shoes EU (36–46)": {
    unit: "cm",
    columns: ["EU", "US (M)", "US (W)", "UK", "Foot length"],
    rows: [
      ["36", "4", "5.5", "3.5", "22.5"],
      ["37", "5", "6.5", "4", "23"],
      ["38", "6", "7.5", "5", "24"],
      ["39", "7", "8.5", "6", "24.5"],
      ["40", "7.5", "9", "6.5", "25"],
      ["41", "8", "9.5", "7", "25.5"],
      ["42", "8.5", "10", "7.5", "26.5"],
      ["43", "9.5", "11", "8.5", "27"],
      ["44", "10", "11.5", "9", "28"],
      ["45", "11", "12.5", "10", "29"],
      ["46", "12", "13.5", "11", "29.5"],
    ].map((v, i) => ({ _key: `sh${i}`, size: v[0] ?? "", values: v.slice(1) })),
  },
  "Kids (2Y–14Y)": {
    unit: "cm",
    columns: ["Height", "Chest", "Waist"],
    rows: [
      { _key: "k0", size: "2Y", values: ["88–92", "52–54", "51–53"] },
      { _key: "k1", size: "4Y", values: ["100–104", "54–56", "53–55"] },
      { _key: "k2", size: "6Y", values: ["112–116", "57–60", "55–57"] },
      { _key: "k3", size: "8Y", values: ["124–128", "61–64", "57–59"] },
      { _key: "k4", size: "10Y", values: ["136–140", "65–68", "59–62"] },
      { _key: "k5", size: "12Y", values: ["148–152", "70–74", "62–65"] },
      { _key: "k6", size: "14Y", values: ["160–164", "76–80", "65–68"] },
    ],
  },
};

/* ── Empty draft factory ── */

function emptyDraft(): SizeChartDraft {
  return {
    unit: "cm",
    columns: ["Chest", "Waist", "Length"],
    rows: ["XS", "S", "M", "L", "XL", "XXL"].map((s, i) => ({
      _key: `init${i}`,
      size: s,
      values: ["", "", ""],
    })),
    notes: "",
  };
}

/* ── Props ── */

export interface SizeChartEditorProps {
  value: SizeChartDraft | null;
  onChange: (next: SizeChartDraft | null) => void;
}

/* ── Component ── */

export function SizeChartEditor({ value, onChange }: SizeChartEditorProps) {
  const [newColName, setNewColName] = React.useState("");
  const [savePrompt, setSavePrompt] = React.useState(false);
  const [saveName, setSaveName] = React.useState("");
  const [userTemplates, setUserTemplates] = React.useState<Record<string, SizeChartDraft>>({});
  const [showTemplates, setShowTemplates] = React.useState(false);
  const templateMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setUserTemplates(loadUserTemplates());
  }, []);

  React.useEffect(() => {
    if (!showTemplates) return;
    function handler(e: MouseEvent) {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setShowTemplates(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTemplates]);

  /* ── No chart state ── */

  if (!value) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-dashed border-neutral-200 px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-neutral-600">No size chart</span>
          <span className="text-xs text-neutral-400">
            Add measurements to help customers find the right fit.
          </span>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange(emptyDraft())}>
          <Ruler className="h-4 w-4" aria-hidden />
          <span className="ml-1.5">Add size chart</span>
        </Button>
      </div>
    );
  }

  /* ── Updater ── */

  const update = (fn: (d: SizeChartDraft) => SizeChartDraft) => onChange(fn(value));

  /* ── Column ops ── */

  const addColumn = () => {
    const col = newColName.trim();
    if (!col || value.columns.includes(col)) return;
    update((d) => ({
      ...d,
      columns: [...d.columns, col],
      rows: d.rows.map((r) => ({ ...r, values: [...r.values, ""] })),
    }));
    setNewColName("");
  };

  const removeColumn = (ci: number) =>
    update((d) => ({
      ...d,
      columns: d.columns.filter((_, i) => i !== ci),
      rows: d.rows.map((r) => ({
        ...r,
        values: r.values.filter((_, i) => i !== ci),
      })),
    }));

  const renameColumn = (ci: number, name: string) =>
    update((d) => ({
      ...d,
      columns: d.columns.map((c, i) => (i === ci ? name : c)),
    }));

  /* ── Row ops ── */

  const addRow = () =>
    update((d) => ({
      ...d,
      rows: [
        ...d.rows,
        { _key: newKey(), size: "", values: Array<string>(d.columns.length).fill("") },
      ],
    }));

  const removeRow = (key: string) =>
    update((d) => ({ ...d, rows: d.rows.filter((r) => r._key !== key) }));

  const setRowSize = (key: string, size: string) =>
    update((d) => ({
      ...d,
      rows: d.rows.map((r) => (r._key === key ? { ...r, size } : r)),
    }));

  const setRowValue = (key: string, ci: number, val: string) =>
    update((d) => ({
      ...d,
      rows: d.rows.map((r) =>
        r._key === key
          ? { ...r, values: r.values.map((v, i) => (i === ci ? val : v)) }
          : r,
      ),
    }));

  /* ── Template ops ── */

  const applyTemplate = (tpl: Preset | SizeChartDraft) => {
    onChange({
      unit: tpl.unit,
      columns: [...tpl.columns],
      rows: tpl.rows.map((r) => ({ ...r, _key: newKey(), values: [...r.values] })),
      notes: "notes" in tpl ? (tpl as SizeChartDraft).notes : "",
    });
    setShowTemplates(false);
  };

  const handleSaveTemplate = () => {
    const name = saveName.trim();
    if (!name) return;
    saveUserTemplate(name, value);
    setUserTemplates(loadUserTemplates());
    setSavePrompt(false);
    setSaveName("");
  };

  const handleDeleteUserTemplate = (name: string) => {
    deleteUserTemplate(name);
    setUserTemplates(loadUserTemplates());
  };

  const userTemplateNames = Object.keys(userTemplates);

  /* ── Render ── */

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Unit toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-500">Unit</span>
          <div className="inline-flex items-center rounded-lg border border-neutral-200 p-0.5 text-xs">
            {(["cm", "inches"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => update((d) => ({ ...d, unit: u }))}
                className={cn(
                  "rounded-lg px-2.5 py-1 transition-colors",
                  value.unit === u ? "bg-ink text-white" : "text-neutral-600 hover:text-ink",
                )}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Template loader */}
          <div className="relative" ref={templateMenuRef}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
            >
              Load template
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" aria-hidden />
            </Button>
            {showTemplates ? (
              <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                  Presets
                </div>
                {Object.entries(PRESETS).map(([name, preset]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => applyTemplate(preset)}
                    className="flex w-full items-center px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-ink"
                  >
                    {name}
                  </button>
                ))}
                {userTemplateNames.length > 0 ? (
                  <>
                    <div className="my-1 border-t border-neutral-100" />
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                      Saved
                    </div>
                    {userTemplateNames.map((name) => (
                      <div key={name} className="flex items-center gap-1 pr-1">
                        <button
                          type="button"
                          onClick={() => applyTemplate(userTemplates[name]!)}
                          className="flex flex-1 items-center px-3 py-2 text-sm text-neutral-700 hover:text-ink"
                        >
                          {name}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUserTemplate(name)}
                          className="rounded-lg p-1.5 text-neutral-400 hover:text-ink"
                          aria-label={`Delete template ${name}`}
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                        </button>
                      </div>
                    ))}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Save as template */}
          {savePrompt ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleSaveTemplate(); }
                  if (e.key === "Escape") { setSavePrompt(false); setSaveName(""); }
                }}
                placeholder="Template name…"
                autoFocus
                className="h-8 w-40 text-sm"
              />
              <Button type="button" size="sm" onClick={handleSaveTemplate} disabled={!saveName.trim()}>
                <Save className="h-4 w-4" aria-hidden />
              </Button>
              <button
                type="button"
                onClick={() => { setSavePrompt(false); setSaveName(""); }}
                className="rounded-lg p-1.5 text-neutral-400 hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ) : (
            <Button type="button" variant="secondary" size="sm" onClick={() => setSavePrompt(true)}>
              <Save className="h-4 w-4" aria-hidden />
              <span className="ml-1.5">Save as template</span>
            </Button>
          )}

          {/* Remove chart */}
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-600 hover:border-ink hover:text-ink"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Remove
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50">
              <th className="w-24 py-2 pl-4 pr-2 text-left text-xs font-semibold text-neutral-500">
                Size
              </th>
              {value.columns.map((col, ci) => (
                <th key={ci} className="py-2 px-2 text-left">
                  <div className="flex items-center gap-1">
                    <input
                      value={col}
                      onChange={(e) => renameColumn(ci, e.target.value)}
                      className="min-w-0 w-24 border-0 bg-transparent text-xs font-semibold text-neutral-600 focus:outline-none focus:border-b focus:border-neutral-300"
                    />
                    <button
                      type="button"
                      onClick={() => removeColumn(ci)}
                      className="shrink-0 text-neutral-300 hover:text-ink"
                      aria-label={`Remove column ${col}`}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-8 py-2 px-2" />
            </tr>
          </thead>
          <tbody>
            {value.rows.map((row) => (
              <tr key={row._key} className="border-b border-neutral-100 last:border-0">
                <td className="py-1.5 pl-4 pr-2">
                  <Input
                    value={row.size}
                    onChange={(e) => setRowSize(row._key, e.target.value)}
                    placeholder="S"
                    className="h-7 w-20 text-xs font-semibold"
                  />
                </td>
                {row.values.map((val, ci) => (
                  <td key={ci} className="py-1.5 px-2">
                    <Input
                      value={val}
                      onChange={(e) => setRowValue(row._key, ci, e.target.value)}
                      placeholder={`- ${value.unit}`}
                      className="h-7 w-24 text-xs tabular-nums"
                    />
                  </td>
                ))}
                <td className="py-1.5 px-2">
                  <button
                    type="button"
                    onClick={() => removeRow(row._key)}
                    className="text-neutral-300 hover:text-ink"
                    aria-label="Remove row"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row + column controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4" aria-hidden />
          <span className="ml-1.5">Add size</span>
        </Button>
        <div className="flex items-center gap-1.5">
          <Input
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addColumn(); }
            }}
            placeholder="Column name…"
            className="h-8 w-36 text-sm"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addColumn}
            disabled={!newColName.trim()}
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span className="ml-1.5">Add column</span>
          </Button>
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-neutral-500">
          Measuring instructions
          <span className="ml-1 font-normal text-neutral-400">(optional)</span>
        </span>
        <textarea
          rows={2}
          value={value.notes}
          onChange={(e) => update((d) => ({ ...d, notes: e.target.value }))}
          placeholder="How to measure: wrap a soft tape around the fullest part of your chest, keeping it horizontal…"
          className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-neutral-400 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1"
        />
      </div>
    </div>
  );
}
