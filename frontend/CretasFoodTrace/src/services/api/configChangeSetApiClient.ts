import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 配置变更集 API 客户端
 *
 * 用于管理配置变更的完整生命周期：
 * - 创建变更集
 * - 预览差异
 * - 审批/拒绝
 * - 应用变更
 * - 回滚变更
 *
 * 路径: /api/mobile/{factoryId}/config-changes/*
 *
 * @author Cretas Team
 * @since 2025-12-30
 */

// ========== 类型定义 ==========

/**
 * 配置类型
 */
export type ConfigType =
  | 'FORM_TEMPLATE'
  | 'DROOLS_RULE'
  | 'APPROVAL_CHAIN'
  | 'QUALITY_RULE'
  | 'CONVERSION_RATE'
  | 'FACTORY_CAPACITY'
  | 'OTHER';

/**
 * 变更集状态
 */
export type ChangeStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'APPLIED'
  | 'REJECTED'
  | 'ROLLED_BACK'
  | 'EXPIRED';

/**
 * 配置变更集
 */
export interface ConfigChangeSet {
  id: string;
  factoryId: string;
  configType: ConfigType;
  configId: string;
  configName?: string;
  fromVersion?: number;
  toVersion?: number;
  beforeSnapshot?: string;
  afterSnapshot?: string;
  diffJson?: string;
  changeSummary?: string;
  status: ChangeStatus;
  createdBy?: number;
  createdByName?: string;
  approvedBy?: number;
  approvedByName?: string;
  approvedAt?: string;
  approvalComment?: string;
  appliedAt?: string;
  rolledBackAt?: string;
  rolledBackBy?: number;
  rollbackReason?: string;
  isRollbackable?: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * 创建变更集请求
 */
export interface CreateChangeSetRequest {
  configType: ConfigType;
  configId: string;
  configName?: string;
  beforeSnapshot?: string;
  afterSnapshot: string;
}

/**
 * 审批请求
 */
export interface ApprovalRequest {
  comment?: string;
}

/**
 * 拒绝请求
 */
export interface RejectRequest {
  reason: string;
}

/**
 * 回滚请求
 */
export interface RollbackRequest {
  reason: string;
}

/**
 * Dry-run 请求
 */
export interface DryRunRequest {
  configType: ConfigType;
  configId: string;
  configName?: string;
  beforeSnapshot?: string;
  afterSnapshot: string;
}

/**
 * Dry-run 响应结果
 */
export interface DryRunResult {
  configType: ConfigType;
  configTypeName: string;
  configId: string;
  configName?: string;
  fromVersion: number;
  toVersion: number;
  hasPendingChange: boolean;
  canCreate: boolean;
  changeSummary: string;
  diffJson: string;
  diff: {
    added: Array<{ field: string; value: unknown }>;
    removed: Array<{ field: string; value: unknown }>;
    modified: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  };
  warnings: string[];
}

/**
 * 差异预览结果
 */
export interface DiffPreviewResult {
  id: string;
  configType: ConfigType;
  configName?: string;
  fromVersion?: number;
  toVersion?: number;
  status: ChangeStatus;
  createdBy?: string;
  createdAt: string;
  changeSummary?: string;
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  diff?: {
    added: Array<{ field: string; value: unknown }>;
    removed: Array<{ field: string; value: unknown }>;
    modified: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  };
}

/**
 * 分页响应
 */
export interface PageResponse<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * API标准响应
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// ========== API客户端类 ==========

class ConfigChangeSetApiClient {
  private getPath(factoryId?: string): string {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/config-changes`;
  }

  // ========== 查询 ==========

  /**
   * 分页查询变更集列表
   *
   * GET /api/mobile/{factoryId}/config-changes
   */
  async getChangeSets(
    params?: { page?: number; size?: number; status?: ChangeStatus },
    factoryId?: string
  ): Promise<PageResponse<ConfigChangeSet>> {
    const { page = 1, size = 10, status } = params || {};
    const response = await apiClient.get<ApiResponse<PageResponse<ConfigChangeSet>>>(
      this.getPath(factoryId),
      { params: { page, size, status } }
    );

    if (response.success && response.data) {
      return response.data;
    }

    return {
      content: [],
      number: page,
      size,
      totalElements: 0,
      totalPages: 0,
    };
  }

  /**
   * 获取待审批的变更集列表
   *
   * GET /api/mobile/{factoryId}/config-changes/pending
   */
  async getPendingChangeSets(factoryId?: string): Promise<ConfigChangeSet[]> {
    const response = await apiClient.get<ApiResponse<ConfigChangeSet[]>>(
      `${this.getPath(factoryId)}/pending`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }

  /**
   * 统计待审批数量
   *
   * GET /api/mobile/{factoryId}/config-changes/pending/count
   */
  async countPendingChangeSets(factoryId?: string): Promise<number> {
    const response = await apiClient.get<ApiResponse<{ count: number }>>(
      `${this.getPath(factoryId)}/pending/count`
    );

    if (response.success && response.data) {
      return response.data.count;
    }

    return 0;
  }

  /**
   * 获取可回滚的变更集列表
   *
   * GET /api/mobile/{factoryId}/config-changes/rollbackable
   */
  async getRollbackableChangeSets(factoryId?: string): Promise<ConfigChangeSet[]> {
    const response = await apiClient.get<ApiResponse<ConfigChangeSet[]>>(
      `${this.getPath(factoryId)}/rollbackable`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }

  /**
   * 获取变更集详情
   *
   * GET /api/mobile/{factoryId}/config-changes/{id}
   */
  async getChangeSetById(
    id: string,
    factoryId?: string
  ): Promise<ConfigChangeSet> {
    const response = await apiClient.get<ApiResponse<ConfigChangeSet>>(
      `${this.getPath(factoryId)}/${id}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '获取变更集失败');
    }

    return response.data;
  }

  /**
   * 预览变更差异
   *
   * GET /api/mobile/{factoryId}/config-changes/{id}/preview
   */
  async previewDiff(
    id: string,
    factoryId?: string
  ): Promise<DiffPreviewResult> {
    const response = await apiClient.get<ApiResponse<DiffPreviewResult>>(
      `${this.getPath(factoryId)}/${id}/preview`
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '获取差异预览失败');
    }

    return response.data;
  }

  /**
   * 获取配置的变更历史
   *
   * GET /api/mobile/{factoryId}/config-changes/history/{configType}/{configId}
   */
  async getChangeHistory(
    configType: ConfigType,
    configId: string,
    factoryId?: string
  ): Promise<ConfigChangeSet[]> {
    const response = await apiClient.get<ApiResponse<ConfigChangeSet[]>>(
      `${this.getPath(factoryId)}/history/${configType}/${configId}`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }

  /**
   * 按配置类型统计各状态数量
   *
   * GET /api/mobile/{factoryId}/config-changes/statistics/{configType}
   */
  async getStatusStatistics(
    configType: ConfigType,
    factoryId?: string
  ): Promise<Record<string, number>> {
    const response = await apiClient.get<ApiResponse<Record<string, number>>>(
      `${this.getPath(factoryId)}/statistics/${configType}`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return {};
  }

  // ========== Dry-Run 预览 ==========

  /**
   * Dry-run 预览变更效果
   * 在创建 ChangeSet 之前，预览即将产生的差异和潜在问题
   *
   * POST /api/mobile/{factoryId}/config-changes/dry-run
   *
   * @param request 预览请求
   * @param factoryId 工厂ID (可选)
   * @returns 预览结果，包含差异、摘要和警告
   */
  async dryRun(
    request: DryRunRequest,
    factoryId?: string
  ): Promise<DryRunResult> {
    const response = await apiClient.post<ApiResponse<DryRunResult>>(
      `${this.getPath(factoryId)}/dry-run`,
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Dry-run 预览失败');
    }

    return response.data;
  }

  // ========== 创建 ==========

  /**
   * 创建配置变更集
   *
   * POST /api/mobile/{factoryId}/config-changes
   */
  async createChangeSet(
    request: CreateChangeSetRequest,
    factoryId?: string
  ): Promise<ConfigChangeSet> {
    const response = await apiClient.post<ApiResponse<ConfigChangeSet>>(
      this.getPath(factoryId),
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '创建变更集失败');
    }

    return response.data;
  }

  // ========== 审批 ==========

  /**
   * 审批通过变更集
   *
   * POST /api/mobile/{factoryId}/config-changes/{id}/approve
   */
  async approveChangeSet(
    id: string,
    request: ApprovalRequest = {},
    factoryId?: string
  ): Promise<ConfigChangeSet> {
    const response = await apiClient.post<ApiResponse<ConfigChangeSet>>(
      `${this.getPath(factoryId)}/${id}/approve`,
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '审批失败');
    }

    return response.data;
  }

  /**
   * 拒绝变更集
   *
   * POST /api/mobile/{factoryId}/config-changes/{id}/reject
   */
  async rejectChangeSet(
    id: string,
    request: RejectRequest,
    factoryId?: string
  ): Promise<ConfigChangeSet> {
    const response = await apiClient.post<ApiResponse<ConfigChangeSet>>(
      `${this.getPath(factoryId)}/${id}/reject`,
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '拒绝失败');
    }

    return response.data;
  }

  // ========== 应用与回滚 ==========

  /**
   * 应用变更集
   *
   * POST /api/mobile/{factoryId}/config-changes/{id}/apply
   */
  async applyChangeSet(
    id: string,
    factoryId?: string
  ): Promise<ConfigChangeSet> {
    const response = await apiClient.post<ApiResponse<ConfigChangeSet>>(
      `${this.getPath(factoryId)}/${id}/apply`
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '应用变更失败');
    }

    return response.data;
  }

  /**
   * 回滚变更集
   *
   * POST /api/mobile/{factoryId}/config-changes/{id}/rollback
   */
  async rollbackChangeSet(
    id: string,
    request: RollbackRequest,
    factoryId?: string
  ): Promise<ConfigChangeSet> {
    const response = await apiClient.post<ApiResponse<ConfigChangeSet>>(
      `${this.getPath(factoryId)}/${id}/rollback`,
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '回滚失败');
    }

    return response.data;
  }

  // ========== 辅助方法 ==========

  /**
   * 获取配置类型的中文名称
   */
  getConfigTypeName(configType: ConfigType): string {
    const names: Record<ConfigType, string> = {
      FORM_TEMPLATE: '表单模板',
      DROOLS_RULE: '业务规则',
      APPROVAL_CHAIN: '审批链',
      QUALITY_RULE: '质检规则',
      CONVERSION_RATE: '转换率',
      FACTORY_CAPACITY: '产能配置',
      OTHER: '其他配置',
    };
    return names[configType] || configType;
  }

  /**
   * 获取状态的中文名称
   */
  getStatusName(status: ChangeStatus): string {
    const names: Record<ChangeStatus, string> = {
      PENDING: '待审批',
      APPROVED: '已审批',
      APPLIED: '已应用',
      REJECTED: '已拒绝',
      ROLLED_BACK: '已回滚',
      EXPIRED: '已过期',
    };
    return names[status] || status;
  }

  /**
   * 获取状态的颜色
   */
  getStatusColor(status: ChangeStatus): string {
    const colors: Record<ChangeStatus, string> = {
      PENDING: '#FFA500',    // 橙色
      APPROVED: '#4CAF50',   // 绿色
      APPLIED: '#2196F3',    // 蓝色
      REJECTED: '#F44336',   // 红色
      ROLLED_BACK: '#9E9E9E', // 灰色
      EXPIRED: '#9E9E9E',    // 灰色
    };
    return colors[status] || '#9E9E9E';
  }
}

export const configChangeSetApiClient = new ConfigChangeSetApiClient();
export default configChangeSetApiClient;
