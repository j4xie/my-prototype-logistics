/**
 * Regression: defensive ApiResponse envelope unwrap for printTemplate API.
 *
 * Issue #719 root cause: the response interceptor in `src/api/request.ts`
 * returns the full `{success, data, message}` envelope. Legacy
 * `getPrintTemplate` cast that envelope as the inner `PrintTemplateResponse`,
 * making `data.schemaJson` undefined → `unwrapFromStorage(undefined)` → null
 * → canvas rendered 0 of 65 backend-seeded elements.
 */
import { describe, it, expect } from 'vitest';
import { unwrapApiEnvelope } from '../printTemplateApi';

describe('unwrapApiEnvelope', () => {
  it('returns null for null/undefined input', () => {
    expect(unwrapApiEnvelope<unknown>(null)).toBeNull();
    expect(unwrapApiEnvelope<unknown>(undefined)).toBeNull();
  });

  it('extracts .data when given an ApiResponse envelope', () => {
    const envelope = {
      success: true,
      data: { id: 'abc', schemaJson: '{"x":1}', version: 3 },
      message: 'OK',
    };
    expect(unwrapApiEnvelope<typeof envelope.data>(envelope)).toEqual({
      id: 'abc',
      schemaJson: '{"x":1}',
      version: 3,
    });
  });

  it('returns null when envelope.data is null (no custom template)', () => {
    const envelope = { success: true, data: null, message: '无自定义模板' };
    expect(unwrapApiEnvelope(envelope)).toBeNull();
  });

  it('passes through when given already-unwrapped inner data (no envelope discriminant)', () => {
    // Defensive: if a future interceptor change makes request.get return the
    // inner payload directly, this helper still does the right thing.
    const inner = { id: 'abc', schemaJson: '{"x":1}', version: 3 };
    expect(unwrapApiEnvelope<typeof inner>(inner)).toBe(inner);
  });

  it('does NOT mistake an object with only a "success" field for an envelope', () => {
    // Edge: backend DTO that happens to have a `success` field (e.g. job
    // status) but no `data` field — leave it alone.
    const dto = { success: true, otherField: 1 };
    expect(unwrapApiEnvelope<typeof dto>(dto)).toBe(dto);
  });
});
