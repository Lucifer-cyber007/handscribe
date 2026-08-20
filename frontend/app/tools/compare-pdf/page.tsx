"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, comparePdfs } from "@/lib/api";
import { DiffSegment } from "@/lib/types";

function isPageMarker(line: string): boolean {
  return /^===== Page \d+ =====$/.test(line);
}

interface DisplayLine {
  text: string;
  kind: "context" | "removed" | "added" | "page-marker";
}

function toDisplayLines(segments: DiffSegment[]): DisplayLine[] {
  const lines: DisplayLine[] = [];
  for (const seg of segments) {
    if (seg.type === "equal") {
      for (const line of seg.a_lines) {
        lines.push({ text: line, kind: isPageMarker(line) ? "page-marker" : "context" });
      }
    } else {
      for (const line of seg.a_lines) {
        lines.push({ text: line, kind: isPageMarker(line) ? "page-marker" : "removed" });
      }
      for (const line of seg.b_lines) {
        lines.push({ text: line, kind: isPageMarker(line) ? "page-marker" : "added" });
      }
    }
  }
  return lines;
}

export default function ComparePdfPage() {
  const { showToast } = useToast();
  const [fileA, setFileA] = useState<File[]>([]);
  const [fileB, setFileB] = useState<File[]>([]);
  const [lines, setLines] = useState<DisplayLine[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    if (fileA.length === 0 || fileB.length === 0) {
      showToast("Add both PDFs first.", "error");
      return;
    }
    setLoading(true);
    setLines(null);
    try {
      const result = await comparePdfs(fileA[0], fileB[0]);
      const displayLines = toDisplayLines(result.segments);
      setLines(displayLines);
      const changed = displayLines.some((l) => l.kind === "removed" || l.kind === "added");
      showToast(changed ? "Differences found — see below." : "No differences found.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Comparison failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell
      title="Compare PDF"
      description="Spot the text differences between two versions of a PDF — added lines in green, removed lines in red."
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">First PDF</label>
            <div className="mt-1">
              <FileDropZone
                files={fileA}
                onChange={setFileA}
                accept="application/pdf"
                acceptedTypes={["application/pdf"]}
                label="Select PDF"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Second PDF</label>
            <div className="mt-1">
              <FileDropZone
                files={fileB}
                onChange={setFileB}
                accept="application/pdf"
                acceptedTypes={["application/pdf"]}
                label="Select PDF"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCompare}
          disabled={loading || fileA.length === 0 || fileB.length === 0}
          className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Comparing…" : "Compare PDFs"}
        </button>

        {lines && (
          <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-slate-200 bg-white font-mono text-xs dark:border-slate-700 dark:bg-slate-900">
            {lines.map((line, i) =>
              line.kind === "page-marker" ? (
                <div
                  key={i}
                  className="border-y border-slate-200 bg-slate-50 px-3 py-1.5 font-sans text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400 dark:bg-slate-800"
                >
                  {line.text}
                </div>
              ) : (
                <div
                  key={i}
                  className={`whitespace-pre-wrap px-3 py-1 ${
                    line.kind === "removed"
                      ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                      : line.kind === "added"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {line.kind === "removed" ? "− " : line.kind === "added" ? "+ " : "  "}
                  {line.text}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </ToolPageShell>
  );
}
