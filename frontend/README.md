# PDFBoii frontend (Next.js)

Dynamic field builder, batch image/PDF upload, standalone value
verification, and an editable review screen with CSV/Excel export for the
PDFBoii handwriting-to-structured-text app.

## Setup

```bash
cd frontend
npm install
```

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_BASE_URL` to
wherever the backend is running (defaults to `http://localhost:8000`).

## Run

```bash
npm run dev
```

Open http://localhost:3000. Make sure the backend (`../backend`) is running
first — the app calls it directly from the browser.

## Pages

- `/` — define fields (or pick a saved template), optionally add specific
  values to verify, upload 1–50 images/PDFs, extract, and review/edit/
  export the structured results (CSV or highlighted Excel). Batch results
  also flag duplicate invoice numbers across the uploaded set.
- `/templates` — create, edit, and delete reusable field templates.

## Deployment (Vercel)

1. Import this repo into Vercel, set the project root to `frontend/`.
2. Set the environment variable `NEXT_PUBLIC_API_BASE_URL` to your deployed
   Railway backend URL (e.g. `https://pdfboii-backend.up.railway.app`).
3. Deploy. Build command and output are auto-detected for Next.js.
