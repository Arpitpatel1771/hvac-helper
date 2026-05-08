# PRD: Free-form Text Annotations

## Problem Statement

HVAC engineers annotating floor plans need to add free-form text notes inside zones — such as room load values (kW, L/s, m²) or custom labels — directly on the canvas. Currently, each zone only displays a single auto-generated name label. There is no way to add additional text content to a zone, forcing engineers to annotate outside the tool or maintain a separate document alongside the exported PDF.

## Solution

Introduce a **Text tool** that lets the user click anywhere on the canvas to place a free-form, multi-line text block. Text blocks placed inside a zone boundary are logically linked to that zone (owned by it). Text blocks placed outside any zone are standalone. All text blocks export to the PDF as real selectable text. Font size is adjustable per block via a contextual second toolbar row that appears when a text block is selected.

## User Stories

1. As an HVAC engineer, I want to place a text block inside a zone, so that I can annotate load values (kW, L/s, m²) directly on the floor plan.
2. As an HVAC engineer, I want to place multiple independent text blocks inside the same zone, so that I can separate different categories of notes spatially within a large room.
3. As an HVAC engineer, I want to place a text block outside any zone, so that I can annotate duct labels or general plan notes that don't belong to a specific room.
4. As an HVAC engineer, I want text blocks to be free-floating on the canvas, so that I can position them precisely where they read best regardless of room boundaries.
5. As an HVAC engineer, I want to double-click a placed text block to edit its content inline, so that I don't have to open a separate dialog to make changes.
6. As an HVAC engineer, I want text to start editing immediately when I click with the text tool, so that I can place and type in a single action without an extra double-click.
7. As an HVAC engineer, I want to increase or decrease the font size of a selected text block, so that I can control how prominently each annotation reads on the plan.
8. As an HVAC engineer, I want font size controls to appear in a second toolbar row only when a text block is selected, so that the toolbar doesn't feel cluttered when I'm drawing zones.
9. As an HVAC engineer, I want text blocks linked to a zone to be listed nested under that zone in the sidebar, so that I can see at a glance what annotations belong to each room.
10. As an HVAC engineer, I want standalone text blocks to appear as top-level items in the sidebar, so that I can manage them independently.
11. As an HVAC engineer, I want to be warned before deleting a zone that has linked text blocks, so that I don't accidentally lose annotations I spent time writing.
12. As an HVAC engineer, I want all linked text blocks to be deleted when I confirm a zone deletion, so that the document stays clean without orphaned notes floating over an unmarked area.
13. As an HVAC engineer, I want text blocks to be draggable independently of their linked zone, so that I can reposition labels when a zone is resized or the text no longer fits.
14. As an HVAC engineer, I want text blocks to export as real selectable text in the output PDF, so that reviewers can copy values out of the document.
15. As an HVAC engineer, I want text annotations to respect PDF page rotation during export, so that labels appear upright on pages that have internal rotation metadata.
16. As an HVAC engineer, I want text blocks that overlap multiple zones to link to the topmost zone, so that there is a deterministic and predictable ownership rule.
17. As an HVAC engineer, I want to select and delete a text block individually without affecting its linked zone, so that I can remove a note without losing the zone it belongs to.
18. As an HVAC engineer, I want the text tool to be accessible from the main toolbar (alongside Select, Rect, Polygon), so that it is discoverable and consistent with the existing drawing workflow.
19. As an HVAC engineer, I want a keyboard shortcut to activate the text tool, so that I can switch to it quickly without reaching for the mouse.
20. As an HVAC engineer, I want text blocks on other pages to be hidden when I navigate away, so that the canvas only shows annotations relevant to the current page.

## Implementation Decisions

### Data model

A new `annotations` array is added to `state`. Each annotation has:

- `id` — uuid
- `type: 'annotation'`
- `text` — free-form string (may contain newlines)
- `x`, `y` — absolute Konva stage position
- `fontSize` — number, default `14`, step `2`, no enforced min/max beyond usability
- `page` — 1-indexed page number
- `linkedShapeId` — id of the zone that owns this annotation, or `null` for standalone

### Modules to build or modify

**state.js** — Add `annotations: []` alongside `shapes`.

**Hit-detection utility** (`src/utils/hitTest.js`, new) — Pure function `findTopmostShapeAt(x, y, shapes)` that returns the id of the topmost shape whose bounding area contains the given point, or `null`. Encapsulates the point-in-polygon / point-in-rect logic so it can be tested in isolation without Konva or DOM.

**canvas.js** — Four additions:
1. Text tool click handler: on canvas click when `state.tool === 'text'`, place a new annotation at the click position and immediately open the inline textarea editor.
2. Inline editor: a positioned `<textarea>` overlaid on the `#konva-container` at the annotation's visual coordinates. On blur/Enter, save text and remove textarea.
3. Double-click handler on existing annotation Konva nodes to re-open the inline editor.
4. `renderAnnotations()` — renders `Konva.Text` nodes for all annotations on the current page, wires click (select), dragend (update x/y), and dblclick (edit).

**ui.js** — Two additions:
1. Update `renderShapeList` to render annotations nested under their linked shape, and standalone annotations as top-level items.
2. `updateTextToolbar(annotation)` — shows/hides the second toolbar row and populates font size display. Called from `main.js` when selection changes.

**index.html** — Three additions:
1. Text tool button in the main toolbar (alongside Select, Rect, Polygon).
2. A second toolbar row (initially hidden) containing font size decrease button, font size display, and font size increase button.
3. A confirmation dialog (or `window.confirm`) for zone deletion when the zone has linked annotations.

**main.js** — Wire up:
- Text tool button and keyboard shortcut (`t`).
- Font size +/− buttons calling into canvas/state and re-rendering.
- `onShapesChanged` extension: when a shape is deleted, check for linked annotations and prompt confirmation; if confirmed, remove linked annotations and re-render.

**pdfExport.js** — After drawing zone shapes, iterate `annotations` for the page and call `page.drawText()` for each, converting Konva coordinates to PDF points via `mapVisualToPdf`, preserving font size and rotation.

### Key interaction details

- Linking is determined once at placement time and stored as `linkedShapeId`. It is not recalculated when zones are moved.
- The inline textarea is positioned using `stage.container().getBoundingClientRect()` plus the annotation's Konva coordinates scaled by `state.zoom`, so it aligns correctly at all zoom levels.
- Font size controls in the second toolbar row are only visible when `state.selectedId` refers to an annotation (not a zone shape).
- The `Escape` key should close the inline textarea without saving (cancel edit), consistent with the existing `cancelDrawing` pattern.
- Keyboard shortcut for the text tool: `t`.

### Coordinate export

Text position follows the same `mapVisualToPdf` path already used for zone label positions in `pdfExport.js`. Font size is passed directly to `page.drawText({ size: annotation.fontSize })`.

## Testing Decisions

No test suite is currently configured in this project. The one module worth designing for testability is the hit-detection utility:

**`src/utils/hitTest.js`** — `findTopmostShapeAt(x, y, shapes)` takes plain data and returns a plain value. It has no Konva, DOM, or state dependency and can be unit-tested with any test runner by passing synthetic shape arrays and asserting the returned id. This is the highest-value test target because incorrect linking is silent — the annotation silently belongs to the wrong room.

If a test suite is added in the future, this function should be the first thing tested.

## Out of Scope

- Inline mixed formatting (bold, italic, underline, colour, highlight per word or character)
- Text block borders or backgrounds
- Automatic repositioning or reflow of text when a linked zone is resized or moved
- Structured / templated fields (kW, L/s, m² as discrete inputs)
- Text rotation to match a rotated zone shape
- Undo/redo

## Further Notes

- The reference design (ref.jpeg in the repo root) shows each coloured zone with a text block in the top-left corner containing room name and HVAC load data. The implementation does not auto-populate or auto-position this block — the user places it manually with the text tool.
- The client's actual PDFs have been observed to contain multiple text blocks per zone, confirming that a 1:1 zone-to-text constraint would be too restrictive.
- The existing zone label (drawn by `saveShape` in canvas.js as a `Konva.Text` with `listening: false`) is separate from annotations and is not replaced by this feature.

## TODO

- [x] Add `annotations: []` to `state.js`
- [x] Create `src/utils/hitTest.js` — `findTopmostShapeAt(x, y, shapes)` pure function
- [x] Add text tool button to main toolbar in `index.html` (keyboard shortcut `t`)
- [x] Add second toolbar row (font size controls) to `index.html`, hidden by default
- [x] Implement text tool click handler in `canvas.js` — place annotation + open inline textarea immediately
- [x] Implement inline textarea editor in `canvas.js` — positioned overlay, saves on blur/Enter, cancels on Escape
- [x] Implement double-click to re-edit existing annotation in `canvas.js`
- [x] Implement `renderAnnotations()` in `canvas.js` — Konva.Text nodes, click to select, dragend to update position
- [x] Update `renderShapeList` in `ui.js` — nest annotations under linked zone, standalone as top-level
- [x] Implement `updateTextToolbar()` in `ui.js` — show/hide second row and font size display based on selection
- [x] Wire text tool + font size +/− + delete confirmation in `main.js`
- [x] Add confirmation dialog in `main.js` when deleting a zone that has linked annotations
- [x] Export annotations as `page.drawText()` in `pdfExport.js` with rotation support
