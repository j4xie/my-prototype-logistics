/**
 * SmartBI Chart Components
 * Reusable ECharts-based visualization components for business intelligence
 */

// Chart Components
export { default as TrendChart } from './TrendChart.vue';
export { default as RankingChart } from './RankingChart.vue';
export { default as PieChart } from './PieChart.vue';
export { default as GaugeChart } from './GaugeChart.vue';
export { default as HeatmapChart } from './HeatmapChart.vue';
export { default as CombinedChart } from './CombinedChart.vue';
export { default as MapChart } from './MapChart.vue';
export { default as KPICard } from './KPICard.vue';

// Type exports
export type { TrendDataPoint, TrendSeries } from './TrendChart.vue';
export type { RankingItem } from './RankingChart.vue';
export type { PieDataItem } from './PieChart.vue';
export type { HeatmapDataPoint } from './HeatmapChart.vue';
export type { CombinedDataPoint, CombinedSeries } from './CombinedChart.vue';
export type { MapDataItem } from './MapChart.vue';
export type { TrendDirection, StatusType } from './KPICard.vue';

// Utility types for common chart configurations
export interface ChartTheme {
  primaryColor: string;
  successColor: string;
  warningColor: string;
  dangerColor: string;
  infoColor: string;
  textColor: string;
  borderColor: string;
  backgroundColor: string;
}

export const defaultChartTheme: ChartTheme = {
  primaryColor: '#409eff',
  successColor: '#67c23a',
  warningColor: '#e6a23c',
  dangerColor: '#f56c6c',
  infoColor: '#909399',
  textColor: '#303133',
  borderColor: '#dcdfe6',
  backgroundColor: '#ffffff'
};

// Color palettes for charts
export const colorPalettes = {
  default: [
    '#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399',
    '#00d4ff', '#ff6b9d', '#c084fc', '#fbbf24', '#34d399'
  ],
  warm: [
    '#f56c6c', '#e6a23c', '#fbbf24', '#ff6b9d', '#c084fc',
    '#f97316', '#ef4444', '#ec4899', '#f59e0b', '#d946ef'
  ],
  cool: [
    '#409eff', '#67c23a', '#00d4ff', '#34d399', '#06b6d4',
    '#3b82f6', '#10b981', '#0ea5e9', '#14b8a6', '#22c55e'
  ],
  gradient: [
    '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe',
    '#00f2fe', '#43e97b', '#38f9d7', '#fa709a', '#fee140'
  ]
};

// Helper function to format numbers
export function formatNumber(value: number, options?: {
  precision?: number;
  compact?: boolean;
  prefix?: string;
  suffix?: string;
}): string {
  const { precision = 0, compact = false, prefix = '', suffix = '' } = options || {};

  let formatted: string;

  if (compact) {
    if (value >= 1000000000) {
      formatted = (value / 1000000000).toFixed(1) + 'B';
    } else if (value >= 1000000) {
      formatted = (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      formatted = (value / 1000).toFixed(1) + 'K';
    } else {
      formatted = value.toFixed(precision);
    }
  } else {
    formatted = new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    }).format(value);
  }

  return `${prefix}${formatted}${suffix}`;
}

// Helper function to calculate percentage change
export function calculateChange(current: number, previous: number): {
  value: number;
  percentage: number;
  direction: 'up' | 'down' | 'flat';
} {
  if (previous === 0) {
    return {
      value: current,
      percentage: current > 0 ? 100 : 0,
      direction: current > 0 ? 'up' : current < 0 ? 'down' : 'flat'
    };
  }

  const change = current - previous;
  const percentage = (change / Math.abs(previous)) * 100;

  return {
    value: change,
    percentage: Math.abs(percentage),
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
  };
}
