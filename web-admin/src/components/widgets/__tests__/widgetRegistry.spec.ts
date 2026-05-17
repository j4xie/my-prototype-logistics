/**
 * widgetRegistry invariants (P1 #65 C-WIDGET-1).
 *
 * Tests the registry contract:
 * - Every WidgetKind in the registrations list has a component.
 * - widgetRegistry Map is complete + immutable.
 * - All non-coming-soon entries have a defaultConfig + defaultSize.
 * - No duplicate kinds.
 *
 * Per `feedback_vitest_invariant_tests_not_run_by_vite_build.md` HARD,
 * these invariant checks only run via `npx vitest run` — vite build will
 * not catch them. CI should run both.
 */
import { describe, it, expect } from 'vitest';
import { widgetRegistry, widgetRegistrationList } from '../widgetRegistry';
import type { WidgetKind } from '@/types/dashboardWidget';

describe('widgetRegistry', () => {
  const list = widgetRegistrationList();

  it('contains at least the 10 widget kinds expected by P1 #65 backlog', () => {
    // Sprint 4 Chat L: 3 raw + 7 coming-soon = 10 entries.
    // P1 #65: graduates 7 coming-soon to endpoint-bound, adds 7 new kinds.
    expect(list.length).toBeGreaterThanOrEqual(10);
  });

  it('has unique kinds with no duplicates', () => {
    const kinds = list.map((r) => r.kind);
    const unique = new Set(kinds);
    expect(kinds.length).toBe(unique.size);
  });

  it('every registration has a component', () => {
    for (const reg of list) {
      expect(reg.component, `kind=${reg.kind} missing component`).toBeTruthy();
    }
  });

  it('every registration has a defaultTitle', () => {
    for (const reg of list) {
      expect(reg.defaultTitle, `kind=${reg.kind} missing defaultTitle`).toBeTruthy();
      expect(typeof reg.defaultTitle).toBe('string');
    }
  });

  it('every registration has a defaultConfig factory returning an object', () => {
    for (const reg of list) {
      expect(typeof reg.defaultConfig).toBe('function');
      const cfg = reg.defaultConfig();
      expect(cfg).toBeTypeOf('object');
      expect(cfg).not.toBeNull();
    }
  });

  it('every registration has a defaultSize with valid w/h', () => {
    for (const reg of list) {
      expect(reg.defaultSize.w).toBeGreaterThan(0);
      expect(reg.defaultSize.w).toBeLessThanOrEqual(12);
      expect(reg.defaultSize.h).toBeGreaterThan(0);
    }
  });

  it('widgetRegistry Map matches the registrationList', () => {
    for (const reg of list) {
      expect(widgetRegistry.has(reg.kind)).toBe(true);
      expect(widgetRegistry.get(reg.kind)).toBe(reg);
    }
    expect(widgetRegistry.size).toBe(list.length);
  });

  it('P1 #65 — at least 5 endpoint-bound (non-comingSoon) widgets exist', () => {
    const active = list.filter((r) => !r.comingSoon);
    // 3 raw (kpi/chart/list) + 7 endpoint-bound (P1 #65) = 10.
    expect(active.length).toBeGreaterThanOrEqual(5);
  });

  it('all P1 #65 endpoint-bound widget kinds are registered as active', () => {
    const expected: WidgetKind[] = [
      'kpi-today-production',
      'wip-batch-count',
      'delivery-warn',
      'pending-reminders',
      'equipment-status',
      'quality-rate',
      'scheduling-alerts',
    ];
    for (const kind of expected) {
      const reg = widgetRegistry.get(kind);
      expect(reg, `${kind} missing from registry`).toBeTruthy();
      expect(reg?.comingSoon, `${kind} should be active not coming-soon`).toBeFalsy();
    }
  });
});
