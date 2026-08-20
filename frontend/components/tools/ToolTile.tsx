import Link from "next/link";
import { ToolDef } from "@/lib/tools";
import { CATEGORY_ICON_COLORS, getToolIcon } from "@/lib/toolIcons";

export default function ToolTile({ tool }: { tool: ToolDef }) {
  const Icon = getToolIcon(tool.slug);
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="relative flex flex-col rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-brand-400 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      {tool.status === "coming-soon" && (
        <span className="absolute right-3 top-3 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 dark:bg-slate-800">
          Coming soon
        </span>
      )}
      <div
        className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${CATEGORY_ICON_COLORS[tool.category]}`}
      >
        <Icon size={18} strokeWidth={2} />
      </div>
      <h3 className="mt-3 pr-16 text-sm font-semibold text-slate-900 dark:text-slate-50">{tool.title}</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tool.description}</p>
    </Link>
  );
}
