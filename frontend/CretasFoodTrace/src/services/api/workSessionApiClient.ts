import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 员工工作会话API客户端
 * 路径：/api/mobile/{factoryId}/work-sessions/*
 *
 * 业务场景：管理员工工作会话，追踪工时，计算人工成本
 */

// ========== 类型定义 ==========

export interface WorkSession {
  id: number;
  factoryId: string;
  userId: number;
  workTypeId: number;
  startTime: string;
  endTime?: string;
  breakMinutes: number;
  actualWorkMinutes?: number;
  status: 'active' | 'completed' | 'cancelled';
  hourlyRate?: number;
  laborCost?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StartSessionRequest {
  userId: number;
  workTypeId: number;
  hourlyRate?: number;
  notes?: string;
}

export interface EndSessionRequest {
  breakMinutes?: number;
  notes?: string;
}

export interface SessionStats {
  activeCount: number;
  totalLaborCost: number;
  byWorkType: Array<{ workTypeId: number; totalMinutes: number }>;
  byUser: Array<{ userId: number; totalMinutes: number; totalCost: number }>;
}

// ========== API客户端类 ==========

class WorkSessionApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/work-sessions`;
  }

  /**
   * 1. 获取工作会话列表（分页）
   * GET /api/mobile/{factoryId}/work-sessions
   */
  async getWorkSessions(params?: {
    factoryId?: string;
    page?: number;
    size?: number;
    status?: string;
  }): Promise<{ data: WorkSession[]; totalElements: number; totalPages: number }> {
    const { factoryId, ...queryParams } = params || {};
    const apiResponse = await apiClient.get<any>(
      `${this.getPath(factoryId)}`,
      { params: queryParams }
    );

    if (apiResponse.data && Array.isArray(apiResponse.data)) {
      return {
        data: apiResponse.data,
        totalElements: apiResponse.totalElements || apiResponse.data.length,
        totalPages: apiResponse.totalPages || 1
      };
    } else if (Array.isArray(apiResponse)) {
      return { data: apiResponse, totalElements: apiResponse.length, totalPages: 1 };
    }

    return { data: [], totalElements: 0, totalPages: 0 };
  }

  /**
   * 2. 获取单个工作会话
   * GET /api/mobile/{factoryId}/work-sessions/{id}
   */
  async getWorkSessionById(id: number, factoryId?: string): Promise<WorkSession> {
    const response = await apiClient.get<any>(
      `${this.getPath(factoryId)}/${id}`
    );
    return response.data || response;
  }

  /**
   * 3. 开始工作会话
   * POST /api/mobile/{factoryId}/work-sessions/start
   */
  async startSession(
    request: StartSessionRequest,
    factoryId?: string
  ): Promise<WorkSession> {
    const response = await apiClient.post<any>(
      `${this.getPath(factoryId)}/start`,
      request
    );
    return response.data || response;
  }

  /**
   * 4. 结束工作会话
   * PUT /api/mobile/{factoryId}/work-sessions/{id}/end
   */
  async endSession(
    id: number,
    request?: EndSessionRequest,
    factoryId?: string
  ): Promise<WorkSession> {
    const response = await apiClient.put<any>(
      `${this.getPath(factoryId)}/${id}/end`,
      request || {}
    );
    return response.data || response;
  }

  /**
   * 5. 取消工作会话
   * PUT /api/mobile/{factoryId}/work-sessions/{id}/cancel
   */
  async cancelSession(id: number, factoryId?: string): Promise<WorkSession> {
    const response = await apiClient.put<any>(
      `${this.getPath(factoryId)}/${id}/cancel`
    );
    return response.data || response;
  }

  /**
   * 6. 更新工作会话
   * PUT /api/mobile/{factoryId}/work-sessions/{id}
   */
  async updateSession(
    id: number,
    request: Partial<StartSessionRequest>,
    factoryId?: string
  ): Promise<WorkSession> {
    const response = await apiClient.put<any>(
      `${this.getPath(factoryId)}/${id}`,
      request
    );
    return response.data || response;
  }

  /**
   * 7. 获取用户当前活跃会话
   * GET /api/mobile/{factoryId}/work-sessions/active/{userId}
   */
  async getActiveSession(userId: number, factoryId?: string): Promise<WorkSession | null> {
    try {
      const response = await apiClient.get<any>(
        `${this.getPath(factoryId)}/active/${userId}`
      );
      return response.data || null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 8. 获取用户工作会话列表
   * GET /api/mobile/{factoryId}/work-sessions/user/{userId}
   */
  async getUserSessions(userId: number, factoryId?: string): Promise<WorkSession[]> {
    const response = await apiClient.get<any>(
      `${this.getPath(factoryId)}/user/${userId}`
    );
    return response.data || response || [];
  }

  /**
   * 9. 按时间范围查询
   * GET /api/mobile/{factoryId}/work-sessions/date-range
   */
  async getSessionsByDateRange(params: {
    startTime: string;
    endTime: string;
    factoryId?: string;
  }): Promise<WorkSession[]> {
    const { factoryId, ...queryParams } = params;
    const response = await apiClient.get<any>(
      `${this.getPath(factoryId)}/date-range`,
      { params: queryParams }
    );
    return response.data || response || [];
  }

  /**
   * 10. 按工作类型查询
   * GET /api/mobile/{factoryId}/work-sessions/work-type/{workTypeId}
   */
  async getSessionsByWorkType(workTypeId: number, factoryId?: string): Promise<WorkSession[]> {
    const response = await apiClient.get<any>(
      `${this.getPath(factoryId)}/work-type/${workTypeId}`
    );
    return response.data || response || [];
  }

  /**
   * 11. 获取工作会话统计
   * GET /api/mobile/{factoryId}/work-sessions/stats
   */
  async getSessionStats(params: {
    startTime: string;
    endTime: string;
    factoryId?: string;
  }): Promise<SessionStats> {
    const { factoryId, ...queryParams } = params;
    const response = await apiClient.get<any>(
      `${this.getPath(factoryId)}/stats`,
      { params: queryParams }
    );
    return response.data || response;
  }

  /**
   * 12. 获取用户工时统计
   * GET /api/mobile/{factoryId}/work-sessions/user/{userId}/stats
   */
  async getUserStats(params: {
    userId: number;
    startTime: string;
    endTime: string;
    factoryId?: string;
  }): Promise<{ sessionCount: number; totalWorkMinutes: number; totalWorkHours: number }> {
    const { factoryId, userId, ...queryParams } = params;
    const response = await apiClient.get<any>(
      `${this.getPath(factoryId)}/user/${userId}/stats`,
      { params: queryParams }
    );
    return response.data || response;
  }
}

export const workSessionApiClient = new WorkSessionApiClient();
export default workSessionApiClient;
