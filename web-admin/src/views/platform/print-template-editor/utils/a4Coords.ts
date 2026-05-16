/**
 * PDF-point ↔ on-screen-pixel conversion.
 *
 * PDF uses 1 inch = 72 pt. Editor canvas displays at a configurable zoom.
 * Default 1.25× makes A4 portrait (595pt) render at 744px wide — comfortable
 * inside a 1280-wide laptop screen alongside left palette + right property panel.
 */

export const DEFAULT_ZOOM = 1.25;

export function ptToPx(pt: number, zoom: number = DEFAULT_ZOOM): number {
  return pt * zoom;
}

export function pxToPt(px: number, zoom: number = DEFAULT_ZOOM): number {
  return px / zoom;
}

export function snapToGrid(pt: number, gridSize: number = 5): number {
  return Math.round(pt / gridSize) * gridSize;
}

export function clampToCanvas(
  x: number, y: number,
  elementWidth: number, elementHeight: number,
  canvasWidth: number, canvasHeight: number,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(x, canvasWidth - elementWidth)),
    y: Math.max(0, Math.min(y, canvasHeight - elementHeight)),
  };
}

export function generateElementId(): string {
  return `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
