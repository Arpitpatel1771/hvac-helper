/**
 * Single source of truth for all app state.
 * This is a plain mutable object — just read and write to it directly.
 * After changing state, call the relevant render function (renderShapes, renderShapeList, etc.)
 * to sync the UI.
 */
export const state = {
  // PDF
  file: null,           // the File object the user picked
  pdfBytes: null,       // ArrayBuffer of raw PDF bytes — kept for export
  pdfDoc: null,         // pdfjs document object — used to render pages
  currentPage: 1,
  totalPages: 1,
  pageSize: { width: 0, height: 0 }, // rendered page dimensions in pixels (at 1.5x scale)

  // Drawing
  shapes: [],           // all shapes across all pages
  selectedId: null,     // id of the selected shape, or null
  tool: 'select',       // 'select' | 'rect' | 'polygon'

  // View
  zoom: 1,              // e.g. 0.75 = 75% — applied as CSS transform, not Konva scale
};
