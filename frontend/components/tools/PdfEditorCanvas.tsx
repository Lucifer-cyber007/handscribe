"use client";

import { useEffect, useRef, useState } from "react";
import type * as FabricNS from "fabric";
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  Eraser,
  ImagePlus,
  Minus,
  MousePointer2,
  Pencil,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { ApiError, editPdf } from "@/lib/api";
import { downloadBlob } from "@/lib/toolDownload";
import { EditObject, RGBColor } from "@/lib/types";

const RENDER_SCALE = 1.5;
const THUMB_SCALE = 0.22;
const MAX_PAGES = 20;

type Tool = "select" | "text" | "rect" | "ellipse" | "line" | "pen";

interface StyleState {
  strokeColor: string; // hex
  fillEnabled: boolean;
  fillColor: string; // hex
  strokeWidth: number;
  fontSize: number;
}

function hexToRgbFloat(hex: string): RGBColor {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [r, g, b];
}

/** Extracts a path's points as absolute canvas-space coordinates. PencilBrush
 * paths use SVG-style commands ('M'/'L'/'Q'/...) relative to the object's own
 * pathOffset; each command's final (x, y) pair becomes one polyline vertex —
 * good enough to reproduce the stroke's shape without needing bezier curve
 * fitting on the backend. Scale/rotation are intentionally locked to 1/0 for
 * path objects (see below), so no scale/rotation transform is needed here. */
function extractPathPoints(path: FabricNS.Path): [number, number][] {
  const offset = path.pathOffset;
  const left = path.left ?? 0;
  const top = path.top ?? 0;
  const points: [number, number][] = [];
  for (const command of path.path as unknown as (string | number)[][]) {
    const len = command.length;
    if (len < 3) continue;
    const x = command[len - 2] as number;
    const y = command[len - 1] as number;
    points.push([left + (x - offset.x), top + (y - offset.y)]);
  }
  return points;
}

/** Line objects' x1/y1/x2/y2 are relative to the object's own bounding box;
 * calcLinePoints() (a real Line method) returns them already adjusted for
 * that, so absolute = left/top + calcLinePoints() output. Scale/rotation are
 * locked to 1/0 for lines (see below), so this is exact, not an approximation. */
function extractLineEndpoints(line: FabricNS.Line): { x1: number; y1: number; x2: number; y2: number } {
  const calc = line.calcLinePoints();
  const left = line.left ?? 0;
  const top = line.top ?? 0;
  return { x1: left + calc.x1, y1: top + calc.y1, x2: left + calc.x2, y2: top + calc.y2 };
}

function serializePageObjects(canvas: FabricNS.Canvas, page: number): EditObject[] {
  const objects: EditObject[] = [];
  for (const obj of canvas.getObjects()) {
    const bounds = obj.getBoundingRect();
    const toPdf = (v: number) => v / RENDER_SCALE;

    if (obj.type === "textbox") {
      const t = obj as FabricNS.Textbox;
      objects.push({
        type: "text",
        page,
        x: toPdf(bounds.left),
        y: toPdf(bounds.top),
        width: toPdf(bounds.width),
        height: toPdf(bounds.height),
        rotation: 0,
        content: t.text ?? "",
        fontSize: toPdf((t.fontSize ?? 16) * (t.scaleY ?? 1)),
        color: hexToRgbFloat(String(t.fill ?? "#000000")),
      });
    } else if (obj.type === "rect") {
      objects.push({
        type: "rect",
        page,
        x: toPdf(bounds.left),
        y: toPdf(bounds.top),
        width: toPdf(bounds.width),
        height: toPdf(bounds.height),
        rotation: 0,
        strokeColor: hexToRgbFloat(String(obj.stroke ?? "#000000")),
        strokeWidth: toPdf(obj.strokeWidth ?? 1),
        fillColor: obj.fill && obj.fill !== "" ? hexToRgbFloat(String(obj.fill)) : null,
      });
    } else if (obj.type === "ellipse") {
      objects.push({
        type: "ellipse",
        page,
        x: toPdf(bounds.left),
        y: toPdf(bounds.top),
        width: toPdf(bounds.width),
        height: toPdf(bounds.height),
        rotation: 0,
        strokeColor: hexToRgbFloat(String(obj.stroke ?? "#000000")),
        strokeWidth: toPdf(obj.strokeWidth ?? 1),
        fillColor: obj.fill && obj.fill !== "" ? hexToRgbFloat(String(obj.fill)) : null,
      });
    } else if (obj.type === "line") {
      const { x1, y1, x2, y2 } = extractLineEndpoints(obj as FabricNS.Line);
      objects.push({
        type: "line",
        page,
        x: toPdf(x1),
        y: toPdf(y1),
        x2: toPdf(x2),
        y2: toPdf(y2),
        width: 0,
        height: 0,
        rotation: 0,
        strokeColor: hexToRgbFloat(String(obj.stroke ?? "#000000")),
        strokeWidth: toPdf(obj.strokeWidth ?? 1),
      });
    } else if (obj.type === "path") {
      const points = extractPathPoints(obj as FabricNS.Path).map(
        ([x, y]) => [toPdf(x), toPdf(y)] as [number, number]
      );
      objects.push({
        type: "path",
        page,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        points,
        strokeColor: hexToRgbFloat(String(obj.stroke ?? "#000000")),
        strokeWidth: toPdf(obj.strokeWidth ?? 1),
      });
    } else if (obj.type === "image") {
      const img = obj as FabricNS.FabricImage;
      const dataUrl = img.toDataURL({ format: "png", multiplier: 1 });
      objects.push({
        type: "image",
        page,
        x: toPdf(bounds.left),
        y: toPdf(bounds.top),
        width: toPdf(bounds.width),
        height: toPdf(bounds.height),
        rotation: 0,
        dataUrl,
      });
    }
  }
  return objects;
}

const TOOL_BUTTONS: { tool: Tool; label: string; Icon: typeof MousePointer2 }[] = [
  { tool: "select", label: "Select", Icon: MousePointer2 },
  { tool: "text", label: "Text", Icon: Type },
  { tool: "rect", label: "Rectangle", Icon: Square },
  { tool: "ellipse", label: "Ellipse", Icon: Circle },
  { tool: "line", label: "Line", Icon: Minus },
  { tool: "pen", label: "Pen", Icon: Pencil },
];

export default function PdfEditorCanvas({ file }: { file: File }) {
  const { showToast } = useToast();
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState<Tool>("select");
  const [downloading, setDownloading] = useState(false);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [style, setStyle] = useState<StyleState>({
    strokeColor: "#0d9488",
    fillEnabled: false,
    fillColor: "#0d9488",
    strokeWidth: 2,
    fontSize: 18,
  });

  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricNS.Canvas | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const toolRef = useRef(tool);
  toolRef.current = tool;
  const styleRef = useRef(style);
  styleRef.current = style;

  // pageObjects holds every OTHER page's serialized JSON scene (not the
  // currently-live one) so only one Fabric canvas is ever instantiated at a
  // time, keeping memory bounded regardless of document length.
  const pageObjectsRef = useRef<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const arrayBuffer = await file.arrayBuffer();
      let pdf;
      try {
        pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      } catch {
        if (!cancelled) {
          showToast("Couldn't read this file as a PDF.", "error");
          setLoading(false);
        }
        return;
      }
      if (cancelled) return;
      if (pdf.numPages > MAX_PAGES) {
        showToast(
          `Edit PDF supports documents up to ${MAX_PAGES} pages (this one has ${pdf.numPages}). Try splitting it first.`,
          "error"
        );
        setLoading(false);
        return;
      }
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setCurrentPage(1);
      setLoading(false);

      // Generate small page thumbnails once, up front.
      const thumbs: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled) return;
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: THUMB_SCALE });
        const c = document.createElement("canvas");
        c.width = viewport.width;
        c.height = viewport.height;
        await page.render({ canvas: c, viewport }).promise;
        thumbs.push(c.toDataURL("image/png"));
      }
      if (!cancelled) setThumbnails(thumbs);
    })();
    return () => {
      cancelled = true;
    };
  }, [file, showToast]);

  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    let canvas: FabricNS.Canvas | null = null;
    let drawingShape: FabricNS.Object | null = null;
    let startX = 0;
    let startY = 0;

    (async () => {
      const fabric = await import("fabric");
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      if (cancelled) return;

      const pdfCanvasEl = pdfCanvasRef.current;
      const fabricEl = fabricElRef.current;
      if (!pdfCanvasEl || !fabricEl) return;

      pdfCanvasEl.width = viewport.width;
      pdfCanvasEl.height = viewport.height;
      fabricEl.width = viewport.width;
      fabricEl.height = viewport.height;

      await page.render({ canvas: pdfCanvasEl, viewport }).promise;
      if (cancelled) return;

      canvas = new fabric.Canvas(fabricEl, { selection: true });
      fabricRef.current = canvas;

      // Fabric removes the <canvas> element I gave it from the DOM and
      // rebuilds it inside its own auto-created wrapper <div> (which also
      // holds a second, separate "upper canvas" that actually receives all
      // mouse events — the element I originally rendered becomes just the
      // inert rendering layer). Positioning my own JSX canvas doesn't do
      // anything useful post-construction, so the overlay has to be
      // positioned on Fabric's real wrapper element instead.
      canvas.wrapperEl.style.position = "absolute";
      canvas.wrapperEl.style.left = "0";
      canvas.wrapperEl.style.top = "0";

      const saved = pageObjectsRef.current[currentPage];
      if (saved) {
        await canvas.loadFromJSON(saved);
        canvas.requestRenderAll();
      }

      const currentStyle = () => styleRef.current;

      canvas.on("mouse:down", (opt) => {
        const activeTool = toolRef.current;
        if (activeTool === "select" || activeTool === "pen" || !canvas) return;
        const pointer = canvas.getScenePoint(opt.e);
        startX = pointer.x;
        startY = pointer.y;
        const st = currentStyle();

        if (activeTool === "text") {
          const textbox = new fabric.Textbox("Text", {
            left: startX,
            top: startY,
            fontSize: st.fontSize,
            fill: st.strokeColor,
            width: 160,
          });
          canvas.add(textbox);
          canvas.setActiveObject(textbox);
          setTool("select");
          return;
        }

        const fillValue = st.fillEnabled ? st.fillColor : "";
        if (activeTool === "rect") {
          drawingShape = new fabric.Rect({
            left: startX,
            top: startY,
            width: 1,
            height: 1,
            stroke: st.strokeColor,
            strokeWidth: st.strokeWidth,
            fill: fillValue,
          });
        } else if (activeTool === "ellipse") {
          drawingShape = new fabric.Ellipse({
            left: startX,
            top: startY,
            rx: 1,
            ry: 1,
            stroke: st.strokeColor,
            strokeWidth: st.strokeWidth,
            fill: fillValue,
          });
        } else if (activeTool === "line") {
          drawingShape = new fabric.Line([startX, startY, startX, startY], {
            stroke: st.strokeColor,
            strokeWidth: st.strokeWidth,
            lockScalingX: true,
            lockScalingY: true,
            lockRotation: true,
          });
        }
        if (drawingShape) canvas.add(drawingShape);
      });

      canvas.on("mouse:move", (opt) => {
        if (!drawingShape || !canvas) return;
        const pointer = canvas.getScenePoint(opt.e);
        if (drawingShape.type === "rect") {
          (drawingShape as FabricNS.Rect).set({
            width: Math.abs(pointer.x - startX),
            height: Math.abs(pointer.y - startY),
            left: Math.min(pointer.x, startX),
            top: Math.min(pointer.y, startY),
          });
        } else if (drawingShape.type === "ellipse") {
          (drawingShape as FabricNS.Ellipse).set({
            rx: Math.abs(pointer.x - startX) / 2,
            ry: Math.abs(pointer.y - startY) / 2,
            left: Math.min(pointer.x, startX),
            top: Math.min(pointer.y, startY),
          });
        } else if (drawingShape.type === "line") {
          (drawingShape as FabricNS.Line).set({ x2: pointer.x, y2: pointer.y });
        }
        canvas.requestRenderAll();
      });

      canvas.on("mouse:up", () => {
        drawingShape = null;
      });

      canvas.on("path:created", (e: { path: FabricNS.Path }) => {
        e.path.set({ lockScalingX: true, lockScalingY: true, lockRotation: true });
      });
    })();

    return () => {
      cancelled = true;
      if (canvas) {
        pageObjectsRef.current[currentPage] = JSON.stringify(canvas.toJSON());
        canvas.dispose();
      }
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, currentPage]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = tool === "pen";
    if (tool === "pen") {
      import("fabric").then((fabric) => {
        const brush = new fabric.PencilBrush(canvas);
        brush.color = style.strokeColor;
        brush.width = style.strokeWidth;
        canvas.freeDrawingBrush = brush;
      });
    }
  }, [tool, style.strokeColor, style.strokeWidth]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file0 = e.target.files?.[0];
    e.target.value = "";
    if (!file0 || !fabricRef.current) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const fabric = await import("fabric");
      const img = await fabric.FabricImage.fromURL(dataUrl);
      const maxDim = 250;
      const scale = Math.min(1, maxDim / Math.max(img.width ?? maxDim, img.height ?? maxDim));
      img.set({ left: 40, top: 40, scaleX: scale, scaleY: scale });
      fabricRef.current?.add(img);
      fabricRef.current?.setActiveObject(img);
    };
    reader.readAsDataURL(file0);
  };

  const deleteSelected = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    active.forEach((obj) => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  };

  const clearPage = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.requestRenderAll();
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > numPages || page === currentPage) return;
    setCurrentPage(page);
  };

  const handleDownload = async () => {
    const canvas = fabricRef.current;
    setDownloading(true);
    try {
      const allObjects: EditObject[] = [];
      for (let p = 1; p <= numPages; p++) {
        if (p === currentPage && canvas) {
          allObjects.push(...serializePageObjects(canvas, p));
        } else if (pageObjectsRef.current[p]) {
          const fabric = await import("fabric");
          const offscreen = new fabric.StaticCanvas(undefined, { width: 1, height: 1 });
          await offscreen.loadFromJSON(pageObjectsRef.current[p]);
          allObjects.push(...serializePageObjects(offscreen as unknown as FabricNS.Canvas, p));
          await offscreen.dispose();
        }
      }

      if (allObjects.length === 0) {
        showToast("Add at least one annotation before downloading.", "error");
        return;
      }

      const blob = await editPdf(file, allObjects);
      downloadBlob(blob, "edited.pdf");
      showToast("Edited PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't apply your edits.", "error");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading PDF…</p>;
  }
  if (!pdfDoc) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row" style={{ minHeight: "65vh" }}>
      {/* Page thumbnail rail */}
      <div className="order-2 flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900 lg:order-1 lg:w-28 lg:flex-shrink-0 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible">
        {(thumbnails.length ? thumbnails : Array(numPages).fill(null)).map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goToPage(i + 1)}
            className={`shrink-0 overflow-hidden rounded border-2 ${
              currentPage === i + 1
                ? "border-brand-500"
                : "border-transparent hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={`Page ${i + 1}`} className="w-20 lg:w-full" />
            ) : (
              <div className="h-24 w-20 bg-slate-100 dark:bg-slate-800 lg:w-full" />
            )}
            <span className="block bg-slate-50 py-0.5 text-center text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {i + 1}
            </span>
          </button>
        ))}
      </div>

      {/* Canvas viewport with floating toolbar + page nav */}
      <div className="order-1 relative flex-1 overflow-auto rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950 lg:order-2">
        <div className="sticky top-3 z-10 mx-auto flex w-fit items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-1.5 shadow-md backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          {TOOL_BUTTONS.map(({ tool: t, label, Icon }) => (
            <button
              key={t}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => setTool(t)}
              className={`rounded-full p-2 ${
                tool === t
                  ? "bg-brand-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <Icon size={17} />
            </button>
          ))}
          <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />
          <button
            type="button"
            title="Insert image"
            aria-label="Insert image"
            onClick={() => imageInputRef.current?.click()}
            className="rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ImagePlus size={17} />
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />
          <button
            type="button"
            title="Delete selected"
            aria-label="Delete selected"
            onClick={deleteSelected}
            className="rounded-full p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <Trash2 size={17} />
          </button>
          <button
            type="button"
            title="Clear page"
            aria-label="Clear page"
            onClick={clearPage}
            className="rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Eraser size={17} />
          </button>
        </div>

        <div className="flex justify-center p-6">
          <div className="relative w-fit">
            <canvas ref={pdfCanvasRef} className="block shadow" />
            <canvas ref={fabricElRef} />
          </div>
        </div>

        <div className="sticky bottom-3 z-10 mx-auto flex w-fit items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm shadow-md backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
            className="rounded-full p-1 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="tabular-nums">
            {currentPage} / {numPages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
            aria-label="Next page"
            className="rounded-full p-1 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Style panel + download */}
      <div className="order-3 space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 lg:w-64 lg:flex-shrink-0">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Edit PDF</h2>
        <p className="rounded-md bg-brand-50 p-3 text-xs leading-relaxed text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
          Pick a tool above, then click (or drag, for shapes) on the page to add it.
        </p>

        <div className="space-y-3 text-sm">
          <label className="flex items-center justify-between text-slate-600 dark:text-slate-300">
            Stroke color
            <input
              type="color"
              value={style.strokeColor}
              onChange={(e) => setStyle({ ...style, strokeColor: e.target.value })}
              className="h-7 w-9 rounded border border-slate-300 dark:border-slate-600"
            />
          </label>
          <label className="flex items-center justify-between text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={style.fillEnabled}
                onChange={(e) => setStyle({ ...style, fillEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 dark:border-slate-600"
              />
              Fill color
            </span>
            <input
              type="color"
              value={style.fillColor}
              onChange={(e) => setStyle({ ...style, fillColor: e.target.value })}
              disabled={!style.fillEnabled}
              className="h-7 w-9 rounded border border-slate-300 disabled:opacity-40 dark:border-slate-600"
            />
          </label>
          <label className="flex items-center justify-between text-slate-600 dark:text-slate-300">
            Stroke width
            <input
              type="number"
              min={1}
              max={20}
              value={style.strokeWidth}
              onChange={(e) => setStyle({ ...style, strokeWidth: Number(e.target.value) })}
              className="w-16 rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
          <label className="flex items-center justify-between text-slate-600 dark:text-slate-300">
            Font size
            <input
              type="number"
              min={8}
              max={72}
              value={style.fontSize}
              onChange={(e) => setStyle({ ...style, fontSize: Number(e.target.value) })}
              className="w-16 rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="w-full rounded-md bg-brand-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {downloading ? "Applying edits…" : "Download edited PDF"}
        </button>
      </div>
    </div>
  );
}
