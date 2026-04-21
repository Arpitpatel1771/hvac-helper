import { PDFDocument, rgb, degrees } from 'pdf-lib';
import { polygonToPdfCoords, pointsToSvgPath, mapVisualToPdf } from './coordinates';
import { hexToRgb } from './colors';

/**
 * Exports the annotated PDF.
 * @param {ArrayBuffer} pdfBytes - Original PDF bytes
 * @param {Array} shapes - All shapes
 * @param {number} stageWidth - Stage width in pixels
 * @param {number} stageHeight - Stage height in pixels
 * @returns {Promise<Uint8Array>} Final PDF bytes
 */
export async function exportAnnotatedPdf(pdfBytes, shapes, stageWidth, stageHeight) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
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

      // Draw label near the first point.
      // Must use visual-dimension scales (same swap logic as polygonToPdfCoords).
      const isSwapped = rotation === 90 || rotation === 270;
      const visWidthPts  = isSwapped ? pdfHeight : pdfWidth;
      const visHeightPts = isSwapped ? pdfWidth  : pdfHeight;
      const scaleX = visWidthPts  / stageWidth;
      const scaleY = visHeightPts / stageHeight;

      const firstPointX = shape.type === 'rect' ? 0 : shape.points[0];
      const firstPointY = shape.type === 'rect' ? 0 : shape.points[1];
      const vX = (shape.x + firstPointX) * scaleX;
      const vY = (shape.y + firstPointY) * scaleY;
      const labelPos = mapVisualToPdf(vX, vY, pdfWidth, pdfHeight, rotation);

      page.drawText(shape.name, {
        x: labelPos.x + 5,
        y: labelPos.y - 15,
        size: 10,
        color: rgb(0, 0, 0),
        rotate: degrees(-rotation),
      });
    }
  }

  return await pdfDoc.save();
}
