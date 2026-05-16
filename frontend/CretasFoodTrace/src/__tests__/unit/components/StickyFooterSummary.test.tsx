/**
 * Sprint 2 Track I — StickyFooterSummary RN component tests.
 * Covers three required cases:
 *   1. 3 stats (共/金额/损耗) render correctly
 *   2. 5 stats (共/金额/数量/损耗/平均价) render correctly
 *   3. 仓管 role hides price-related stats
 * + format helpers (currency/percent/number), AI/Export buttons, pagination, empty state.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// Mock SafeAreaView for tests (no SafeAreaProvider needed)
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    SafeAreaProvider: ({ children }: any) => <>{children}</>,
  };
});

// Mock useCanViewPrice — switched per-test
let mockCanViewPrice = true;
jest.mock('../../../store/canViewPriceStore', () => ({
  useCanViewPrice: () => mockCanViewPrice,
  canViewPriceForRole: jest.requireActual('../../../store/canViewPriceStore').canViewPriceForRole,
  PRICE_VIEW_ROLES: jest.requireActual('../../../store/canViewPriceStore').PRICE_VIEW_ROLES,
}));

import StickyFooterSummary, { formatValue } from '../../../components/list/StickyFooterSummary';
import type { SummaryStat } from '../../../types/listSummary';

describe('StickyFooterSummary', () => {
  beforeEach(() => {
    mockCanViewPrice = true;
  });

  it('renders 3 stats (共/金额/损耗) for role with price view', () => {
    const stats: SummaryStat[] = [
      { label: '共', value: 25, format: 'number', unit: '条' },
      { label: '总金额', value: 58750, format: 'currency', canViewPrice: true },
      { label: '损耗率', value: 5.2, format: 'percent' },
    ];
    const { getByText } = render(<StickyFooterSummary stats={stats} />);
    expect(getByText('共')).toBeTruthy();
    expect(getByText('总金额')).toBeTruthy();
    expect(getByText('损耗率')).toBeTruthy();
    expect(getByText('25条')).toBeTruthy();
    expect(getByText('¥58,750.00')).toBeTruthy();
    expect(getByText('5.2%')).toBeTruthy();
  });

  it('renders 5 stats (共/金额/数量/损耗/平均价) for role with price view', () => {
    const stats: SummaryStat[] = [
      { label: '共', value: 25, format: 'number', unit: '条' },
      { label: '总金额', value: 58750, format: 'currency', canViewPrice: true },
      { label: '数量', value: 1234, format: 'number' },
      { label: '损耗', value: 5.2, format: 'percent' },
      { label: '平均价', value: 2350, format: 'currency', canViewPrice: true },
    ];
    const { getAllByText, getByText } = render(<StickyFooterSummary stats={stats} />);
    expect(getByText('共')).toBeTruthy();
    expect(getByText('数量')).toBeTruthy();
    expect(getAllByText(/¥/).length).toBe(2);
  });

  it('hides price-related stats when canViewPrice is false (仓管 case)', () => {
    mockCanViewPrice = false;
    const stats: SummaryStat[] = [
      { label: '共', value: 25, format: 'number', unit: '条' },
      { label: '总金额', value: 58750, format: 'currency', canViewPrice: true },
      { label: '损耗率', value: 5.2, format: 'percent' },
      { label: '平均价', value: 2350, format: 'currency', canViewPrice: true },
    ];
    const { getByText, queryByText } = render(<StickyFooterSummary stats={stats} />);
    expect(getByText('共')).toBeTruthy();
    expect(getByText('损耗率')).toBeTruthy();
    expect(queryByText('总金额')).toBeNull();
    expect(queryByText('平均价')).toBeNull();
  });

  it('shows empty text when no visible stats', () => {
    mockCanViewPrice = false;
    const stats: SummaryStat[] = [
      { label: '总金额', value: 100, format: 'currency', canViewPrice: true },
    ];
    const { getByText } = render(<StickyFooterSummary stats={stats} emptyText="无数据" />);
    expect(getByText('无数据')).toBeTruthy();
  });

  it('invokes onAIAnalyze when 📊 pressed', () => {
    const onAIAnalyze = jest.fn();
    const { getByTestId } = render(
      <StickyFooterSummary stats={[{ label: '共', value: 1 }]} onAIAnalyze={onAIAnalyze} />,
    );
    fireEvent.press(getByTestId('sticky-footer-ai'));
    expect(onAIAnalyze).toHaveBeenCalledTimes(1);
  });

  it('invokes onExport when 📤 pressed', () => {
    const onExport = jest.fn();
    const { getByTestId } = render(
      <StickyFooterSummary stats={[{ label: '共', value: 1 }]} onExport={onExport} />,
    );
    fireEvent.press(getByTestId('sticky-footer-export'));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('renders pagination + invokes onPageChange', () => {
    const onPageChange = jest.fn();
    const { getByText, getByLabelText } = render(
      <StickyFooterSummary
        stats={[{ label: '共', value: 25 }]}
        pagination={{
          currentPage: 2,
          totalPages: 5,
          pageSize: 20,
          totalItems: 100,
          onPageChange,
        }}
      />,
    );
    expect(getByText('2/5')).toBeTruthy();
    fireEvent.press(getByLabelText('上一页'));
    expect(onPageChange).toHaveBeenCalledWith(1);
    fireEvent.press(getByLabelText('下一页'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('disables prev on page 1, next on last page', () => {
    const onPageChange = jest.fn();
    const { getByLabelText } = render(
      <StickyFooterSummary
        stats={[{ label: '共', value: 1 }]}
        pagination={{ currentPage: 1, totalPages: 1, pageSize: 20, totalItems: 1, onPageChange }}
      />,
    );
    fireEvent.press(getByLabelText('上一页'));
    fireEvent.press(getByLabelText('下一页'));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('shows loading indicator when loading=true', () => {
    const { getByTestId } = render(<StickyFooterSummary stats={[]} loading />);
    expect(getByTestId('sticky-footer-loading')).toBeTruthy();
  });
});

describe('formatValue helper', () => {
  it('formats currency with ¥ + 2 decimals + thousands separator', () => {
    expect(formatValue({ label: '', value: 6525, format: 'currency' })).toBe('¥6,525.00');
    expect(formatValue({ label: '', value: 0, format: 'currency' })).toBe('¥0.00');
  });

  it('formats percent with 1 decimal + %', () => {
    expect(formatValue({ label: '', value: 5.2, format: 'percent' })).toBe('5.2%');
    expect(formatValue({ label: '', value: 100, format: 'percent' })).toBe('100.0%');
  });

  it('formats number with thousands separator', () => {
    expect(formatValue({ label: '', value: 1234, format: 'number' })).toBe('1,234');
    expect(formatValue({ label: '', value: 1234, format: 'number', unit: '条' })).toBe('1,234条');
  });

  it('returns em-dash for null/empty value', () => {
    expect(formatValue({ label: '', value: '' })).toBe('—');
  });

  it('falls through plain values', () => {
    expect(formatValue({ label: '', value: 'N/A' })).toBe('N/A');
  });
});
