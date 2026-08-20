import Link from "next/link";
import { Combine, ScanText, Languages } from "lucide-react";

const FEATURES = [
  {
    icon: Combine,
    title: "15+ PDF tools",
    description:
      "Merge, split, rotate, watermark, protect, and convert PDFs — each tool opens on its own focused page.",
  },
  {
    icon: ScanText,
    title: "OCR-powered extraction",
    description:
      "Define the fields you need and pull structured data out of handwritten or scanned documents straight into Excel.",
  },
  {
    icon: Languages,
    title: "Multilingual translation",
    description:
      "Translate PDFs into Hindi and other languages while keeping the original layout and formatting intact.",
  },
];

const STEPS = [
  { step: "1", title: "Pick a tool", description: "Choose from the full toolkit on the dashboard." },
  { step: "2", title: "Upload your file", description: "Drop in a PDF, image, or scanned document." },
  { step: "3", title: "Download the result", description: "Get your finished file back in seconds." },
];

export default function MarketingPage() {
  return (
    <div className="space-y-20">
      <section className="pt-8 text-center sm:pt-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-slate-50">
          All your PDF &amp; document tools,
          <br className="hidden sm:block" /> in one place.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-slate-600 sm:text-lg dark:text-slate-300">
          Merge, split, convert, translate, and pull structured data out of PDFs and
          handwritten documents — no software to install.
        </p>
        <div className="mt-8">
          <Link
            href="/tools"
            className="inline-block rounded-md bg-brand-600 px-8 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Explore Tools
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-brand-100 text-brand-700">
              <f.icon size={20} strokeWidth={2} />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-50">{f.title}</h3>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{f.description}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-center text-lg font-semibold text-slate-900 dark:text-slate-50">How it works</h2>
        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.step} className="text-center">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-sm font-semibold text-white">
                {s.step}
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-50">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 pb-8 pt-6 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
        PDF<span className="text-brand-600">Boii</span> — PDF tools &amp; document extraction.
      </footer>
    </div>
  );
}
