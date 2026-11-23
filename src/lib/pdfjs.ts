"use client";

import type * as PdfJs from "pdfjs-dist";

let pdfjsPromise: Promise<typeof PdfJs> | null = null;

/** Lazily loads PDF.js in the browser and points it at the self-hosted worker. */
export function loadPdfJs(): Promise<typeof PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/** Opens a PDF for rendering. The bytes are copied because PDF.js transfers them to its worker. */
export async function openPdf(bytes: Uint8Array) {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({ data: bytes.slice() }).promise;
}

/** Renders one page into a canvas at the given CSS width. */
export async function renderPageToCanvas(
  page: PdfJs.PDFPageProxy,
  canvas: HTMLCanvasElement,
  cssWidth: number,
) {
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
}
