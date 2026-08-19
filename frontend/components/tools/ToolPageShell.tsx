import Link from "next/link";

interface ToolPageShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  /** Structural single-file tools want a narrow centered column (default).
   * Workflow-style tools (field builder, results table...) need the full
   * page width instead. */
  wide?: boolean;
}

export default function ToolPageShell({
  title,
  description,
  children,
  wide = false,
}: ToolPageShellProps) {
  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Back to tools
        </Link>
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </div>
      <div className={wide ? "" : "mx-auto max-w-xl"}>{children}</div>
    </div>
  );
}
