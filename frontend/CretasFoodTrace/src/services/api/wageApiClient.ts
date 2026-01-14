import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 工资计算与人效管理API客户端
 * 路径：/api/mobile/{factoryId}/wage/*
 *
 * 功能:
 * - 计件规则管理
 * - 工人效率记录
 * - 工资单生成和审批
 * - 人力成本分析
 */

// ========== 类型定义 ==========

export interface PieceRateRule {
  id: number;
  factoryId: string;
  workTypeId?: string;
  productTypeId?: string;
  processStageType?: string;
  name: string;
  description?: string;
  tier1Threshold?: number;
  tier1Rate?: number;
  tier2Threshold?: number;
  tier2Rate?: number;
  tier3Threshold?: number;
  tier3Rate?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  isActive: boolean;
  priority: number;
}

export interface WorkerDailyEfficiency {
  id: number;
  factoryId: string;
  workerId: number;
  workerName?: string;
  workDate: string;
  shiftType?: string;
  workStartTime?: string;
  workEndTime?: string;
  totalWorkMinutes?: number;
  breakMinutes?: number;
  effectiveWorkMinutes?: number;
  totalPieceCount?: number;
  qualifiedCount?: number;
  defectCount?: number;
  qualityRate?: number;
  piecesPerHour?: number;
  averageTimePerPiece?: number;
  efficiencyScore?: number;
  efficiencyTrend?: 'UP' | 'DOWN' | 'STABLE';
  workstationId?: string;
  workstationName?: string;
  processStageType?: string;
  productTypeId?: string;
  standardPiecesPerHour?: number;
  comparedToStandard?: number;
  rankInTeam?: number;
}

export interface PayrollRecord {
  id: number;
  factoryId: string;
  workerId: number;
  workerName: string;
  periodStart: string;
  periodEnd: string;
  periodType: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  totalPieceCount?: number;
  pieceRateWage?: number;
  pieceRuleId?: number;
  baseSalary?: number;
  overtimeWage?: number;
  overtimeHours?: number;
  bonusAmount?: number;
  deductionAmount?: number;
  totalWage?: number;
  averageEfficiency?: number;
  totalWorkHours?: number;
  efficiencyRating?: 'A' | 'B' | 'C' | 'D';
  status: 'PENDING' | 'APPROVED' | 'PAID';
  approvedBy?: number;
  approvedAt?: string;
  paidAt?: string;
  notes?: string;
}

export interface LaborCostAnalysis {
  totalWage: number;
  totalPieceRateWage: number;
  totalPieceCount: number;
  costPerPiece: number;
  averageEfficiency: number;
  byEfficiencyRating: Record<string, { count: number; totalWage: number }>;
  byProcessStage: Record<string, { avgEfficiency: number; totalPieces: number }>;
  workerCount: number;
  avgPiecesPerWorker: number;
  avgWagePerWorker: number;
}

export interface EfficiencyTrendData {
  workerId: number;
  startDate: string;
  endDate: string;
  trend: Record<string, number>;
  summary: {
    averageEfficiency: number;
    maxEfficiency: number;
    minEfficiency: number;
    dataPoints: number;
  };
}

export interface FactoryEfficiencyTrendItem {
  date: string;
  avgEfficiency: number;
  totalPieces: number;
  workerCount: number;
}

// ========== API客户端类 ==========

class WageApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/wage`;
  }

  // ========== 计件规则管理 ==========

  /**
   * 获取计件规则列表
   */
  async getPieceRateRules(params?: {
    activeOnly?: boolean;
    factoryId?: string;
  }): Promise<PieceRateRule[]> {
    const { factoryId, ...queryParams } = params || {};
    return await apiClient.get<PieceRateRule[]>(
      `${this.getPath(factoryId)}/piece-rate-rules`,
      { params: queryParams }
    );
  }

  /**
   * 获取计件规则详情
   */
  async getPieceRateRule(ruleId: number, factoryId?: string): Promise<PieceRateRule> {
    return await apiClient.get<PieceRateRule>(
      `${this.getPath(factoryId)}/piece-rate-rules/${ruleId}`
    );
  }

  /**
   * 创建计件规则
   */
  async createPieceRateRule(
    rule: Omit<PieceRateRule, 'id' | 'factoryId'>,
    factoryId?: string
  ): Promise<PieceRateRule> {
    return await apiClient.post<PieceRateRule>(
      `${this.getPath(factoryId)}/piece-rate-rules`,
      rule
    );
  }

  /**
   * 更新计件规则
   */
  async updatePieceRateRule(
    ruleId: number,
    rule: Partial<PieceRateRule>,
    factoryId?: string
  ): Promise<PieceRateRule> {
    return await apiClient.put<PieceRateRule>(
      `${this.getPath(factoryId)}/piece-rate-rules/${ruleId}`,
      rule
    );
  }

  /**
   * 删除计件规则
   */
  async deletePieceRateRule(ruleId: number, factoryId?: string): Promise<void> {
    return await apiClient.delete<void>(
      `${this.getPath(factoryId)}/piece-rate-rules/${ruleId}`
    );
  }

  // ========== 效率记录 ==========

  /**
   * 记录工人计件数据
   */
  async recordEfficiency(
    data: {
      workerId: number;
      pieceCount: number;
      workDate?: string;
      workMinutes?: number;
      processStageType?: string;
    },
    factoryId?: string
  ): Promise<WorkerDailyEfficiency> {
    return await apiClient.post<WorkerDailyEfficiency>(
      `${this.getPath(factoryId)}/efficiency/record`,
      data
    );
  }

  /**
   * 获取工人日效率列表
   */
  async getDailyEfficiency(
    date: string,
    factoryId?: string
  ): Promise<WorkerDailyEfficiency[]> {
    return await apiClient.get<WorkerDailyEfficiency[]>(
      `${this.getPath(factoryId)}/efficiency/daily`,
      { params: { date } }
    );
  }

  /**
   * 获取工人日效率详情
   */
  async getWorkerDailyEfficiency(
    workerId: number,
    date: string,
    factoryId?: string
  ): Promise<WorkerDailyEfficiency | null> {
    return await apiClient.get<WorkerDailyEfficiency | null>(
      `${this.getPath(factoryId)}/efficiency/daily/${workerId}`,
      { params: { date } }
    );
  }

  /**
   * 获取效率排名
   */
  async getEfficiencyRanking(
    date: string,
    processStageType?: string,
    factoryId?: string
  ): Promise<WorkerDailyEfficiency[]> {
    const params: Record<string, string> = { date };
    if (processStageType) {
      params.processStageType = processStageType;
    }
    return await apiClient.get<WorkerDailyEfficiency[]>(
      `${this.getPath(factoryId)}/efficiency/ranking`,
      { params }
    );
  }

  /**
   * 获取工人效率趋势
   */
  async getWorkerEfficiencyTrend(
    workerId: number,
    startDate: string,
    endDate: string,
    factoryId?: string
  ): Promise<EfficiencyTrendData> {
    return await apiClient.get<EfficiencyTrendData>(
      `${this.getPath(factoryId)}/efficiency/trend/${workerId}`,
      { params: { startDate, endDate } }
    );
  }

  /**
   * 获取工厂效率趋势
   */
  async getFactoryEfficiencyTrend(
    startDate: string,
    endDate: string,
    factoryId?: string
  ): Promise<FactoryEfficiencyTrendItem[]> {
    return await apiClient.get<FactoryEfficiencyTrendItem[]>(
      `${this.getPath(factoryId)}/efficiency/factory-trend`,
      { params: { startDate, endDate } }
    );
  }

  // ========== 工资单管理 ==========

  /**
   * 生成工资单
   */
  async generatePayroll(
    data: {
      workerId: number;
      periodStart: string;
      periodEnd: string;
    },
    factoryId?: string
  ): Promise<PayrollRecord> {
    return await apiClient.post<PayrollRecord>(
      `${this.getPath(factoryId)}/payroll/generate`,
      data
    );
  }

  /**
   * 批量生成工资单
   */
  async generateBatchPayroll(
    data: {
      periodStart: string;
      periodEnd: string;
    },
    factoryId?: string
  ): Promise<PayrollRecord[]> {
    return await apiClient.post<PayrollRecord[]>(
      `${this.getPath(factoryId)}/payroll/generate-batch`,
      data
    );
  }

  /**
   * 获取工资单列表
   */
  async getPayrollList(
    params?: {
      workerId?: number;
      status?: string;
      page?: number;
      size?: number;
      factoryId?: string;
    }
  ): Promise<{
    content: PayrollRecord[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
  }> {
    const { factoryId, ...queryParams } = params || {};
    return await apiClient.get(
      `${this.getPath(factoryId)}/payroll`,
      { params: queryParams }
    );
  }

  /**
   * 获取工资单详情
   */
  async getPayrollById(payrollId: number, factoryId?: string): Promise<PayrollRecord> {
    return await apiClient.get<PayrollRecord>(
      `${this.getPath(factoryId)}/payroll/${payrollId}`
    );
  }

  /**
   * 审批工资单
   */
  async approvePayroll(payrollId: number, factoryId?: string): Promise<PayrollRecord> {
    return await apiClient.put<PayrollRecord>(
      `${this.getPath(factoryId)}/payroll/${payrollId}/approve`,
      {}
    );
  }

  /**
   * 批量审批工资单
   */
  async batchApprovePayroll(
    payrollIds: number[],
    factoryId?: string
  ): Promise<{ totalRequested: number; successCount: number; failedCount: number }> {
    return await apiClient.put(
      `${this.getPath(factoryId)}/payroll/batch-approve`,
      payrollIds
    );
  }

  /**
   * 标记工资单已发放
   */
  async markPayrollAsPaid(payrollId: number, factoryId?: string): Promise<PayrollRecord> {
    return await apiClient.put<PayrollRecord>(
      `${this.getPath(factoryId)}/payroll/${payrollId}/paid`,
      {}
    );
  }

  /**
   * 获取待审核工资单数量
   */
  async getPendingPayrollCount(factoryId?: string): Promise<{ pendingCount: number }> {
    return await apiClient.get<{ pendingCount: number }>(
      `${this.getPath(factoryId)}/payroll/pending-count`
    );
  }

  /**
   * 获取工资排行榜
   */
  async getTopEarners(
    periodStart: string,
    periodEnd: string,
    limit: number = 10,
    factoryId?: string
  ): Promise<PayrollRecord[]> {
    return await apiClient.get<PayrollRecord[]>(
      `${this.getPath(factoryId)}/payroll/top-earners`,
      { params: { periodStart, periodEnd, limit } }
    );
  }

  // ========== 成本分析 ==========

  /**
   * 人力成本分析
   */
  async analyzeLaborCost(
    periodStart: string,
    periodEnd: string,
    factoryId?: string
  ): Promise<LaborCostAnalysis> {
    return await apiClient.get<LaborCostAnalysis>(
      `${this.getPath(factoryId)}/analysis/labor-cost`,
      { params: { periodStart, periodEnd } }
    );
  }

  /**
   * 计算预估计件工资
   */
  async estimateWage(
    pieceCount: number,
    processStageType?: string,
    productTypeId?: string,
    factoryId?: string
  ): Promise<{ pieceCount: number; estimatedWage: number }> {
    const params: Record<string, string | number> = { pieceCount };
    if (processStageType) params.processStageType = processStageType;
    if (productTypeId) params.productTypeId = productTypeId;
    return await apiClient.get(
      `${this.getPath(factoryId)}/analysis/estimate-wage`,
      { params }
    );
  }
}

export const wageApiClient = new WageApiClient();
export default wageApiClient;
