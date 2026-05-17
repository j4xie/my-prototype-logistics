import { describe, it, expect } from 'vitest';
import {
  MARKER_COLORS,
  MARKER_COLOR_HEX,
  MARKER_COLOR_LABELS,
  isMarkerColor,
} from '../rowMarker';

describe('row marker types', () => {
  it('exposes 5 colors in canonical order', () => {
    expect(MARKER_COLORS).toEqual(['red', 'orange', 'yellow', 'green', 'blue']);
  });

  it('has hex + label for every color', () => {
    for (const c of MARKER_COLORS) {
      expect(MARKER_COLOR_HEX[c]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(MARKER_COLOR_LABELS[c]).toBeTruthy();
    }
  });

  it('isMarkerColor narrows correctly', () => {
    expect(isMarkerColor('red')).toBe(true);
    expect(isMarkerColor('blue')).toBe(true);
    expect(isMarkerColor('purple')).toBe(false);
    expect(isMarkerColor(null)).toBe(false);
    expect(isMarkerColor('')).toBe(false);
    expect(isMarkerColor(123)).toBe(false);
  });
});
