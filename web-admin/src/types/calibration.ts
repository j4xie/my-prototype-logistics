/**
 * ET-Agent Behavior Calibration Types
 * AI 行为校准监控相关类型定义
 */

/**
 * 单个指标数据
 */
export interface MetricItem {
  key: string;
  label: string;
  value: number;
  unit: string;
  change: number;
  changeLabel: string;
  trend: 'up' | 'down' | 'flat';
  status: 'success' | 'warning' | 'danger' | 'info';
  description?: string;
}

/**
 * 工具可靠性排名项
 */
export interface ToolReliabilityItem {
  rank: number;
  toolName: string;
  toolCode: string;
  successRate: number;
  avgDuration: number;
  totalCalls: number;
  failureCount: number;
  trend: 'up' | 'down' | 'flat';
  lastUsed: string;
}

/**
 * 工具调用记录
 */
export interface ToolCallRecord {
  id: string;
  toolName: string;
  toolCode: string;
  status: 'success' | 'failed' | 'timeout' | 'cancelled';
  duration: number;
  timestamp: string;
  userId?: number;
  userName?: string;
  inputSummary?: string;
  outputSummary?: string;
  errorMessage?: string;
  intentId?: string;
  intentName?: string;
}

/**
 * 趋势数据点
 */
export interface TrendDataPoint {
  date: string;
  conciseness: number;
  successRate: number;
  efficiency: number;
  compositeScore: number;
}

/**
 * 校准仪表盘数据
 */
export interface CalibrationDashboardData {
  metrics: MetricItem[];
  trendData: TrendDataPoint[];
  toolReliability: ToolReliabilityItem[];
  recentCalls: ToolCallRecord[];
  lastUpdated: string;
}

/**
 * 工具调用查询参数
 */
export interface ToolCallQueryParams {
  page?: number;
  size?: number;
  toolCode?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  userId?: number;
}

/**
 * 工具调用分页响应
 */
export interface ToolCallPageResponse {
  content: ToolCallRecord[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/**
 * 校准配置
 */
export interface CalibrationConfig {
  concisenessThreshold: number;
  successRateThreshold: number;
  efficiencyThreshold: number;
  compositeScoreThreshold: number;
  alertEnabled: boolean;
  alertRecipients: string[];
}

/**
 * 校准告警
 */
export interface CalibrationAlert {
  id: string;
  type: 'conciseness' | 'success_rate' | 'efficiency' | 'composite';
  level: 'info' | 'warning' | 'critical';
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: string;
  isAcknowledged: boolean;
}

/**
 * 时间粒度类型
 */
export type TimeGranularity = 'hour' | 'day' | 'week' | 'month';

/**
 * 趋势查询参数
 */
export interface TrendQueryParams {
  startDate: string;
  endDate: string;
  granularity: TimeGranularity;
  factoryId?: string;
}

/**
 * 工具状态统计
 */
export interface ToolStatusStats {
  total: number;
  success: number;
  failed: number;
  timeout: number;
  cancelled: number;
}

/**
 * 工厂选项（用于工厂选择下拉框）
 */
export interface FactoryOption {
  id: string;
  name: string;
  factoryId: string;
}
