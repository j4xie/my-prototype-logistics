/**
 * Coordinate-conversion helpers — pt ↔ px + snap-to-grid + clamp. These
 * sit on the hot path of every drag-move + drop event in FormCanvas, so
 * regression here would mean elements snap to wrong positions during use.
 */
import { describe, it, expect } from 'vitest';
import {
  ptToPx, pxToPt, snapToGrid, clampToCanvas, generateElementId, DEFAULT_ZOOM,
} from '../utils/a4Coords';

describe('a4Coords', () => {
  describe('ptToPx / pxToPt', () => {
    it('round-trip at default zoom', () => {
      const pt = 100;
      expect(pxToPt(ptToPx(pt))).toBeCloseTo(pt, 5);
    });

    it('default zoom is 1.25 (A4 portrait 595pt → 743.75px)', () => {
      expect(DEFAULT_ZOOM).toBe(1.25);
      expect(ptToPx(595)).toBeCloseTo(743.75, 2);
    });

    it('accepts an explicit zoom override', () => {
      expect(ptToPx(100, 2)).toBe(200);
      expect(pxToPt(200, 2)).toBe(100);
    });
  });

  describe('snapToGrid', () => {
    it('snaps to nearest multiple of 5 by default', () => {
      expect(snapToGrid(0)).toBe(0);
      expect(snapToGrid(2)).toBe(0);
      expect(snapToGrid(3)).toBe(5);
      expect(snapToGrid(7)).toBe(5);
      expect(snapToGrid(8)).toBe(10);
    });

    it('accepts a custom grid size', () => {
      expect(snapToGrid(7, 10)).toBe(10);
      expect(snapToGrid(14, 10)).toBe(10);
      expect(snapToGrid(15, 10)).toBe(20);
    });
  });

  describe('clampToCanvas', () => {
    it('clamps negative coordinates to 0', () => {
      expect(clampToCanvas(-10, -20, 50, 20, 595, 842)).toEqual({ x: 0, y: 0 });
    });

    it('clamps to canvas - element size on the right/bottom edges', () => {
      expect(clampToCanvas(999, 999, 50, 20, 595, 842)).toEqual({ x: 545, y: 822 });
    });

    it('passes through coordinates inside the canvas unchanged', () => {
      expect(clampToCanvas(100, 200, 50, 20, 595, 842)).toEqual({ x: 100, y: 200 });
    });
  });

  describe('generateElementId', () => {
    it('produces unique ids across calls', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 50; i++) ids.add(generateElementId());
      expect(ids.size).toBe(50);
    });

    it("starts with 'el_' prefix to make tests + logs greppable", () => {
      expect(generateElementId()).toMatch(/^el_/);
    });
  });
});
