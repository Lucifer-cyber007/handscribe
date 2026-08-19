"use client";

import Link from "next/link";
import ExtractWorkflow from "@/components/tools/ExtractWorkflow";

export default function ImageToExcelPage() {
  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Back to tools
      </Link>
      <ExtractWorkflow
        heading="Image to Excel"
        description="Define the fields you want, upload one or more photos, and export the structured results to Excel."
        acceptedTypes={["image/jpeg", "image/png", "image/webp"]}
        uploadHint="or click to browse — JPG, PNG, or WEBP"
      />
    </div>
  );
}
