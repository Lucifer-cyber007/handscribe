import {
  Archive,
  Code2,
  Combine,
  Crop,
  EyeOff,
  FileCode,
  FileText,
  GitCompare,
  Hash,
  Image as ImageIcon,
  Languages,
  ListChecks,
  ListOrdered,
  Lock,
  type LucideIcon,
  Minimize2,
  PenLine,
  PenTool,
  Presentation,
  RotateCw,
  ScanLine,
  ScanText,
  Scissors,
  Sparkles,
  Table,
  Unlock,
  Droplet,
  Wrench,
} from "lucide-react";
import { ToolCategory } from "./tools";

export const TOOL_ICON_MAP: Record<string, LucideIcon> = {
  "merge-pdf": Combine,
  "split-pdf": Scissors,
  "organize-pdf": ListOrdered,
  "rotate-pdf": RotateCw,
  "crop-pdf": Crop,
  "page-numbers": Hash,
  "compress-pdf": Minimize2,
  "repair-pdf": Wrench,
  "pdf-to-pdfa": Archive,

  "word-to-pdf": FileText,
  "powerpoint-to-pdf": Presentation,
  "excel-to-pdf": Table,
  "jpg-to-pdf": ImageIcon,
  "html-to-pdf": Code2,
  "scan-to-pdf": ScanLine,

  "pdf-to-word": FileText,
  "pdf-to-powerpoint": Presentation,
  "pdf-to-excel": Table,
  "pdf-to-jpg": ImageIcon,
  "pdf-to-markdown": FileCode,

  "edit-pdf": PenLine,
  "sign-pdf": PenTool,
  "watermark-pdf": Droplet,
  "pdf-forms": ListChecks,

  "protect-pdf": Lock,
  "unlock-pdf": Unlock,
  "redact-pdf": EyeOff,
  "compare-pdf": GitCompare,

  "ocr-pdf": ScanText,
  "image-to-excel": Table,
  "ai-summarizer": Sparkles,
  "translate-pdf": Languages,
};

export const CATEGORY_ICON_COLORS: Record<ToolCategory, string> = {
  "Organize PDF": "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "Convert to PDF": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "Convert from PDF": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Edit & Sign": "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  Security: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "AI & Extraction": "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
};

export function getToolIcon(slug: string): LucideIcon {
  return TOOL_ICON_MAP[slug] ?? FileText;
}
