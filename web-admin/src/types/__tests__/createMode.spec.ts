import { describe, it, expect } from 'vitest';
import {
  type CreateMode,
  DEFAULT_CREATE_MODES,
  CREATE_MODE_LABELS,
  CREATE_MODE_DESCRIPTIONS,
} from '../createMode';

describe('createMode types', () => {
  it('exposes 4 modes in canonical order', () => {
    expect(DEFAULT_CREATE_MODES).toEqual(['normal', 'quick', 'batch', 'bom']);
  });

  it('has Chinese label + description for every mode', () => {
    for (const mode of DEFAULT_CREATE_MODES) {
      expect(CREATE_MODE_LABELS[mode]).toBeTruthy();
      expect(CREATE_MODE_DESCRIPTIONS[mode]).toBeTruthy();
    }
  });

  it.each<CreateMode>(['normal', 'quick', 'batch', 'bom'])(
    'mode %s has distinct label',
    (mode) => {
      const others = DEFAULT_CREATE_MODES.filter((m) => m !== mode);
      const otherLabels = others.map((m) => CREATE_MODE_LABELS[m]);
      expect(otherLabels).not.toContain(CREATE_MODE_LABELS[mode]);
    }
  );
});
