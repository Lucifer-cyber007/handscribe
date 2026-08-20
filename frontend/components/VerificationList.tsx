"use client";

import { VerificationItem } from "@/lib/types";

interface VerificationListProps {
  items: VerificationItem[];
  onChange: (items: VerificationItem[]) => void;
}

function emptyItem(): VerificationItem {
  return { label: "", value: "" };
}

export default function VerificationList({ items, onChange }: VerificationListProps) {
  const updateItem = (index: number, patch: Partial<VerificationItem>) => {
    const next = items.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const addItem = () => onChange([...items, emptyItem()]);

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Already know a value and just want to confirm it&apos;s in the document — like a
        specific buyer GSTIN or name? Add it here. This is separate from the fields above and
        isn&apos;t saved to templates.
      </p>

      {items.length === 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500">Nothing to verify yet.</p>
      )}

      {items.map((item, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center dark:border-slate-700 dark:bg-slate-900"
        >
          <input
            type="text"
            value={item.label}
            onChange={(e) => updateItem(index, { label: e.target.value })}
            placeholder="Label (e.g. Buyer GSTIN)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-48 dark:border-slate-600"
          />
          <input
            type="text"
            value={item.value}
            onChange={(e) => updateItem(index, { value: e.target.value })}
            placeholder="Expected value (e.g. 27AAPFU0939F1ZV)"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
          />
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="text-sm font-medium text-red-500 hover:text-red-700"
            aria-label="Remove verification item"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        className="rounded-md border border-dashed border-brand-400 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
      >
        + Add value to verify
      </button>
    </div>
  );
}
