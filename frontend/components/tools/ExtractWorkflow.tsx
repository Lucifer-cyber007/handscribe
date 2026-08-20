"use client";

import { useEffect, useState } from "react";
import BatchImageUpload from "@/components/BatchImageUpload";
import BatchResultsTable from "@/components/BatchResultsTable";
import FieldBuilder from "@/components/FieldBuilder";
import HistoryList from "@/components/HistoryList";
import TemplateManager from "@/components/tools/TemplateManager";
import VerificationList from "@/components/VerificationList";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import { runWithConcurrency } from "@/lib/concurrency";
import { ApiError, extractDocument, listHistory, listTemplates } from "@/lib/api";
import {
  BatchItem,
  ExtractionHistoryItem,
  FieldSchema,
  Template,
  VerificationItem,
} from "@/lib/types";

const MAX_FILES = 50;
const CONCURRENCY = 4;

function emptyField(): FieldSchema {
  return { name: "", field_type: "alphanumeric", regex_pattern: "", required: false };
}

interface ExtractWorkflowProps {
  heading: string;
  description: string;
  acceptedTypes: string[];
  uploadHint: string;
}

export default function ExtractWorkflow({
  heading,
  description,
  acceptedTypes,
  uploadHint,
}: ExtractWorkflowProps) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const canUseTemplates = !!user?.is_subscribed;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [fields, setFields] = useState<FieldSchema[]>([emptyField()]);
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  const [items, setItems] = useState<BatchItem[]>([]);
  const [processing, setProcessing] = useState(false);

  const [history, setHistory] = useState<ExtractionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const refreshHistory = async () => {
    setHistoryLoading(true);
    try {
      setHistory(await listHistory());
    } catch {
      // history is a convenience feature — fail quietly, don't block the main flow
    } finally {
      setHistoryLoading(false);
    }
  };

  const refreshTemplates = () => {
    listTemplates()
      .then(setTemplates)
      .catch(() => showToast("Couldn't load saved templates.", "error"));
  };

  useEffect(() => {
    // Anonymous/non-subscribed visitors can't see saved templates at all —
    // don't fire a request that will 401/403 for them on every page load,
    // just leave the dropdown showing only "Define fields manually".
    if (canUseTemplates) refreshTemplates();
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseTemplates]);

  const handleTemplateSelect = (id: string) => {
    setSelectedTemplateId(id);
    if (!id) {
      setFields([emptyField()]);
      return;
    }
    const template = templates.find((t) => t.id === id);
    if (template) {
      setFields(template.fields.map((f) => ({ ...f })));
    }
  };

  const cleanFields = fields.filter((f) => f.name.trim());
  const cleanVerifications = verifications.filter((v) => v.label.trim() && v.value.trim());
  const hasFieldConfig = selectedTemplateId !== "" || cleanFields.length > 0;

  const handleExtract = async () => {
    if (items.length === 0) {
      showToast("Add at least one file first.", "error");
      return;
    }
    if (!hasFieldConfig) {
      showToast("Define at least one field, or pick a saved template.", "error");
      return;
    }

    setProcessing(true);
    setItems((prev) => prev.map((item) => ({ ...item, status: "pending" as const, result: undefined, error: undefined })));

    const toProcess = items;
    await runWithConcurrency(toProcess, CONCURRENCY, async (item) => {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "processing" as const } : i))
      );
      try {
        const result = await extractDocument({
          image: item.file,
          templateId: selectedTemplateId || undefined,
          fields: selectedTemplateId ? undefined : cleanFields,
          verifications: cleanVerifications,
        });
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "done" as const, result } : i))
        );
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Extraction failed.";
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "error" as const, error: message } : i))
        );
      }
    });

    setProcessing(false);
    showToast("Extraction complete — review the results below.", "success");
    refreshHistory();
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{heading}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50">1. Choose fields</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          For better accuracy, add the fields you want extracted — telling the model
          exactly what to look for makes extraction smoother and faster than leaving it
          to guess the structure on its own.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-600 dark:text-slate-300">Use a saved template:</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600"
          >
            <option value="">— Define fields manually —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowTemplateManager((v) => !v)}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            {showTemplateManager ? "Hide template manager" : "Manage saved templates"}
          </button>
        </div>

        {showTemplateManager && <TemplateManager onTemplatesChanged={refreshTemplates} />}

        <FieldBuilder
          fields={fields}
          onChange={(next) => {
            setSelectedTemplateId("");
            setFields(next);
          }}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50">2. Verify specific data (optional)</h2>
        <VerificationList items={verifications} onChange={setVerifications} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50">3. Upload documents</h2>
        <BatchImageUpload
          items={items}
          onChange={setItems}
          maxFiles={MAX_FILES}
          acceptedTypes={acceptedTypes}
          uploadHint={uploadHint}
        />
        <button
          type="button"
          onClick={handleExtract}
          disabled={processing}
          className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {processing
            ? `Processing… (${items.filter((i) => i.status === "done" || i.status === "error").length}/${items.length})`
            : `Extract text${items.length > 1 ? ` (${items.length} files)` : ""}`}
        </button>
      </section>

      {items.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50">4. Review & export</h2>
          <BatchResultsTable items={items} onChange={setItems} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50">Recent extractions</h2>
        <HistoryList items={history} loading={historyLoading} />
      </section>
    </div>
  );
}
