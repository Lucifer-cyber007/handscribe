"use client";

import { useEffect, useMemo, useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import ChatMarkdown from "@/components/tools/ChatMarkdown";
import { useToast } from "@/components/Toast";
import { ApiError, askAboutPdf, summarizePdf } from "@/lib/api";
import { ChatMessage } from "@/lib/types";

export default function AiSummarizerPage() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [documentText, setDocumentText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  const pdfUrl = useMemo(() => {
    if (files.length === 0) return null;
    return URL.createObjectURL(files[0]);
  }, [files]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const handleSummarize = async () => {
    if (files.length === 0) {
      showToast("Add a PDF first.", "error");
      return;
    }
    setLoading(true);
    setSummary(null);
    setDocumentText(null);
    setMessages([]);
    try {
      const result = await summarizePdf(files[0]);
      setSummary(result.summary);
      setDocumentText(result.document_text);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Summarization failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed || !documentText || asking) return;

    const priorMessages = messages;
    setMessages([...priorMessages, { role: "user", content: trimmed }]);
    setQuestion("");
    setAsking(true);
    try {
      const result = await askAboutPdf(documentText, trimmed, priorMessages);
      setMessages([...priorMessages, { role: "user", content: trimmed }, { role: "assistant", content: result.answer }]);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't answer that.", "error");
      setMessages(priorMessages);
      setQuestion(trimmed);
    } finally {
      setAsking(false);
    }
  };

  const startOver = () => {
    setFiles([]);
    setSummary(null);
    setDocumentText(null);
    setMessages([]);
  };

  const copySummary = async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
    showToast("Summary copied to clipboard.", "success");
  };

  if (!summary || !documentText) {
    return (
      <ToolPageShell
        title="AI Summarizer"
        description="Get clear, precise key points from a PDF's contents, then ask follow-up questions answered only from that document."
      >
        <div className="space-y-4">
          <FileDropZone
            files={files}
            onChange={setFiles}
            accept="application/pdf"
            acceptedTypes={["application/pdf"]}
            label="Select PDF file"
          />
          <button
            type="button"
            onClick={handleSummarize}
            disabled={loading || files.length === 0}
            className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "Summarizing…" : "Summarize"}
          </button>
        </div>
      </ToolPageShell>
    );
  }

  return (
    <ToolPageShell
      title="AI Summarizer"
      description="Ask follow-up questions below — answers are grounded only in this document."
      wide
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-[36rem] overflow-hidden rounded-lg border border-slate-200 bg-slate-50 lg:h-[42rem] dark:border-slate-700 dark:bg-slate-800">
          {pdfUrl && (
            <iframe src={pdfUrl} title={files[0]?.name ?? "PDF preview"} className="h-full w-full" />
          )}
        </div>

        <div className="flex h-[36rem] flex-col rounded-lg border border-slate-200 bg-white lg:h-[42rem] dark:border-slate-700 dark:bg-slate-900">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-900 dark:text-slate-50">Summary</h2>
                <button
                  type="button"
                  onClick={copySummary}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Copy
                </button>
              </div>
              <div className="mt-2 text-slate-700 dark:text-slate-200">
                <ChatMarkdown content={summary} />
              </div>
            </div>

            {messages.length > 0 && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="ml-6 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
                      {m.content}
                    </div>
                  ) : (
                    <div key={i} className="mr-6 rounded-lg bg-slate-50 px-3 py-2 text-slate-700 dark:text-slate-200 dark:bg-slate-800">
                      <ChatMarkdown content={m.content} />
                    </div>
                  )
                )}
              </div>
            )}
            {asking && <p className="text-xs text-slate-400 dark:text-slate-500">Thinking…</p>}
          </div>

          <div className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              placeholder="Ask anything about this document…"
              disabled={asking}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50 dark:border-slate-600"
            />
            <button
              type="button"
              onClick={handleAsk}
              disabled={asking || !question.trim()}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Ask
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={startOver}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Summarize a different PDF
        </button>
      </div>
    </ToolPageShell>
  );
}
