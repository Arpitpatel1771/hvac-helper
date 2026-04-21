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
      page.drawSvgPath(svgPath, {
        color: rgb(r, g, b),
        opacity: 0.4,
      });

      // Draw label near the first point
      const scaleX = pdfWidth / stageWidth;
      const scaleY = pdfHeight / stageHeight;
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
