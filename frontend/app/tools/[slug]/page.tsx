import { notFound } from "next/navigation";
import ToolPageShell from "@/components/tools/ToolPageShell";
import ComingSoonPanel from "@/components/tools/ComingSoonPanel";
import { getToolBySlug } from "@/lib/tools";

interface ToolPageProps {
  params: { slug: string };
}

export function generateMetadata({ params }: ToolPageProps) {
  const tool = getToolBySlug(params.slug);
  return { title: tool ? `${tool.title} — HandScribe` : "Tool not found" };
}

export default function ComingSoonToolPage({ params }: ToolPageProps) {
  const tool = getToolBySlug(params.slug);
  // Real tools are matched by their more specific static route
  // (app/tools/<slug>/page.tsx) first — reaching here with a "real" status
  // would mean a static page is missing, so treat it the same as unknown.
  if (!tool || tool.status !== "coming-soon") {
    notFound();
  }

  return (
    <ToolPageShell title={tool.title} description={tool.description}>
      <ComingSoonPanel toolTitle={tool.title} />
    </ToolPageShell>
  );
}
