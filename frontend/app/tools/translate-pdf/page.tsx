"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import { useToast } from "@/components/Toast";
import { ApiError, translatePdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";

const LANGUAGE_GROUPS: { group: string; languages: { code: string; label: string }[] }[] = [
  {
    group: "Indian languages",
    languages: [
      { code: "hi", label: "Hindi" },
      { code: "bn", label: "Bengali" },
      { code: "ta", label: "Tamil" },
      { code: "te", label: "Telugu" },
      { code: "mr", label: "Marathi" },
      { code: "gu", label: "Gujarati" },
      { code: "kn", label: "Kannada" },
      { code: "ml", label: "Malayalam" },
      { code: "pa", label: "Punjabi" },
      { code: "ur", label: "Urdu" },
      { code: "ne", label: "Nepali" },
      { code: "si", label: "Sinhala" },
    ],
  },
  {
    group: "East & Southeast Asian",
    languages: [
      { code: "zh", label: "Chinese (Simplified)" },
      { code: "zh-TW", label: "Chinese (Traditional)" },
      { code: "ja", label: "Japanese" },
      { code: "ko", label: "Korean" },
      { code: "vi", label: "Vietnamese" },
      { code: "th", label: "Thai" },
      { code: "id", label: "Indonesian" },
      { code: "ms", label: "Malay" },
      { code: "fil", label: "Filipino" },
      { code: "my", label: "Burmese" },
      { code: "km", label: "Khmer" },
      { code: "lo", label: "Lao" },
      { code: "mn", label: "Mongolian" },
    ],
  },
  {
    group: "European",
    languages: [
      { code: "es", label: "Spanish" },
      { code: "fr", label: "French" },
      { code: "de", label: "German" },
      { code: "it", label: "Italian" },
      { code: "pt", label: "Portuguese" },
      { code: "nl", label: "Dutch" },
      { code: "pl", label: "Polish" },
      { code: "ru", label: "Russian" },
      { code: "uk", label: "Ukrainian" },
      { code: "el", label: "Greek" },
      { code: "sv", label: "Swedish" },
      { code: "no", label: "Norwegian" },
      { code: "da", label: "Danish" },
      { code: "fi", label: "Finnish" },
      { code: "cs", label: "Czech" },
      { code: "ro", label: "Romanian" },
      { code: "hu", label: "Hungarian" },
      { code: "bg", label: "Bulgarian" },
      { code: "hr", label: "Croatian" },
      { code: "sk", label: "Slovak" },
      { code: "sr", label: "Serbian" },
    ],
  },
  {
    group: "Other",
    languages: [
      { code: "en", label: "English" },
      { code: "ar", label: "Arabic" },
      { code: "tr", label: "Turkish" },
    ],
  },
];

export default function TranslatePdfPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [sourceLanguage, setSourceLanguage] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("hi");
  const [loading, setLoading] = useState(false);

  const handleTranslate = async () => {
    if (files.length === 0) {
      showToast("Add a PDF first.", "error");
      return;
    }
    if (sourceLanguage === targetLanguage) {
      showToast("Pick two different languages.", "error");
      return;
    }
    setLoading(true);
    try {
      const { blob, isTextFallback } = await translatePdf(
        files[0],
        sourceLanguage || null,
        targetLanguage
      );
      if (isTextFallback) {
        downloadBlob(blob, "translated-text-fallback.txt");
        showToast(
          "This PDF had no extractable text (likely a scan/photo), so it was OCR'd and " +
            "translated as plain text instead — layout couldn't be preserved.",
          "info"
        );
      } else {
        downloadBlob(blob, "translated.pdf");
        showToast("Translated PDF downloaded.", "success");
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Translation failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolPageShell
      title="Translate PDF"
      description="Translate a PDF while keeping its layout and formatting intact. Google adds a small 'Machine Translated by Google' notice to the output."
    >
      <div className="space-y-4">
        <FileDropZone
          files={files}
          onChange={setFiles}
          accept="application/pdf"
          acceptedTypes={["application/pdf"]}
          label="Select PDF file"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-300">From</label>
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
            >
              <option value="">Auto-detect</option>
              {LANGUAGE_GROUPS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-300">To</label>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
            >
              {LANGUAGE_GROUPS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={handleTranslate}
          disabled={loading || files.length === 0}
          className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Translating…" : "Translate PDF"}
        </button>
      </div>
    </ToolPageShell>
  );
}
