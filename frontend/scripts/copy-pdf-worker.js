// Copies pdf.js's worker script into public/ so it loads same-origin at
// runtime, rather than pointing GlobalWorkerOptions.workerSrc at a CDN —
// a CDN worker version can silently mismatch the installed API version and
// throw a hard runtime error, and this app has no reason to depend on a
// third party being up just to render a PDF.
const fs = require("fs");
const path = require("path");

const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const destDir = path.join(__dirname, "..", "public");
const dest = path.join(destDir, "pdf.worker.min.mjs");

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Copied pdf.js worker to ${dest}`);
