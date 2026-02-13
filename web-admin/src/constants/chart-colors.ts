/**
 * Unified chart color palette for ECharts series.
 *
 * Re-exports CHART_COLORS from the shared ECharts theme so there is a
 * single source of truth.  Components that already import from here
 * will continue to work without changes.
 */
export { CHART_COLORS } from '@/utils/echarts-theme';

/** First 5 colors -- handy for small-series charts like rankings */
import { CHART_COLORS as _COLORS } from '@/utils/echarts-theme';
export const CHART_COLORS_5 = _COLORS.slice(0, 5);
