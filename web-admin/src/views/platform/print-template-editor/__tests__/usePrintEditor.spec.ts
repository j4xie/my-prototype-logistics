/**
 * Editor state composable — covers schema mutation operations + dirty
 * tracking + selection. These ops are what every UI gesture in the editor
 * funnels through, so each one is unit-tested independently of the Vue
 * component shell.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { usePrintEditor, createDefaultElement } from '../composables/usePrintEditor';
import type { TextElement, FieldElement, TableElement } from '../utils/printSchemaTypes';

describe('usePrintEditor', () => {
  let editor: ReturnType<typeof usePrintEditor>;

  beforeEach(() => {
    editor = usePrintEditor();
  });

  describe('initial state', () => {
    it('starts with an empty A4 portrait schema, no selection, not dirty', () => {
      expect(editor.schema.value.elements).toEqual([]);
      expect(editor.schema.value.canvas.width).toBe(595);
      expect(editor.schema.value.canvas.height).toBe(842);
      expect(editor.selectedElementId.value).toBeNull();
      expect(editor.dirty.value).toBe(false);
      expect(editor.entityType.value).toBe('');
      expect(editor.templateId.value).toBeNull();
    });
  });

  describe('addElement', () => {
    it('assigns a stable id, appends to elements, selects, marks dirty', () => {
      const el = editor.addElement({
        type: 'text', x: 50, y: 50, text: 'Hello', fontSize: 12,
      });
      expect(el.id).toMatch(/^el_/);
      expect(editor.schema.value.elements).toHaveLength(1);
      expect(editor.schema.value.elements[0].id).toBe(el.id);
      expect(editor.selectedElementId.value).toBe(el.id);
      expect(editor.dirty.value).toBe(true);
    });

    it('generates unique ids across multiple adds', () => {
      const a = editor.addElement({ type: 'text', x: 0, y: 0, text: 'a', fontSize: 12 });
      const b = editor.addElement({ type: 'text', x: 0, y: 30, text: 'b', fontSize: 12 });
      expect(a.id).not.toBe(b.id);
      expect(editor.schema.value.elements).toHaveLength(2);
    });
  });

  describe('updateElement', () => {
    it('patches only the named fields', () => {
      const el = editor.addElement({
        type: 'text', x: 50, y: 50, text: 'Hello', fontSize: 12,
      });
      editor.markClean();
      editor.updateElement(el.id, { text: 'Updated', fontSize: 18 });
      const after = editor.schema.value.elements[0] as TextElement;
      expect(after.text).toBe('Updated');
      expect(after.fontSize).toBe(18);
      expect(after.x).toBe(50);  // preserved
      expect(after.y).toBe(50);  // preserved
      expect(editor.dirty.value).toBe(true);
    });

    it('is a no-op when id is unknown (does not mark dirty)', () => {
      editor.addElement({ type: 'text', x: 0, y: 0, text: 'x', fontSize: 12 });
      editor.markClean();
      editor.updateElement('nonexistent-id', { text: 'noop' } as Partial<TextElement>);
      expect(editor.dirty.value).toBe(false);
    });
  });

  describe('moveElement', () => {
    it('clamps to canvas bounds (top-left)', () => {
      const el = editor.addElement({
        type: 'text', x: 100, y: 100, width: 50, height: 20, text: 'x', fontSize: 12,
      });
      editor.moveElement(el.id, -50, -50);
      expect(editor.schema.value.elements[0].x).toBe(0);
      expect(editor.schema.value.elements[0].y).toBe(0);
    });

    it('clamps to canvas bounds (bottom-right) — snap happens first, then clamp', () => {
      const el = editor.addElement({
        type: 'text', x: 100, y: 100, width: 50, height: 20, text: 'x', fontSize: 12,
      });
      editor.moveElement(el.id, 99999, 99999);
      // Order: snap to grid → clamp. 99999 → 100000 (snap) → 545 / 822 (clamp).
      // The bottom-edge value (822) is NOT divisible by the 5pt grid; clamp
      // takes precedence over the grid invariant since out-of-bounds is the
      // worse failure mode.
      expect(editor.schema.value.elements[0].x).toBe(545);
      expect(editor.schema.value.elements[0].y).toBe(822);
    });

    it('snaps to a 5pt grid by default', () => {
      const el = editor.addElement({
        type: 'text', x: 0, y: 0, width: 50, height: 20, text: 'x', fontSize: 12,
      });
      editor.moveElement(el.id, 47, 33);
      expect(editor.schema.value.elements[0].x).toBe(45);
      expect(editor.schema.value.elements[0].y).toBe(35);
    });
  });

  describe('removeElement', () => {
    it('drops the element and clears selection if it was selected', () => {
      const el = editor.addElement({ type: 'text', x: 0, y: 0, text: 'x', fontSize: 12 });
      editor.removeElement(el.id);
      expect(editor.schema.value.elements).toEqual([]);
      expect(editor.selectedElementId.value).toBeNull();
    });

    it('preserves selection when a different element is removed', () => {
      const a = editor.addElement({ type: 'text', x: 0, y: 0, text: 'a', fontSize: 12 });
      const b = editor.addElement({ type: 'text', x: 0, y: 30, text: 'b', fontSize: 12 });
      editor.selectElement(a.id);
      editor.removeElement(b.id);
      expect(editor.selectedElementId.value).toBe(a.id);
      expect(editor.schema.value.elements).toHaveLength(1);
    });
  });

  describe('duplicateElement', () => {
    it('creates a copy offset by (10, 10) with a new id, selecting the copy', () => {
      const a = editor.addElement({
        type: 'field', x: 50, y: 50, binding: '{{a}}', fontSize: 12,
      });
      editor.duplicateElement(a.id);
      expect(editor.schema.value.elements).toHaveLength(2);
      const copy = editor.schema.value.elements[1] as FieldElement;
      expect(copy.id).not.toBe(a.id);
      expect(copy.binding).toBe('{{a}}');
      expect(copy.x).toBe(60);
      expect(copy.y).toBe(60);
      expect(editor.selectedElementId.value).toBe(copy.id);
    });
  });

  describe('resetForEntity / loadSchema', () => {
    it('resetForEntity clears state and sets entityType', () => {
      editor.addElement({ type: 'text', x: 0, y: 0, text: 'x', fontSize: 12 });
      editor.resetForEntity('PRINT_SALES_ORDER');
      expect(editor.schema.value.elements).toEqual([]);
      expect(editor.entityType.value).toBe('PRINT_SALES_ORDER');
      expect(editor.templateId.value).toBeNull();
      expect(editor.templateName.value).toBe('PRINT_SALES_ORDER 模板');
      expect(editor.dirty.value).toBe(false);
    });

    it('loadSchema deep-copies the input (caller can mutate without affecting state)', () => {
      const incoming = {
        version: 1 as const,
        canvas: { width: 595, height: 842, orientation: 'portrait' as const },
        elements: [
          { id: 'preset', type: 'text' as const, x: 50, y: 50, text: 'preset', fontSize: 12 },
        ],
      };
      editor.loadSchema(incoming, 'tpl-123', '默认销售单');
      expect(editor.templateId.value).toBe('tpl-123');
      expect(editor.templateName.value).toBe('默认销售单');
      expect(editor.dirty.value).toBe(false);

      // Mutate the incoming reference; editor state should not change.
      incoming.elements[0].text = 'MUTATED';
      const loaded = editor.schema.value.elements[0] as TextElement;
      expect(loaded.text).toBe('preset');
    });
  });

  describe('selectElement', () => {
    it('updates selectedElementId, including null for deselection', () => {
      const el = editor.addElement({ type: 'text', x: 0, y: 0, text: 'x', fontSize: 12 });
      editor.selectElement(null);
      expect(editor.selectedElementId.value).toBeNull();
      expect(editor.selectedElement.value).toBeNull();
      editor.selectElement(el.id);
      expect(editor.selectedElement.value?.id).toBe(el.id);
    });
  });

  describe('createDefaultElement', () => {
    it('produces sensible defaults for each element type', () => {
      const text = createDefaultElement('text', 10, 20) as Omit<TextElement, 'id'>;
      expect(text.type).toBe('text');
      expect(text.x).toBe(10);
      expect(text.y).toBe(20);
      expect(text.fontSize).toBe(12);

      const field = createDefaultElement('field', 0, 0) as Omit<FieldElement, 'id'>;
      expect(field.binding).toMatch(/^\{\{.+\}\}$/);

      const table = createDefaultElement('table', 0, 0) as Omit<TableElement, 'id'>;
      expect(table.columns.length).toBeGreaterThanOrEqual(2);
      expect(table.binding).toMatch(/^\{\{.+\}\}$/);
      expect(table.rowHeight).toBeGreaterThan(0);

      const qr = createDefaultElement('qr', 0, 0);
      expect(qr.type).toBe('qr');

      const stamp = createDefaultElement('stamp', 0, 0);
      expect(stamp.type).toBe('stamp');
    });
  });
});
