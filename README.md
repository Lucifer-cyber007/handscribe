# PDFBoii

A full PDF toolkit — merge, split, convert, protect, redact, translate,
summarize, and more — plus AI-powered extraction that turns scanned or
handwritten documents into structured Excel data using fields you define
yourself. No coding required for any of it.

**New here?** See [SETUP.md](SETUP.md) for everything needed to get this
running on a fresh computer, start to finish.

## Repo layout

```
backend/    FastAPI app (PDF tools, OCR + LLM extraction, templates, history)
frontend/   Next.js 14 app (marketing site + tools dashboard + workflows)
```

Each has its own README with deeper setup/deployment detail:
[backend/README.md](backend/README.md) · [frontend/README.md](frontend/README.md)

## Quick start (local dev)

**Backend:**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
copy .env.example .env        # then fill in your API keys — see SETUP.md
uvicorn app.main:app --reload --port 8000
```

**Frontend** (separate terminal):
```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Open http://localhost:3000 — the marketing page links to the tools
dashboard at `/tools`.

Word/PowerPoint/Excel/HTML-to-PDF conversion additionally needs
[LibreOffice](https://www.libreoffice.org/download/) installed locally
(`soffice` on PATH); every other tool works without it. See SETUP.md.

## The toolkit

26 tools are live today, organized into six categories on the `/tools`
dashboard:

**Organize PDF** — Merge, Split, Organize (reorder/delete pages), Rotate,
Crop, Page Numbers, Compress, Repair

**Convert to PDF** — Word, PowerPoint, Excel, JPG, HTML (from a URL), and
Scan to PDF (phone photos, with an optional auto-enhance pass)

**Convert from PDF** — to Word, PowerPoint (each page as a slide image),
Excel (see below), JPG, and Markdown

**Edit & Sign** — Watermark, PDF Forms (detect and fill a PDF's existing
fillable fields)

**Security** — Protect / Unlock (password encryption), Redact (permanently
strips chosen words/phrases, not just visually covers them), Compare
(line-level diff between two PDFs)

**AI & Extraction** — OCR PDF, Image to Excel, PDF to Excel, AI Summarizer,
Translate PDF (see below)

Still on the roadmap: PDF to PDF/A, a full Edit PDF canvas, and Sign PDF.

Most tools are pure local processing (PyMuPDF/LibreOffice) with no
per-use cost. A handful call a paid API every time — OCR PDF, Image to
Excel, Translate PDF, AI Summarizer — and PDF to Word/Markdown/Translate
only do so as a fallback when a PDF has no real text layer (a scan/photo).

## AI-powered extraction

**Image to Excel** and **PDF to Excel** turn unstructured documents into
structured spreadsheet data:

1. **Choose fields** — name, type (Numeric, Alphabetic, Alphanumeric, Date,
   Currency, Email, Phone, GST Number, or Custom Regex), and whether it's
   required. Save a set of fields as a reusable named template. (PDF to
   Excel skips this entirely for PDFs that already have selectable text —
   tables are pulled out directly, no fields needed.)
2. **Verify specific data (optional)** — check whether a value you already
   know (e.g. a specific ID number) actually appears anywhere in the
   document, with fuzzy matching that tolerates the kind of character
   misreads OCR produces.
3. **Upload** — one file, or up to 50 at once (batch mode processes them
   concurrently into one combined results table).
4. **Extract** — OCR runs, then the LLM maps the raw text onto your fields.
   Values are never invented — anything not clearly present is left blank
   and flagged, not guessed.
5. **Review & export** — every value is inline-editable. Export to CSV or
   Excel (which highlights fields needing a second look in orange, and
   duplicate values across a batch in red).

**AI Summarizer** gives a PDF a short overview plus key-point bullets, then
opens a chat where follow-up questions are answered strictly from that
document's own text — never outside knowledge, and it says so plainly when
an answer isn't in the document. Always runs on Groq's `openai/gpt-oss-120b`.

**Translate PDF** preserves layout via Google Cloud Translation for PDFs
with real text; scanned PDFs automatically fall back to OCR + LLM
translation as plain text instead.

## Reliability features worth knowing about

The field-extraction workflow isn't just "send OCR text to an LLM and
hope" — several deterministic checks sit on top of the LLM output:

- **Type validation isn't the LLM's opinion.** Every non-empty value is
  re-checked against a real regex for its declared type (including a
  15-character Indian GSTIN pattern) — this is what actually drives the
  Valid/Check badges, not the model's own judgment call.
- **Grand Total is always flagged for manual check**, never auto-marked
  valid — the displayed value is exactly what was on the document, with a
  background calculation (Taxable Value + tax) compared against it so you
  know whether it matches before you trust it.
- **Amount in Words is computed**, not read from handwriting — spelled out
  in the Indian numbering system (Lakh/Crore) from the (corrected) Grand
  Total, since OCR is especially unreliable on handwritten spelled-out
  numbers.
- **Invoice Number has a regex fallback** for when the LLM misses a bare
  "No." label (very common on Indian invoice books) — including cases
  where OCR displaces the value onto a different line than its label.

## Configuration

The LLM structuring step supports three interchangeable providers — pick
one via `LLM_PROVIDER` in `backend/.env`:

| Provider | Auth | Notes |
|---|---|---|
| `groq` | API key | Fast, but free-tier rate limits are easy to hit with real use |
| `gemini` | API key | Google AI Studio — simplest to set up, generous free tier |
| `vertex` | Service account (GCP) | Heaviest setup; only worth it if you need enterprise GCP billing |

AI Summarizer is the one exception — it always calls Groq's
`openai/gpt-oss-120b` directly, regardless of `LLM_PROVIDER`, so it needs
`GROQ_API_KEY` set even if extraction elsewhere is configured for
Gemini/Vertex.

Translate PDF is a separate optional add-on: it needs its own Google Cloud
Translation service account (`GOOGLE_TRANSLATE_PROJECT_ID` /
`GOOGLE_TRANSLATE_CREDENTIALS`), independent of the Vision/LLM credentials
above.

Full details on getting every key, plus every other required setting, are
in [SETUP.md](SETUP.md).

## Extending

- **Swap the OCR provider**: implement `OCRProvider` in `backend/app/ocr/`
  and register it in `backend/app/ocr/factory.py`.
- **Add an LLM provider**: implement `LLMStructuringProvider` in
  `backend/app/llm/` and register it in `backend/app/llm/factory.py` — all
  prompt-building and JSON parsing is shared, you only implement the API call.
- **Add a PDF tool**: `backend/app/utils/pdf_ops.py` (PyMuPDF operations),
  `backend/app/utils/office_ops.py` (LibreOffice-backed conversions), and
  `backend/app/routers/pdf_tools.py` (endpoints) show the existing patterns
  to follow.
- **Move to PostgreSQL**: change `DATABASE_URL` in `backend/.env` — the
  SQLAlchemy models are already database-agnostic.

## Deployment

Not yet deployed — local dev only for now. `backend/README.md` and
`frontend/README.md` have notes from an earlier Railway/Vercel plan; the
current direction under consideration is Cloud Run + Cloud SQL for the
backend. Treat both as provisional until a deployment actually ships.
