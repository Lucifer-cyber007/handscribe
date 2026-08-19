"use client";

import { FIELD_TYPE_OPTIONS, FieldSchema, FieldType } from "@/lib/types";

interface FieldBuilderProps {
  fields: FieldSchema[];
  onChange: (fields: FieldSchema[]) => void;
}

function emptyField(): FieldSchema {
  return { name: "", field_type: "alphanumeric", regex_pattern: "", required: false };
}

export default function FieldBuilder({ fields, onChange }: FieldBuilderProps) {
  const updateField = (index: number, patch: Partial<FieldSchema>) => {
    const next = fields.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const addField = () => onChange([...fields, emptyField()]);

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = fields.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="text-sm text-slate-500">
          No fields yet. Add at least one field to describe what to extract.
        </p>
      )}

      {fields.map((field, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center"
        >
          <div className="flex flex-col gap-1 sm:w-16">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => moveField(index, -1)}
                disabled={index === 0}
                className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-500 disabled:opacity-30"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveField(index, 1)}
                disabled={index === fields.length - 1}
                className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-500 disabled:opacity-30"
                aria-label="Move down"
              >
                ↓
              </button>
            </div>
          </div>

          <input
            type="text"
            value={field.name}
            onChange={(e) => updateField(index, { name: e.target.value })}
            placeholder="Field name (e.g. Invoice Number)"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />

          <select
            value={field.field_type}
            onChange={(e) => updateField(index, { field_type: e.target.value as FieldType })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-44"
          >
            {FIELD_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {field.field_type === "custom_regex" && (
            <input
              type="text"
              value={field.regex_pattern || ""}
              onChange={(e) => updateField(index, { regex_pattern: e.target.value })}
              placeholder="Regex pattern, e.g. ^[A-Z]{2}\\d{4}$"
              className="rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-56"
            />
          )}

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => updateField(index, { required: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Required
          </label>

          <button
            type="button"
            onClick={() => removeField(index)}
            className="text-sm font-medium text-red-500 hover:text-red-700"
            aria-label="Remove field"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addField}
        className="rounded-md border border-dashed border-brand-400 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
      >
        + Add field
      </button>
    </div>
  );
}
