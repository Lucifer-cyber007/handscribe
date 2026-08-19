import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "HandScribe — PDF Tools & Handwritten Data Extraction",
  description:
    "Merge, split, convert, and translate PDFs, plus turn handwritten documents into structured, editable data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <NavBar />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
