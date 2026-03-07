/**
 * Partial ECharts option types used in SmartBI chart processing.
 * Not exhaustive -- covers only properties accessed in our codebase.
 */

export interface EChartsSeriesItem {
  type?: string;
  data?: unknown[];
  name?: string;
  stack?: string;
  smooth?: boolean;
  areaStyle?: Record<string, unknown>;
  lineStyle?: Record<string, unknown>;
  itemStyle?: Record<string, unknown>;
  label?: Record<string, unknown>;
  labelLayout?: Record<string, unknown>;
  markLine?: Record<string, unknown>;
  markPoint?: Record<string, unknown>;
  sampling?: string;
  yAxisIndex?: number;
  [k: string]: unknown;
}

export interface EChartsAxisLabel {
  rotate?: number;
  interval?: number | 'auto';
  formatter?: unknown;
  hideOverlap?: boolean;
  fontSize?: number;
  [k: string]: unknown;
}

export interface EChartsAxis {
  type?: string;
  data?: unknown[];
  name?: string;
  axisLabel?: EChartsAxisLabel;
  scale?: boolean;
  splitNumber?: number;
  [k: string]: unknown;
}

export interface EChartsRadarIndicator {
  name: string;
  max?: number;
  [k: string]: unknown;
}

export interface EChartsRadarItem {
  indicator?: EChartsRadarIndicator[];
  splitNumber?: number;
  [k: string]: unknown;
}

export interface SmartBIChartOption {
  title?: { text?: string; subtext?: string; [k: string]: unknown };
  tooltip?: { formatter?: unknown; position?: unknown; [k: string]: unknown };
  legend?: { data?: unknown[]; show?: boolean; formatter?: unknown; tooltip?: unknown; [k: string]: unknown };
  grid?: { left?: string | number; right?: string | number; top?: string | number; bottom?: string | number; containLabel?: boolean; [k: string]: unknown };
  xAxis?: EChartsAxis;
  yAxis?: EChartsAxis | EChartsAxis[];
  series?: EChartsSeriesItem[];
  radar?: EChartsRadarItem | EChartsRadarItem[];
  dataZoom?: Array<{ type?: string; [k: string]: unknown }>;
  dataset?: { source?: unknown[] };
  graphic?: unknown[];
  visualMap?: unknown;
  [key: string]: unknown;
}

/** Chart item from enrichment flow */
export interface SmartBIChartItem {
  chartType: string;
  title: string;
  config: SmartBIChartOption;
  xField?: string;
  totalItems?: number;
  anomalies?: Record<string, unknown>;
}

/** ECharts tooltip/click callback params (partial — ECharts types are complex) */
export interface EChartsCallbackParams {
  componentType?: string;
  seriesType?: string;
  seriesIndex?: number;
  seriesName?: string;
  name?: string;
  dataIndex?: number;
  data?: unknown;
  value?: unknown;
  percent?: number;
  marker?: string;
  event?: { event?: MouseEvent };
  [k: string]: unknown;
}

/** ECharts getOption() return shape (arrays for all top-level keys) */
export interface EChartsGetOptionResult {
  xAxis?: EChartsAxis[];
  yAxis?: EChartsAxis[];
  series?: EChartsSeriesItem[];
  legend?: Array<{ data?: unknown[] }>;
  [k: string]: unknown;
}
