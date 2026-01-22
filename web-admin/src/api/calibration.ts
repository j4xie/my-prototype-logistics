/**
 * ET-Agent Behavior Calibration API Service
 * AI 行为校准监控 API 服务
 *
 * 注意：校准 API 使用 /api/admin 路径，不同于其他 API 的 /api/mobile
 */
import { get, post } from './request';
import type {
  CalibrationDashboardData,
  ToolCallQueryParams,
  ToolCallPageResponse,
  TrendQueryParams,
  TrendDataPoint,
  ToolReliabilityItem,
  CalibrationConfig,
  CalibrationAlert,
  ToolStatusStats,
  FactoryOption,
  CalibrationSession,
  CalibrationSessionQueryParams,
  CalibrationSessionPageResponse,
  CreateCalibrationSessionRequest,
  CalibrationStatistics,
  CalibrationHistoryItem
} from '@/types/calibration';

// API 路径前缀 - 使用绝对路径覆盖 baseURL
const API_PREFIX = '/api/admin/calibration';

// ==================== 仪表盘数据 ====================

/**
 * 获取校准仪表盘数据
 * @param factoryId 工厂ID（平台管理员可选）
 */
export function getCalibrationDashboard(factoryId?: string) {
  const params = factoryId ? { factoryId } : undefined;
  return get<CalibrationDashboardData>(`${API_PREFIX}/dashboard`, { params });
}

/**
 * 获取校准指标摘要
 * @param factoryId 工厂ID
 */
export function getMetricsSummary(factoryId?: string) {
  const params = factoryId ? { factoryId } : undefined;
  return get<CalibrationDashboardData['metrics']>(`${API_PREFIX}/metrics/summary`, { params });
}

// ==================== 趋势数据 ====================

/**
 * 获取指标趋势数据
 * @param params 查询参数
 */
export function getMetricsTrend(params: TrendQueryParams) {
  return get<TrendDataPoint[]>(`${API_PREFIX}/metrics/trend`, { params });
}

/**
 * 获取单个指标的趋势数据
 * @param metricKey 指标键名
 * @param params 查询参数
 */
export function getSingleMetricTrend(metricKey: string, params: TrendQueryParams) {
  return get<Array<{ date: string; value: number }>>(`${API_PREFIX}/metrics/${metricKey}/trend`, { params });
}

// ==================== 工具可靠性 ====================

/**
 * 获取工具可靠性排名
 * @param factoryId 工厂ID
 * @param limit 返回数量限制
 */
export function getToolReliabilityRanking(factoryId?: string, limit: number = 10) {
  const params: Record<string, unknown> = { limit };
  if (factoryId) params.factoryId = factoryId;
  return get<ToolReliabilityItem[]>(`${API_PREFIX}/tools/reliability`, { params });
}

/**
 * 获取单个工具的详细统计
 * @param toolCode 工具代码
 * @param factoryId 工厂ID
 */
export function getToolStats(toolCode: string, factoryId?: string) {
  const params = factoryId ? { factoryId } : undefined;
  return get<ToolReliabilityItem>(`${API_PREFIX}/tools/${toolCode}/stats`, { params });
}

/**
 * 获取工具状态统计
 * @param factoryId 工厂ID
 */
export function getToolStatusStats(factoryId?: string) {
  const params = factoryId ? { factoryId } : undefined;
  return get<ToolStatusStats>(`${API_PREFIX}/tools/status-stats`, { params });
}

// ==================== 工具调用记录 ====================

/**
 * 获取工具调用记录列表
 * @param params 查询参数
 */
export function getToolCalls(params: ToolCallQueryParams) {
  return get<ToolCallPageResponse>(`${API_PREFIX}/calls`, { params });
}

/**
 * 获取最近的工具调用记录
 * @param factoryId 工厂ID
 * @param limit 返回数量
 */
export function getRecentToolCalls(factoryId?: string, limit: number = 20) {
  const params: Record<string, unknown> = { limit };
  if (factoryId) params.factoryId = factoryId;
  return get<ToolCallPageResponse['content']>(`${API_PREFIX}/calls/recent`, { params });
}

/**
 * 获取工具调用详情
 * @param callId 调用记录ID
 */
export function getToolCallDetail(callId: string) {
  return get<ToolCallPageResponse['content'][0]>(`${API_PREFIX}/calls/${callId}`);
}

// ==================== 配置管理 ====================

/**
 * 获取校准配置
 * @param factoryId 工厂ID
 */
export function getCalibrationConfig(factoryId?: string) {
  const params = factoryId ? { factoryId } : undefined;
  return get<CalibrationConfig>(`${API_PREFIX}/config`, { params });
}

/**
 * 更新校准配置
 * @param config 配置数据
 * @param factoryId 工厂ID
 */
export function updateCalibrationConfig(config: Partial<CalibrationConfig>, factoryId?: string) {
  const data = factoryId ? { ...config, factoryId } : config;
  return post<CalibrationConfig>(`${API_PREFIX}/config`, data);
}

// ==================== 告警管理 ====================

/**
 * 获取校准告警列表
 * @param factoryId 工厂ID
 * @param acknowledged 是否已确认
 */
export function getCalibrationAlerts(factoryId?: string, acknowledged?: boolean) {
  const params: Record<string, unknown> = {};
  if (factoryId) params.factoryId = factoryId;
  if (acknowledged !== undefined) params.acknowledged = acknowledged;
  return get<CalibrationAlert[]>(`${API_PREFIX}/alerts`, { params });
}

/**
 * 确认告警
 * @param alertId 告警ID
 */
export function acknowledgeAlert(alertId: string) {
  return post<void>(`${API_PREFIX}/alerts/${alertId}/acknowledge`);
}

/**
 * 批量确认告警
 * @param alertIds 告警ID列表
 */
export function acknowledgeAlerts(alertIds: string[]) {
  return post<void>(`${API_PREFIX}/alerts/acknowledge-batch`, { alertIds });
}

// ==================== 工厂列表（平台管理员） ====================

/**
 * 获取工厂列表（用于下拉选择）
 */
export function getFactoryOptions() {
  return get<FactoryOption[]>(`${API_PREFIX}/factories`);
}

// ==================== 数据导出 ====================

/**
 * 导出校准报告
 * @param params 查询参数
 */
export function exportCalibrationReport(params: {
  startDate: string;
  endDate: string;
  factoryId?: string;
  format?: 'excel' | 'pdf';
}) {
  return post<Blob>(`${API_PREFIX}/export`, params, {
    responseType: 'blob'
  } as unknown);
}

// ==================== 校准会话管理 ====================

/**
 * 获取校准会话列表
 * @param params 查询参数
 */
export function getCalibrationSessions(params: CalibrationSessionQueryParams) {
  return get<CalibrationSessionPageResponse>(`${API_PREFIX}/sessions`, { params });
}

/**
 * 获取校准会话详情
 * @param sessionId 会话ID
 */
export function getCalibrationSession(sessionId: string) {
  return get<CalibrationSession>(`${API_PREFIX}/sessions/${sessionId}`);
}

/**
 * 创建校准会话
 * @param data 创建请求数据
 */
export function createCalibrationSession(data: CreateCalibrationSessionRequest) {
  return post<CalibrationSession>(`${API_PREFIX}/sessions`, data);
}

/**
 * 更新校准会话状态
 * @param sessionId 会话ID
 * @param status 新状态
 */
export function updateCalibrationSessionStatus(sessionId: string, status: string) {
  return post<CalibrationSession>(`${API_PREFIX}/sessions/${sessionId}/status`, { status });
}

/**
 * 删除校准会话
 * @param sessionId 会话ID
 */
export function deleteCalibrationSession(sessionId: string) {
  return post<void>(`${API_PREFIX}/sessions/${sessionId}/delete`);
}

/**
 * 获取校准指标
 * @param factoryId 工厂ID
 */
export function getCalibrationMetrics(factoryId?: string) {
  const params = factoryId ? { factoryId } : undefined;
  return get<CalibrationDashboardData['metrics']>(`${API_PREFIX}/metrics`, { params });
}

/**
 * 获取校准统计数据
 * @param factoryId 工厂ID
 */
export function getCalibrationStatistics(factoryId?: string) {
  const params = factoryId ? { factoryId } : undefined;
  return get<CalibrationStatistics>(`${API_PREFIX}/statistics`, { params });
}

/**
 * 执行校准评估
 * @param sessionId 会话ID
 */
export function executeCalibrationEvaluation(sessionId: string) {
  return post<CalibrationSession>(`${API_PREFIX}/evaluate`, { sessionId });
}

/**
 * 获取校准历史记录
 * @param params 查询参数
 */
export function getCalibrationHistory(params: {
  sessionId?: string;
  page?: number;
  size?: number;
  startDate?: string;
  endDate?: string;
}) {
  return get<{ content: CalibrationHistoryItem[]; totalElements: number }>(`${API_PREFIX}/history`, { params });
}
