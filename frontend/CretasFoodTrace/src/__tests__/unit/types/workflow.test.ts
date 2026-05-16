// @ts-nocheck
/**
 * workflow types unit tests — FU Chat 3 bucket-filter helpers (2026-05-16).
 * 覆盖 getBucketPrimaryStatus 5 module × 3 bucket = 15 路径 + 异常 path.
 */

import {
  BUCKET_PRIMARY_STATUS,
  getBucketPrimaryStatus,
} from '../../../types/workflow';

describe('BUCKET_PRIMARY_STATUS map', () => {
  it('defines all 5 modules', () => {
    expect(Object.keys(BUCKET_PRIMARY_STATUS).sort()).toEqual(
      ['finance', 'inventory', 'production', 'purchase', 'sales'],
    );
  });

  it('each module defines pending/in_progress/done buckets', () => {
    for (const module of ['sales', 'purchase', 'production', 'finance', 'inventory']) {
      const m = BUCKET_PRIMARY_STATUS[module];
      expect(m).toBeDefined();
      expect(m.pending).toBeTruthy();
      expect(m.in_progress).toBeTruthy();
      expect(m.done).toBeTruthy();
    }
  });
});

describe('getBucketPrimaryStatus()', () => {
  it('sales pending → PENDING_FINANCE_REVIEW', () => {
    expect(getBucketPrimaryStatus('sales', 'pending')).toBe('PENDING_FINANCE_REVIEW');
  });

  it('sales in_progress → PROCESSING', () => {
    expect(getBucketPrimaryStatus('sales', 'in_progress')).toBe('PROCESSING');
  });

  it('sales done → COMPLETED', () => {
    expect(getBucketPrimaryStatus('sales', 'done')).toBe('COMPLETED');
  });

  it('purchase pending → PENDING_FINANCE_REVIEW', () => {
    expect(getBucketPrimaryStatus('purchase', 'pending')).toBe('PENDING_FINANCE_REVIEW');
  });

  it('production in_progress → IN_PROGRESS', () => {
    expect(getBucketPrimaryStatus('production', 'in_progress')).toBe('IN_PROGRESS');
  });

  it('finance pending → REQUESTED', () => {
    expect(getBucketPrimaryStatus('finance', 'pending')).toBe('REQUESTED');
  });

  it('inventory pending → EXPIRED (异常 bucket)', () => {
    expect(getBucketPrimaryStatus('inventory', 'pending')).toBe('EXPIRED');
  });

  it('inventory done → AVAILABLE', () => {
    expect(getBucketPrimaryStatus('inventory', 'done')).toBe('AVAILABLE');
  });

  it('unknown module returns empty string', () => {
    expect(getBucketPrimaryStatus('unknown' as any, 'pending')).toBe('');
  });

  it('unknown bucket returns empty string', () => {
    expect(getBucketPrimaryStatus('sales', 'unknown')).toBe('');
  });
});
