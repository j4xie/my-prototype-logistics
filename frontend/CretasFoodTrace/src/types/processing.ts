/**
 * 生产模块类型定义
 */

// ==================== 批次成本分析类型 ====================

export interface BatchCostAnalysis {
  batch: {
    id: number;
    batchNumber: string;
    productType: string;
    rawMaterialCategory: string;
    productCategory: string;
    status: string;
    supervisor?: {
      id: number;
      fullName: string;
    };
    startDate: string;
    endDate?: string;
  };
  laborStats: {
    totalSessions: number;
    completedSessions: number;
    activeSessions: number;
    totalMinutes: number;
    totalLaborCost: number;
    totalQuantityProcessed: number;
    workerDetails: Array<{
      workerId: number;
      workerName: string;
      department?: string;
      workType?: string;
      startTime: string;
      endTime?: string;
      totalMinutes?: number;
      processedQuantity?: string;
      ccrRate?: number;
      laborCost?: number;
    }>;
  };
  equipmentStats: {
    totalUsages: number;
    completedUsages: number;
    activeUsages: number;
    totalDuration: number;
    totalEquipmentCost: number;
    equipmentDetails: Array<{
      equipmentId: number;
      equipmentName: string;
      equipmentType?: string;
      startTime: string;
      endTime?: string;
      usageDuration?: number;
      equipmentCost?: number;
    }>;
  };
  costBreakdown: {
    rawMaterialCost: number;
    rawMaterialPercentage: string | number;
    laborCost: number;
    laborPercentage: string | number;
    equipmentCost: number;
    equipmentPercentage: string | number;
    totalCost: number;
  };
  profitAnalysis: {
    expectedPrice?: number;
    rawMaterialWeight?: number;
    expectedRevenue?: number;
    totalCost: number;
    profitMargin?: number;
    profitRate?: number;
    breakEvenPrice?: string;
  };
}

// ==================== AI分析类型 ====================

export interface AICostAnalysisRequest {
  batchId: string;
  question?: string;
  session_id?: string;
}

export interface AICostAnalysisResponse {
  analysis: string;
  session_id: string;
  message_count: number;
  quota?: AIQuota;
}

export interface AIQuota {
  used: number;
  limit: number;
  remaining: number;
  period: 'weekly';
  resetDate: string;
}

// ==================== AI设置类型 ====================

export interface AISettings {
  enabled: boolean;
  tone: 'professional' | 'friendly' | 'concise';
  goal: 'cost_optimization' | 'efficiency' | 'profit';
  detailLevel: 'brief' | 'standard' | 'detailed';
  industryStandards: {
    laborCostPercentage: number;      // 人工成本占比标准(%)
    equipmentUtilization: number;     // 设备利用率目标(%)
    profitMargin: number;             // 利润率目标(%)
  };
  customPrompt?: string;
}

export interface AISettingsResponse {
  settings: AISettings;
  weeklyQuota: number;        // 每周配额（只读）
  quotaEditable: boolean;     // 配额是否可编辑（工厂管理员为false）
}

// ==================== AI使用统计类型 ====================

export interface AIUsageStats {
  period: string;             // '2025-W2' 或 'all'
  totalCalls: number;
  byType: {
    analysis: number;
    question: number;
  };
  byUser: Record<string, number>;
  recentLogs: Array<{
    id: number;
    userName: string;
    requestType: string;
    question?: string;
    createdAt: string;
  }>;
}

// ==================== 平台AI配额管理类型 ====================

export interface FactoryAIQuota {
  id: string;
  name: string;
  aiWeeklyQuota: number;
  _count: {
    aiUsageLogs: number;
  };
}

export interface AIQuotaRule {
  id?: number;
  factoryId?: string | null;
  factoryName?: string;
  weeklyQuota: number;
  roleMultipliers?: Record<string, number>;
  resetDayOfWeek: number;
  enabled: boolean;
  priority: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAIQuotaRuleRequest {
  factoryId?: string | null;
  weeklyQuota: number;
  roleMultipliers?: Record<string, number>;
  resetDayOfWeek?: number;
  enabled?: boolean;
  priority?: number;
  description?: string;
}

export interface UpdateAIQuotaRuleRequest {
  weeklyQuota?: number;
  roleMultipliers?: Record<string, number>;
  resetDayOfWeek?: number;
  enabled?: boolean;
  priority?: number;
  description?: string;
}

export interface PlatformAIUsageStats {
  currentWeek: string;          // '2025-W2'
  totalUsed: number;
  factories: Array<{
    factoryId: string;
    factoryName: string;
    weeklyQuota: number;
    used: number;
    remaining: number;
    utilization: string;        // '75.0'
  }>;
}

export interface AIQuotaUpdate {
  factoryId: string;
  weeklyQuota: number;
}

// ==================== 语气/目标选项 ====================

export const AI_TONE_OPTIONS = [
  { value: 'professional', label: '专业严谨', description: '使用专业术语，分析深入' },
  { value: 'friendly', label: '友好易懂', description: '通俗易懂，便于理解' },
  { value: 'concise', label: '简明扼要', description: '直接给出核心建议' },
] as const;

export const AI_GOAL_OPTIONS = [
  { value: 'cost_optimization', label: '成本优化', description: '降本增效，控制成本' },
  { value: 'efficiency', label: '效率提升', description: '优化人员和设备配置' },
  { value: 'profit', label: '利润最大化', description: '提高利润率和定价策略' },
] as const;

export const AI_DETAIL_OPTIONS = [
  { value: 'brief', label: '简略', description: '核心建议，3条以内' },
  { value: 'standard', label: '标准', description: '标准分析报告' },
  { value: 'detailed', label: '详细', description: '详细分析，多角度建议' },
] as const;
