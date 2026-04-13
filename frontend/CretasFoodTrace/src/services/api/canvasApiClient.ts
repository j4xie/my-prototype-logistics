/**
 * canvasApiClient.ts — Canvas V3 配置消费 (Round 4 Fix P1-9)
 *
 * RN 移动端消费 Canvas 动态字段配置。老板/车间工人在手机上能看到平台管理员
 * 在 Canvas 里配的自定义字段和规则。
 *
 * 之前 RN 报表是硬编码 DTO, 与 Canvas 完全解耦。
 */
import { apiClient } from './apiClient';
import { logger } from '../../utils/logger';

const canvasLogger = logger.createContextLogger('CanvasApi');

export type DynamicFieldType =
  | 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DECIMAL' | 'SELECT'
  | 'DATE' | 'DATETIME' | 'BOOLEAN'
  | 'ATTACHMENT' | 'SUB_TABLE';

export interface EffectiveField {
  code: string;
  label: string;
  type: string;
  required: boolean;
  visible: boolean;
  readonly: boolean;
  defaultValue: any;
  options: any;
  group: string;
  order: number;
  extra?: Record<string, any>;
  visibleWhen?: string;
  computedWhen?: string;
  source: 'jpa' | 'dynamic';
}

export interface EffectiveModuleConfig {
  moduleCode: string;
  moduleName: string;
  enabled: boolean;
  fields: EffectiveField[];
  groups: Array<{ code: string; label: string; order: number; visible: boolean }>;
  workflowStates?: any[];
  workflowTransitions?: any[];
  renderingMode: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  success: boolean;
}

class CanvasApiClient {
  /** 获取模块的合并有效配置 (包含动态字段) */
  async getEffectiveConfig(
    factoryId: string,
    moduleCode: string,
    roleCode?: string
  ): Promise<EffectiveModuleConfig | null> {
    try {
      const params = roleCode ? { roleCode } : {};
      const res = await apiClient.get<ApiResponse<EffectiveModuleConfig>>(
        `/mobile/${factoryId}/config/modules/${moduleCode}/effective`,
        { params }
      );
      return res.success ? res.data : null;
    } catch (e: any) {
      canvasLogger.warn(`Failed to load effective config for ${moduleCode}`, e?.message);
      return null;
    }
  }

  /** 获取工厂所有启用的模块 */
  async getModules(factoryId: string): Promise<any[]> {
    try {
      const res = await apiClient.get<ApiResponse<any[]>>(`/mobile/${factoryId}/config/modules`);
      return res.success ? res.data : [];
    } catch (e) {
      return [];
    }
  }

  /** 获取记录的动态字段值 */
  async getCustomFields(
    factoryId: string,
    moduleCode: string,
    recordId: string
  ): Promise<Record<string, any>> {
    try {
      const res = await apiClient.get<ApiResponse<Record<string, any>>>(
        `/mobile/${factoryId}/${moduleCode}/${recordId}/custom-fields`
      );
      return res.success ? (res.data || {}) : {};
    } catch (e) {
      return {};
    }
  }

  /** 获取 Sub-table 行 */
  async getSubTableRows(
    factoryId: string,
    moduleCode: string,
    recordId: string,
    fieldCode: string,
    filters?: Record<string, string>
  ): Promise<any[]> {
    try {
      const res = await apiClient.get<ApiResponse<any[]>>(
        `/mobile/${factoryId}/${moduleCode}/${recordId}/sub-table/${fieldCode}`,
        { params: filters }
      );
      return res.success ? (res.data || []) : [];
    } catch (e) {
      return [];
    }
  }

  /** 过滤只保留动态字段 */
  filterDynamicFields(config: EffectiveModuleConfig | null): EffectiveField[] {
    if (!config) return [];
    return config.fields.filter(f => f.source === 'dynamic' && f.visible);
  }
}

export const canvasApiClient = new CanvasApiClient();
