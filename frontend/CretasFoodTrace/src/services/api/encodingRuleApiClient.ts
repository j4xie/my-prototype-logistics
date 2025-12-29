import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 编码规则配置 API 客户端
 *
 * 用于管理各类业务单据的编号生成规则
 * 支持前缀、日期格式、序列号、重置周期等配置
 *
 * 路径: /api/mobile/{factoryId}/encoding-rules/*
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */

// ========== 类型定义 ==========

/**
 * 实体类型
 * 每种类型对应一种业务单据
 */
export type EncodingEntityType =
  | 'MATERIAL_BATCH'      // 原材料批次
  | 'PROCESSING_BATCH'    // 加工批次
  | 'SHIPMENT'            // 出货记录
  | 'QUALITY_INSPECTION'  // 质检记录
  | 'DISPOSAL_RECORD'     // 处置记录
  | 'EQUIPMENT'           // 设备
  | 'PRODUCTION_PLAN'     // 生产计划
  | 'TIMECLOCK_RECORD';   // 考勤记录

/**
 * 序列号重置周期
 */
export type ResetCycle = 'DAILY' | 'MONTHLY' | 'YEARLY' | 'NEVER';

/**
 * 编码规则配置
 */
export interface EncodingRule {
  /** 规则ID */
  id: string;
  /** 工厂ID (null 表示系统默认规则) */
  factoryId: string | null;
  /** 实体类型 */
  entityType: EncodingEntityType;
  /** 规则名称 */
  ruleName: string;
  /** 规则描述 */
  ruleDescription?: string;
  /**
   * 编码模板
   * 支持占位符:
   * - {PREFIX} - 固定前缀
   * - {FACTORY} - 工厂代码
   * - {YYYY} - 4位年份
   * - {YY} - 2位年份
   * - {MM} - 2位月份
   * - {DD} - 2位日期
   * - {SEQ:N} - N位序列号（自动补零）
   * - {DEPT} - 部门代码
   * - {TYPE} - 类型代码
   * - {PRODUCT} - 产品代码
   * - {LINE} - 生产线代码
   *
   * 示例: MB-{FACTORY}-{YYYYMMDD}-{SEQ:4} → MB-F001-20251229-0001
   */
  encodingPattern: string;
  /** 固定前缀 (如: MB, PB, SH) */
  prefix?: string;
  /** 日期格式 (如: YYYYMMDD, YYYYMM, YYYY) */
  dateFormat?: string;
  /** 序列号长度 (默认4位) */
  sequenceLength: number;
  /** 重置周期 */
  resetCycle: ResetCycle;
  /** 当前序列号 */
  currentSequence: number;
  /** 最后重置日期 */
  lastResetDate?: string;
  /** 分隔符 (默认 -) */
  separator: string;
  /** 是否包含工厂代码 */
  includeFactoryCode: boolean;
  /** 是否启用 */
  enabled: boolean;
  /** 版本号 */
  version: number;
  /** 创建者用户ID */
  createdBy?: number;
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
}

/**
 * 创建编码规则请求
 */
export interface CreateEncodingRuleRequest {
  /** 实体类型 */
  entityType: EncodingEntityType;
  /** 规则名称 */
  ruleName: string;
  /** 规则描述 */
  ruleDescription?: string;
  /** 编码模板 */
  encodingPattern: string;
  /** 固定前缀 */
  prefix?: string;
  /** 日期格式 */
  dateFormat?: string;
  /** 序列号长度 */
  sequenceLength?: number;
  /** 重置周期 */
  resetCycle?: ResetCycle;
  /** 分隔符 */
  separator?: string;
  /** 是否包含工厂代码 */
  includeFactoryCode?: boolean;
}

/**
 * 更新编码规则请求
 */
export interface UpdateEncodingRuleRequest {
  /** 规则名称 */
  ruleName?: string;
  /** 规则描述 */
  ruleDescription?: string;
  /** 编码模板 */
  encodingPattern?: string;
  /** 固定前缀 */
  prefix?: string;
  /** 日期格式 */
  dateFormat?: string;
  /** 序列号长度 */
  sequenceLength?: number;
  /** 重置周期 */
  resetCycle?: ResetCycle;
  /** 分隔符 */
  separator?: string;
  /** 是否包含工厂代码 */
  includeFactoryCode?: boolean;
}

/**
 * 编码模板验证结果
 */
export interface PatternValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 错误信息 */
  errors: string[];
  /** 警告信息 */
  warnings: string[];
  /** 原始模板 */
  pattern: string;
}

/**
 * 占位符说明
 */
export interface PlaceholderInfo {
  /** 占位符 */
  placeholder: string;
  /** 描述 */
  description: string;
  /** 示例 */
  example: string;
}

/**
 * 实体类型信息
 */
export interface EntityTypeInfo {
  /** 类型代码 */
  code: EncodingEntityType;
  /** 类型名称 */
  name: string;
  /** 默认前缀 */
  defaultPrefix: string;
}

/**
 * 编码规则统计
 */
export interface EncodingRuleStatistics {
  /** 规则总数 */
  totalRules: number;
  /** 各实体类型的当前序列号 */
  rulesByEntityType: Record<string, number>;
  /** 系统默认规则数量 */
  systemDefaultRules: number;
}

/**
 * 分页响应
 */
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/**
 * API 标准响应
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// ========== API 客户端类 ==========

class EncodingRuleApiClient {
  private getBasePath(factoryId?: string): string {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/encoding-rules`;
  }

  // ========== 编码生成 ==========

  /**
   * 生成编码
   * 根据规则生成下一个编码，会消耗序号
   *
   * @param entityType 实体类型
   * @param context 上下文变量 (如: { DEPT: 'D01', TYPE: 'A' })
   * @param factoryId 工厂ID (可选)
   * @returns 生成的编码
   */
  async generateCode(
    entityType: EncodingEntityType,
    context?: Record<string, string>,
    factoryId?: string
  ): Promise<string> {
    const response = await apiClient.post<ApiResponse<{ code: string }>>(
      `${this.getBasePath(factoryId)}/generate/${entityType}`,
      context ?? {}
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '生成编码失败');
    }

    return response.data.code;
  }

  /**
   * 预览编码
   * 预览下一个编码，不消耗序号
   *
   * @param entityType 实体类型
   * @param factoryId 工厂ID (可选)
   * @returns 预览的编码
   */
  async previewCode(
    entityType: EncodingEntityType,
    factoryId?: string
  ): Promise<string> {
    const response = await apiClient.get<ApiResponse<{ code: string }>>(
      `${this.getBasePath(factoryId)}/preview/${entityType}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '预览编码失败');
    }

    return response.data.code;
  }

  // ========== 规则 CRUD ==========

  /**
   * 获取编码规则列表
   *
   * @param params 分页参数
   * @param factoryId 工厂ID (可选)
   * @returns 分页规则列表
   */
  async getRules(
    params?: { page?: number; size?: number },
    factoryId?: string
  ): Promise<PageResponse<EncodingRule>> {
    const { page = 1, size = 20 } = params ?? {};
    const response = await apiClient.get<ApiResponse<PageResponse<EncodingRule>>>(
      this.getBasePath(factoryId),
      { params: { page, size } }
    );

    if (response.success && response.data) {
      return response.data;
    }

    return {
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: page - 1,
      size,
    };
  }

  /**
   * 获取单个编码规则
   *
   * @param ruleId 规则ID
   * @param factoryId 工厂ID (可选)
   * @returns 编码规则或 null
   */
  async getRuleById(
    ruleId: string,
    factoryId?: string
  ): Promise<EncodingRule | null> {
    try {
      const response = await apiClient.get<ApiResponse<EncodingRule>>(
        `${this.getBasePath(factoryId)}/${ruleId}`
      );

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 获取指定实体类型的编码规则
   *
   * @param entityType 实体类型
   * @param factoryId 工厂ID (可选)
   * @returns 编码规则或 null
   */
  async getRuleByEntityType(
    entityType: EncodingEntityType,
    factoryId?: string
  ): Promise<EncodingRule | null> {
    try {
      const response = await apiClient.get<ApiResponse<EncodingRule>>(
        `${this.getBasePath(factoryId)}/entity-type/${entityType}`
      );

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 创建编码规则
   *
   * @param request 创建请求
   * @param factoryId 工厂ID (可选)
   * @returns 创建的规则
   */
  async createRule(
    request: CreateEncodingRuleRequest,
    factoryId?: string
  ): Promise<EncodingRule> {
    const response = await apiClient.post<ApiResponse<EncodingRule>>(
      this.getBasePath(factoryId),
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '创建编码规则失败');
    }

    return response.data;
  }

  /**
   * 更新编码规则
   *
   * @param ruleId 规则ID
   * @param request 更新请求
   * @param factoryId 工厂ID (可选)
   * @returns 更新后的规则
   */
  async updateRule(
    ruleId: string,
    request: UpdateEncodingRuleRequest,
    factoryId?: string
  ): Promise<EncodingRule> {
    const response = await apiClient.put<ApiResponse<EncodingRule>>(
      `${this.getBasePath(factoryId)}/${ruleId}`,
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '更新编码规则失败');
    }

    return response.data;
  }

  /**
   * 启用/禁用编码规则
   *
   * @param ruleId 规则ID
   * @param enabled 是否启用
   * @param factoryId 工厂ID (可选)
   * @returns 更新后的规则
   */
  async toggleEnabled(
    ruleId: string,
    enabled: boolean,
    factoryId?: string
  ): Promise<EncodingRule> {
    const response = await apiClient.put<ApiResponse<EncodingRule>>(
      `${this.getBasePath(factoryId)}/${ruleId}/enabled`,
      null,
      { params: { enabled } }
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '更新规则状态失败');
    }

    return response.data;
  }

  /**
   * 删除编码规则
   *
   * @param ruleId 规则ID
   * @param factoryId 工厂ID (可选)
   */
  async deleteRule(ruleId: string, factoryId?: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse<string>>(
      `${this.getBasePath(factoryId)}/${ruleId}`
    );

    if (!response.success) {
      throw new Error(response.message || '删除编码规则失败');
    }
  }

  /**
   * 重置序列号
   *
   * @param ruleId 规则ID
   * @param factoryId 工厂ID (可选)
   */
  async resetSequence(ruleId: string, factoryId?: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<string>>(
      `${this.getBasePath(factoryId)}/${ruleId}/reset-sequence`
    );

    if (!response.success) {
      throw new Error(response.message || '重置序列号失败');
    }
  }

  // ========== 工具接口 ==========

  /**
   * 验证编码模板
   *
   * @param pattern 编码模板
   * @param factoryId 工厂ID (可选)
   * @returns 验证结果
   */
  async validatePattern(
    pattern: string,
    factoryId?: string
  ): Promise<PatternValidationResult> {
    const response = await apiClient.post<ApiResponse<PatternValidationResult>>(
      `${this.getBasePath(factoryId)}/validate-pattern`,
      { pattern }
    );

    if (response.success && response.data) {
      return response.data;
    }

    return {
      isValid: false,
      errors: ['验证请求失败'],
      warnings: [],
      pattern,
    };
  }

  /**
   * 获取支持的占位符列表
   *
   * @param factoryId 工厂ID (可选)
   * @returns 占位符列表
   */
  async getPlaceholders(factoryId?: string): Promise<PlaceholderInfo[]> {
    const response = await apiClient.get<ApiResponse<PlaceholderInfo[]>>(
      `${this.getBasePath(factoryId)}/placeholders`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }

  /**
   * 获取实体类型列表
   *
   * @param factoryId 工厂ID (可选)
   * @returns 实体类型列表
   */
  async getEntityTypes(factoryId?: string): Promise<EntityTypeInfo[]> {
    const response = await apiClient.get<ApiResponse<EntityTypeInfo[]>>(
      `${this.getBasePath(factoryId)}/entity-types`
    );

    if (response.success && response.data) {
      return response.data;
    }

    // 返回默认列表
    return [
      { code: 'MATERIAL_BATCH', name: '原材料批次', defaultPrefix: 'MB' },
      { code: 'PROCESSING_BATCH', name: '加工批次', defaultPrefix: 'PB' },
      { code: 'SHIPMENT', name: '出货记录', defaultPrefix: 'SH' },
      { code: 'QUALITY_INSPECTION', name: '质检记录', defaultPrefix: 'QI' },
      { code: 'DISPOSAL_RECORD', name: '处置记录', defaultPrefix: 'DR' },
      { code: 'EQUIPMENT', name: '设备', defaultPrefix: 'EQ' },
      { code: 'PRODUCTION_PLAN', name: '生产计划', defaultPrefix: 'PP' },
      { code: 'TIMECLOCK_RECORD', name: '考勤记录', defaultPrefix: 'TC' },
    ];
  }

  /**
   * 获取编码规则统计
   *
   * @param factoryId 工厂ID (可选)
   * @returns 统计信息
   */
  async getStatistics(factoryId?: string): Promise<EncodingRuleStatistics> {
    const response = await apiClient.get<ApiResponse<EncodingRuleStatistics>>(
      `${this.getBasePath(factoryId)}/statistics`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return {
      totalRules: 0,
      rulesByEntityType: {},
      systemDefaultRules: 0,
    };
  }

  /**
   * 获取系统默认规则
   *
   * @param factoryId 工厂ID (可选)
   * @returns 系统默认规则列表
   */
  async getSystemDefaults(factoryId?: string): Promise<EncodingRule[]> {
    const response = await apiClient.get<ApiResponse<EncodingRule[]>>(
      `${this.getBasePath(factoryId)}/system-defaults`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }
}

export const encodingRuleApiClient = new EncodingRuleApiClient();
export default encodingRuleApiClient;
