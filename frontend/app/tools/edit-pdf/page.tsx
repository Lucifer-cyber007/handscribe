"use client";

import { useState } from "react";
import ToolPageShell from "@/components/tools/ToolPageShell";
import FileDropZone from "@/components/tools/FileDropZone";
import PdfEditorCanvas from "@/components/tools/PdfEditorCanvas";

export default function EditPdfPage() {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <ToolPageShell
      title="Edit PDF"
      description="Add text, images, shapes, or freehand annotations to a PDF, then download the flattened result."
      wide
    >
      {files.length === 0 ? (
        <div className="mx-auto max-w-xl">
          <FileDropZone
            files={files}
            onChange={setFiles}
            accept="application/pdf"
            acceptedTypes={["application/pdf"]}
            label="Select PDF file"
          />
        </div>
      ) : (
        <PdfEditorCanvas file={files[0]} />
      )}
    </ToolPageShell>
  );
}
