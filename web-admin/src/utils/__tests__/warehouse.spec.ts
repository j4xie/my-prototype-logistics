/**
 * D1 UI label policy unit tests.
 *
 * Verifies the warehouse code → customer-facing display label mapping
 * defined in `utils/warehouse.ts`. Customer transcript (PR #346 audit)
 * uses 线边仓 / 总仓; internal DB / Java code stays WH-WKS / WH-LOG.
 */
import { describe, it, expect } from 'vitest';
import { warehouseDisplayLabel, warehouseDisplayName } from '../warehouse';

describe('warehouseDisplayLabel', () => {
  it('maps WH-WKS to 线边仓 (factory-side daily clear)', () => {
    expect(warehouseDisplayLabel('WH-WKS')).toBe('线边仓');
  });

  it('maps WH-LOG to 总仓 (persistent inventory)', () => {
    expect(warehouseDisplayLabel('WH-LOG')).toBe('总仓');
  });

  it('surfaces unknown codes verbatim (forward-compat fallback)', () => {
    expect(warehouseDisplayLabel('WH-FROZEN')).toBe('WH-FROZEN');
  });

  it('returns "-" for null / undefined / empty', () => {
    expect(warehouseDisplayLabel(null)).toBe('-');
    expect(warehouseDisplayLabel(undefined)).toBe('-');
    expect(warehouseDisplayLabel('')).toBe('-');
  });
});

describe('warehouseDisplayName', () => {
  it('prefers customer-aligned label over server name for known codes', () => {
    // server-side name could be customer-configured and might drift
    // (e.g. seed data says "鲜棉仓"); we always show 线边仓 for WH-WKS.
    expect(warehouseDisplayName('鲜棉仓', 'WH-WKS')).toBe('线边仓');
    expect(warehouseDisplayName('物流仓', 'WH-LOG')).toBe('总仓');
  });

  it('uses server name when code is unknown', () => {
    expect(warehouseDisplayName('冷冻仓 A', 'WH-FROZEN-A')).toBe('冷冻仓 A');
  });

  it('uses raw code when name is missing but code is known but non-mapped', () => {
    expect(warehouseDisplayName(null, 'WH-FROZEN-A')).toBe('WH-FROZEN-A');
  });

  it('returns "-" when both name and code are missing', () => {
    expect(warehouseDisplayName(null, null)).toBe('-');
    expect(warehouseDisplayName(undefined, undefined)).toBe('-');
    expect(warehouseDisplayName('', '')).toBe('-');
  });

  it('handles WH-WKS even when name is empty', () => {
    expect(warehouseDisplayName('', 'WH-WKS')).toBe('线边仓');
    expect(warehouseDisplayName(null, 'WH-LOG')).toBe('总仓');
  });
});
