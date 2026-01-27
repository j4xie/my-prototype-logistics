/**
 * SmartBI Mobile Chart Components
 *
 * A collection of mobile-optimized chart components for SmartBI dashboard.
 * Built on top of react-native-chart-kit for consistent visualization.
 */

// Chart size constants and utilities
export * from './chartSizes';

// KPI Card - Single metric display with trend indicators
export { default as MobileKPICard } from './MobileKPICard';
export type { MobileKPICardProps, TrendDirection, StatusType } from './MobileKPICard';

// Line Chart - Trend visualization and multi-series comparison
export { default as MobileLineChart } from './MobileLineChart';
export type { MobileLineChartProps, LineDataPoint, LineDataSeries } from './MobileLineChart';

// Bar Chart - Category comparison (vertical and horizontal)
export { default as MobileBarChart } from './MobileBarChart';
export type { MobileBarChartProps, BarDataItem } from './MobileBarChart';

// Pie Chart - Proportion visualization
export { default as MobilePieChart } from './MobilePieChart';
export type { MobilePieChartProps, PieDataItem } from './MobilePieChart';

// Ranking List - Top N items with progress bars
export { default as MobileRankingList } from './MobileRankingList';
export type { MobileRankingListProps, RankingItem } from './MobileRankingList';

// Gauge Chart - Speedometer for metrics like OEE, completion rate
export { default as MobileGaugeChart } from './MobileGaugeChart';
export type { MobileGaugeChartProps, GaugeThresholds } from './MobileGaugeChart';

// Radar Chart - Multi-dimensional comparison (spider chart)
export { default as MobileRadarChart } from './MobileRadarChart';
export type { MobileRadarChartProps, RadarDataset } from './MobileRadarChart';

// Funnel Chart - Sales pipeline and conversion visualization
export { default as MobileFunnelChart } from './MobileFunnelChart';
export type { MobileFunnelChartProps, FunnelStage } from './MobileFunnelChart';

// Budget Chart - Budget vs actual achievement visualization
export { default as MobileBudgetChart } from './MobileBudgetChart';
export type { MobileBudgetChartProps, BudgetData } from './MobileBudgetChart';

// Waterfall Chart - Cumulative change visualization (bridge chart)
export { default as MobileWaterfallChart } from './MobileWaterfallChart';
export type { MobileWaterfallChartProps, WaterfallDataPoint, WaterfallColors } from './MobileWaterfallChart';

// AI Insight Panel - AI-generated analysis insights display
export { default as MobileAIInsightPanel } from './MobileAIInsightPanel';
export type {
  MobileAIInsightPanelProps,
  AIInsightData,
  InsightItem,
} from './MobileAIInsightPanel';

// YoY/MoM Comparison Chart - Year-over-Year and Month-over-Month comparison
export { default as MobileYoYComparisonChart } from './MobileYoYComparisonChart';
export type {
  MobileYoYComparisonChartProps,
  ComparisonData,
  ViewMode,
} from './MobileYoYComparisonChart';

// Period Selector - Mobile-optimized time period selection with bottom sheet
export { default as MobilePeriodSelector, formatPeriodDisplay } from './MobilePeriodSelector';
export type {
  MobilePeriodSelectorProps,
  PeriodSelection,
  PeriodType,
  QuickOption,
} from './MobilePeriodSelector';
