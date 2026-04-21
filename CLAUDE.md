# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite)
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

No test suite is configured.

---

## Architecture

HVAC Helper is a local-first, browser-based floor plan annotation tool. The user loads a PDF,
draws labeled zones (rectangles or polygons) over it, and exports a new PDF with the annotations
burned in.

**Stack: Vanilla JS + Vite + Tailwind CSS + Konva + pdfjs-dist + pdf-lib. No React.**

The app is built around three completely separate concerns. Never mix them.

```
[pdfjs-dist]  →  renders PDF page to a PNG image (display only)
[Konva]       →  drawing canvas on top of that image (interaction only)
[pdf-lib]     →  loads original PDF bytes and draws vector shapes on export (export only)
```

### Folder structure

```
index.html              HTML shell with all static UI (toolbar, panels, canvas area)
src/
  main.js               Entry point — wires all modules together, owns all event listeners
  state.js              Single plain-object state — read/write directly, no reactive system
  canvas.js             Konva setup, shape rendering, drawing interaction
  pdfLoader.js          pdfjs: load PDF, render pages to data URLs
  ui.js                 DOM updates — toolbar state, shape list, screen switching
  utils/
    coordinates.js      ALL coordinate conversion (Konva pixels ↔ PDF points)
    pdfExport.js        pdf-lib export — imports from coordinates.js
    colors.js           Color cycling + hex→rgb helper
```

### Key data flow

```
File pick   → loadPdf()          → state.pdfDoc, state.pdfBytes
Page render → renderPage()       → state.pageSize, loads background into Konva
Draw shape  → canvas.js events   → state.shapes[]
Export      → exportAnnotatedPdf → downloads annotated PDF
```

### State (src/state.js)

Plain mutable object. After writing to it, call the relevant render function.

```js
{
  file, pdfBytes, pdfDoc,         // PDF loading
  currentPage, totalPages,
  pageSize: { width, height },    // rendered page size in pixels (at 1.5x scale)
  shapes: [],                     // all shapes across all pages
  selectedId,                     // currently selected shape id
  tool,                           // 'select' | 'rect' | 'polygon'
  zoom,                           // e.g. 0.75 = 75%
}
```

---

## Shape data model

Every shape has these base fields:

```js
{
  id: string,          // uuid
  type: 'rect' | 'polygon',
  name: string,        // user label e.g. "Zone 1"
  color: string,       // hex, auto-assigned from colors.js
  page: number,        // 1-indexed
}
```

Type-specific fields:

```js
// Rectangle
{ ...base, type: 'rect', x, y, width, height }

// Polygon — points are RELATIVE to (x, y)
{ ...base, type: 'polygon', x, y, points: [0,0, relX1,relY1, relX2,relY2, ...] }
```

For polygons: `x`/`y` is the absolute position of the first node. `points` are offsets from that.
This means `pdfExport.js` adds `shape.x`/`shape.y` back as `offsetX`/`offsetY` when converting.

Keep this model extensible — future shape types (ductwork lines, equipment symbols) will follow
the same base pattern.

---

## Coordinate system — the most critical part

PDF and Konva use different coordinate spaces:

| | Konva (pixels) | PDF (points, pdf-lib) |
|---|---|---|
| Origin | top-left | bottom-left |
| Y axis | increases downward | increases upward |
| Units | pixels | points (1pt = 1/72 inch) |

All conversion lives in `src/utils/coordinates.js`. Never pass raw Konva coordinates to pdf-lib.
Functions: `polygonToPdfCoords`, `rectToPdfCoords`, `mapVisualToPdf`.

### PDF rotation handling

Some PDFs have internal rotation metadata (0°/90°/180°/270°). The export function reads
`page.getRotation().angle` and compensates via `mapVisualToPdf`. Do not remove or simplify
this logic — test with a rotated PDF if the export function is ever modified.

---

## Zoom

- `state.zoom` is a float (0.25–3.0).
- Zoom is applied as **CSS transform: scale()** on `#konva-container`. The Konva stage always
  renders at the natural page size — it has no scaleX/scaleY.
- `#canvas-size-anchor` is resized to `pageWidth * zoom × pageHeight * zoom` so the scrollbar
  reflects the correct visual size.
- Konva 10 compensates for the CSS transform internally (`getBoundingClientRect` vs
  `clientWidth`), so `stage.getPointerPosition()` already returns **logical (stage) pixels**.
  No manual zoom division is needed. See `getLogicalPos()` in canvas.js.
- On PDF load, zoom is auto-computed to fit the viewport (`computeFitZoom` in main.js).

---

## Features

### Annotation drawing
- **Rectangle**: mousedown → drag → mouseup. Normalized so you can drag in any direction.
- **Polygon**: click to place nodes, click within 10px of the first node to close.
  First node shown as filled blue circle. In-progress polygon shows dashed preview + node dots.
- **Select**: click to select, drag to move, handles to resize (Konva Transformer).
  Resize updates width/height/points in state by multiplying by the group's scaleX/scaleY.
- All shapes belong to a specific page (`shape.page`). Canvas shows only the current page's shapes.

### Zoom
- `+` / `−` buttons in the toolbar: step by 0.25, range 0.25–3.0.
- Auto-fit on PDF load.
- See coordinate note above — divide pointer positions by zoom.

### Export
- Loads original PDF bytes into pdf-lib.
- Converts each shape's Konva coordinates to PDF points via `coordinates.js`.
- Draws as vector overlays (SVG path) with a text label.
- Rotation-aware: compensates for PDFs with internal rotation metadata.

### Page navigation
- `<` / `>` buttons or keyboard-driven. Navigating cancels any drawing in progress.

---

## Key implementation notes

### pdfjs worker
pdfjs-dist v4 uses an ES module worker (`.mjs`). Use Vite's `?url` import:
```js
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
```
Do NOT use a CDN URL — v4 workers are ES modules and CDN `.min.js` URLs fail at runtime.

### pdfjs ArrayBuffer ownership
`pdfjsLib.getDocument({ data: arrayBuffer })` transfers the ArrayBuffer to the worker thread,
detaching the original. Always pass `arrayBuffer.slice(0)` (a copy) to pdfjs and keep the
original for pdf-lib export. See `loadPdf()` in pdfLoader.js.

---

## Development rules

- **JavaScript only** — no TypeScript.
- **Tailwind CSS only** — no custom `.css` files (except `index.css` for Tailwind directives).
- **No React** — vanilla JS only.
- **Coordinate safety** — never pass raw Konva coordinates to pdf-lib.
  Always go through `src/utils/coordinates.js`.
- **Document all features** — every feature (new or modified) must be added to the Features
  section above. Fixes that change observable behaviour count as features.
- Keep files small and single-purpose. Comment non-obvious architectural decisions.
