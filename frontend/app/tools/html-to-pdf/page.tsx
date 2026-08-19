"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import { useToast } from "@/components/Toast";
import { ApiError, htmlToPdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

export default function HtmlToPdfPage() {
  const { showToast } = useToast();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    if (!url.trim()) {
      showToast("Enter a webpage URL first.", "error");
      return;
    }
    setLoading(true);
    try {
      const blob = await htmlToPdf(url.trim());
      downloadBlob(blob, "webpage.pdf");
      showToast("PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Conversion failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell
      title="HTML to PDF"
      description="Convert a webpage URL to a PDF. Works well for articles, blogs, and simple pages — JavaScript-heavy sites and complex layouts may not render perfectly."
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm text-slate-600">Webpage URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button
          type="button"
          onClick={handleConvert}
          disabled={loading || !url.trim()}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Converting…" : "Convert to PDF"}
        </button>
      </div>
    </ToolPageShell>
  );
}
