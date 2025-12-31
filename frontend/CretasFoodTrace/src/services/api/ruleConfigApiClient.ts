import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 规则配置 API 客户端
 *
 * 用于管理 Drools 规则和状态机配置
 * 包括 AI 辅助的自然语言规则生成功能
 *
 * 路径:
 * - 规则管理: /api/mobile/{factoryId}/rules/*
 * - AI解析: /api/mobile/{factoryId}/ai-rules/*
 */

// ========== 类型定义 ==========

/**
 * 规则组类型
 */
export type RuleGroup = 'validation' | 'workflow' | 'costing' | 'quality' | 'alert';

/**
 * 实体类型
 */
export type EntityType =
  | 'MaterialBatch'
  | 'ProcessingBatch'
  | 'QualityInspection'
  | 'Shipment'
  | 'Equipment'
  | 'DisposalRecord';

/**
 * Drools 规则
 */
export interface DroolsRule {
  id: string;
  factoryId: string;
  ruleGroup: RuleGroup;
  ruleName: string;
  ruleDescription?: string;
  ruleContent: string;
  priority: number;
  enabled: boolean;
  version: number;
  createdBy?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 创建规则请求
 */
export interface CreateRuleRequest {
  ruleGroup: RuleGroup;
  ruleName: string;
  ruleDescription?: string;
  ruleContent: string;
  priority?: number;
  enabled?: boolean;
}

/**
 * 更新规则请求
 */
export interface UpdateRuleRequest {
  ruleName?: string;
  ruleDescription?: string;
  ruleContent?: string;
  priority?: number;
}

/**
 * 状态定义
 */
export interface StateDefinition {
  code: string;
  name: string;
  description?: string;
  color?: string;
  isFinal?: boolean;
}

/**
 * 状态转换定义
 */
export interface TransitionDefinition {
  fromState: string;
  toState: string;
  event: string;
  guard?: string;
  action?: string;
  description?: string;
}

/**
 * 状态机配置
 */
export interface StateMachineConfig {
  id?: string;
  factoryId: string;
  entityType: string;
  machineName: string;
  machineDescription?: string;
  initialState: string;
  states: StateDefinition[];
  transitions: TransitionDefinition[];
  enabled: boolean;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * AI 规则解析请求
 */
export interface AIRuleParseRequest {
  userInput: string;
  ruleGroup?: RuleGroup;
  entityType?: EntityType;
  context?: Record<string, unknown>;
}

/**
 * AI 规则解析响应
 */
export interface AIRuleParseResponse {
  success: boolean;
  ruleName: string;
  ruleDescription: string;
  drlContent: string;
  ruleGroup: RuleGroup;
  priority: number;
  entityTypes: string[];
  aiExplanation: string;
  suggestions: string[];
  message: string;
}

/**
 * AI 状态机解析请求
 */
export interface AIStateMachineParseRequest {
  userInput: string;
  entityType: EntityType;
  context?: Record<string, unknown>;
}

/**
 * AI 状态机解析响应
 */
export interface AIStateMachineParseResponse {
  success: boolean;
  machineName: string;
  machineDescription: string;
  initialState: string;
  states: StateDefinition[];
  transitions: TransitionDefinition[];
  aiExplanation: string;
  suggestions: string[];
  message: string;
}

/**
 * 规则验证结果
 */
export interface RuleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Dry-Run 请求
 */
export interface DryRunRequest {
  /** DRL 规则内容 (完整的 Drools 规则定义) */
  ruleContent: string;
  /** 实体类型 (如 MATERIAL_BATCH, PROCESSING_BATCH) */
  entityType?: string;
  /** Hook 触发点 (如 beforeCreate, beforeSubmit) */
  hookPoint?: string;
  /** 测试数据 - 用于规则执行的事实对象 */
  testData?: Record<string, unknown>;
}

/**
 * Dry-Run 响应
 */
export interface DryRunResult {
  /** 是否执行成功 */
  success: boolean;
  /** 匹配到的规则名称列表 */
  rulesMatched: string[];
  /** 规则执行结果 (如 ALLOW, DENY, CONTINUE) */
  result: string;
  /** 触发的规则数量 */
  firedCount: number;
  /** 模拟的数据变更 */
  simulatedChanges: Record<string, unknown>;
  /** 验证错误 */
  validationErrors?: string[];
  /** 警告信息 */
  warnings?: string[];
  /** 执行时间 (毫秒) */
  executionTimeMs?: number;
  /** 工厂ID */
  factoryId?: string;
  /** 实体类型 */
  entityType?: string;
  /** Hook 触发点 */
  hookPoint?: string;
  /** 时间戳 */
  timestamp?: string;
  /** 错误信息 (执行失败时) */
  error?: string;
}

/**
 * 规则执行结果
 */
export interface RuleExecutionResult {
  success: boolean;
  rulesExecuted: number;
  results: Record<string, unknown>[];
  message: string;
}

/**
 * 规则引擎统计
 */
export interface RuleEngineStatistics {
  totalRules: number;
  enabledRules: number;
  rulesByGroup: Record<RuleGroup, number>;
  stateMachines: number;
  lastReloadTime?: string;
}

/**
 * 分页响应
 */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
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

class RuleConfigApiClient {
  private getRulePath(factoryId?: string): string {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/rules`;
  }

  private getAIRulePath(factoryId?: string): string {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/ai-rules`;
  }

  // ========== 规则 CRUD ==========

  /**
   * 获取规则列表
   */
  async getRules(
    params?: {
      page?: number;
      size?: number;
      ruleGroup?: RuleGroup;
      enabled?: boolean;
    },
    factoryId?: string
  ): Promise<PageResponse<DroolsRule>> {
    const { page = 1, size = 10, ...rest } = params || {};
    const response = await apiClient.get<ApiResponse<PageResponse<DroolsRule>>>(
      this.getRulePath(factoryId),
      { params: { page, size, ...rest } }
    );

    if (response.success && response.data) {
      return response.data;
    }

    return {
      content: [],
      page,
      size,
      totalElements: 0,
      totalPages: 0,
    };
  }

  /**
   * 按规则组获取规则
   */
  async getRulesByGroup(
    ruleGroup: RuleGroup,
    factoryId?: string
  ): Promise<DroolsRule[]> {
    const response = await apiClient.get<ApiResponse<DroolsRule[]>>(
      `${this.getRulePath(factoryId)}/group/${ruleGroup}`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }

  /**
   * 获取单个规则
   */
  async getRuleById(id: string, factoryId?: string): Promise<DroolsRule | null> {
    try {
      const response = await apiClient.get<ApiResponse<DroolsRule>>(
        `${this.getRulePath(factoryId)}/${id}`
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
   * 创建规则
   */
  async createRule(
    request: CreateRuleRequest,
    factoryId?: string
  ): Promise<DroolsRule> {
    const response = await apiClient.post<ApiResponse<DroolsRule>>(
      this.getRulePath(factoryId),
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '创建规则失败');
    }

    return response.data;
  }

  /**
   * 更新规则
   */
  async updateRule(
    id: string,
    request: UpdateRuleRequest,
    factoryId?: string
  ): Promise<DroolsRule> {
    const response = await apiClient.put<ApiResponse<DroolsRule>>(
      `${this.getRulePath(factoryId)}/${id}`,
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '更新规则失败');
    }

    return response.data;
  }

  /**
   * 启用/禁用规则
   */
  async toggleRuleEnabled(
    id: string,
    enabled: boolean,
    factoryId?: string
  ): Promise<DroolsRule> {
    const response = await apiClient.put<ApiResponse<DroolsRule>>(
      `${this.getRulePath(factoryId)}/${id}/enabled`,
      null,
      { params: { enabled } }
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '更新规则状态失败');
    }

    return response.data;
  }

  /**
   * 删除规则
   */
  async deleteRule(id: string, factoryId?: string): Promise<void> {
    await apiClient.delete(`${this.getRulePath(factoryId)}/${id}`);
  }

  // ========== 规则验证和执行 ==========

  /**
   * 验证 DRL 语法
   */
  async validateDRL(
    drlContent: string,
    factoryId?: string
  ): Promise<RuleValidationResult> {
    const response = await apiClient.post<ApiResponse<RuleValidationResult>>(
      `${this.getRulePath(factoryId)}/validate`,
      { drlContent }
    );

    if (response.success && response.data) {
      return response.data;
    }

    return {
      isValid: false,
      errors: ['验证请求失败'],
      warnings: [],
    };
  }

  /**
   * 测试规则执行
   */
  async testRule(
    ruleId: string,
    testData: Record<string, unknown>,
    factoryId?: string
  ): Promise<RuleExecutionResult> {
    const response = await apiClient.post<ApiResponse<RuleExecutionResult>>(
      `${this.getRulePath(factoryId)}/${ruleId}/test`,
      testData
    );

    if (response.success && response.data) {
      return response.data;
    }

    return {
      success: false,
      rulesExecuted: 0,
      results: [],
      message: '测试失败',
    };
  }

  /**
   * 重新加载规则
   */
  async reloadRules(ruleGroup?: RuleGroup, factoryId?: string): Promise<void> {
    await apiClient.post(
      `${this.getRulePath(factoryId)}/reload`,
      null,
      { params: ruleGroup ? { ruleGroup } : undefined }
    );
  }

  /**
   * Dry-Run 规则执行 (沙箱环境)
   *
   * 在不保存规则的情况下测试规则效果
   * 用于规则发布前预览执行结果
   *
   * POST /api/mobile/{factoryId}/rules/dry-run
   */
  async dryRun(
    request: DryRunRequest,
    factoryId?: string
  ): Promise<DryRunResult> {
    if (!request.ruleContent || request.ruleContent.trim() === '') {
      return {
        success: false,
        rulesMatched: [],
        result: 'ERROR',
        firedCount: 0,
        simulatedChanges: {},
        validationErrors: ['规则内容不能为空'],
        warnings: [],
      };
    }

    try {
      const response = await apiClient.post<ApiResponse<DryRunResult>>(
        `${this.getRulePath(factoryId)}/dry-run`,
        request
      );

      if (response.success && response.data) {
        return response.data;
      }

      return {
        success: false,
        rulesMatched: [],
        result: 'ERROR',
        firedCount: 0,
        simulatedChanges: {},
        validationErrors: [response.message || 'Dry-Run 执行失败'],
        warnings: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Dry-Run 请求失败';
      return {
        success: false,
        rulesMatched: [],
        result: 'ERROR',
        firedCount: 0,
        simulatedChanges: {},
        error: errorMessage,
        validationErrors: [errorMessage],
        warnings: [],
      };
    }
  }

  // ========== 状态机 CRUD ==========

  /**
   * 获取状态机列表
   */
  async getStateMachines(factoryId?: string): Promise<StateMachineConfig[]> {
    const response = await apiClient.get<ApiResponse<StateMachineConfig[]>>(
      `${this.getRulePath(factoryId)}/state-machines`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }

  /**
   * 获取指定实体类型的状态机
   */
  async getStateMachine(
    entityType: EntityType,
    factoryId?: string
  ): Promise<StateMachineConfig | null> {
    try {
      const response = await apiClient.get<ApiResponse<StateMachineConfig>>(
        `${this.getRulePath(factoryId)}/state-machines/${entityType}`
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
   * 保存状态机配置
   */
  async saveStateMachine(
    entityType: EntityType,
    config: Partial<StateMachineConfig>,
    factoryId?: string
  ): Promise<StateMachineConfig> {
    const response = await apiClient.put<ApiResponse<StateMachineConfig>>(
      `${this.getRulePath(factoryId)}/state-machines/${entityType}`,
      config
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || '保存状态机失败');
    }

    return response.data;
  }

  /**
   * 删除状态机配置
   */
  async deleteStateMachine(entityType: EntityType, factoryId?: string): Promise<void> {
    await apiClient.delete(`${this.getRulePath(factoryId)}/state-machines/${entityType}`);
  }

  /**
   * 获取可用状态转换
   */
  async getAvailableTransitions(
    entityType: EntityType,
    currentState: string,
    factoryId?: string
  ): Promise<TransitionDefinition[]> {
    const response = await apiClient.get<ApiResponse<TransitionDefinition[]>>(
      `${this.getRulePath(factoryId)}/state-machines/${entityType}/transitions`,
      { params: { currentState } }
    );

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }

  // ========== AI 规则解析 ==========

  /**
   * AI 解析自然语言生成 DRL 规则
   */
  async parseRule(
    request: AIRuleParseRequest,
    factoryId?: string
  ): Promise<AIRuleParseResponse> {
    const response = await apiClient.post<ApiResponse<AIRuleParseResponse>>(
      `${this.getAIRulePath(factoryId)}/parse-rule`,
      request
    );

    if (response.success && response.data) {
      return response.data;
    }

    return {
      success: false,
      ruleName: '',
      ruleDescription: '',
      drlContent: '',
      ruleGroup: 'validation',
      priority: 10,
      entityTypes: [],
      aiExplanation: '',
      suggestions: [],
      message: response.message || 'AI 解析失败',
    };
  }

  /**
   * AI 解析并保存规则
   */
  async parseAndSaveRule(
    request: AIRuleParseRequest,
    factoryId?: string
  ): Promise<DroolsRule> {
    const response = await apiClient.post<ApiResponse<DroolsRule>>(
      `${this.getAIRulePath(factoryId)}/parse-and-save-rule`,
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || 'AI 解析并保存失败');
    }

    return response.data;
  }

  /**
   * AI 解析自然语言生成状态机配置
   */
  async parseStateMachine(
    request: AIStateMachineParseRequest,
    factoryId?: string
  ): Promise<AIStateMachineParseResponse> {
    const response = await apiClient.post<ApiResponse<AIStateMachineParseResponse>>(
      `${this.getAIRulePath(factoryId)}/parse-state-machine`,
      request
    );

    if (response.success && response.data) {
      return response.data;
    }

    return {
      success: false,
      machineName: '',
      machineDescription: '',
      initialState: '',
      states: [],
      transitions: [],
      aiExplanation: '',
      suggestions: [],
      message: response.message || 'AI 解析失败',
    };
  }

  /**
   * AI 解析并保存状态机
   */
  async parseAndSaveStateMachine(
    request: AIStateMachineParseRequest,
    factoryId?: string
  ): Promise<StateMachineConfig> {
    const response = await apiClient.post<ApiResponse<StateMachineConfig>>(
      `${this.getAIRulePath(factoryId)}/parse-and-save-state-machine`,
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || 'AI 解析并保存失败');
    }

    return response.data;
  }

  // ========== 统计和健康检查 ==========

  /**
   * 获取规则引擎统计
   */
  async getStatistics(factoryId?: string): Promise<RuleEngineStatistics> {
    const response = await apiClient.get<ApiResponse<RuleEngineStatistics>>(
      `${this.getRulePath(factoryId)}/statistics`
    );

    if (response.success && response.data) {
      return response.data;
    }

    return {
      totalRules: 0,
      enabledRules: 0,
      rulesByGroup: {
        validation: 0,
        workflow: 0,
        costing: 0,
        quality: 0,
        alert: 0,
      },
      stateMachines: 0,
    };
  }

  /**
   * AI 规则服务健康检查
   */
  async checkAIHealth(factoryId?: string): Promise<{
    aiServiceAvailable: boolean;
    ruleEngineStatus: RuleEngineStatistics;
  }> {
    const response = await apiClient.get<
      ApiResponse<{
        aiServiceAvailable: boolean;
        ruleEngineStatus: RuleEngineStatistics;
      }>
    >(`${this.getAIRulePath(factoryId)}/health`);

    if (response.success && response.data) {
      return response.data;
    }

    return {
      aiServiceAvailable: false,
      ruleEngineStatus: {
        totalRules: 0,
        enabledRules: 0,
        rulesByGroup: {
          validation: 0,
          workflow: 0,
          costing: 0,
          quality: 0,
          alert: 0,
        },
        stateMachines: 0,
      },
    };
  }
}

export const ruleConfigApiClient = new RuleConfigApiClient();
export default ruleConfigApiClient;
