/**
 * 人员报表API客户端
 * 功能：人员统计、工时排行、加班统计、绩效评估
 *
 * 后端API路径：/api/mobile/{factoryId}/personnel/*
 */

import { apiClient } from './apiClient';

/**
 * 人员总览统计
 */
export interface PersonnelStatistics {
  totalEmployees: number;
  totalPresent: number;
  totalAbsent: number;
  avgAttendanceRate: number;
  activeDepartments: number;
  totalWorkHours: number;
  avgWorkHoursPerEmployee: number;
}

/**
 * 工时排行榜项
 */
export interface WorkHoursRankingItem {
  userId: number;
  userName: string;
  departmentId: string;
  departmentName: string;
  totalWorkHours: number;
  totalOvertimeHours: number;
  attendanceDays: number;
  attendanceRate: number;
}

/**
 * 加班员工项
 */
export interface OvertimeEmployeeItem {
  userId: number;
  userName: string;
  overtimeHours: number;
}

/**
 * 加班统计
 */
export interface OvertimeStatistics {
  totalOvertimeHours: number;
  totalEmployeesWithOvertime: number;
  avgOvertimeHoursPerEmployee: number;
  topOvertimeEmployees: OvertimeEmployeeItem[];
}

/**
 * 人员绩效项
 */
export interface PerformanceItem {
  userId: number;
  userName: string;
  departmentName: string;
  workHours: number;
  attendanceRate: number;
  qualityScore: number;
  efficiencyScore: number;
  overallScore: number;
}

/**
 * 人员报表API客户端
 */
export const personnelApiClient = {
  /**
   * 获取人员总览统计
   * 后端API: GET /api/mobile/{factoryId}/personnel/statistics
   */
  getPersonnelStatistics: async (
    factoryId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    success: boolean;
    data: PersonnelStatistics;
    message?: string;
  }> => {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await apiClient.get(
      `/api/mobile/${factoryId}/personnel/statistics`,
      { params }
    );
    return response.data;
  },

  /**
   * 获取工时排行榜
   * 后端API: GET /api/mobile/{factoryId}/personnel/work-hours-ranking
   */
  getWorkHoursRanking: async (
    factoryId: string,
    startDate: string,
    endDate: string,
    limit: number = 10
  ): Promise<{
    success: boolean;
    data: WorkHoursRankingItem[];
    message?: string;
  }> => {
    const response = await apiClient.get(
      `/api/mobile/${factoryId}/personnel/work-hours-ranking`,
      {
        params: { startDate, endDate, limit },
      }
    );
    return response.data;
  },

  /**
   * 获取加班统计
   * 后端API: GET /api/mobile/{factoryId}/personnel/overtime-statistics
   */
  getOvertimeStatistics: async (
    factoryId: string,
    startDate: string,
    endDate: string,
    departmentId?: string
  ): Promise<{
    success: boolean;
    data: OvertimeStatistics;
    message?: string;
  }> => {
    const params: Record<string, string> = { startDate, endDate };
    if (departmentId) params.departmentId = departmentId;

    const response = await apiClient.get(
      `/api/mobile/${factoryId}/personnel/overtime-statistics`,
      { params }
    );
    return response.data;
  },

  /**
   * 获取人员绩效统计
   * 后端API: GET /api/mobile/{factoryId}/personnel/performance
   */
  getPersonnelPerformance: async (
    factoryId: string,
    startDate: string,
    endDate: string,
    userId?: number
  ): Promise<{
    success: boolean;
    data: PerformanceItem[];
    message?: string;
  }> => {
    const params: Record<string, any> = { startDate, endDate };
    if (userId !== undefined) params.userId = userId;

    const response = await apiClient.get(
      `/api/mobile/${factoryId}/personnel/performance`,
      { params }
    );
    return response.data;
  },
};
