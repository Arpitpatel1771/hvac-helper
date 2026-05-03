/**
 * Coordinate system conversion between Konva (pixels) and PDF (points).
 * Origin for Konva: Top-Left
 * Origin for PDF: Bottom-Left (rotated according to PDF metadata)
 */

/**
 * Maps a single visual (Konva) point to a PDF point, accounting for page rotation.
 * 
 * @param {number} vX - Visual X in points
 * @param {number} vY - Visual Y in points
 * @param {number} pdfWidth - PDF page width in points
 * @param {number} pdfHeight - PDF page height in points
 * @param {number} rotation - PDF rotation angle (0, 90, 180, 270)
 * @returns {object} { x, y } in PDF points
 */
export function mapVisualToPdf(vX, vY, pdfWidth, pdfHeight, rotation) {
  if (rotation === 0) return { x: vX, y: pdfHeight - vY };
  if (rotation === 90)  return { x: vY, y: vX };
  if (rotation === 180) return { x: pdfWidth - vX, y: vY };
  if (rotation === 270) return { x: pdfWidth - vY, y: pdfHeight - vX };
  return { x: vX, y: pdfHeight - vY };
}

/**
 * Converts Konva rectangle coordinates to PDF coordinates.
 * @param {object} shape - Rect shape { x, y, width, height }
 * @param {number} stageWidth - Konva stage width in pixels
 * @param {number} stageHeight - Konva stage height in pixels
 * @param {number} pdfWidth - PDF page width in points
 * @param {number} pdfHeight - PDF page height in points
 * @param {number} rotation - PDF rotation angle (0, 90, 180, 270)
 * @returns {object} { x, y, width, height, rotation } in PDF points
 */
export function rectToPdfCoords(shape, stageWidth, stageHeight, pdfWidth, pdfHeight, rotation) {
  const scaleX = pdfWidth / stageWidth;
  const scaleY = pdfHeight / stageHeight;

  // We need to map the points of the rectangle
  // In pdf-lib, drawRectangle origin is bottom-left of the rect.
  // In Konva, origin is top-left.
  
  // To handle rotation correctly and easily, we can use the same mapVisualToPdf
  // but we need to know WHICH corner we are mapping.
  
  // Let's just use the logic from the previous implementation but modularized.
  // The previous implementation used drawSvgPath for everything to simplify.
  
  const points = [
    0, 0,
    shape.width, 0,
    shape.width, shape.height,
    0, shape.height
  ];

  const convertedPoints = polygonToPdfCoords(points, stageWidth, stageHeight, pdfWidth, pdfHeight, rotation, shape.x, shape.y);
  return convertedPoints;
}

/**
 * Converts Konva polygon points to PDF coordinates.
 * @param {number[]} points - Flat array [x1, y1, x2, y2, ...] in Konva pixels (relative to shape.x, shape.y)
 * @param {number} stageWidth - Konva stage width in pixels
 * @param {number} stageHeight - Konva stage height in pixels
 * @param {number} pdfWidth - PDF page width in points
 * @param {number} pdfHeight - PDF page height in points
 * @param {number} rotation - PDF rotation angle (0, 90, 180, 270)
 * @param {number} offsetX - Global Konva X offset
 * @param {number} offsetY - Global Konva Y offset
 * @returns {number[]} Flat array [x1, y1, x2, y2, ...] in PDF points
 */
export function polygonToPdfCoords(points, stageWidth, stageHeight, pdfWidth, pdfHeight, rotation, offsetX = 0, offsetY = 0) {
  // pdfjs renders at VISUAL dimensions (post-rotation). pdf-lib's page.getSize()
  // returns INTERNAL (pre-rotation) dimensions. For 90°/270° pages the axes are
  // swapped, so we must derive the correct visual-dimension scale factors.
  const isSwapped = rotation === 90 || rotation === 270;
  const visWidthPts  = isSwapped ? pdfHeight : pdfWidth;
  const visHeightPts = isSwapped ? pdfWidth  : pdfHeight;

  const scaleX = visWidthPts  / stageWidth;
  const scaleY = visHeightPts / stageHeight;

  // drawSvgPath is called with y=pdfHeight and applies scale(1,-1) internally:
  //   final PDF_Y = pdfHeight - path_y
  // So we need: path_y = pdfHeight - pdfY
  // where pdfY comes from mapVisualToPdf (visual Y-down → PDF internal Y-up).
  const converted = [];
  for (let i = 0; i < points.length; i += 2) {
    const vX = (offsetX + points[i])     * scaleX;
    const vY = (offsetY + points[i + 1]) * scaleY;
    const { x: pdfX, y: pdfY } = mapVisualToPdf(vX, vY, pdfWidth, pdfHeight, rotation);
    converted.push(pdfX);
    converted.push(pdfHeight - pdfY);
  }
  return converted;
}

/**
 * Converts points to SVG path string for pdf-lib's drawSvgPath.
 * @param {number[]} points - Flat array [x1, y1, x2, y2, ...]
 * @returns {string} SVG path string
 */
export function pointsToSvgPath(points) {
  if (points.length < 4) return "";
  let path = `M ${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length; i += 2) {
    path += ` L ${points[i]} ${points[i + 1]}`;
  }
  return path + " Z";
}
