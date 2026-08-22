export type ToolStatus = "real" | "coming-soon";

export type ToolCategory =
  | "Organize PDF"
  | "Convert to PDF"
  | "Convert from PDF"
  | "Edit & Sign"
  | "Security"
  | "AI & Extraction";

export interface ToolDef {
  slug: string;
  title: string;
  description: string;
  category: ToolCategory;
  status: ToolStatus;
}

export const TOOLS: ToolDef[] = [
  // Organize PDF
  {
    slug: "merge-pdf",
    title: "Merge PDF",
    description: "Combine multiple PDFs into one document, in the order you choose.",
    category: "Organize PDF",
    status: "real",
  },
  {
    slug: "split-pdf",
    title: "Split PDF",
    description: "Break a PDF into separate files by page range.",
    category: "Organize PDF",
    status: "real",
  },
  {
    slug: "organize-pdf",
    title: "Organize PDF",
    description: "Reorder or delete pages in a PDF.",
    category: "Organize PDF",
    status: "real",
  },
  {
    slug: "rotate-pdf",
    title: "Rotate PDF",
    description: "Rotate some or all pages by 90, 180, or 270 degrees.",
    category: "Organize PDF",
    status: "real",
  },
  {
    slug: "crop-pdf",
    title: "Crop PDF",
    description: "Trim margins from every page of a PDF.",
    category: "Organize PDF",
    status: "real",
  },
  {
    slug: "page-numbers",
    title: "Page numbers",
    description: "Add page numbers to a PDF in the position you choose.",
    category: "Organize PDF",
    status: "real",
  },
  {
    slug: "compress-pdf",
    title: "Compress PDF",
    description: "Reduce a PDF's file size with a lossless cleanup pass.",
    category: "Organize PDF",
    status: "real",
  },
  {
    slug: "repair-pdf",
    title: "Repair PDF",
    description: "Fix a damaged PDF and recover its data.",
    category: "Organize PDF",
    status: "real",
  },
  {
    slug: "pdf-to-pdfa",
    title: "PDF to PDF/A",
    description: "Convert to the ISO-standardized PDF/A format for long-term archiving.",
    category: "Organize PDF",
    status: "real",
  },

  // Convert to PDF
  {
    slug: "word-to-pdf",
    title: "Word to PDF",
    description: "Make DOC and DOCX files easy to view by converting them to PDF.",
    category: "Convert to PDF",
    status: "real",
  },
  {
    slug: "powerpoint-to-pdf",
    title: "PowerPoint to PDF",
    description: "Make PPT and PPTX slideshows easy to view by converting them to PDF.",
    category: "Convert to PDF",
    status: "real",
  },
  {
    slug: "excel-to-pdf",
    title: "Excel to PDF",
    description: "Make Excel spreadsheets easy to read by converting them to PDF.",
    category: "Convert to PDF",
    status: "real",
  },
  {
    slug: "jpg-to-pdf",
    title: "JPG to PDF",
    description: "Convert JPG images to a single PDF in seconds.",
    category: "Convert to PDF",
    status: "real",
  },
  {
    slug: "html-to-pdf",
    title: "HTML to PDF",
    description: "Convert a webpage URL to a PDF.",
    category: "Convert to PDF",
    status: "real",
  },
  {
    slug: "scan-to-pdf",
    title: "Scan to PDF",
    description: "Capture document scans and turn them into a PDF.",
    category: "Convert to PDF",
    status: "real",
  },

  // Convert from PDF
  {
    slug: "pdf-to-word",
    title: "PDF to Word",
    description: "Turn PDF files into easy-to-edit DOC and DOCX documents.",
    category: "Convert from PDF",
    status: "real",
  },
  {
    slug: "pdf-to-powerpoint",
    title: "PDF to PowerPoint",
    description: "Turn each page of a PDF into a slide, ready to present in PowerPoint.",
    category: "Convert from PDF",
    status: "real",
  },
  {
    slug: "pdf-to-excel",
    title: "PDF to Excel",
    description: "Define the fields you need, then pull structured data from a PDF into Excel.",
    category: "Convert from PDF",
    status: "real",
  },
  {
    slug: "pdf-to-jpg",
    title: "PDF to JPG",
    description: "Convert each PDF page into a JPG image.",
    category: "Convert from PDF",
    status: "real",
  },
  {
    slug: "pdf-to-markdown",
    title: "PDF to Markdown",
    description: "Turn PDFs into Markdown files — perfect for notes, docs, and LLMs.",
    category: "Convert from PDF",
    status: "real",
  },

  // Edit & Sign
  {
    slug: "edit-pdf",
    title: "Edit PDF",
    description: "Add text, images, shapes, or freehand annotations to a PDF.",
    category: "Edit & Sign",
    status: "coming-soon",
  },
  {
    slug: "sign-pdf",
    title: "Sign PDF",
    description: "Sign yourself or request electronic signatures from others.",
    category: "Edit & Sign",
    status: "coming-soon",
  },
  {
    slug: "watermark-pdf",
    title: "Watermark",
    description: "Stamp text or an image over every page of a PDF.",
    category: "Edit & Sign",
    status: "real",
  },
  {
    slug: "pdf-forms",
    title: "PDF Forms",
    description: "Detect the fillable fields already in a PDF form, and fill them in.",
    category: "Edit & Sign",
    status: "real",
  },

  // Security
  {
    slug: "protect-pdf",
    title: "Protect PDF",
    description: "Encrypt a PDF with a password.",
    category: "Security",
    status: "real",
  },
  {
    slug: "unlock-pdf",
    title: "Unlock PDF",
    description: "Remove password security from a PDF you have the password for.",
    category: "Security",
    status: "real",
  },
  {
    slug: "redact-pdf",
    title: "Redact PDF",
    description: "Permanently remove every occurrence of specific words or phrases from a PDF.",
    category: "Security",
    status: "real",
  },
  {
    slug: "compare-pdf",
    title: "Compare PDF",
    description: "Spot the text differences between two versions of a PDF.",
    category: "Security",
    status: "real",
  },

  // AI & Extraction
  {
    slug: "ocr-pdf",
    title: "OCR PDF",
    description: "Extract the text from a scanned PDF using OCR.",
    category: "AI & Extraction",
    status: "real",
  },
  {
    slug: "image-to-excel",
    title: "Image to Excel",
    description: "Define the fields you need, then pull structured data from a photo into Excel.",
    category: "AI & Extraction",
    status: "real",
  },
  {
    slug: "ai-summarizer",
    title: "AI Summarizer",
    description: "Get clear, precise key points from a PDF's contents.",
    category: "AI & Extraction",
    status: "real",
  },
  {
    slug: "translate-pdf",
    title: "Translate PDF",
    description: "Translate a PDF while keeping its layout and formatting intact.",
    category: "AI & Extraction",
    status: "real",
  },
];

export function getToolBySlug(slug: string): ToolDef | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  "Organize PDF",
  "Convert to PDF",
  "Convert from PDF",
  "Edit & Sign",
  "Security",
  "AI & Extraction",
];
