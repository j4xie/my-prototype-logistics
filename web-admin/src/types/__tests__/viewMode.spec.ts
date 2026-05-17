/**
 * U-VIEW-1 — pure helper tests for viewMode persistence layer.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  type ViewMode,
  DEFAULT_VIEW_MODES,
  VIEW_MODE_LABELS,
  loadViewMode,
  saveViewMode,
} from '../viewMode';

describe('viewMode types', () => {
  it('exposes 5 modes in canonical order', () => {
    expect(DEFAULT_VIEW_MODES).toEqual(['table', 'grid', 'kanban', 'timeline', 'calendar']);
  });

  it('has a Chinese label for every mode', () => {
    for (const mode of DEFAULT_VIEW_MODES) {
      expect(VIEW_MODE_LABELS[mode]).toBeTruthy();
    }
  });
});

describe('loadViewMode / saveViewMode', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns fallback when nothing stored', () => {
    expect(loadViewMode('sales-orders-list')).toBe('table');
    expect(loadViewMode('sales-orders-list', 'kanban')).toBe('kanban');
  });

  it('round-trips a saved value', () => {
    saveViewMode('sales-orders-list', 'kanban');
    expect(loadViewMode('sales-orders-list')).toBe('kanban');
  });

  it('isolates by route name', () => {
    saveViewMode('sales-orders-list', 'kanban');
    saveViewMode('purchase-orders-list', 'grid');
    expect(loadViewMode('sales-orders-list')).toBe('kanban');
    expect(loadViewMode('purchase-orders-list')).toBe('grid');
  });

  it('rejects invalid stored values and falls back', () => {
    window.localStorage.setItem('view-mode:sales-orders-list', 'invalid-mode');
    expect(loadViewMode('sales-orders-list', 'grid')).toBe('grid');
  });

  it.each(DEFAULT_VIEW_MODES)('round-trips mode %s', (mode: ViewMode) => {
    saveViewMode('test-route', mode);
    expect(loadViewMode('test-route')).toBe(mode);
  });
});
