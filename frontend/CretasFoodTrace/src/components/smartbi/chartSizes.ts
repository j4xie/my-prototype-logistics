import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Chart size presets for SmartBI components
 * Responsive sizes based on screen width
 */
export const CHART_SIZES = {
  /** Full width chart (with 16px padding on each side) */
  fullWidth: {
    width: SCREEN_WIDTH - 32,
    height: 220,
  },
  /** Half width chart for 2-column layouts */
  halfWidth: {
    width: (SCREEN_WIDTH - 48) / 2,
    height: 180,
  },
  /** KPI card size for dashboard grids */
  kpiCard: {
    width: (SCREEN_WIDTH - 56) / 2,
    height: 100,
  },
  /** Pie chart (square aspect ratio) */
  pie: {
    width: SCREEN_WIDTH - 64,
    height: SCREEN_WIDTH - 64,
  },
};

/**
 * SmartBI color palette
 * Consistent colors for charts and data visualization
 */
export const CHART_COLORS = {
  /** Primary brand color - blue */
  primary: '#3B82F6',
  /** Secondary color - green (positive) */
  secondary: '#10B981',
  /** Warning color - amber */
  warning: '#F59E0B',
  /** Danger color - red (negative) */
  danger: '#EF4444',
  /** Neutral gray */
  gray: '#6B7280',
  /** Series colors for multi-data charts */
  series: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'],
};

/**
 * Common chart configuration
 */
export const CHART_CONFIG = {
  /** Background color for charts */
  backgroundColor: '#FFFFFF',
  /** Background gradient start */
  backgroundGradientFrom: '#FFFFFF',
  /** Background gradient end */
  backgroundGradientTo: '#FFFFFF',
  /** Decimal places for labels */
  decimalPlaces: 0,
  /** Main text/line color */
  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
  /** Label color */
  labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
  /** Grid/stroke color */
  strokeWidth: 2,
  /** Bar percentage width */
  barPercentage: 0.7,
  /** Use shadow offset */
  useShadowColorFromDataset: false,
  /** Chart style */
  style: {
    borderRadius: 16,
  },
  /** Props for bezier line decorations */
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#3B82F6',
  },
};

/**
 * Get responsive chart width
 * @param padding - Total horizontal padding (default: 32)
 * @returns Calculated width
 */
export function getChartWidth(padding = 32): number {
  return Dimensions.get('window').width - padding;
}

/**
 * Get responsive chart height based on aspect ratio
 * @param aspectRatio - Height/Width ratio (default: 0.5)
 * @param padding - Total horizontal padding (default: 32)
 * @returns Calculated height
 */
export function getChartHeight(aspectRatio = 0.5, padding = 32): number {
  const width = getChartWidth(padding);
  return Math.round(width * aspectRatio);
}
