import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { CHART_COLORS, CHART_SIZES } from './chartSizes';

/**
 * Trend direction type
 */
export type TrendDirection = 'up' | 'down' | 'flat';

/**
 * Status indicator type
 */
export type StatusType = 'green' | 'yellow' | 'red' | 'neutral';

/**
 * MobileKPICard Props
 */
export interface MobileKPICardProps {
  /** Card title/label */
  title: string;
  /** Main display value */
  value: number | string;
  /** Unit suffix (e.g., '%', 'kg', 'units') */
  unit?: string;
  /** Absolute change value */
  change?: number;
  /** Percentage change rate */
  changeRate?: number;
  /** Trend direction */
  trend?: TrendDirection;
  /** Status indicator color */
  status?: StatusType;
  /** Card width (default: kpiCard.width) */
  width?: number;
  /** Card height (default: kpiCard.height) */
  height?: number;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Format value as currency */
  isCurrency?: boolean;
  /** Currency symbol (default: CNY) */
  currencySymbol?: string;
  /** Press handler */
  onPress?: () => void;
}

/**
 * Status color mapping
 */
const STATUS_COLORS: Record<StatusType, string> = {
  green: CHART_COLORS.secondary,
  yellow: CHART_COLORS.warning,
  red: CHART_COLORS.danger,
  neutral: CHART_COLORS.gray,
};

/**
 * Trend icon mapping
 */
const TREND_ICONS: Record<TrendDirection, string> = {
  up: '\u2191',    // Up arrow
  down: '\u2193',  // Down arrow
  flat: '\u2192',  // Right arrow (flat)
};

/**
 * Format number with thousand separators
 */
function formatNumber(value: number, isCurrency?: boolean, currencySymbol = '\u00a5'): string {
  const formatted = value.toLocaleString('zh-CN', {
    minimumFractionDigits: isCurrency ? 2 : 0,
    maximumFractionDigits: isCurrency ? 2 : 2,
  });
  return isCurrency ? `${currencySymbol}${formatted}` : formatted;
}

/**
 * MobileKPICard Component
 *
 * A card component for displaying single KPI metrics with trend indicators.
 * Commonly used in dashboards to show key business metrics at a glance.
 *
 * @example
 * ```tsx
 * <MobileKPICard
 *   title="Total Revenue"
 *   value={125000}
 *   unit="CNY"
 *   change={5000}
 *   changeRate={4.2}
 *   trend="up"
 *   status="green"
 *   isCurrency
 * />
 * ```
 */
export default function MobileKPICard({
  title,
  value,
  unit,
  change,
  changeRate,
  trend = 'flat',
  status = 'neutral',
  width = CHART_SIZES.kpiCard.width,
  height = CHART_SIZES.kpiCard.height,
  subtitle,
  isCurrency = false,
  currencySymbol = '\u00a5',
  onPress,
}: MobileKPICardProps): React.ReactElement {
  // Determine trend color
  const trendColor = trend === 'up'
    ? CHART_COLORS.secondary
    : trend === 'down'
      ? CHART_COLORS.danger
      : CHART_COLORS.gray;

  // Format the main value
  const displayValue = typeof value === 'number'
    ? formatNumber(value, isCurrency, currencySymbol)
    : value;

  // Format change text
  const changeText = change !== undefined
    ? `${change >= 0 ? '+' : ''}${formatNumber(change, isCurrency, currencySymbol)}`
    : null;

  // Format change rate text
  const rateText = changeRate !== undefined
    ? `${changeRate >= 0 ? '+' : ''}${changeRate.toFixed(1)}%`
    : null;

  return (
    <Surface
      style={[
        styles.container,
        { width, minHeight: height },
      ]}
      elevation={1}
      onTouchEnd={onPress}
    >
      {/* Status indicator dot */}
      <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] }]} />

      {/* Title */}
      <Text
        variant="bodySmall"
        style={styles.title}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {title}
      </Text>

      {/* Main Value */}
      <View style={styles.valueContainer}>
        <Text
          variant="headlineMedium"
          style={styles.value}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {displayValue}
        </Text>
        {unit && !isCurrency && (
          <Text variant="bodyMedium" style={styles.unit}>
            {unit}
          </Text>
        )}
      </View>

      {/* Subtitle if provided */}
      {subtitle && (
        <Text
          variant="bodySmall"
          style={styles.subtitle}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      )}

      {/* Trend and Change */}
      {(changeText || rateText) && (
        <View style={styles.trendContainer}>
          <Text style={[styles.trendIcon, { color: trendColor }]}>
            {TREND_ICONS[trend]}
          </Text>
          {changeText && (
            <Text style={[styles.changeText, { color: trendColor }]}>
              {changeText}
            </Text>
          )}
          {rateText && (
            <Text style={[styles.rateText, { color: trendColor }]}>
              ({rateText})
            </Text>
          )}
        </View>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    position: 'relative',
  },
  statusDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    color: '#6B7280',
    marginBottom: 4,
    paddingRight: 16,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  value: {
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 36,
  },
  unit: {
    marginLeft: 4,
    color: '#6B7280',
  },
  subtitle: {
    color: '#9CA3AF',
    marginBottom: 4,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  trendIcon: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  rateText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
});
