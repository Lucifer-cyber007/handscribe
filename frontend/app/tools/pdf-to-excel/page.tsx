"use client";

import { useState } from "react";
import Link from "next/link";
import ExtractWorkflow from "@/components/tools/ExtractWorkflow";
import PdfTableToExcel from "@/components/tools/PdfTableToExcel";

type Mode = "normal" | "ocr";

export default function PdfToExcelPage() {
  const [mode, setMode] = useState<Mode>("normal");

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Back to tools
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">PDF to Excel</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose the option that matches your PDF, then convert it to Excel.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("normal")}
          className={`rounded-lg border p-4 text-left transition-colors ${
            mode === "normal"
              ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <p className="font-medium text-slate-900">Normal PDF</p>
          <p className="mt-1 text-sm text-slate-500">
            The PDF already has selectable text (e.g. exported from Word, Excel, or a
            website). Converts straight to Excel — no setup needed.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setMode("ocr")}
          className={`rounded-lg border p-4 text-left transition-colors ${
            mode === "ocr"
              ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <p className="font-medium text-slate-900">Scanned / handwritten (OCR)</p>
          <p className="mt-1 text-sm text-slate-500">
            The PDF is a scan, photo, or handwriting with no selectable text. Uses OCR —
            define the fields you want pulled out first.
          </p>
        </button>
      </div>

      {mode === "normal" ? (
        <PdfTableToExcel />
      ) : (
        <ExtractWorkflow
          heading="Scanned / handwritten PDF to Excel"
          description="Define the fields you want, upload one or more PDFs, and export the structured results to Excel."
          acceptedTypes={["application/pdf"]}
          uploadHint="or click to browse — PDF files only"
        />
      )}
    </div>
  );
}
