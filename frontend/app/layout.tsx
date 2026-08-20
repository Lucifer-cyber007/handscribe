import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "PDFBoii — PDF Tools & Handwritten Data Extraction",
  description:
    "Merge, split, convert, and translate PDFs, plus turn handwritten documents into structured, editable data.",
};

// Runs before React hydrates so the correct theme applies on first paint —
// without this, a stored "dark" preference would flash light for a moment.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("pdfboii_theme");
    var isDark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <NavBar />
              <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
