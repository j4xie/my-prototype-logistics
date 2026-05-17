/**
 * P1 #58 (U-NEW-1) — 4-mode create dialog suite.
 *
 * Verifies that the 4 mode-specific dialogs are exported and that the
 * `CreateMode` union covers all 4 (普通/一维/二维/BOM).
 *
 * Deeper render-tests are deferred to E2E (Playwright) since these dialogs
 * pull heavy Element Plus chrome that's expensive to stub in unit.
 */
import { describe, it, expect } from 'vitest';
import {
  CreateModeSelector,
  BatchCreateDialog,
  QuickCreateDialog,
  BomExpansionDialog,
} from '../dialog';
import {
  DEFAULT_CREATE_MODES,
  CREATE_MODE_LABELS,
  CREATE_MODE_DESCRIPTIONS,
  type CreateMode,
} from '@/types/createMode';

describe('CreateDialog 4-mode set (P1 #58)', () => {
  it('exports all 4 mode dialog components', () => {
    expect(CreateModeSelector).toBeDefined();
    expect(BatchCreateDialog).toBeDefined();
    expect(QuickCreateDialog).toBeDefined();
    expect(BomExpansionDialog).toBeDefined();
  });

  it('defines exactly 4 create modes covering 普通/一维/二维/BOM', () => {
    expect(DEFAULT_CREATE_MODES).toHaveLength(4);
    const expected: CreateMode[] = ['normal', 'quick', 'batch', 'bom'];
    expected.forEach((mode) => {
      expect(DEFAULT_CREATE_MODES).toContain(mode);
    });
  });

  it('provides Chinese labels matching the backlog naming (普通/一维/二维/BOM)', () => {
    expect(CREATE_MODE_LABELS.normal).toMatch(/普通/);
    expect(CREATE_MODE_LABELS.quick).toMatch(/一维/);
    expect(CREATE_MODE_LABELS.batch).toMatch(/二维/);
    expect(CREATE_MODE_LABELS.bom).toMatch(/BOM/);
  });

  it('provides descriptions for each mode', () => {
    expect(CREATE_MODE_DESCRIPTIONS.normal).toBeTruthy();
    expect(CREATE_MODE_DESCRIPTIONS.quick).toBeTruthy();
    expect(CREATE_MODE_DESCRIPTIONS.batch).toBeTruthy();
    expect(CREATE_MODE_DESCRIPTIONS.bom).toBeTruthy();
  });
});
