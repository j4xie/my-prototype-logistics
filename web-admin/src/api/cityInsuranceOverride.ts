/**
 * #863 follow-up — 城市差异化 社保 / 公积金 配置覆盖 API client.
 *
 * Backend: HrCityInsuranceOverrideController
 *   at /api/mobile/{factoryId}/hr/insurance-config/cities
 *
 * @since 2026-05-18
 */
import { get, post, del } from './request';
import type { ApiResponse } from '@/types/api';
import type { HrInsuranceConfig } from './insuranceConfig';

export type CityOverrideStatus = 'ACTIVE' | 'ARCHIVED';

/**
 * 城市覆盖记录 — 覆盖工厂默认 HrInsuranceConfig 的基数 + 部分费率.
 */
export interface HrCityInsuranceOverride {
  id: string;
  factoryId: string;
  cityCode: string;
  cityName?: string | null;
  baseSalaryLowerBound: number;
  baseSalaryUpperBound: number;
  /** 可选 jsonb 费率覆盖. keys = HrInsuranceConfig camelCase 字段, values = 0~0.30. */
  overrideRates?: Record<string, number> | null;
  effectiveFrom: string;
  status: CityOverrideStatus;
  remark?: string | null;
  createdBy?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaveCityOverridePayload {
  cityCode: string;
  cityName?: string;
  baseSalaryLowerBound: number;
  baseSalaryUpperBound: number;
  overrideRates?: Record<string, number>;
  effectiveFrom: string;
  remark?: string;
}

export interface HrEmployeeCityAssignment {
  id: string;
  factoryId: string;
  userId: number;
  cityCode: string;
  effectiveFrom: string;
  status: CityOverrideStatus;
  remark?: string | null;
  createdBy?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssignEmployeePayload {
  userId: number;
  cityCode: string;
}

/** 当前 ACTIVE 城市覆盖列表. */
export function listCityOverrides(
  factoryId: string
): Promise<ApiResponse<HrCityInsuranceOverride[]>> {
  return get<HrCityInsuranceOverride[]>(
    `/${factoryId}/hr/insurance-config/cities`
  );
}

/** 历史覆盖 (含 ARCHIVED). */
export function listCityOverrideHistory(
  factoryId: string
): Promise<ApiResponse<HrCityInsuranceOverride[]>> {
  return get<HrCityInsuranceOverride[]>(
    `/${factoryId}/hr/insurance-config/cities/history`
  );
}

/**
 * 取某城市合并后 effective 配置 (R1 预览).
 *
 * Backend response (controller) 在标准 envelope 之外多带一个 `override` 字段
 * 表示原始覆盖记录. ApiResponse 类型本身只覆盖 envelope, 此处把 override 标为
 * 可选字段供调用方读取.
 */
export type CityEffectiveResponse = ApiResponse<HrInsuranceConfig> & {
  override?: HrCityInsuranceOverride | null;
};

export function getCityEffective(
  factoryId: string,
  cityCode: string,
  yearMonth?: string
): Promise<CityEffectiveResponse> {
  return get<HrInsuranceConfig>(
    `/${factoryId}/hr/insurance-config/cities/${encodeURIComponent(cityCode)}/effective`,
    { params: yearMonth ? { yearMonth } : {} }
  ) as Promise<CityEffectiveResponse>;
}

/** 保存新城市覆盖 (老 ACTIVE 自动 ARCHIVED). */
export function saveCityOverride(
  factoryId: string,
  payload: SaveCityOverridePayload
): Promise<ApiResponse<HrCityInsuranceOverride>> {
  return post<HrCityInsuranceOverride>(
    `/${factoryId}/hr/insurance-config/cities`,
    payload
  );
}

/** 软删除某城市覆盖. */
export function deleteCityOverride(
  factoryId: string,
  id: string
): Promise<ApiResponse<unknown>> {
  return del<unknown>(`/${factoryId}/hr/insurance-config/cities/${id}`);
}

// ===== 员工 → 城市 分配 =====

/** 列出 factory 全部 ACTIVE 员工→城市分配. */
export function listEmployeeAssignments(
  factoryId: string
): Promise<ApiResponse<HrEmployeeCityAssignment[]>> {
  return get<HrEmployeeCityAssignment[]>(
    `/${factoryId}/hr/insurance-config/cities/assignments`
  );
}

/** 列出某城市的员工分配. */
export function listAssignmentsByCity(
  factoryId: string,
  cityCode: string
): Promise<ApiResponse<HrEmployeeCityAssignment[]>> {
  return get<HrEmployeeCityAssignment[]>(
    `/${factoryId}/hr/insurance-config/cities/${encodeURIComponent(cityCode)}/assignments`
  );
}

/** 分配员工到城市. */
export function assignEmployee(
  factoryId: string,
  payload: AssignEmployeePayload
): Promise<ApiResponse<HrEmployeeCityAssignment>> {
  return post<HrEmployeeCityAssignment>(
    `/${factoryId}/hr/insurance-config/cities/assignments`,
    payload
  );
}

/** 取消员工分配 (回归工厂默认). */
export function unassignEmployee(
  factoryId: string,
  userId: number
): Promise<ApiResponse<unknown>> {
  return del<unknown>(
    `/${factoryId}/hr/insurance-config/cities/assignments/${userId}`
  );
}
