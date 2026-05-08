/**
 * All Konva canvas logic: setup, shape rendering, drawing interaction, zoom.
 *
 * Zoom is applied as a CSS transform on the konva-container element — the Stage
 * itself always renders at the natural page size. This keeps Konva's internal
 * coordinate system clean and export-safe.
 *
 * Konva 10 compensates for the CSS transform internally, so getPointerPosition()
 * already returns stage (logical) coordinates. See getLogicalPos().
 */

import Konva from 'konva';
import { v4 as uuid } from 'uuid';
import { state } from './state.js';
import { getColor } from './utils/colors.js';
import { findTopmostShapeAt } from './utils/hitTest.js';

// ── Konva instances ────────────────────────────────────────────────────────────
let stage = null;
let bgLayer = null;      // PDF background image
let shapesLayer = null;  // finished shapes + transformer
let previewLayer = null; // in-progress drawing preview (dashed outlines)
let transformer = null;

// ── In-progress drawing state ─────────────────────────────────────────────────
let drawStart = null;     // {x, y} where mousedown started, for rect drawing
let previewNode = null;   // Konva node for the live rect preview
let polyPoints = [];      // absolute [x0,y0, x1,y1, ...] for polygon in progress

// ── Inline text editor state ──────────────────────────────────────────────────
let activeTextarea = null; // the currently open textarea overlay, if any

// ── Callback: called after shapes/annotations array changes ───────────────────
let onShapesChanged = null;
export function setOnShapesChanged(cb) { onShapesChanged = cb; }

// ── Init ───────────────────────────────────────────────────────────────────────

export function initCanvas() {
  const container = document.getElementById('konva-container');

  stage = new Konva.Stage({ container, width: 100, height: 100 });

  bgLayer = new Konva.Layer();
  shapesLayer = new Konva.Layer();
  previewLayer = new Konva.Layer();
  stage.add(bgLayer, shapesLayer, previewLayer);

  stage.on('mousedown', onMouseDown);
  stage.on('mousemove', onMouseMove);
  stage.on('mouseup', onMouseUp);
  // 'click' fires after mousedown+mouseup on the same target
  stage.on('click', onStageClick);
}

// ── Zoom ───────────────────────────────────────────────────────────────────────

/**
 * Applies the current zoom level as a CSS transform.
 * The size-anchor div is resized to the visual dimensions so the scroll area is correct.
 */
export function applyZoom() {
  const container = document.getElementById('konva-container');
  const anchor = document.getElementById('canvas-size-anchor');
  const { width, height } = state.pageSize;
  const { zoom } = state;

  container.style.transform = `scale(${zoom})`;
  container.style.transformOrigin = 'top left';

  anchor.style.width = `${width * zoom}px`;
  anchor.style.height = `${height * zoom}px`;
}

// ── Background image ───────────────────────────────────────────────────────────

/**
 * Sets the PDF page image as the canvas background and resizes the stage.
 */
export function loadPageBackground(imageDataUrl, width, height) {
  stage.width(width);
  stage.height(height);

  bgLayer.destroyChildren();
  const img = new Image();
  img.onload = () => {
    bgLayer.add(new Konva.Image({ image: img, width, height }));
    bgLayer.batchDraw();
  };
  img.src = imageDataUrl;
}

// ── Shape rendering ────────────────────────────────────────────────────────────

/**
 * Clears and redraws all shapes (and annotations) for the current page.
 */
export function renderShapes() {
  shapesLayer.destroyChildren();

  transformer = new Konva.Transformer({
    rotateEnabled: false,
    boundBoxFunc: (oldBox, newBox) => {
      if (newBox.width < 5 || newBox.height < 5) return oldBox;
      return newBox;
    },
  });
  shapesLayer.add(transformer);

  const pageShapes = state.shapes.filter(s => s.page === state.currentPage);

  for (const s of pageShapes) {
    const isSelected = s.id === state.selectedId;
    const strokeColor = isSelected ? '#2563eb' : s.color;
    const strokeWidth = isSelected ? 2 : 1;

    const group = new Konva.Group({
      id: s.id,
      x: s.x,
      y: s.y,
      draggable: state.tool === 'select',
    });

    if (s.type === 'rect') {
      group.add(new Konva.Rect({
        width: s.width,
        height: s.height,
        fill: s.color,
        opacity: 0.4,
        stroke: strokeColor,
        strokeWidth,
      }));
    } else {
      group.add(new Konva.Line({
        points: s.points,
        fill: s.color,
        opacity: 0.4,
        stroke: strokeColor,
        strokeWidth,
        closed: true,
      }));
    }

    group.on('click', (e) => {
      if (state.tool !== 'select') return;
      e.cancelBubble = true;
      state.selectedId = s.id;
      renderShapes();
      if (onShapesChanged) onShapesChanged();
    });

    group.on('dragend', () => {
      s.x = group.x();
      s.y = group.y();
    });

    group.on('transformend', () => {
      const sx = group.scaleX();
      const sy = group.scaleY();
      group.scaleX(1);
      group.scaleY(1);
      s.x = group.x();
      s.y = group.y();
      if (s.type === 'rect') {
        s.width  = s.width  * sx;
        s.height = s.height * sy;
      } else {
        s.points = s.points.map((p, i) => i % 2 === 0 ? p * sx : p * sy);
      }
      renderShapes();
    });

    shapesLayer.add(group);
  }

  // Only attach transformer to zone shapes, not annotations
  if (state.selectedId && state.tool === 'select') {
    const isShape = state.shapes.some(s => s.id === state.selectedId);
    if (isShape) {
      const node = shapesLayer.findOne('#' + state.selectedId);
      if (node) transformer.nodes([node]);
    }
  }

  // Always render annotations on top of shapes
  renderAnnotations();

  shapesLayer.batchDraw();
}

// ── Annotation rendering ───────────────────────────────────────────────────────

/**
 * Renders text annotation Konva nodes for the current page.
 * Can be called standalone (only annotations need updating) or from renderShapes.
 * When called standalone, removes existing annotation nodes before re-adding.
 */
export function renderAnnotations() {
  // Remove any existing annotation nodes (no-op when called from renderShapes
  // since destroyChildren already cleared everything)
  shapesLayer.find('.annotation').forEach(n => n.destroy());

  const pageAnnotations = state.annotations.filter(a => a.page === state.currentPage);

  for (const ann of pageAnnotations) {
    const isSelected = ann.id === state.selectedId;

    const textNode = new Konva.Text({
      text: ann.text || ' ',
      fontSize: ann.fontSize,
      fontFamily: 'sans-serif',
      fill: '#1e293b',
      lineHeight: 1.4,
    });

    const group = new Konva.Group({
      id: ann.id,
      x: ann.x,
      y: ann.y,
      draggable: state.tool === 'select',
      name: 'annotation',
    });

    // Selection/hover indicator drawn behind the text
    if (isSelected) {
      group.add(new Konva.Rect({
        x: -2,
        y: -2,
        width: textNode.width() + 4,
        height: textNode.height() + 4,
        stroke: '#3b82f6',
        strokeWidth: 1,
        dash: [4, 3],
        listening: false,
      }));
    }

    group.add(textNode);

    group.on('click', (e) => {
      e.cancelBubble = true;
      if (state.tool === 'text') {
        // In text tool: single click opens editor
        closeActiveTextEditor();
        openAnnotationEditor(ann, false);
        return;
      }
      if (state.tool !== 'select') return;
      state.selectedId = ann.id;
      renderShapes();
      if (onShapesChanged) onShapesChanged();
    });

    group.on('dblclick', (e) => {
      e.cancelBubble = true;
      closeActiveTextEditor();
      openAnnotationEditor(ann, false);
    });

    group.on('dragend', () => {
      ann.x = group.x();
      ann.y = group.y();
    });

    shapesLayer.add(group);
  }

  shapesLayer.batchDraw();
}

// ── Inline text editor ─────────────────────────────────────────────────────────

/**
 * Opens a textarea overlay positioned over the annotation on the canvas.
 * isNew: if true, an empty save (Escape or blur with no text) removes the annotation.
 */
function openAnnotationEditor(ann, isNew) {
  if (activeTextarea) {
    activeTextarea.remove();
    activeTextarea = null;
  }

  const anchor = document.getElementById('canvas-size-anchor');
  const textarea = document.createElement('textarea');
  activeTextarea = textarea;

  const visualX = ann.x * state.zoom;
  const visualY = ann.y * state.zoom;
  const visualFontSize = ann.fontSize * state.zoom;

  Object.assign(textarea.style, {
    position:   'absolute',
    left:       `${visualX}px`,
    top:        `${visualY}px`,
    fontSize:   `${visualFontSize}px`,
    fontFamily: 'sans-serif',
    lineHeight: '1.4',
    minWidth:   '80px',
    padding:    '2px 4px',
    border:     '1.5px dashed #3b82f6',
    borderRadius: '2px',
    background: 'rgba(255,255,255,0.88)',
    resize:     'none',
    outline:    'none',
    zIndex:     '50',
    overflow:   'hidden',
  });

  textarea.value = ann.text;
  anchor.appendChild(textarea);

  // Auto-resize height as user types
  const autoResize = () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };
  textarea.addEventListener('input', autoResize);
  autoResize();

  textarea.focus();
  // Place cursor at end
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  const save = () => {
    const text = textarea.value;
    if (!text.trim() && isNew) {
      state.annotations = state.annotations.filter(a => a.id !== ann.id);
      if (state.selectedId === ann.id) state.selectedId = null;
    } else {
      ann.text = text;
    }
    cleanup();
    renderAnnotations();
    if (onShapesChanged) onShapesChanged();
  };

  const cancel = () => {
    if (isNew) {
      state.annotations = state.annotations.filter(a => a.id !== ann.id);
      if (state.selectedId === ann.id) state.selectedId = null;
    }
    cleanup();
    renderAnnotations();
    if (onShapesChanged) onShapesChanged();
  };

  const cleanup = () => {
    textarea.removeEventListener('blur', onBlur);
    textarea.remove();
    if (activeTextarea === textarea) activeTextarea = null;
  };

  const onBlur = () => save();
  textarea.addEventListener('blur', onBlur);

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      textarea.removeEventListener('blur', onBlur);
      save();
    }
    // Enter = newline (natural textarea behavior); Ctrl+Enter also saves
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      textarea.removeEventListener('blur', onBlur);
      save();
    }
  });
}

/**
 * Closes the active inline text editor (saves its content).
 * Call before switching tools or pages.
 */
export function closeActiveTextEditor() {
  if (activeTextarea) {
    activeTextarea.blur();
  }
}

// ── Pointer helper ─────────────────────────────────────────────────────────────

/**
 * Returns the pointer position in logical (unzoomed) stage coordinates.
 */
function getLogicalPos() {
  return stage.getPointerPosition();
}

// ── Mouse event handlers ───────────────────────────────────────────────────────

function onMouseDown() {
  const pos = getLogicalPos();
  if (!pos || state.tool !== 'rect') return;

  drawStart = pos;
  previewNode = new Konva.Rect({
    x: pos.x, y: pos.y,
    width: 0, height: 0,
    stroke: '#3b82f6',
    strokeWidth: 1,
    dash: [5, 5],
    listening: false,
  });
  previewLayer.add(previewNode);
  previewLayer.batchDraw();
}

function onMouseMove() {
  const pos = getLogicalPos();
  if (!pos) return;

  if (state.tool === 'rect' && drawStart && previewNode) {
    previewNode.x(Math.min(pos.x, drawStart.x));
    previewNode.y(Math.min(pos.y, drawStart.y));
    previewNode.width(Math.abs(pos.x - drawStart.x));
    previewNode.height(Math.abs(pos.y - drawStart.y));
    previewLayer.batchDraw();
  }

  if (state.tool === 'polygon' && polyPoints.length >= 2) {
    drawPolyPreview([...polyPoints, pos.x, pos.y]);
  }
}

function onMouseUp() {
  const pos = getLogicalPos();
  if (!pos || state.tool !== 'rect' || !drawStart || !previewNode) return;

  const x = Math.min(pos.x, drawStart.x);
  const y = Math.min(pos.y, drawStart.y);
  const width  = Math.abs(pos.x - drawStart.x);
  const height = Math.abs(pos.y - drawStart.y);

  if (width > 5 && height > 5) {
    saveShape({ type: 'rect', x, y, width, height });
  }

  previewNode.destroy();
  previewNode = null;
  drawStart = null;
  previewLayer.batchDraw();
}

function onStageClick(e) {
  const pos = getLogicalPos();
  if (!pos) return;

  if (state.tool === 'select') {
    if (e.target === stage) {
      state.selectedId = null;
      renderShapes();
      if (onShapesChanged) onShapesChanged();
    }
    return;
  }

  if (state.tool === 'polygon') {
    if (polyPoints.length === 0) {
      polyPoints = [pos.x, pos.y];
      drawPolyPreview(polyPoints);
    } else {
      const distToStart = Math.hypot(pos.x - polyPoints[0], pos.y - polyPoints[1]);
      const threshold = 10 / state.zoom;

      if (distToStart < threshold && polyPoints.length >= 6) {
        closePolygon();
      } else {
        polyPoints.push(pos.x, pos.y);
        drawPolyPreview(polyPoints);
      }
    }
    return;
  }

  if (state.tool === 'text') {
    // Place a new annotation at the clicked position, linked to the topmost zone there
    const pageShapes = state.shapes.filter(s => s.page === state.currentPage);
    const linkedShapeId = findTopmostShapeAt(pos.x, pos.y, pageShapes);

    const ann = {
      id: uuid(),
      type: 'annotation',
      text: '',
      x: pos.x,
      y: pos.y,
      fontSize: 14,
      page: state.currentPage,
      linkedShapeId,
    };
    state.annotations.push(ann);
    state.selectedId = ann.id;
    renderAnnotations();
    if (onShapesChanged) onShapesChanged();
    openAnnotationEditor(ann, true);
  }
}

// ── Polygon drawing helpers ────────────────────────────────────────────────────

function drawPolyPreview(points) {
  previewLayer.destroyChildren();

  if (points.length >= 4) {
    previewLayer.add(new Konva.Line({
      points,
      stroke: '#3b82f6',
      strokeWidth: 1,
      dash: [5, 5],
      listening: false,
    }));
  }

  for (let i = 0; i < polyPoints.length; i += 2) {
    previewLayer.add(new Konva.Circle({
      x: polyPoints[i],
      y: polyPoints[i + 1],
      radius: 4,
      fill: i === 0 ? '#3b82f6' : '#ffffff',
      stroke: '#3b82f6',
      strokeWidth: 1.5,
      listening: false,
    }));
  }

  previewLayer.batchDraw();
}

function closePolygon() {
  const anchorX = polyPoints[0];
  const anchorY = polyPoints[1];
  const relPoints = polyPoints.map((v, i) => i % 2 === 0 ? v - anchorX : v - anchorY);

  saveShape({
    type: 'polygon',
    x: anchorX,
    y: anchorY,
    points: relPoints,
  });

  polyPoints = [];
  previewLayer.destroyChildren();
  previewLayer.batchDraw();
}

// ── Shape CRUD ─────────────────────────────────────────────────────────────────

function saveShape(data) {
  const shape = {
    id: uuid(),
    color: getColor(state.shapes.length),
    page: state.currentPage,
    name: `Zone ${state.shapes.length + 1}`,
    ...data,
  };
  state.shapes.push(shape);
  state.selectedId = shape.id;
  renderShapes();
  if (onShapesChanged) onShapesChanged();
}

export function deleteShape(id) {
  state.shapes = state.shapes.filter(s => s.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  renderShapes();
  if (onShapesChanged) onShapesChanged();
}

export function deleteSelectedShape() {
  if (state.selectedId && state.shapes.some(s => s.id === state.selectedId)) {
    deleteShape(state.selectedId);
  }
}

export function deleteAnnotation(id) {
  state.annotations = state.annotations.filter(a => a.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  renderAnnotations();
  if (onShapesChanged) onShapesChanged();
}

/**
 * Cancel any drawing in progress (e.g. when switching tools or changing page).
 */
export function cancelDrawing() {
  closeActiveTextEditor();
  drawStart = null;
  polyPoints = [];
  if (previewNode) { previewNode.destroy(); previewNode = null; }
  previewLayer.destroyChildren();
  previewLayer.batchDraw();
}
