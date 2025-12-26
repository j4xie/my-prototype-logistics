/**
 * 服务器连接测试类型定义
 *
 * @description 定义测试状态、类别、结果等核心类型
 * @created 2025-12-26
 */

// ============ 测试状态枚举 ============

/**
 * 测试状态
 */
export type TestStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

/**
 * 测试类别
 */
export type TestCategory = 'network' | 'health' | 'auth' | 'business' | 'data_integrity';

/**
 * 测试阶段
 */
export type TestPhase = 1 | 2 | 3 | 4;

// ============ 测试结果接口 ============

/**
 * 单个测试结果
 */
export interface TestResult {
  /** 测试ID，如 NET-001, AUTH-001 */
  testId: string;
  /** 测试名称 */
  testName: string;
  /** 测试类别 */
  category: TestCategory;
  /** 测试阶段 */
  phase: TestPhase;
  /** 测试状态 */
  status: TestStatus;
  /** 响应时间（毫秒）*/
  responseTimeMs?: number;
  /** 错误信息 */
  errorMessage?: string;
  /** 响应数据（调试用）*/
  responseData?: unknown;
  /** 测试时间戳 */
  timestamp: string;
}

/**
 * 测试用例定义
 */
export interface TestCase {
  /** 测试ID */
  testId: string;
  /** 测试名称 */
  testName: string;
  /** 测试类别 */
  category: TestCategory;
  /** 测试阶段 */
  phase: TestPhase;
  /** API 端点 */
  endpoint?: string;
  /** HTTP 方法 */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** 是否需要认证 */
  requiresAuth: boolean;
  /** 测试执行函数 */
  execute: (context: TestContext) => Promise<TestExecutionResult>;
}

/**
 * 测试执行结果
 */
export interface TestExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 响应数据 */
  data?: unknown;
  /** 错误信息 */
  errorMessage?: string;
}

// ============ 测试上下文 ============

/**
 * 测试上下文（认证信息）
 */
export interface TestContext {
  /** 访问令牌 */
  accessToken?: string;
  /** 刷新令牌 */
  refreshToken?: string;
  /** 工厂ID */
  factoryId?: string;
  /** 用户ID */
  userId?: number;
  /** 用户名 */
  username?: string;
  /** 角色 */
  role?: string;
}

// ============ 测试进度 ============

/**
 * 测试进度
 */
export interface TestProgress {
  /** 当前阶段 */
  currentPhase: TestPhase;
  /** 总阶段数 */
  totalPhases: number;
  /** 已完成测试数 */
  completedTests: number;
  /** 总测试数 */
  totalTests: number;
  /** 完成百分比 */
  percentage: number;
}

/**
 * 阶段状态
 */
export interface PhaseStatus {
  /** 阶段编号 */
  phase: TestPhase;
  /** 阶段名称 */
  phaseName: string;
  /** 阶段状态 */
  status: TestStatus;
  /** 阶段内测试结果 */
  tests: TestResult[];
  /** 通过数 */
  passed: number;
  /** 失败数 */
  failed: number;
  /** 总数 */
  total: number;
}

// ============ 测试汇总 ============

/**
 * 测试汇总
 */
export interface TestSummary {
  /** 总测试数 */
  totalTests: number;
  /** 通过数 */
  passed: number;
  /** 失败数 */
  failed: number;
  /** 跳过数 */
  skipped: number;
  /** 总耗时（毫秒）*/
  totalDurationMs: number;
  /** 汇总时间戳 */
  timestamp: string;
  /** 各阶段状态 */
  phases: PhaseStatus[];
}

// ============ 数据完整性测试 ============

/**
 * 字段验证结果
 */
export interface FieldValidationResult {
  /** 字段名 */
  fieldName: string;
  /** 期望存在 */
  expected: boolean;
  /** 实际存在 */
  actual: boolean;
  /** 期望类型 */
  expectedType?: string;
  /** 实际类型 */
  actualType?: string;
  /** 是否通过 */
  passed: boolean;
  /** 备注 */
  note?: string;
}

/**
 * 数据完整性测试结果
 */
export interface DataIntegrityTestResult extends TestResult {
  /** 字段验证结果列表 */
  fieldValidations?: FieldValidationResult[];
  /** 缺失字段 */
  missingFields?: string[];
  /** 额外字段 */
  extraFields?: string[];
  /** 类型不匹配字段 */
  typeMismatchFields?: string[];
}

// ============ 日志类型 ============

/**
 * 测试日志级别
 */
export type LogLevel = 'info' | 'success' | 'warning' | 'error';

/**
 * 测试日志条目
 */
export interface TestLogEntry {
  /** 日志时间戳 */
  timestamp: string;
  /** 日志级别 */
  level: LogLevel;
  /** 日志消息 */
  message: string;
  /** 关联的测试ID */
  testId?: string;
}

// ============ 服务器配置 ============

/**
 * 服务器配置
 */
export interface ServerConfig {
  /** 服务器地址 */
  baseUrl: string;
  /** 超时时间（毫秒）*/
  timeout: number;
  /** 测试账户用户名 */
  testUsername: string;
  /** 测试账户密码 */
  testPassword: string;
}

/**
 * 默认服务器配置
 */
export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  baseUrl: 'http://139.196.165.140:10010',
  timeout: 30000,
  testUsername: 'factory_admin1',
  testPassword: '123456',
};

// ============ 阶段名称常量 ============

export const PHASE_NAMES: Record<TestPhase, string> = {
  1: '网络与健康检查',
  2: '认证测试',
  3: '业务 API 测试',
  4: '数据完整性检查',
};
