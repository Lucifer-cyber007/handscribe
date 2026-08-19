"use client";

import { ExtractionHistoryItem } from "@/lib/types";

interface HistoryListProps {
  items: ExtractionHistoryItem[];
  loading: boolean;
}

export default function HistoryList({ items, loading }: HistoryListProps) {
  if (loading) {
    return <p className="text-sm text-slate-500">Loading history…</p>;
  }

  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No extractions yet.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {items.map((item) => (
        <li key={item.id} className="px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">
              {item.template_name || "Ad-hoc fields"}
            </span>
            <span className="text-xs text-slate-400">
              {new Date(item.created_at).toLocaleString("en-GB")}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">{item.preview}</p>
        </li>
      ))}
    </ul>
  );
}
