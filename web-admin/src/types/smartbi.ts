/**
 * SmartBI 共享类型定义
 * 统一 Dashboard、FinanceAnalysis、SalesAnalysis 等页面的类型
 */

/** 后端返回的 KPI 卡片 (统一接口，供 Dashboard / SalesAnalysis / FinanceAnalysis 等共用) */
export interface KPICard {
  key: string;
  title: string;
  value: string;
  rawValue: number;
  unit?: string;
  change?: number;
  changeRate?: number;
  trend: 'up' | 'down' | 'flat';
  status: 'green' | 'yellow' | 'red' | string;
  compareText?: string;
}

/** 后端返回的排行项 */
export interface RankingItem {
  rank: number;
  name: string;
  value: number;
  target: number;
  completionRate: number;
  alertLevel: 'RED' | 'YELLOW' | 'GREEN';
}

/** 后端返回的 AI 洞察 */
export interface AIInsightResponse {
  level: 'RED' | 'YELLOW' | 'GREEN' | 'INFO';
  category: string;
  message: string;
  relatedEntity: string;
  actionSuggestion: string;
}

/** 旧版图表配置 (data[] + xAxisField 格式) */
export interface LegacyChartConfig {
  chartType: string;
  title?: string;
  xAxisField?: string;
  yAxisField?: string;
  seriesField?: string;
  data?: Array<Record<string, unknown>>;
  options?: Record<string, unknown>;
}

/** 新版动态图表配置 (series[] + xAxis 格式) */
export interface DynamicChartConfig {
  chartType: string;
  title?: string;
  subTitle?: string;
  xAxis?: {
    type: string;
    name?: string;
    data?: string[];
  };
  yAxis?: Array<{
    type: string;
    name?: string;
    position?: string;
    min?: number;
    max?: number;
    axisLabel?: Record<string, unknown>;
  }>;
  legend?: {
    show?: boolean;
    data?: string[];
    position?: string;
    orient?: string;
  };
  series?: Array<{
    name?: string;
    type: string;
    data?: unknown[];
    yAxisIndex?: number;
    stack?: string;
    smooth?: boolean;
    areaStyle?: boolean;
    itemStyle?: Record<string, unknown>;
    label?: Record<string, unknown>;
  }>;
  tooltip?: {
    trigger?: string;
    axisPointer?: Record<string, unknown>;
    formatter?: string;
  };
  options?: Record<string, unknown>;
}

/** Dashboard endpoint 返回的图表配置 (series[] + xAxis.data 格式) */
export interface DashboardChartConfig {
  chartType: string;
  title: string;
  xAxis?: { data: string[] };
  yAxis?: { name: string };
  series: Array<{
    name: string;
    type: string;
    data: number[];
    yAxisIndex?: number;
  }>;
  legend?: { data: string[] };
}

/** 统一图表配置类型 */
export type ChartConfig = LegacyChartConfig | DynamicChartConfig | DashboardChartConfig;

/** 后端返回的 Dashboard 响应 */
export interface DashboardResponse {
  period: string;
  startDate: string;
  endDate: string;
  kpiCards: KPICard[];
  rankings: Record<string, RankingItem[]>;
  charts: Record<string, ChartConfig>;
  aiInsights: AIInsightResponse[];
  alerts: Array<{ level: string; message: string }>;
  generatedAt: string;
}

/** 判断图表是否有可渲染的数据 */
export function chartHasData(config: ChartConfig): boolean {
  // DashboardChartConfig / DynamicChartConfig: has series array
  if ('series' in config && Array.isArray(config.series) && config.series.length > 0) {
    return config.series.some(s => {
      if (!s.data || !Array.isArray(s.data)) return false;
      return s.data.length > 0;
    });
  }
  // LegacyChartConfig: has data array
  if ('data' in config && Array.isArray(config.data)) {
    return config.data.length > 0;
  }
  return false;
}

/** 排行榜显示名称映射 */
export const RANKING_DISPLAY_NAMES: Record<string, string> = {
  department: '部门业绩排行',
  '部门': '部门业绩排行',
  sales_person: '销售员排行',
  region: '区域销售分布',
  '区域': '区域销售分布',
  salesperson: '销售员排行',
  product: '产品排行',
  customer: '客户排行',
  overdue_customers: '逾期客户排行',
};

/** 获取排行榜显示名称 */
export function getRankingDisplayName(key: string): string {
  return RANKING_DISPLAY_NAMES[key] || key;
}
