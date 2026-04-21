/**
 * All Konva canvas logic: setup, shape rendering, drawing interaction, zoom.
 *
 * Zoom is applied as a CSS transform on the konva-container element — the Stage
 * itself always renders at the natural page size. This keeps Konva's internal
 * coordinate system clean and export-safe.
 *
 * Because of the CSS transform, stage.getPointerPosition() returns visual pixels.
 * We divide by state.zoom to get logical (stage) pixels before doing anything with
 * the position. See getLogicalPos().
 */

import Konva from 'konva';
import { v4 as uuid } from 'uuid';
import { state } from './state.js';
import { getColor } from './utils/colors.js';

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

// ── Callback: called after shapes array changes (add / delete) ─────────────────
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

  // The anchor sits in the layout and controls the scrollable area.
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
 * Clears and redraws all shapes for the current page.
 * Also reattaches the transformer to the selected shape.
 */
export function renderShapes() {
  shapesLayer.destroyChildren();

  // Transformer must be added to the layer after destroyChildren wipes it.
  transformer = new Konva.Transformer({
    rotateEnabled: false,
    boundBoxFunc: (oldBox, newBox) => {
      // Prevent shrinking below 5px
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

    // Group is positioned at (shape.x, shape.y). Its children use (0,0) as origin.
    // Drag moves the group → we update shape.x/shape.y in dragend.
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
      // Polygon points are stored relative to (shape.x, shape.y)
      group.add(new Konva.Line({
        points: s.points,
        fill: s.color,
        opacity: 0.4,
        stroke: strokeColor,
        strokeWidth,
        closed: true,
      }));
    }

    group.add(new Konva.Text({
      text: s.name,
      x: 5,
      y: 5,
      fontSize: 12,
      fill: '#1e293b',
      listening: false, // text shouldn't eat mouse events
    }));

    // Select on click (select tool only)
    group.on('click', (e) => {
      if (state.tool !== 'select') return;
      e.cancelBubble = true; // stop the stage click from firing deselect
      state.selectedId = s.id;
      renderShapes();
      if (onShapesChanged) onShapesChanged();
    });

    // After drag: save new position into state
    group.on('dragend', () => {
      s.x = group.x();
      s.y = group.y();
    });

    // After resize via transformer: apply the scale into width/height or points, then reset scale.
    // We store the actual dimensions, not a scale multiplier, so this keeps state clean.
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

  // Attach transformer to selected shape (only makes sense in select mode)
  if (state.selectedId && state.tool === 'select') {
    const node = shapesLayer.findOne('#' + state.selectedId);
    if (node) transformer.nodes([node]);
  }

  shapesLayer.batchDraw();
}

// ── Pointer helper ─────────────────────────────────────────────────────────────

/**
 * Returns the pointer position in logical (unzoomed) stage coordinates.
 *
 * CSS transform causes stage.getPointerPosition() to return visual pixels
 * (i.e. already scaled down by zoom). Dividing by zoom converts back to the
 * stage's natural pixel space, which is what we store in shapes and export.
 */
function getLogicalPos() {
  const pos = stage.getPointerPosition();
  if (!pos) return null;
  return { x: pos.x / state.zoom, y: pos.y / state.zoom };
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

  // Live rect preview while dragging
  if (state.tool === 'rect' && drawStart && previewNode) {
    previewNode.x(Math.min(pos.x, drawStart.x));
    previewNode.y(Math.min(pos.y, drawStart.y));
    previewNode.width(Math.abs(pos.x - drawStart.x));
    previewNode.height(Math.abs(pos.y - drawStart.y));
    previewLayer.batchDraw();
  }

  // Polygon: show a trailing line from last placed node to the cursor
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

  // Only save if the rect has meaningful size (not just a stray click)
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
    // Click on the background (not a shape) → deselect
    if (e.target === stage) {
      state.selectedId = null;
      renderShapes();
      if (onShapesChanged) onShapesChanged();
    }
    return;
  }

  if (state.tool === 'polygon') {
    if (polyPoints.length === 0) {
      // First click: start the polygon
      polyPoints = [pos.x, pos.y];
      drawPolyPreview(polyPoints);
    } else {
      // Check distance to the first node — close polygon if near enough
      const distToStart = Math.hypot(pos.x - polyPoints[0], pos.y - polyPoints[1]);
      // Scale the closure threshold by zoom so it feels consistent at any zoom level
      const threshold = 10 / state.zoom;

      if (distToStart < threshold && polyPoints.length >= 6) {
        closePolygon();
      } else {
        polyPoints.push(pos.x, pos.y);
        drawPolyPreview(polyPoints);
      }
    }
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

  // Draw a small dot at each placed node so the user can see where they clicked
  for (let i = 0; i < polyPoints.length; i += 2) {
    previewLayer.add(new Konva.Circle({
      x: polyPoints[i],
      y: polyPoints[i + 1],
      radius: 4,
      // First node is filled blue — that's the target for closing the polygon
      fill: i === 0 ? '#3b82f6' : '#ffffff',
      stroke: '#3b82f6',
      strokeWidth: 1.5,
      listening: false,
    }));
  }

  previewLayer.batchDraw();
}

function closePolygon() {
  // polyPoints are absolute stage coords.
  // We store polygons with x/y = first point, and points[] relative to that.
  // This matches the format pdfExport.js expects (offsetX = shape.x, offsetY = shape.y).
  const anchorX = polyPoints[0];
  const anchorY = polyPoints[1];
  const relPoints = polyPoints.map((v, i) => i % 2 === 0 ? v - anchorX : v - anchorY);

  saveShape({
    type: 'polygon',
    x: anchorX,
    y: anchorY,
    points: relPoints, // [0, 0, rel1, rel2, ...]
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
  if (state.selectedId) deleteShape(state.selectedId);
}

/**
 * Cancel any drawing in progress (e.g. when switching tools or changing page).
 */
export function cancelDrawing() {
  drawStart = null;
  polyPoints = [];
  if (previewNode) { previewNode.destroy(); previewNode = null; }
  previewLayer.destroyChildren();
  previewLayer.batchDraw();
}
