interface ComingSoonPanelProps {
  toolTitle: string;
}

export default function ComingSoonPanel({ toolTitle }: ComingSoonPanelProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-700 dark:bg-slate-800">
      <span className="mb-3 inline-block rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
        Coming soon
      </span>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {toolTitle} isn&apos;t built yet — it&apos;s on the roadmap for a future update.
      </p>
    </div>
  );
}
