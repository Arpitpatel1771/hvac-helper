/**
 * Point-in-shape hit testing — pure functions, no Konva or DOM dependency.
 * Returns the id of the topmost shape at (x, y), or null.
 * Shapes are tested in reverse order so the last-added (highest z) wins on overlap.
 */

export function findTopmostShapeAt(x, y, shapes) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (s.type === 'rect') {
      if (x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height) {
        return s.id;
      }
    } else if (s.type === 'polygon') {
      if (pointInPolygon(x, y, s.points, s.x, s.y)) {
        return s.id;
      }
    }
  }
  return null;
}

// Ray-casting algorithm for point-in-polygon.
// points are relative to (ox, oy).
function pointInPolygon(px, py, points, ox, oy) {
  let inside = false;
  const n = points.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i * 2] + ox;
    const yi = points[i * 2 + 1] + oy;
    const xj = points[j * 2] + ox;
    const yj = points[j * 2 + 1] + oy;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
