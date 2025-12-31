import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';
import { EntityType } from './formTemplateApiClient';

/**
 * AI表单助手API客户端
 *
 * 提供AI辅助表单填写功能:
 * - 语音/文本输入 → AI解析 → 表单字段值
 * - 图片OCR → 结构化数据 → 表单字段值
 *
 * 路径: /api/mobile/{factoryId}/form-assistant/*
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */

// ========== 类型定义 ==========

/**
 * 枚举选项
 */
export interface EnumOption {
  label: string;
  value: string;
}

/**
 * 表单字段定义
 * 用于告诉AI可以填充哪些字段
 */
export interface FormFieldDefinition {
  /** 字段名 (对应表单字段的key) */
  name: string;
  /** 字段标题 (显示名称) */
  title: string;
  /** 字段类型: string, number, boolean, date, enum */
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'array';
  /** 字段描述 (帮助AI理解字段用途) */
  description?: string;
  /** 枚举选项 (仅当 type === 'enum' 时) */
  enumOptions?: EnumOption[];
  /** 是否必填 */
  required?: boolean;
}

/**
 * 表单解析请求
 */
export interface FormParseRequest {
  /** 用户输入 (文本或语音转文字) */
  userInput: string;
  /** 实体类型 */
  entityType: EntityType;
  /** 表单字段定义列表 (可选，帮助AI更准确地识别) */
  formFields?: FormFieldDefinition[];
  /** 上下文信息 (如当前工厂名称、常用供应商等) */
  context?: Record<string, unknown>;
}

/**
 * 表单解析响应
 */
export interface FormParseResponse {
  /** 是否成功 */
  success: boolean;
  /** 解析出的字段值 */
  fieldValues: Record<string, unknown>;
  /** 置信度 (0-1) */
  confidence: number;
  /** 无法解析的文本 */
  unparsedText?: string;
  /** 消息/提示 */
  message?: string;

  // P1-1: 缺字段自动追问
  /** 缺失的必填字段名列表 */
  missingRequiredFields?: string[];
  /** AI生成的追问问题列表 */
  suggestedQuestions?: string[];
  /** 主要追问问题 (便于简单场景使用) */
  followUpQuestion?: string;
}

/**
 * OCR解析请求
 */
export interface OCRParseRequest {
  /** 图片的Base64编码 */
  imageBase64: string;
  /** 实体类型 */
  entityType: EntityType;
  /** 表单字段定义列表 */
  formFields?: FormFieldDefinition[];
}

/**
 * OCR解析响应
 */
export interface OCRParseResponse {
  /** 是否成功 */
  success: boolean;
  /** OCR提取的原始文本 */
  extractedText?: string;
  /** 解析出的字段值 */
  fieldValues: Record<string, unknown>;
  /** 置信度 (0-1) */
  confidence: number;
  /** 消息/提示 */
  message?: string;
}

/**
 * Schema字段定义 (AI生成)
 */
export interface SchemaFieldDefinition {
  /** 字段名 (英文) */
  name: string;
  /** 字段标题 (中文) */
  title: string;
  /** 字段类型 */
  type: 'string' | 'number' | 'boolean' | 'array';
  /** Formily 组件 */
  'x-component': string;
  /** 组件属性 */
  'x-component-props'?: Record<string, unknown>;
  /** 装饰器 */
  'x-decorator'?: string;
  /** 装饰器属性 */
  'x-decorator-props'?: Record<string, unknown>;
  /** 验证规则 */
  'x-validator'?: Array<Record<string, unknown>>;
  /** 反应规则 */
  'x-reactions'?: Record<string, unknown>;
  /** 枚举选项 */
  enum?: Array<{ label: string; value: string }>;
  /** 是否必填 */
  required?: boolean;
  /** 字段描述 */
  description?: string;
  /**
   * 字段别名列表
   * 用于支持同一字段的不同叫法，如 ["投料重量", "投料净重", "原料重量"]
   * AI 表单解析时会同时匹配标题和别名
   */
  'x-aliases'?: string[];
}

/**
 * Schema生成请求
 */
export interface SchemaGenerateRequest {
  /** 用户自然语言描述 */
  userInput: string;
  /** 实体类型 */
  entityType: EntityType;
  /** 现有字段 (避免重复) */
  existingFields?: string[];
}

/**
 * Schema生成响应
 */
export interface SchemaGenerateResponse {
  /** 是否成功 */
  success: boolean;
  /** 生成的字段列表 */
  fields: SchemaFieldDefinition[];
  /** 验证规则 */
  validationRules?: Array<Record<string, unknown>>;
  /** 消息 */
  message?: string;
}

/**
 * 健康检查响应
 */
export interface FormAssistantHealthResponse {
  /** AI服务是否可用 */
  available: boolean;
  /** AI服务URL */
  serviceUrl: string;
  /** 服务信息 */
  serviceInfo?: Record<string, unknown>;
  /** 错误信息 (如果不可用) */
  error?: string;
}

/**
 * API标准响应包装
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// ========== 校验反馈类型 (Phase 1.2) ==========

/**
 * 校验错误
 * 表单提交失败时的单个错误信息
 */
export interface ValidationError {
  /** 字段名 */
  field: string;
  /** 错误消息 */
  message: string;
  /** 校验规则 (如 "required", "min", "max", "pattern") */
  rule?: string;
  /** 当前值 */
  currentValue?: unknown;
}

/**
 * 校验反馈请求
 * 将表单校验错误反馈给AI，获取修正建议
 */
export interface ValidationFeedbackRequest {
  /** 会话ID (用于多轮对话) */
  sessionId?: string;
  /** 实体类型 */
  entityType: EntityType;
  /** 表单字段定义 */
  formFields?: FormFieldDefinition[];
  /** 用户提交的值 */
  submittedValues: Record<string, unknown>;
  /** 校验错误列表 */
  validationErrors: ValidationError[];
  /** 用户补充说明 (可选) */
  userInstruction?: string;
}

/**
 * 校验反馈响应
 * AI返回的修正建议
 */
export interface ValidationFeedbackResponse {
  /** 是否成功 */
  success: boolean;
  /** 字段修正提示 (field -> hint) */
  correctionHints?: Record<string, string>;
  /** 修正后的值 (field -> correctedValue) */
  correctedValues?: Record<string, unknown>;
  /** AI解释说明 */
  explanation?: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 会话ID (用于继续对话) */
  sessionId?: string;
  /** 消息 */
  message?: string;
}

// ========== API客户端类 ==========

class FormAssistantApiClient {
  private getBasePath(factoryId?: string): string {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/form-assistant`;
  }

  /**
   * AI表单解析 - 文本/语音输入
   *
   * 将用户的自然语言输入解析为表单字段值
   *
   * 示例:
   * - 输入: "帮我填一个带鱼批次，500公斤，温度-20度"
   * - 输出: { materialType: "带鱼", quantity: 500, temperature: -20 }
   *
   * @param request 解析请求
   * @param factoryId 工厂ID (可选)
   * @returns 解析结果
   */
  async parseFormInput(
    request: FormParseRequest,
    factoryId?: string
  ): Promise<FormParseResponse> {
    try {
      const response = await apiClient.post<ApiResponse<FormParseResponse>>(
        `${this.getBasePath(factoryId)}/parse`,
        request
      );

      if (response.success && response.data) {
        return response.data;
      }

      // 兼容直接返回数据的情况
      if ('fieldValues' in response) {
        return response as unknown as FormParseResponse;
      }

      return {
        success: false,
        fieldValues: {},
        confidence: 0,
        message: response.message || 'AI解析失败',
      };
    } catch (error) {
      console.error('[FormAssistantApiClient] parseFormInput error:', error);
      return {
        success: false,
        fieldValues: {},
        confidence: 0,
        message: error instanceof Error ? error.message : 'AI服务暂时不可用',
      };
    }
  }

  /**
   * AI表单OCR解析 - 图片输入
   *
   * 从图片中提取文字并解析为表单字段值
   * 适用于送货单、质检报告等单据扫描
   *
   * @param request OCR解析请求
   * @param factoryId 工厂ID (可选)
   * @returns OCR解析结果
   */
  async parseFormOCR(
    request: OCRParseRequest,
    factoryId?: string
  ): Promise<OCRParseResponse> {
    try {
      const response = await apiClient.post<ApiResponse<OCRParseResponse>>(
        `${this.getBasePath(factoryId)}/ocr`,
        request
      );

      if (response.success && response.data) {
        return response.data;
      }

      // 兼容直接返回数据的情况
      if ('fieldValues' in response) {
        return response as unknown as OCRParseResponse;
      }

      return {
        success: false,
        fieldValues: {},
        confidence: 0,
        message: response.message || 'OCR解析失败',
      };
    } catch (error) {
      console.error('[FormAssistantApiClient] parseFormOCR error:', error);
      return {
        success: false,
        fieldValues: {},
        confidence: 0,
        message: error instanceof Error ? error.message : 'OCR服务暂时不可用',
      };
    }
  }

  /**
   * AI表单助手健康检查
   *
   * 检查AI服务是否可用
   *
   * @param factoryId 工厂ID (可选)
   * @returns 健康状态
   */
  async checkHealth(factoryId?: string): Promise<FormAssistantHealthResponse> {
    try {
      const response = await apiClient.get<ApiResponse<FormAssistantHealthResponse>>(
        `${this.getBasePath(factoryId)}/health`
      );

      if (response.success && response.data) {
        return response.data;
      }

      // 兼容直接返回数据的情况
      if ('available' in response) {
        return response as unknown as FormAssistantHealthResponse;
      }

      return {
        available: false,
        serviceUrl: '',
        error: response.message || '健康检查失败',
      };
    } catch (error) {
      console.error('[FormAssistantApiClient] checkHealth error:', error);
      return {
        available: false,
        serviceUrl: '',
        error: error instanceof Error ? error.message : '健康检查失败',
      };
    }
  }

  /**
   * AI生成Schema字段
   *
   * 根据用户自然语言描述生成 Formily Schema 字段定义
   *
   * 示例:
   * - 输入: "给质检表单加一个辣度评分字段，1-5分，3分以上合格"
   * - 输出: { fields: [{ name: "spicyRating", title: "辣度评分", ... }] }
   *
   * @param request 生成请求
   * @param factoryId 工厂ID (可选)
   * @returns 生成的字段列表
   */
  async generateSchema(
    request: SchemaGenerateRequest,
    factoryId?: string
  ): Promise<SchemaGenerateResponse> {
    try {
      const response = await apiClient.post<ApiResponse<SchemaGenerateResponse>>(
        `${this.getBasePath(factoryId)}/generate-schema`,
        request
      );

      if (response.success && response.data) {
        return response.data;
      }

      // 兼容直接返回数据的情况
      if ('fields' in response) {
        return response as unknown as SchemaGenerateResponse;
      }

      return {
        success: false,
        fields: [],
        message: response.message || 'AI生成Schema失败',
      };
    } catch (error) {
      console.error('[FormAssistantApiClient] generateSchema error:', error);
      return {
        success: false,
        fields: [],
        message: error instanceof Error ? error.message : 'AI服务暂时不可用',
      };
    }
  }

  /**
   * 提交校验反馈 - 获取AI修正建议
   *
   * 当表单校验失败时，将错误信息反馈给AI
   * AI会分析错误并给出修正建议
   *
   * 示例:
   * - 错误: "数量必须大于0"，当前值: -10
   * - AI建议: "检测到负数，已自动修正为正数 10"
   *
   * @param request 校验反馈请求
   * @param factoryId 工厂ID (可选)
   * @returns AI修正建议
   */
  async submitValidationFeedback(
    request: ValidationFeedbackRequest,
    factoryId?: string
  ): Promise<ValidationFeedbackResponse> {
    try {
      const response = await apiClient.post<ApiResponse<ValidationFeedbackResponse>>(
        `${this.getBasePath(factoryId)}/validation-feedback`,
        request
      );

      if (response.success && response.data) {
        return response.data;
      }

      // 兼容直接返回数据的情况
      if ('correctionHints' in response || 'correctedValues' in response) {
        return response as unknown as ValidationFeedbackResponse;
      }

      return {
        success: false,
        confidence: 0,
        message: response.message || '获取AI修正建议失败',
      };
    } catch (error) {
      console.error('[FormAssistantApiClient] submitValidationFeedback error:', error);
      return {
        success: false,
        confidence: 0,
        message: error instanceof Error ? error.message : 'AI服务暂时不可用',
      };
    }
  }

  /**
   * 从 Formily Schema 提取字段定义
   *
   * 将 Formily Schema 转换为 FormFieldDefinition 列表
   * 便于发送给AI服务进行解析
   *
   * @param schema Formily Schema
   * @returns 字段定义列表
   */
  extractFieldsFromSchema(schema: {
    properties?: Record<string, {
      type?: string;
      title?: string;
      description?: string;
      required?: boolean;
      enum?: Array<{ label: string; value: string }>;
    }>;
  }): FormFieldDefinition[] {
    if (!schema.properties) {
      return [];
    }

    return Object.entries(schema.properties).map(([name, field]) => {
      const fieldDef: FormFieldDefinition = {
        name,
        title: field.title || name,
        type: this.mapSchemaType(field.type),
        description: field.description,
        required: field.required,
      };

      // 处理枚举类型
      if (field.enum && Array.isArray(field.enum)) {
        fieldDef.type = 'enum';
        fieldDef.enumOptions = field.enum.map((opt) => {
          if (typeof opt === 'object' && 'label' in opt && 'value' in opt) {
            return { label: opt.label, value: opt.value };
          }
          return { label: String(opt), value: String(opt) };
        });
      }

      return fieldDef;
    });
  }

  /**
   * 映射 Schema 类型到 FormFieldDefinition 类型
   */
  private mapSchemaType(
    schemaType?: string
  ): 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'array' {
    switch (schemaType) {
      case 'number':
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'array';
      default:
        return 'string';
    }
  }
}

// ========== 导出 ==========

export const formAssistantApiClient = new FormAssistantApiClient();
export default formAssistantApiClient;
