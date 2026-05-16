/**
 * Sprint 2 Track I Day 7 — formatSummaryForAI tests.
 * Verifies AI deep-link string format for stat embedding into AIChat initialMessage.
 */
import { formatSummaryForAI } from '../../../utils/aiSummaryContext';
import type { ListSummaryResponse } from '../../../types/listSummary';

describe('formatSummaryForAI', () => {
  it('returns empty string when no summary + no filter', () => {
    expect(formatSummaryForAI(null)).toBe('');
    expect(formatSummaryForAI(undefined)).toBe('');
    expect(formatSummaryForAI({ entityType: 'salesOrder', stats: [] })).toBe('');
  });

  it('formats single filter when summary missing', () => {
    expect(formatSummaryForAI(null, { filter: { status: 'APPROVED' } })).toBe(
      ' (筛选: status=APPROVED)',
    );
  });

  it('skips filter values equal to "all" / empty / null', () => {
    expect(formatSummaryForAI(null, { filter: { status: 'all', customer: '', region: undefined } })).toBe('');
  });

  it('formats currency / number / percent stats', () => {
    const summary: ListSummaryResponse = {
      entityType: 'salesOrder',
      stats: [
        { label: '共', value: 25, format: 'number', unit: '条' },
        { label: '总金额', value: 58750, format: 'currency' },
        { label: '损耗率', value: 5.2, format: 'percent' },
      ],
    };
    const result = formatSummaryForAI(summary);
    expect(result).toBe(' (当前统计: 共 25条 | 总金额 ¥58,750.00 | 损耗率 5.2%)');
  });

  it('combines filter + stats + note', () => {
    const summary: ListSummaryResponse = {
      entityType: 'salesOrder',
      stats: [{ label: '共', value: 10, format: 'number', unit: '条' }],
    };
    const result = formatSummaryForAI(summary, {
      filter: { status: 'APPROVED' },
      note: 'F006 卤制品工厂',
    });
    expect(result).toBe(' (筛选: status=APPROVED; 当前统计: 共 10条; F006 卤制品工厂)');
  });

  it('handles missing / empty value gracefully', () => {
    const summary: ListSummaryResponse = {
      entityType: 'wastage',
      stats: [
        { label: '损耗', value: '', format: 'currency' },
        { label: '共', value: 0, format: 'number', unit: '条' },
      ],
    };
    const result = formatSummaryForAI(summary);
    expect(result).toBe(' (当前统计: 损耗 — | 共 0条)');
  });
});
