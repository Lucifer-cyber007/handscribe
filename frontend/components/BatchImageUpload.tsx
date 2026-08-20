"use client";

import { useCallback, useRef, useState } from "react";
import { BatchItem } from "@/lib/types";

interface BatchImageUploadProps {
  items: BatchItem[];
  onChange: (items: BatchItem[]) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  uploadHint?: string;
}

const DEFAULT_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const DEFAULT_UPLOAD_HINT = "or click to browse — JPG, PNG, WEBP, or PDF";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function BatchImageUpload({
  items,
  onChange,
  maxFiles = 50,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  uploadHint = DEFAULT_UPLOAD_HINT,
}: BatchImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      const rejected = incoming.filter((f) => !acceptedTypes.includes(f.type));
      const accepted = incoming.filter((f) => acceptedTypes.includes(f.type));

      const combined = [...items];
      for (const file of accepted) {
        if (combined.length >= maxFiles) break;
        combined.push({ id: makeId(), file, status: "pending" });
      }

      if (rejected.length > 0) {
        setError(`Skipped ${rejected.length} unsupported file(s).`);
      } else if (incoming.length + items.length > maxFiles) {
        setError(`Only the first ${maxFiles} files were kept (limit is ${maxFiles}).`);
      } else {
        setError(null);
      }

      onChange(combined);
    },
    [items, maxFiles, onChange, acceptedTypes]
  );

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const clearAll = () => onChange([]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30"
            : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
        }`}
      >
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Drag & drop up to {maxFiles} files here
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{uploadHint}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            <span>
              {items.length} file{items.length === 1 ? "" : "s"} selected
              {items.length >= maxFiles ? ` (limit reached)` : ""}
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="font-medium text-red-500 hover:text-red-700"
            >
              Clear all
            </button>
          </div>
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:divide-slate-700 dark:bg-slate-900">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="truncate text-slate-700 dark:text-slate-200">{item.file.name}</span>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="ml-2 shrink-0 font-medium text-red-500 hover:text-red-700"
                  aria-label={`Remove ${item.file.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
