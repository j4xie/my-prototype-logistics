import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';
import { timeStatsApiClient } from './timeStatsApiClient';
import { whitelistApiClient } from './whitelistApiClient';
import { userApiClient, UserDTO, PageResponse } from './userApiClient';

/**
 * HR管理API客户端
 * 聚合多个API为HR Dashboard提供数据
 *
 * 核心功能：
 * 1. 获取今日考勤统计 (复用 timeStatsApiClient)
 * 2. 获取白名单待激活数量 (复用 whitelistApiClient)
 * 3. 获取本月入职人数 (新API: /join-date-range)
 * 4. 获取考勤异常列表 (复用 timeclockApiClient)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-27
 */

// ========== 类型定义 ==========

/**
 * HR Dashboard 统计数据
 */
export interface HRDashboardData {
  /** 今日在岗人数 */
  todayOnSite: number;
  /** 总员工数 */
  totalStaff: number;
  /** 出勤率 (百分比) */
  attendanceRate: number;
  /** 迟到人数 */
  lateCount: number;
  /** 白名单待激活数量 */
  whitelistPending: number;
  /** 本月入职人数 */
  thisMonthNewHires: number;
  /** 与上月入职人数对比 (+/- 数字) */
  newHiresChange?: number;
}

/**
 * 考勤异常记录
 */
export interface AttendanceAnomaly {
  id: number;
  userId: number;
  userName: string;
  department?: string;
  position?: string;
  anomalyType: 'LATE' | 'ABSENT' | 'EARLY_LEAVE' | 'NO_CLOCK_IN' | 'NO_CLOCK_OUT';
  anomalyTypeDisplay: string;
  details?: string;
  date: string;
  expectedTime?: string;
  actualTime?: string;
}

/**
 * 今日考勤统计
 */
export interface TodayAttendanceStats {
  /** 总人数 */
  totalEmployees: number;
  /** 已打卡人数 */
  clockedIn: number;
  /** 迟到人数 */
  lateCount: number;
  /** 未打卡人数 */
  notClockedIn: number;
  /** 出勤率 */
  attendanceRate: number;
}

/**
 * 入职日期范围查询参数
 */
export interface JoinDateRangeParams {
  startDate: string; // yyyy-MM-dd
  endDate: string;   // yyyy-MM-dd
  page?: number;
  size?: number;
  factoryId?: string;
}

// ========== API客户端类 ==========

class HRApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}`;
  }

  /**
   * 格式化日期为 yyyy-MM-dd 字符串
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 获取本月第一天的日期字符串
   */
  private getFirstDayOfMonth(): string {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.formatDate(firstDay);
  }

  /**
   * 获取今天的日期字符串
   */
  private getToday(): string {
    return this.formatDate(new Date());
  }

  /**
   * 获取上月第一天和最后一天
   */
  private getLastMonthRange(): { startDate: string; endDate: string } {
    const now = new Date();
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      startDate: this.formatDate(firstDayLastMonth),
      endDate: this.formatDate(lastDayLastMonth),
    };
  }

  /**
   * 1. 获取指定日期范围内入职的用户列表
   * GET /api/{factoryId}/users/join-date-range
   *
   * @param params 查询参数
   */
  async getUsersByJoinDateRange(params: JoinDateRangeParams): Promise<PageResponse<UserDTO>> {
    const { factoryId, ...queryParams } = params;
    const response = await apiClient.get<{
      code: number;
      data: PageResponse<UserDTO>;
      message: string;
      success: boolean;
    }>(
      `${this.getPath(factoryId)}/users/join-date-range`,
      { params: queryParams }
    );
    return response.data || { content: [], totalElements: 0, totalPages: 0, size: 20, number: 0 };
  }

  /**
   * 2. 获取本月入职人数
   */
  async getThisMonthNewHires(factoryId?: string): Promise<number> {
    try {
      const response = await this.getUsersByJoinDateRange({
        startDate: this.getFirstDayOfMonth(),
        endDate: this.getToday(),
        page: 1,
        size: 1, // 只需要 totalElements
        factoryId,
      });
      return response.totalElements;
    } catch (error) {
      console.error('[hrApiClient] 获取本月入职人数失败:', error);
      return 0;
    }
  }

  /**
   * 3. 获取上月入职人数 (用于计算环比)
   */
  async getLastMonthNewHires(factoryId?: string): Promise<number> {
    try {
      const { startDate, endDate } = this.getLastMonthRange();
      const response = await this.getUsersByJoinDateRange({
        startDate,
        endDate,
        page: 1,
        size: 1,
        factoryId,
      });
      return response.totalElements;
    } catch (error) {
      console.error('[hrApiClient] 获取上月入职人数失败:', error);
      return 0;
    }
  }

  /**
   * 4. 获取HR Dashboard完整数据 (并行查询)
   *
   * 聚合以下数据:
   * - 今日考勤统计 (timeStatsApiClient)
   * - 白名单待激活数 (whitelistApiClient)
   * - 本月入职人数 (新API)
   * - 总员工数 (userApiClient)
   */
  async getDashboardData(factoryId?: string): Promise<HRDashboardData> {
    try {
      // 并行查询所有数据
      const [
        dailyStatsResult,
        whitelistStatsResult,
        thisMonthHiresResult,
        lastMonthHiresResult,
        usersResult,
      ] = await Promise.allSettled([
        timeStatsApiClient.getDailyStats(this.getToday(), factoryId),
        whitelistApiClient.getWhitelistStats(factoryId),
        this.getThisMonthNewHires(factoryId),
        this.getLastMonthNewHires(factoryId),
        userApiClient.getUsers({ factoryId, page: 1, size: 1 }), // 只需要 totalElements
      ]);

      // 解析今日考勤统计
      let todayOnSite = 0;
      let lateCount = 0;
      if (dailyStatsResult.status === 'fulfilled' && dailyStatsResult.value?.data) {
        const dailyData = dailyStatsResult.value.data;
        todayOnSite = dailyData.employeeCount || 0;
        // 从records中筛选迟到记录 (如果有isLate或lateMinutes字段)
        if (dailyData.records && Array.isArray(dailyData.records)) {
          lateCount = dailyData.records.filter((r) => {
            const record = r as unknown as Record<string, unknown>;
            return record.isLate === true || (typeof record.lateMinutes === 'number' && record.lateMinutes > 0);
          }).length;
        }
      }

      // 解析白名单统计
      let whitelistPending = 0;
      if (whitelistStatsResult.status === 'fulfilled') {
        const stats = whitelistStatsResult.value;
        // 待激活 = pending + disabled 状态
        whitelistPending = (stats.pending || 0) + (stats.disabled || 0);
      }

      // 解析入职人数
      const thisMonthNewHires = thisMonthHiresResult.status === 'fulfilled'
        ? thisMonthHiresResult.value : 0;
      const lastMonthNewHires = lastMonthHiresResult.status === 'fulfilled'
        ? lastMonthHiresResult.value : 0;
      const newHiresChange = thisMonthNewHires - lastMonthNewHires;

      // 解析总员工数
      let totalStaff = 0;
      if (usersResult.status === 'fulfilled') {
        totalStaff = usersResult.value.totalElements || 0;
      }

      // 计算出勤率
      const attendanceRate = totalStaff > 0
        ? Math.round((todayOnSite / totalStaff) * 100)
        : 0;

      return {
        todayOnSite,
        totalStaff,
        attendanceRate,
        lateCount,
        whitelistPending,
        thisMonthNewHires,
        newHiresChange,
      };
    } catch (error) {
      console.error('[hrApiClient] 获取Dashboard数据失败:', error);
      // 返回默认值，不阻塞页面渲染
      return {
        todayOnSite: 0,
        totalStaff: 0,
        attendanceRate: 0,
        lateCount: 0,
        whitelistPending: 0,
        thisMonthNewHires: 0,
        newHiresChange: 0,
      };
    }
  }

  /**
   * 5. 获取今日考勤异常列表
   *
   * 从打卡记录中筛选出异常情况
   */
  async getTodayAnomalies(factoryId?: string): Promise<AttendanceAnomaly[]> {
    try {
      const today = this.getToday();
      const response = await timeStatsApiClient.getDailyStats(today, factoryId);

      if (!response?.data?.records) {
        return [];
      }

      // 将迟到记录转换为异常格式
      const anomalies: AttendanceAnomaly[] = [];

      for (const record of response.data.records) {
        // 检查是否迟到 (假设有 isLate 或 lateMinutes 字段)
        if ((record as { isLate?: boolean }).isLate || (record as { lateMinutes?: number }).lateMinutes) {
          const lateMinutes = (record as { lateMinutes?: number }).lateMinutes || 0;
          anomalies.push({
            id: record.id,
            userId: record.employeeId,
            userName: record.employeeName || '未知',
            department: record.department,
            position: undefined,
            anomalyType: 'LATE',
            anomalyTypeDisplay: `迟到 ${lateMinutes}分钟`,
            date: today,
            expectedTime: (record as { expectedStartTime?: string }).expectedStartTime,
            actualTime: record.startTime,
          });
        }
      }

      return anomalies;
    } catch (error) {
      console.error('[hrApiClient] 获取今日考勤异常失败:', error);
      return [];
    }
  }

  /**
   * 6. 获取待激活白名单列表 (用于待处理事项)
   */
  async getPendingWhitelist(params?: {
    page?: number;
    size?: number;
    factoryId?: string;
  }): Promise<PageResponse<{
    id: number;
    phoneNumber: string;
    realName: string;
    role: string;
    department?: string;
    createdAt: string;
  }>> {
    const { factoryId, ...queryParams } = params || {};
    return await whitelistApiClient.getWhitelist({
      factoryId,
      status: 'PENDING',
      ...queryParams,
    });
  }
}

export const hrApiClient = new HRApiClient();
export default hrApiClient;
