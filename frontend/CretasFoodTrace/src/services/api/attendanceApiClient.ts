import { apiClient } from './apiClient';
import { DEFAULT_FACTORY_ID } from '../../constants/config';

/**
 * 考勤打卡管理API客户端
 * 总计11个API - 路径：/api/mobile/{factoryId}/attendance/*
 */

class AttendanceApiClient {
  private getPath(factoryId?: string) {
    return `/api/mobile/${factoryId || DEFAULT_FACTORY_ID}/attendance`;
  }

  // 1. 获取打卡记录列表
  async getAttendanceRecords(params?: { factoryId?: string; [key: string]: any }) {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(this.getPath(factoryId), { params: query });
  }

  // 2. 打卡（签到/签退）
  async clockInOut(data: any, factoryId?: string) {
    return await apiClient.post(this.getPath(factoryId), data);
  }

  // 3. 获取打卡详情
  async getAttendanceById(id: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/${id}`);
  }

  // 4. 更新打卡记录
  async updateAttendance(id: string, data: any, factoryId?: string) {
    return await apiClient.put(`${this.getPath(factoryId)}/${id}`, data);
  }

  // 5. 删除打卡记录
  async deleteAttendance(id: string, factoryId?: string) {
    return await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  // 6. 获取员工打卡记录
  async getEmployeeAttendance(employeeId: number, params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/employee/${employeeId}`, { params });
  }

  // 7. 获取部门考勤统计
  async getDepartmentAttendance(department: string, params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/department/${department}`, { params });
  }

  // 8. 获取每日考勤汇总
  async getDailyAttendanceSummary(date: string, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/daily-summary`, { params: { date } });
  }

  // 9. 获取异常打卡记录
  async getAbnormalAttendance(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/abnormal`, { params });
  }

  // 10. 导出考勤记录
  async exportAttendance(params?: { factoryId?: string; [key: string]: any }) {
    const { factoryId, ...query } = params || {};
    return await apiClient.get(`${this.getPath(factoryId)}/export`, {
      params: query,
      responseType: 'blob'
    });
  }

  // 11. 获取考勤统计
  async getAttendanceStatistics(params?: any, factoryId?: string) {
    return await apiClient.get(`${this.getPath(factoryId)}/statistics`, { params });
  }
}

export const attendanceApiClient = new AttendanceApiClient();
export default attendanceApiClient;
