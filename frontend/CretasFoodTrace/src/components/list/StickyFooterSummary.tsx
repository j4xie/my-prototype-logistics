import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCanViewPrice } from '../../store/canViewPriceStore';
import type {
  ListSummaryPagination,
  SummaryStat,
} from '../../types/listSummary';

export interface StickyFooterSummaryProps {
  stats: SummaryStat[];
  pagination?: ListSummaryPagination & { onPageChange: (page: number) => void };
  onAIAnalyze?: () => void;
  onExport?: () => void;
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  testID?: string;
}

function formatValue(stat: SummaryStat): string {
  const { value, format, unit } = stat;
  if (value == null || value === '') return '—';
  if (typeof value === 'string' && format !== 'number' && format !== 'currency' && format !== 'percent') {
    return value + (unit ?? '');
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);
  switch (format) {
    case 'currency':
      return `${unit ?? '¥'}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'percent':
      return `${num.toFixed(1)}${unit ?? '%'}`;
    case 'number':
      return `${num.toLocaleString()}${unit ?? ''}`;
    default:
      return `${num}${unit ?? ''}`;
  }
}

function StatItem({ stat }: { stat: SummaryStat }) {
  const display = formatValue(stat);
  const trendIcon = stat.trend === 'up' ? '↑' : stat.trend === 'down' ? '↓' : null;
  const trendColor = stat.trend === 'up' ? '#2E7D32' : stat.trend === 'down' ? '#C62828' : undefined;
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{stat.label}</Text>
      <Text style={styles.statValue}>
        {display}
        {trendIcon != null && (
          <Text style={[styles.trend, trendColor ? { color: trendColor } : null]}>
            {' '}
            {trendIcon}
            {stat.trendDelta != null ? Math.abs(stat.trendDelta).toFixed(1) : ''}
          </Text>
        )}
      </Text>
    </View>
  );
}

function PaginationBar({ pagination }: { pagination: NonNullable<StickyFooterSummaryProps['pagination']> }) {
  const { currentPage, totalPages, onPageChange } = pagination;
  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;
  return (
    <View style={styles.pagination}>
      <TouchableOpacity
        onPress={() => !prevDisabled && onPageChange(currentPage - 1)}
        disabled={prevDisabled}
        accessibilityLabel="上一页"
      >
        <Text style={[styles.pageBtn, prevDisabled && styles.pageBtnDisabled]}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.pageIndicator}>
        {currentPage}/{Math.max(totalPages, 1)}
      </Text>
      <TouchableOpacity
        onPress={() => !nextDisabled && onPageChange(currentPage + 1)}
        disabled={nextDisabled}
        accessibilityLabel="下一页"
      >
        <Text style={[styles.pageBtn, nextDisabled && styles.pageBtnDisabled]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const StickyFooterSummary: React.FC<StickyFooterSummaryProps> = ({
  stats,
  pagination,
  onAIAnalyze,
  onExport,
  loading,
  empty,
  emptyText = '暂无数据',
  testID,
}) => {
  const canViewPrice = useCanViewPrice();
  const visibleStats = useMemo(
    () => stats.filter((s) => !s.canViewPrice || canViewPrice),
    [stats, canViewPrice],
  );

  return (
    <SafeAreaView edges={['bottom']} style={styles.container} testID={testID ?? 'sticky-footer-summary'}>
      <View style={styles.row}>
        <View style={styles.statsRow}>
          {loading ? (
            <ActivityIndicator size="small" testID="sticky-footer-loading" />
          ) : empty || visibleStats.length === 0 ? (
            <Text style={styles.emptyText}>{emptyText}</Text>
          ) : (
            visibleStats.map((stat, i) => <StatItem key={`${stat.label}-${i}`} stat={stat} />)
          )}
        </View>

        <View style={styles.actions}>
          {onAIAnalyze != null && (
            <TouchableOpacity onPress={onAIAnalyze} accessibilityLabel="AI 分析" testID="sticky-footer-ai">
              <Text style={styles.actionIcon}>📊</Text>
            </TouchableOpacity>
          )}
          {onExport != null && (
            <TouchableOpacity onPress={onExport} accessibilityLabel="导出" testID="sticky-footer-export">
              <Text style={styles.actionIcon}>📤</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {pagination != null && <PaginationBar pagination={pagination} />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: 12,
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 14,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  statValue: {
    fontSize: 14,
    color: '#222',
    fontWeight: '600',
  },
  trend: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionIcon: {
    fontSize: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEE',
  },
  pageBtn: {
    fontSize: 20,
    color: '#1976D2',
    paddingHorizontal: 18,
  },
  pageBtnDisabled: {
    color: '#CCC',
  },
  pageIndicator: {
    fontSize: 13,
    color: '#444',
    marginHorizontal: 8,
  },
});

export { formatValue };
export default StickyFooterSummary;
