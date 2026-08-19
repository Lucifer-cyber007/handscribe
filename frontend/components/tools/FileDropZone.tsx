"use client";

import { useCallback, useRef, useState } from "react";

interface FileDropZoneProps {
  files: File[];
  onChange: (files: File[]) => void;
  accept: string;
  acceptedTypes: string[];
  multiple?: boolean;
  label?: string;
  hint?: string;
}

export default function FileDropZone({
  files,
  onChange,
  accept,
  acceptedTypes,
  multiple = false,
  label = "Select file",
  hint = "or drop it here",
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      const accepted = incoming.filter((f) => acceptedTypes.includes(f.type));
      const rejected = incoming.length - accepted.length;

      setError(rejected > 0 ? `Skipped ${rejected} unsupported file(s).` : null);
      onChange(multiple ? [...files, ...accepted] : accepted.slice(0, 1));
    },
    [files, multiple, onChange, acceptedTypes]
  );

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          isDragging ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white"
        }`}
      >
        <span className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
          {label}
        </span>
        <p className="mt-3 text-xs text-slate-500">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {files.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="truncate text-slate-700">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="ml-2 shrink-0 font-medium text-red-500 hover:text-red-700"
                aria-label={`Remove ${file.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
