/**
 * Entry point. Wires together all modules.
 *
 * The flow is:
 *   User action → update state → call render functions
 *
 * State lives in state.js.
 * Canvas (Konva) rendering lives in canvas.js.
 * Sidebar/toolbar DOM updates live in ui.js.
 * This file is the coordinator — it handles events and calls into the other modules.
 */

import { state } from './state.js';
import { loadPdf, renderPage } from './pdfLoader.js';
import { exportAnnotatedPdf } from './utils/pdfExport.js';
import {
  initCanvas,
  loadPageBackground,
  renderShapes,
  applyZoom,
  cancelDrawing,
  deleteShape,
  deleteSelectedShape,
  setOnShapesChanged,
} from './canvas.js';
import {
  showApp,
  showUploader,
  updateToolbar,
  renderShapeList,
} from './ui.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────────

initCanvas();

// canvas.js calls this whenever shapes are added or removed, so the sidebar stays
// in sync without canvas.js needing to know about the DOM.
setOnShapesChanged(refreshShapeList);

setupFileInput();
setupToolbar();
setupKeyboard();

// ── Render helpers ─────────────────────────────────────────────────────────────

function refreshShapeList() {
  renderShapeList(
    (id) => { deleteShape(id); refreshShapeList(); },
    (id) => { state.selectedId = id; renderShapes(); refreshShapeList(); },
    (id, name) => {
      const s = state.shapes.find(sh => sh.id === id);
      if (s) s.name = name;
      // Re-render shapes so the label on canvas updates too
      renderShapes();
    },
  );
}

// ── File input ─────────────────────────────────────────────────────────────────

function setupFileInput() {
  const input    = document.getElementById('file-input');
  const dropZone = document.getElementById('drop-zone');

  input.addEventListener('change', () => {
    if (input.files[0]) loadFile(input.files[0]);
  });

  // Drag-and-drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-blue-400', 'bg-blue-50');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-blue-400', 'bg-blue-50');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-400', 'bg-blue-50');
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') loadFile(file);
  });
}

async function loadFile(file) {
  const { pdfDoc, pdfBytes, totalPages } = await loadPdf(file);

  state.file       = file;
  state.pdfBytes   = pdfBytes;
  state.pdfDoc     = pdfDoc;
  state.totalPages = totalPages;
  state.currentPage = 1;
  state.shapes     = [];
  state.selectedId = null;

  showApp(file.name);
  await goToPage(1, /* fitZoom */ true);
}

// ── Page navigation ────────────────────────────────────────────────────────────

/**
 * Renders the given page and updates all display state.
 * @param {number} pageNum
 * @param {boolean} fitZoom - if true, auto-compute zoom to fit the viewport
 */
async function goToPage(pageNum, fitZoom = false) {
  cancelDrawing();
  state.selectedId = null;
  state.currentPage = pageNum;

  const { imageDataUrl, width, height } = await renderPage(state.pdfDoc, pageNum);
  state.pageSize = { width, height };

  if (fitZoom) {
    state.zoom = computeFitZoom(width, height);
  }

  loadPageBackground(imageDataUrl, width, height);
  applyZoom();
  renderShapes();
  updateToolbar();
  refreshShapeList();
}

/**
 * Computes a zoom level that makes the page fit within the canvas scroll area.
 * Never zooms in beyond 100% — only scales down when necessary.
 */
function computeFitZoom(pageWidth, pageHeight) {
  const scrollEl = document.getElementById('canvas-scroll');
  if (!scrollEl) return 1;
  // Subtract padding (p-8 = 32px each side)
  const availW = scrollEl.clientWidth  - 64;
  const availH = scrollEl.clientHeight - 64;
  const fit = Math.min(availW / pageWidth, availH / pageHeight, 1);
  return Math.max(0.25, parseFloat(fit.toFixed(2)));
}

// ── Toolbar ────────────────────────────────────────────────────────────────────

function setupToolbar() {
  // Tool buttons
  document.getElementById('tool-select').addEventListener('click',  () => setTool('select'));
  document.getElementById('tool-rect').addEventListener('click',    () => setTool('rect'));
  document.getElementById('tool-polygon').addEventListener('click', () => setTool('polygon'));

  // Page navigation
  document.getElementById('page-prev').addEventListener('click', () => {
    if (state.currentPage > 1) goToPage(state.currentPage - 1);
  });
  document.getElementById('page-next').addEventListener('click', () => {
    if (state.currentPage < state.totalPages) goToPage(state.currentPage + 1);
  });

  // Zoom
  document.getElementById('zoom-in').addEventListener('click', () => {
    state.zoom = Math.min(3, parseFloat((state.zoom + 0.25).toFixed(2)));
    applyZoom();
    updateToolbar();
  });
  document.getElementById('zoom-out').addEventListener('click', () => {
    state.zoom = Math.max(0.25, parseFloat((state.zoom - 0.25).toFixed(2)));
    applyZoom();
    updateToolbar();
  });

  // Export
  document.getElementById('btn-export').addEventListener('click', handleExport);

  // Close document
  document.getElementById('btn-close').addEventListener('click', () => {
    state.file = state.pdfBytes = state.pdfDoc = null;
    state.shapes = [];
    state.selectedId = null;
    cancelDrawing();
    showUploader();
  });
}

function setTool(tool) {
  cancelDrawing();
  state.tool = tool;
  // Re-render shapes so draggable flag updates (only draggable in select mode)
  renderShapes();
  updateToolbar();
}

// ── Export ─────────────────────────────────────────────────────────────────────

async function handleExport() {
  if (!state.pdfBytes) return;

  const btn = document.getElementById('btn-export');
  btn.disabled = true;

  try {
    const bytes = await exportAnnotatedPdf(
      state.pdfBytes,
      state.shapes,
      state.pageSize.width,
      state.pageSize.height,
    );
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HVAC_Helper_${state.file.name}`;
    link.click();
    URL.revokeObjectURL(url);
  } finally {
    btn.disabled = false;
  }
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────────

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Don't fire shortcuts when the user is typing in an input
    if (e.target.tagName === 'INPUT') return;

    if (e.key === 'v') setTool('select');
    if (e.key === 'r') setTool('rect');
    if (e.key === 'p') setTool('polygon');

    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelectedShape();
      refreshShapeList();
    }

    if (e.key === 'Escape') {
      cancelDrawing();
    }
  });
}
