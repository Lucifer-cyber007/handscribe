"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, fillForm, getFormFields } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";
import { FormField } from "@/lib/types";

export default function PdfFormsPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [fields, setFields] = useState<FormField[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [detecting, setDetecting] = useState(false);
  const [filling, setFilling] = useState(false);

  const handleDetect = async () => {
    if (files.length === 0) {
      showToast("Add a PDF first.", "error");
      return;
    }
    setDetecting(true);
    setFields(null);
    try {
      const result = await getFormFields(files[0]);
      setFields(result.fields);
      const initial: Record<string, string> = {};
      result.fields.forEach((f) => {
        initial[f.name] = f.type === "checkbox" ? (f.value === "Yes" ? "true" : "false") : f.value;
      });
      setValues(initial);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't detect form fields.", "error");
    } finally {
      setDetecting(false);
    }
  };

  const handleFill = async () => {
    if (files.length === 0 || !fields) return;
    setFilling(true);
    try {
      const blob = await fillForm(files[0], values);
      downloadBlob(blob, "filled.pdf");
      showToast("Filled PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't fill this form.", "error");
    } finally {
      setFilling(false);
    }
  };

  return (
    <ToolPageShell
      title="PDF Forms"
      description="Detect the fillable fields already in a PDF form (e.g. a government or application form), then fill them in and download."
    >
      <div className="space-y-6">
        <div className="space-y-4">
          <FileDropZone
            files={files}
            onChange={(next) => {
              setFiles(next);
              setFields(null);
            }}
            accept="application/pdf"
            acceptedTypes={["application/pdf"]}
            label="Select PDF file"
          />
          <button
            type="button"
            onClick={handleDetect}
            disabled={detecting || files.length === 0}
            className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {detecting ? "Detecting…" : "Detect form fields"}
          </button>
        </div>

        {fields && fields.length > 0 && (
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-medium text-slate-900 dark:text-slate-50">
              {fields.length} field{fields.length === 1 ? "" : "s"} found
            </h2>
            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.name}>
                  <label className="text-sm text-slate-600 dark:text-slate-300">
                    {field.name} <span className="text-xs text-slate-400 dark:text-slate-500">(page {field.page})</span>
                  </label>
                  {field.type === "checkbox" ? (
                    <div className="mt-1">
                      <input
                        type="checkbox"
                        checked={values[field.name] === "true"}
                        onChange={(e) =>
                          setValues({ ...values, [field.name]: e.target.checked ? "true" : "false" })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={values[field.name] ?? ""}
                      onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleFill}
              disabled={filling}
              className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {filling ? "Filling…" : "Fill & download"}
            </button>
          </div>
        )}
      </div>
    </ToolPageShell>
  );
}
