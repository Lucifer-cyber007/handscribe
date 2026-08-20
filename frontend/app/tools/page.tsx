import ToolTile from "@/components/tools/ToolTile";
import { TOOL_CATEGORIES, TOOLS } from "@/lib/tools";

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">PDF &amp; document tools</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Pick a tool below. Every tool opens on its own page.
        </p>
      </div>

      {TOOL_CATEGORIES.map((category) => {
        const tools = TOOLS.filter((t) => t.category === category);
        if (tools.length === 0) return null;
        return (
          <section key={category} className="space-y-4">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50">{category}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <ToolTile key={tool.slug} tool={tool} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
