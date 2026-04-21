import * as pdfjsLib from 'pdfjs-dist';
// Vite's ?url suffix emits the worker as a separate file and returns its URL.
// pdfjs-dist v4 uses ES modules (.mjs), so CDN .min.js URLs won't work.
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Loads a PDF File object and returns the pdfjs document + raw bytes for export.
 * @param {File} file
 * @returns {{ pdfDoc, pdfBytes: ArrayBuffer, totalPages: number }}
 */
export async function loadPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  // pdfjs transfers the ArrayBuffer to its worker thread, detaching the original.
  // Pass a copy so we keep the original intact for pdf-lib export later.
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
  const pdfDoc = await loadingTask.promise;
  return { pdfDoc, pdfBytes: arrayBuffer, totalPages: pdfDoc.numPages };
}

/**
 * Renders a single page of a pdfjs document to a data URL (PNG).
 * @param {object} pdfDoc - pdfjs document
 * @param {number} pageNumber - 1-indexed
 * @param {number} scale - render scale (1.5 = 150% = decent quality for screen)
 * @returns {{ imageDataUrl: string, width: number, height: number }}
 */
export async function renderPage(pdfDoc, pageNumber, scale = 1.5) {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

  return {
    imageDataUrl: canvas.toDataURL(),
    width: viewport.width,
    height: viewport.height,
  };
}
