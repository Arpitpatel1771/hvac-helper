import { PDFDocument, rgb, degrees } from 'pdf-lib';
import { polygonToPdfCoords, pointsToSvgPath, mapVisualToPdf } from './coordinates';
import { hexToRgb } from './colors';

/**
 * Exports the annotated PDF with zone shapes and text annotations burned in.
 * @param {ArrayBuffer} pdfBytes
 * @param {Array} shapes
 * @param {Array} annotations
 * @param {number} stageWidth - Stage width in pixels
 * @param {number} stageHeight - Stage height in pixels
 * @returns {Promise<Uint8Array>}
 */
export async function exportAnnotatedPdf(pdfBytes, shapes, annotations, stageWidth, stageHeight) {
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // ── Zone shapes ──────────────────────────────────────────────────────────────
  for (const shape of shapes) {
    const page = pdfDoc.getPage(shape.page - 1);
    const { width: pdfWidth, height: pdfHeight } = page.getSize();
    const rotation = page.getRotation().angle;
    const { r, g, b } = hexToRgb(shape.color);

    let pdfPoints;
    if (shape.type === 'rect') {
      const rectPoints = [
        0, 0,
        shape.width, 0,
        shape.width, shape.height,
        0, shape.height
      ];
      pdfPoints = polygonToPdfCoords(rectPoints, stageWidth, stageHeight, pdfWidth, pdfHeight, rotation, shape.x, shape.y);
    } else if (shape.type === 'polygon') {
      pdfPoints = polygonToPdfCoords(shape.points, stageWidth, stageHeight, pdfWidth, pdfHeight, rotation, shape.x, shape.y);
    }

    if (pdfPoints) {
      const svgPath = pointsToSvgPath(pdfPoints);
      // y: pdfHeight places the SVG origin at the top-left of the page.
      // drawSvgPath applies scale(1,-1) internally, so Y-down path coords
      // become correct PDF Y-up coordinates: PDF_y = pdfHeight - path_y.
      page.drawSvgPath(svgPath, {
        x: 0,
        y: pdfHeight,
        color: rgb(r, g, b),
        opacity: 0.4,
      });
    }
  }

  // ── Text annotations ─────────────────────────────────────────────────────────
  for (const ann of annotations) {
    if (!ann.text.trim()) continue;

    const page = pdfDoc.getPage(ann.page - 1);
    const { width: pdfWidth, height: pdfHeight } = page.getSize();
    const rotation = page.getRotation().angle;

    const isSwapped = rotation === 90 || rotation === 270;
    const visWidthPts  = isSwapped ? pdfHeight : pdfWidth;
    const visHeightPts = isSwapped ? pdfWidth  : pdfHeight;
    const scaleX = visWidthPts  / stageWidth;

    const vX = ann.x * scaleX;
    const vY = ann.y * (visHeightPts / stageHeight);
    const basePos = mapVisualToPdf(vX, vY, pdfWidth, pdfHeight, rotation);

    const pdfFontSize = Math.max(4, Math.round(ann.fontSize * scaleX));
    const lineHeightPts = Math.round(pdfFontSize * 1.4);

    // mapVisualToPdf maps the visual top-left of the text block, but drawText
    // positions the baseline. Offset downward by ~0.75× font size (typical ascent
    // ratio for sans-serif fonts) so the top of the rendered text matches ann.y.
    const ascentPts = Math.round(pdfFontSize * 0.75);

    // Per-rotation: line advance direction (visual "down") + initial ascent offset
    let lax = 0, lay = 0, ox = 0, oy = 0;
    if (rotation === 0)        { lax = 0;              lay = -lineHeightPts; oy = -ascentPts; }
    else if (rotation === 90)  { lax = lineHeightPts;  lay = 0;              ox =  ascentPts; }
    else if (rotation === 180) { lax = 0;              lay = lineHeightPts;  oy =  ascentPts; }
    else if (rotation === 270) { lax = -lineHeightPts; lay = 0;              ox = -ascentPts; }

    const lines = ann.text.split('\n');
    lines.forEach((line, i) => {
      if (!line) return;
      page.drawText(line, {
        x: basePos.x + ox + i * lax,
        y: basePos.y + oy + i * lay,
        size: pdfFontSize,
        color: rgb(0.12, 0.16, 0.24), // #1e293b
        rotate: degrees(rotation),
      });
    });
  }

  return await pdfDoc.save();
}
