/**
 * 数据完整性测试服务
 *
 * @description 检测后端返回数据的字段完整性，识别前后端字段不一致问题
 * @created 2025-12-26
 */

import axios, { AxiosInstance } from 'axios';
import {
  TestCase,
  TestResult,
  TestContext,
  TestExecutionResult,
  DataIntegrityTestResult,
  FieldValidationResult,
  TestPhase,
  DEFAULT_SERVER_CONFIG,
} from '../../types/testing';

/**
 * 预期字段定义
 */
interface ExpectedFields {
  required: string[];
  optional?: string[];
  typeChecks?: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>;
}

/**
 * 字段验证器
 */
function validateFields(data: Record<string, unknown>, expected: ExpectedFields): {
  passed: boolean;
  validations: FieldValidationResult[];
  missingFields: string[];
  extraFields: string[];
} {
  const validations: FieldValidationResult[] = [];
  const missingFields: string[] = [];
  const extraFields: string[] = [];
  let allPassed = true;

  // 检查必需字段
  for (const field of expected.required) {
    const exists = field in data;
    const validation: FieldValidationResult = {
      fieldName: field,
      expected: true,
      actual: exists,
      passed: exists,
    };

    if (expected.typeChecks?.[field] && exists) {
      const expectedType = expected.typeChecks[field];
      let actualType = typeof data[field];
      if (Array.isArray(data[field])) actualType = 'array' as typeof actualType;
      validation.expectedType = expectedType;
      validation.actualType = actualType;
      validation.passed = actualType === expectedType;
    }

    if (!exists) {
      missingFields.push(field);
      allPassed = false;
    }

    validations.push(validation);
  }

  // 检查额外字段（后端返回但前端未定义）
  const allExpected = [...expected.required, ...(expected.optional || [])];
  for (const key of Object.keys(data)) {
    if (!allExpected.includes(key)) {
      extraFields.push(key);
      validations.push({
        fieldName: key,
        expected: false,
        actual: true,
        passed: true, // 额外字段不算失败，只是提示
        note: '后端返回了前端未使用的字段',
      });
    }
  }

  return { passed: allPassed, validations, missingFields, extraFields };
}

/**
 * 数据完整性测试服务
 */
export class DataIntegrityTestService {
  private axiosInstance: AxiosInstance;
  private testCases: TestCase[] = [];

  constructor(baseUrl: string = DEFAULT_SERVER_CONFIG.baseUrl) {
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: DEFAULT_SERVER_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    this.initializeTestCases();
  }

  /**
   * 初始化数据完整性测试用例
   */
  private initializeTestCases(): void {
    this.testCases = [
      // ============ Phase 4: 数据完整性检查 ============
      {
        testId: 'DATA-001',
        testName: 'User 字段完整性',
        category: 'data_integrity',
        phase: 4,
        endpoint: '/auth/me',
        requiresAuth: true,
        execute: async (context) => this.testUserFields(context),
      },
      {
        testId: 'DATA-002',
        testName: 'MaterialBatch 字段映射',
        category: 'data_integrity',
        phase: 4,
        endpoint: '/material-batches',
        requiresAuth: true,
        execute: async (context) => this.testMaterialBatchFields(context),
      },
      {
        testId: 'DATA-003',
        testName: 'ProductionBatch 成本字段',
        category: 'data_integrity',
        phase: 4,
        endpoint: '/processing/batches',
        requiresAuth: true,
        execute: async (context) => this.testProductionBatchFields(context),
      },
      {
        testId: 'DATA-004',
        testName: 'QualityInspection 计算字段',
        category: 'data_integrity',
        phase: 4,
        endpoint: '/reports/dashboard/quality',
        requiresAuth: true,
        execute: async (context) => this.testQualityInspectionFields(context),
      },
      {
        testId: 'DATA-005',
        testName: 'Equipment 单位一致性',
        category: 'data_integrity',
        phase: 4,
        endpoint: '/equipments',
        requiresAuth: true,
        execute: async (context) => this.testEquipmentFields(context),
      },
      {
        testId: 'DATA-006',
        testName: 'ProductionPlan 匹配状态',
        category: 'data_integrity',
        phase: 4,
        endpoint: '/production-plans',
        requiresAuth: true,
        execute: async (context) => this.testProductionPlanFields(context),
      },
    ];
  }

  /**
   * 测试 User 字段完整性
   */
  private async testUserFields(context: TestContext): Promise<TestExecutionResult> {
    if (!context.accessToken) {
      return { success: false, errorMessage: '缺少 accessToken' };
    }

    try {
      const response = await this.axiosInstance.get('/api/mobile/auth/me', {
        headers: { Authorization: `Bearer ${context.accessToken}` },
      });

      const userData = response.data?.data || response.data;

      // 前端期望的 User 字段
      const expected: ExpectedFields = {
        required: [
          'id', 'username', 'role', 'factoryId',
          'createdAt', 'updatedAt',
        ],
        optional: [
          'realName', 'phone', 'email', 'avatar',
          'departmentId', 'departmentName', 'position',
          'isActive', 'lastLoginAt',
        ],
        typeChecks: {
          id: 'number',
          username: 'string',
          role: 'string',
        },
      };

      const result = validateFields(userData, expected);

      return {
        success: result.passed,
        data: {
          validations: result.validations,
          missingFields: result.missingFields,
          extraFields: result.extraFields,
          note: result.missingFields.includes('email')
            ? '⚠️ email 字段缺失 - 后端需添加'
            : undefined,
        },
        errorMessage: result.passed
          ? undefined
          : `缺失字段: ${result.missingFields.join(', ')}`,
      };
    } catch (error: unknown) {
      return { success: false, errorMessage: this.getErrorMessage(error) };
    }
  }

  /**
   * 测试 MaterialBatch 字段映射
   */
  private async testMaterialBatchFields(context: TestContext): Promise<TestExecutionResult> {
    if (!context.accessToken || !context.factoryId) {
      return { success: false, errorMessage: '缺少认证信息' };
    }

    try {
      const response = await this.axiosInstance.get(
        `/api/mobile/${context.factoryId}/material-batches?page=1&size=1`,
        { headers: { Authorization: `Bearer ${context.accessToken}` } }
      );

      const content = response.data?.data?.content || response.data?.content || [];
      if (content.length === 0) {
        return { success: true, data: { note: '无数据，跳过字段验证' } };
      }

      const batch = content[0];

      // 检查命名一致性问题
      const namingIssues: string[] = [];

      // receiptDate vs inboundDate
      if ('receiptDate' in batch && !('inboundDate' in batch)) {
        namingIssues.push('receiptDate 应映射为 inboundDate');
      }
      // receiptQuantity vs inboundQuantity
      if ('receiptQuantity' in batch && !('inboundQuantity' in batch)) {
        namingIssues.push('receiptQuantity 应映射为 inboundQuantity');
      }

      const expected: ExpectedFields = {
        required: [
          'id', 'batchNumber', 'materialTypeId', 'quantity',
          'status', 'factoryId',
        ],
        optional: [
          'materialTypeName', 'supplierId', 'supplierName',
          'quantityUnit', 'weightPerUnit', 'qualityCertificate',
          'storageLocation', 'expirationDate', 'createdAt',
        ],
      };

      const result = validateFields(batch, expected);

      return {
        success: result.passed && namingIssues.length === 0,
        data: {
          validations: result.validations,
          missingFields: result.missingFields,
          extraFields: result.extraFields,
          namingIssues,
        },
        errorMessage: namingIssues.length > 0
          ? `命名不一致: ${namingIssues.join('; ')}`
          : result.passed
            ? undefined
            : `缺失字段: ${result.missingFields.join(', ')}`,
      };
    } catch (error: unknown) {
      return { success: false, errorMessage: this.getErrorMessage(error) };
    }
  }

  /**
   * 测试 ProductionBatch 成本字段
   */
  private async testProductionBatchFields(context: TestContext): Promise<TestExecutionResult> {
    if (!context.accessToken || !context.factoryId) {
      return { success: false, errorMessage: '缺少认证信息' };
    }

    try {
      const response = await this.axiosInstance.get(
        `/api/mobile/${context.factoryId}/processing/batches?page=1&size=1`,
        { headers: { Authorization: `Bearer ${context.accessToken}` } }
      );

      const content = response.data?.data?.content || response.data?.content || [];
      if (content.length === 0) {
        return { success: true, data: { note: '无数据，跳过字段验证' } };
      }

      const batch = content[0];

      // 检查成本字段（后端 ProductionBatch 实体定义的字段）
      // 注意: 后端使用 otherCost 而非 overheadCost
      const costFields = [
        'materialCost', 'laborCost', 'equipmentCost', 'otherCost', 'totalCost',
      ];
      // 检查字段是否存在且不为 null
      const missingCostFields = costFields.filter(f => {
        if (!(f in batch)) return true;
        // 如果字段存在但值为 null，也视为"缺失"（数据未填充）
        return batch[f] === null || batch[f] === undefined;
      });

      // 检查质量字段
      const qualityFields = ['goodQuantity', 'defectQuantity', 'qualityStatus'];
      const missingQualityFields = qualityFields.filter(f => !(f in batch));

      const expected: ExpectedFields = {
        required: [
          'id', 'batchNumber', 'productTypeId', 'status',
          'plannedQuantity', 'factoryId',
        ],
        optional: [
          'productTypeName', 'actualQuantity', 'startTime', 'endTime',
          'supervisorId', 'supervisorName', 'equipmentId', 'equipmentName',
          'workerCount', 'createdAt', 'updatedAt',
        ],
      };

      const result = validateFields(batch, expected);

      return {
        success: result.passed,
        data: {
          validations: result.validations,
          missingFields: result.missingFields,
          extraFields: result.extraFields,
          missingCostFields: missingCostFields.length > 0 ? missingCostFields : undefined,
          missingQualityFields: missingQualityFields.length > 0 ? missingQualityFields : undefined,
          note: missingCostFields.length > 0
            ? `成本字段应在专用成本分析 API 中返回: ${missingCostFields.join(', ')}`
            : undefined,
        },
        errorMessage: result.passed
          ? undefined
          : `缺失字段: ${result.missingFields.join(', ')}`,
      };
    } catch (error: unknown) {
      return { success: false, errorMessage: this.getErrorMessage(error) };
    }
  }

  /**
   * 测试 QualityInspection 计算字段
   */
  private async testQualityInspectionFields(context: TestContext): Promise<TestExecutionResult> {
    if (!context.accessToken || !context.factoryId) {
      return { success: false, errorMessage: '缺少认证信息' };
    }

    try {
      const response = await this.axiosInstance.get(
        `/api/mobile/${context.factoryId}/reports/dashboard/quality`,
        { headers: { Authorization: `Bearer ${context.accessToken}` } }
      );

      const data = response.data?.data || response.data;

      // 检查 defectRate 是否存在
      const hasDefectRate = 'defectRate' in (data.summary || data);
      const hasPassRate = 'passRate' in (data.summary || data);
      const hasQualityGrade = 'qualityGrade' in (data.summary || data);

      const issues: string[] = [];
      if (!hasDefectRate && !hasPassRate) {
        issues.push('缺少 defectRate 或 passRate 计算字段');
      }
      if (!hasQualityGrade) {
        issues.push('缺少 qualityGrade 字段');
      }

      return {
        success: issues.length === 0,
        data: {
          hasDefectRate,
          hasPassRate,
          hasQualityGrade,
          issues,
          note: issues.length > 0
            ? '⚠️ 后端需添加质量计算字段'
            : '✅ 质量统计字段完整',
        },
        errorMessage: issues.length > 0 ? issues.join('; ') : undefined,
      };
    } catch (error: unknown) {
      return { success: false, errorMessage: this.getErrorMessage(error) };
    }
  }

  /**
   * 测试 Equipment 单位一致性
   */
  private async testEquipmentFields(context: TestContext): Promise<TestExecutionResult> {
    if (!context.accessToken || !context.factoryId) {
      return { success: false, errorMessage: '缺少认证信息' };
    }

    try {
      const response = await this.axiosInstance.get(
        `/api/mobile/${context.factoryId}/equipments?page=1&size=1`,
        { headers: { Authorization: `Bearer ${context.accessToken}` } }
      );

      const content = response.data?.data?.content || response.data?.content || [];
      if (content.length === 0) {
        return { success: true, data: { note: '无数据，跳过字段验证' } };
      }

      const equipment = content[0];

      // 检查维护间隔单位一致性
      const issues: string[] = [];

      // 后端使用 maintenanceIntervalHours，前端期望 maintenanceInterval (天)
      if ('maintenanceIntervalHours' in equipment && !('maintenanceInterval' in equipment)) {
        issues.push('maintenanceIntervalHours (小时) 应转换为 maintenanceInterval (天)');
      }

      // 检查其他缺失字段
      const energyFields = ['hourlyCost', 'powerConsumptionKw', 'totalRunningHours'];
      const missingEnergyFields = energyFields.filter(f => !(f in equipment));

      const expected: ExpectedFields = {
        required: [
          'id', 'equipmentCode', 'name', 'status', 'factoryId',
        ],
        optional: [
          'departmentId', 'departmentName', 'model', 'manufacturer',
          'purchaseDate', 'lastMaintenanceDate', 'nextMaintenanceDate',
          'maintenanceInterval', 'maintenanceIntervalHours',
        ],
      };

      const result = validateFields(equipment, expected);

      return {
        success: result.passed && issues.length === 0,
        data: {
          validations: result.validations,
          missingFields: result.missingFields,
          extraFields: result.extraFields,
          unitIssues: issues.length > 0 ? issues : undefined,
          missingEnergyFields: missingEnergyFields.length > 0 ? missingEnergyFields : undefined,
          note: issues.length > 0
            ? '⚠️ 维护间隔单位需统一 (小时 vs 天)'
            : undefined,
        },
        errorMessage: issues.length > 0
          ? issues.join('; ')
          : result.passed
            ? undefined
            : `缺失字段: ${result.missingFields.join(', ')}`,
      };
    } catch (error: unknown) {
      return { success: false, errorMessage: this.getErrorMessage(error) };
    }
  }

  /**
   * 测试 ProductionPlan 匹配状态
   */
  private async testProductionPlanFields(context: TestContext): Promise<TestExecutionResult> {
    if (!context.accessToken || !context.factoryId) {
      return { success: false, errorMessage: '缺少认证信息' };
    }

    try {
      const response = await this.axiosInstance.get(
        `/api/mobile/${context.factoryId}/production-plans?page=1&size=1`,
        { headers: { Authorization: `Bearer ${context.accessToken}` } }
      );

      const content = response.data?.data?.content || response.data?.content || [];
      if (content.length === 0) {
        return { success: true, data: { note: '无数据，跳过字段验证' } };
      }

      const plan = content[0];

      // 检查匹配状态字段
      const matchingFields = ['allocatedQuantity', 'isFullyMatched'];
      const missingMatchingFields = matchingFields.filter(f => !(f in plan));

      // 检查优先级字段
      const hasPriority = 'priority' in plan;

      const expected: ExpectedFields = {
        required: [
          'id', 'planNumber', 'productTypeId', 'plannedQuantity',
          'status', 'factoryId',
        ],
        optional: [
          'productTypeName', 'plannedStartDate', 'plannedEndDate',
          'actualStartDate', 'actualEndDate', 'customerOrderNumber',
          'allocatedQuantity', 'isFullyMatched', 'priority',
        ],
      };

      const result = validateFields(plan, expected);

      return {
        success: result.passed,
        data: {
          validations: result.validations,
          missingFields: result.missingFields,
          extraFields: result.extraFields,
          missingMatchingFields: missingMatchingFields.length > 0 ? missingMatchingFields : undefined,
          hasPriority,
          note: missingMatchingFields.length > 0
            ? `⚠️ 原料匹配状态字段缺失: ${missingMatchingFields.join(', ')}`
            : '✅ 生产计划字段完整',
        },
        errorMessage: result.passed
          ? undefined
          : `缺失字段: ${result.missingFields.join(', ')}`,
      };
    } catch (error: unknown) {
      return { success: false, errorMessage: this.getErrorMessage(error) };
    }
  }

  /**
   * 获取错误消息
   */
  private getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || error.response.statusText;
        return `HTTP ${status}: ${message}`;
      }
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * 获取所有测试用例
   */
  getTestCases(): TestCase[] {
    return this.testCases;
  }

  /**
   * 运行单个测试
   */
  async runTest(testCase: TestCase, context: TestContext): Promise<DataIntegrityTestResult> {
    const startTime = Date.now();

    try {
      const executionResult = await testCase.execute(context);
      const endTime = Date.now();

      return {
        testId: testCase.testId,
        testName: testCase.testName,
        category: testCase.category,
        phase: testCase.phase,
        status: executionResult.success ? 'success' : 'failed',
        responseTimeMs: endTime - startTime,
        errorMessage: executionResult.errorMessage,
        responseData: executionResult.data,
        timestamp: new Date().toISOString(),
        fieldValidations: (executionResult.data as Record<string, unknown>)?.validations as FieldValidationResult[] | undefined,
        missingFields: (executionResult.data as Record<string, unknown>)?.missingFields as string[] | undefined,
        extraFields: (executionResult.data as Record<string, unknown>)?.extraFields as string[] | undefined,
      };
    } catch (error: unknown) {
      const endTime = Date.now();
      return {
        testId: testCase.testId,
        testName: testCase.testName,
        category: testCase.category,
        phase: testCase.phase,
        status: 'failed',
        responseTimeMs: endTime - startTime,
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 运行所有数据完整性测试
   */
  async runAllTests(context: TestContext): Promise<DataIntegrityTestResult[]> {
    const results: DataIntegrityTestResult[] = [];

    for (const testCase of this.testCases) {
      const result = await this.runTest(testCase, context);
      results.push(result);
    }

    return results;
  }
}

// 导出单例实例
export const dataIntegrityTestService = new DataIntegrityTestService();
