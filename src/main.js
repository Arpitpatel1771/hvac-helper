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
  renderAnnotations,
  applyZoom,
  cancelDrawing,
  deleteShape,
  deleteSelectedShape,
  deleteAnnotation,
  setOnShapesChanged,
  closeActiveTextEditor,
} from './canvas.js';
import {
  showApp,
  showUploader,
  updateToolbar,
  updateTextToolbar,
  renderShapeList,
} from './ui.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────────

initCanvas();

setOnShapesChanged(refreshShapeList);

setupFileInput();
setupToolbar();
setupKeyboard();

// ── Render helpers ─────────────────────────────────────────────────────────────

function refreshShapeList() {
  renderShapeList(
    (id) => handleShapeDelete(id),
    (id) => { state.selectedId = id; renderShapes(); refreshShapeList(); },
    (id, name) => {
      const s = state.shapes.find(sh => sh.id === id);
      if (s) s.name = name;
      renderShapes();
    },
    (annId) => { deleteAnnotation(annId); refreshShapeList(); },
    (annId) => handleAnnotationSelect(annId),
  );
  syncTextToolbar();
}

function syncTextToolbar() {
  const ann = state.annotations.find(a => a.id === state.selectedId);
  updateTextToolbar(ann || null);
}

function handleAnnotationSelect(annId) {
  state.selectedId = annId;
  renderShapes();
  refreshShapeList();
}

function handleShapeDelete(id) {
  const linked = state.annotations.filter(a => a.linkedShapeId === id);
  if (linked.length > 0) {
    const noun = linked.length === 1 ? 'annotation' : 'annotations';
    const confirmed = window.confirm(
      `This zone has ${linked.length} linked ${noun}. Delete the zone and its ${noun}?`
    );
    if (!confirmed) return;
    linked.forEach(a => deleteAnnotation(a.id));
  }
  deleteShape(id);
  refreshShapeList();
}

// ── File input ─────────────────────────────────────────────────────────────────

function setupFileInput() {
  const input    = document.getElementById('file-input');
  const dropZone = document.getElementById('drop-zone');

  input.addEventListener('change', () => {
    if (input.files[0]) loadFile(input.files[0]);
  });

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

  state.file        = file;
  state.pdfBytes    = pdfBytes;
  state.pdfDoc      = pdfDoc;
  state.totalPages  = totalPages;
  state.currentPage = 1;
  state.shapes      = [];
  state.annotations = [];
  state.selectedId  = null;

  showApp(file.name);
  await goToPage(1, /* fitZoom */ true);
}

// ── Page navigation ────────────────────────────────────────────────────────────

async function goToPage(pageNum, fitZoom = false) {
  closeActiveTextEditor();
  cancelDrawing();
  state.selectedId  = null;
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

function computeFitZoom(pageWidth, pageHeight) {
  const scrollEl = document.getElementById('canvas-scroll');
  if (!scrollEl) return 1;
  const availW = scrollEl.clientWidth  - 64;
  const availH = scrollEl.clientHeight - 64;
  const fit = Math.min(availW / pageWidth, availH / pageHeight, 1);
  return Math.max(0.25, parseFloat(fit.toFixed(2)));
}

// ── Toolbar ────────────────────────────────────────────────────────────────────

function setupToolbar() {
  document.getElementById('tool-select').addEventListener('click',  () => setTool('select'));
  document.getElementById('tool-rect').addEventListener('click',    () => setTool('rect'));
  document.getElementById('tool-polygon').addEventListener('click', () => setTool('polygon'));
  document.getElementById('tool-text').addEventListener('click',    () => setTool('text'));

  document.getElementById('page-prev').addEventListener('click', () => {
    if (state.currentPage > 1) goToPage(state.currentPage - 1);
  });
  document.getElementById('page-next').addEventListener('click', () => {
    if (state.currentPage < state.totalPages) goToPage(state.currentPage + 1);
  });

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

  document.getElementById('font-size-increase').addEventListener('click', () => {
    const ann = state.annotations.find(a => a.id === state.selectedId);
    if (!ann) return;
    ann.fontSize = Math.min(ann.fontSize + 2, 96);
    renderAnnotations();
    syncTextToolbar();
  });
  document.getElementById('font-size-decrease').addEventListener('click', () => {
    const ann = state.annotations.find(a => a.id === state.selectedId);
    if (!ann) return;
    ann.fontSize = Math.max(ann.fontSize - 2, 6);
    renderAnnotations();
    syncTextToolbar();
  });

  document.getElementById('btn-export').addEventListener('click', handleExport);

  document.getElementById('btn-close').addEventListener('click', () => {
    closeActiveTextEditor();
    state.file = state.pdfBytes = state.pdfDoc = null;
    state.shapes = [];
    state.annotations = [];
    state.selectedId = null;
    cancelDrawing();
    showUploader();
  });
}

function setTool(tool) {
  cancelDrawing(); // also closes active text editor
  state.tool = tool;
  renderShapes();
  updateToolbar();
  syncTextToolbar();
}

// ── Export ─────────────────────────────────────────────────────────────────────

async function handleExport() {
  if (!state.pdfBytes) return;

  closeActiveTextEditor();

  const btn = document.getElementById('btn-export');
  btn.disabled = true;

  try {
    const bytes = await exportAnnotatedPdf(
      state.pdfBytes,
      state.shapes,
      state.annotations,
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
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'v') setTool('select');
    if (e.key === 'r') setTool('rect');
    if (e.key === 'p') setTool('polygon');
    if (e.key === 't') setTool('text');

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!state.selectedId) return;
      const ann = state.annotations.find(a => a.id === state.selectedId);
      if (ann) {
        deleteAnnotation(state.selectedId);
        refreshShapeList();
      } else {
        deleteSelectedShape();
        refreshShapeList();
      }
    }

    if (e.key === 'Escape') {
      cancelDrawing();
    }
  });
}
