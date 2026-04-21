const COLORS = [
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#22c55e', // green-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
];

/**
 * Returns a color based on an index.
 * @param {number} index - Index in the color list.
 * @returns {string} Hex color string.
 */
export function getColor(index) {
  return COLORS[index % COLORS.length];
}

/**
 * Converts a hex color to { r, g, b } (0-1 range).
 * @param {string} hex - Hex color string.
 * @returns {object} { r, g, b } in range 0-1.
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 0, g: 0, b: 0 };
}
