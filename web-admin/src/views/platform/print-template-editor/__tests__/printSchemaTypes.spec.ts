/**
 * Schema type helpers — wrap/unwrap (Formily envelope ↔ raw schema),
 * isValidEntityType, emptySchema. These functions are the storage-format
 * boundary between FormTemplate.schemaJson (a string) and the editor's
 * in-memory PrintTemplateSchema.
 */
import { describe, it, expect } from 'vitest';
import {
  wrapForStorage,
  unwrapFromStorage,
  emptySchema,
  isValidEntityType,
  ENTITY_TYPES,
  DEFAULT_A4_PORTRAIT,
  type PrintTemplateSchema,
} from '../utils/printSchemaTypes';

describe('printSchemaTypes', () => {
  describe('wrapForStorage / unwrapFromStorage', () => {
    it('round-trips a non-trivial schema byte-for-byte', () => {
      const original: PrintTemplateSchema = {
        version: 1,
        canvas: { width: 595, height: 842, orientation: 'portrait' },
        elements: [
          { id: 't', type: 'text', x: 50, y: 50, text: 'Hello', fontSize: 12 },
          { id: 'f', type: 'field', x: 50, y: 80, binding: '{{a.b}}', fontSize: 12 },
        ],
      };
      const wrapped = wrapForStorage(original);
      // Outer envelope must look like Formily (satisfies backend validate)
      expect(wrapped.type).toBe('object');
      expect(wrapped.properties._printSchema).toBeDefined();

      const restored = unwrapFromStorage(JSON.stringify(wrapped));
      expect(restored).toEqual(original);
    });

    it('returns null for empty / null input', () => {
      expect(unwrapFromStorage(null)).toBeNull();
      expect(unwrapFromStorage(undefined)).toBeNull();
      expect(unwrapFromStorage('')).toBeNull();
    });

    it('returns null for malformed JSON', () => {
      expect(unwrapFromStorage('{not-json')).toBeNull();
    });

    it('returns null when properties._printSchema is missing', () => {
      const bad = JSON.stringify({ type: 'object', properties: { other: 1 } });
      expect(unwrapFromStorage(bad)).toBeNull();
    });

    it('survives a schema that includes all 7 element types', () => {
      const all: PrintTemplateSchema = {
        version: 1,
        canvas: { width: 595, height: 842, orientation: 'portrait' },
        elements: [
          { id: '1', type: 'text', x: 0, y: 0, text: 'x', fontSize: 12 },
          { id: '2', type: 'field', x: 0, y: 30, binding: '{{a}}', fontSize: 12 },
          { id: '3', type: 'table', x: 0, y: 60, width: 200, binding: '{{items}}',
            rowHeight: 24, columns: [{ header: 'h', binding: '{{item.a}}', width: 100 }] },
          { id: '4', type: 'qr', x: 0, y: 100, size: 80, content: 'x' },
          { id: '5', type: 'barcode', x: 0, y: 200, width: 100, height: 40, content: 'x' },
          { id: '6', type: 'image', x: 0, y: 250, width: 100, height: 50, src: '' },
          { id: '7', type: 'stamp', x: 0, y: 320, size: 80, stampId: 'default' },
        ],
      };
      const restored = unwrapFromStorage(JSON.stringify(wrapForStorage(all)));
      expect(restored).toEqual(all);
      expect(restored?.elements).toHaveLength(7);
    });
  });

  describe('ENTITY_TYPES and isValidEntityType', () => {
    it('lists exactly the 6 PRINT_* codes the backend whitelisted in Day 4', () => {
      // Mirrors FormTemplateServiceImpl.SUPPORTED_ENTITY_TYPES additions.
      expect(ENTITY_TYPES.map(e => e.code).sort()).toEqual([
        'PRINT_MATERIAL_REQUISITION',
        'PRINT_PRODUCTION_TASK',
        'PRINT_PURCHASE_ORDER',
        'PRINT_QUOTATION',
        'PRINT_SALES_ORDER',
        'PRINT_WEIGHING_SLIP',
      ]);
    });

    it('includes the F006 weighing slip ⭐', () => {
      expect(ENTITY_TYPES.some(e => e.code === 'PRINT_WEIGHING_SLIP')).toBe(true);
    });

    it('isValidEntityType accepts known codes', () => {
      expect(isValidEntityType('PRINT_SALES_ORDER')).toBe(true);
      expect(isValidEntityType('PRINT_WEIGHING_SLIP')).toBe(true);
    });

    it('isValidEntityType rejects unknown codes including legacy non-PRINT_ ones', () => {
      expect(isValidEntityType('SALES_ORDER')).toBe(false);
      expect(isValidEntityType('PURCHASE_ORDER')).toBe(false); // legacy form schema, not print
      expect(isValidEntityType('QUALITY_CHECK')).toBe(false);
      expect(isValidEntityType('')).toBe(false);
    });
  });

  describe('emptySchema', () => {
    it('returns a fresh A4 portrait schema with no elements', () => {
      const s = emptySchema();
      expect(s.version).toBe(1);
      expect(s.canvas).toEqual(DEFAULT_A4_PORTRAIT);
      expect(s.elements).toEqual([]);
    });

    it('returns independent canvas objects (mutating one does not affect another)', () => {
      const a = emptySchema();
      const b = emptySchema();
      a.canvas.width = 999;
      expect(b.canvas.width).toBe(595);
    });
  });
});
