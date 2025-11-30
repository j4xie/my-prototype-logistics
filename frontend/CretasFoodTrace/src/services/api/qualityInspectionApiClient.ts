import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 质量检验管理API客户端
 * 对接后端路径：/api/mobile/{factoryId}/processing/quality/*
 *
 * 后端API文档参考：
 * - ProcessingController.java (line 230-291)
 * - 路径：/api/mobile/{factoryId}/processing/quality
 * - 实体：QualityInspection.java
 *
 * 总计4个核心API（已验证）：
 * 1. POST /processing/quality/inspections - 提交质检记录（需batchId查询参数）
 * 2. GET  /processing/quality/inspections - 获取质检记录列表（分页，可选batchId过滤）
 * 3. GET  /processing/quality/statistics - 获取质量统计数据（必需startDate/endDate）
 * 4. GET  /processing/quality/trends - 获取质量趋势分析（可选days参数，默认30）
 */

// ========== 类型定义 ==========

/**
 * 后端统一响应格式
 */
export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T;
}

/**
 * 分页响应格式（与后端PageResponse匹配）
 */
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number; // 当前页码（0-based）
  first: boolean;
  last: boolean;
  empty: boolean;
}

/**
 * 质量检验结果枚举（与后端 result 字段对应）
 * 注：后端存储为字符串，不是枚举类型
 */
export enum InspectionResult {
  PASS = 'PASS',
  FAIL = 'FAIL',
  CONDITIONAL = 'CONDITIONAL',
}

/**
 * 质量状态枚举（与后端 QualityStatus 枚举对应）
 * 用于标识生产批次和物料批次的质量检验状态
 */
export enum QualityStatus {
  PENDING_INSPECTION = 'PENDING_INSPECTION',
  INSPECTING = 'INSPECTING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  PARTIAL_PASS = 'PARTIAL_PASS',
  REWORK_REQUIRED = 'REWORK_REQUIRED',
  REWORKING = 'REWORKING',
  REWORK_COMPLETED = 'REWORK_COMPLETED',
  SCRAPPED = 'SCRAPPED',
}

/**
 * 质检记录（与后端 QualityInspection 实体精确匹配）
 *
 * 后端实体字段：
 * - id (Long)
 * - factoryId (String)
 * - productionBatchId (Long)
 * - inspectorId (Integer)
 * - inspectionDate (LocalDate)
 * - sampleSize (BigDecimal)
 * - passCount (BigDecimal)
 * - failCount (BigDecimal)
 * - passRate (BigDecimal) - 后端自动计算
 * - result (String: PASS, FAIL, CONDITIONAL)
 * - notes (TEXT)
 */
export interface QualityInspection {
  // 基本信息
  id?: number;
  factoryId: string;
  productionBatchId: number;
  inspectorId: number;

  // 检验数据
  inspectionDate: string; // ISO date string: YYYY-MM-DD
  sampleSize: number;
  passCount: number;
  failCount: number;
  passRate?: number; // 后端自动计算（passCount / sampleSize * 100）

  // 检验结果
  result?: InspectionResult; // PASS, FAIL, CONDITIONAL
  notes?: string;

  // 元数据（只读）
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 提交质检记录请求（后端接受的Map<String, Object>格式）
 *
 * 注意：
 * - productionBatchId 可以在请求体或查询参数中传递
 * - 后端会自动计算 passRate = (passCount / sampleSize) * 100
 */
export interface SubmitInspectionRequest {
  productionBatchId?: number; // 也可以通过查询参数batchId传递
  inspectorId: number;
  inspectionDate: string; // YYYY-MM-DD
  sampleSize: number;
  passCount: number;
  failCount: number;
  result?: InspectionResult;
  notes?: string;
}

/**
 * 质检列表查询参数
 */
export interface InspectionListParams {
  batchId?: number; // 后端支持按批次ID过滤
  page?: number; // 页码，默认1
  size?: number; // 每页大小，默认20
}

/**
 * 质量统计数据（后端返回Map<String, Object>）
 */
export interface QualityStatistics {
  totalInspections: number;
  passedInspections: number;
  failedInspections: number;
  conditionalInspections: number;
  averagePassRate: number;
  totalSampleSize: number;
  totalPassCount: number;
  totalFailCount: number;
  [key: string]: any; // 后端可能返回额外字段
}

/**
 * 质量趋势数据点（后端返回List<Map<String, Object>>）
 */
export interface QualityTrendPoint {
  date: string; // YYYY-MM-DD
  inspectionCount: number;
  passRate: number;
  sampleSize: number;
  passCount: number;
  failCount: number;
  [key: string]: any;
}

// ========== API客户端类 ==========

class QualityInspectionApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/processing/quality`;
  }

  /**
   * 1. 提交质检记录
   * POST /api/mobile/{factoryId}/processing/quality/inspections
   *
   * 后端签名：
   * ```java
   * public ApiResponse<Map<String, Object>> submitInspection(
   *   @PathVariable String factoryId,
   *   @RequestParam Long batchId,
   *   @RequestBody Map<String, Object> inspection
   * )
   * ```
   *
   * @param batchId - 生产批次ID（查询参数）
   * @param inspection - 质检信息（请求体）
   * @param factoryId - 工厂ID（可选）
   * @returns 提交的质检记录
   */
  async submitInspection(
    batchId: number,
    inspection: SubmitInspectionRequest,
    factoryId?: string
  ): Promise<ApiResponse<QualityInspection>> {
    return await apiClient.post(
      `${this.getPath(factoryId)}/inspections`,
      inspection,
      {
        params: { batchId },
      }
    );
  }

  /**
   * 2. 获取质检记录列表（分页）
   * GET /api/mobile/{factoryId}/processing/quality/inspections
   *
   * 后端签名：
   * ```java
   * public ApiResponse<PageResponse<Map<String, Object>>> getInspections(
   *   @PathVariable String factoryId,
   *   @RequestParam(required = false) Long batchId,
   *   @RequestParam(defaultValue = "1") Integer page,
   *   @RequestParam(defaultValue = "20") Integer size
   * )
   * ```
   *
   * @param params - 查询参数
   * @param params.batchId - 批次ID（可选，用于过滤）
   * @param params.page - 页码（默认1）
   * @param params.size - 每页大小（默认20）
   * @param factoryId - 工厂ID（可选）
   * @returns 分页的质检记录
   */
  async getInspections(
    params?: InspectionListParams,
    factoryId?: string
  ): Promise<ApiResponse<PageResponse<QualityInspection>>> {
    return await apiClient.get(`${this.getPath(factoryId)}/inspections`, {
      params: {
        batchId: params?.batchId,
        page: params?.page ?? 1,
        size: params?.size ?? 20,
      },
    });
  }

  /**
   * 3. 获取质量统计数据
   * GET /api/mobile/{factoryId}/processing/quality/statistics
   *
   * 后端签名：
   * ```java
   * public ApiResponse<Map<String, Object>> getQualityStatistics(
   *   @PathVariable String factoryId,
   *   @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
   *   @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
   * )
   * ```
   *
   * @param params - 查询参数（必需）
   * @param params.startDate - 开始日期 (YYYY-MM-DD)
   * @param params.endDate - 结束日期 (YYYY-MM-DD)
   * @param factoryId - 工厂ID（可选）
   * @returns 质量统计数据
   */
  async getStatistics(
    params: {
      startDate: string; // YYYY-MM-DD
      endDate: string; // YYYY-MM-DD
    },
    factoryId?: string
  ): Promise<ApiResponse<QualityStatistics>> {
    return await apiClient.get(`${this.getPath(factoryId)}/statistics`, {
      params: {
        startDate: params.startDate,
        endDate: params.endDate,
      },
    });
  }

  /**
   * 4. 获取质量趋势分析
   * GET /api/mobile/{factoryId}/processing/quality/trends
   *
   * 后端签名：
   * ```java
   * public ApiResponse<List<Map<String, Object>>> getQualityTrends(
   *   @PathVariable String factoryId,
   *   @RequestParam(defaultValue = "30") Integer days
   * )
   * ```
   *
   * @param days - 天数（默认30天）
   * @param factoryId - 工厂ID（可选）
   * @returns 质量趋势数据数组
   */
  async getTrends(
    days: number = 30,
    factoryId?: string
  ): Promise<ApiResponse<QualityTrendPoint[]>> {
    return await apiClient.get(`${this.getPath(factoryId)}/trends`, {
      params: { days },
    });
  }
}

// ========== 单例导出 ==========

export const qualityInspectionApiClient = new QualityInspectionApiClient();
export default qualityInspectionApiClient;
