import { apiClient } from './apiClient';
import { requireFactoryId } from '../../utils/factoryIdHelper';
import { logger } from '../../utils/logger';

/**
 * 通知管理API客户端
 * 路径：/api/mobile/{factoryId}/notifications/*
 *
 * 核心功能：
 * - 通知列表查询（分页）
 * - 未读通知数量
 * - 标记已读/全部已读
 * - 删除通知
 *
 * @version 1.0.0
 * @since 2025-12-31
 */

const notificationLogger = logger.createContextLogger('NotificationAPI');

// ========== 类型定义 ==========

export type NotificationType = 'ALERT' | 'INFO' | 'WARNING' | 'SUCCESS' | 'SYSTEM';

export type NotificationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Notification {
  id: number;
  factoryId: string;
  userId?: number;
  title: string;
  content: string;
  type: NotificationType;
  isRead: boolean;
  readAt?: string;
  source?: string; // 来源：SCHEDULING, ALERT, BATCH, QUALITY, SYSTEM
  sourceId?: string; // 关联的业务ID
  actionUrl?: string; // 点击跳转的URL
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  content: Notification[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  code?: number;
  message: string;
  data: T;
}

// ========== API 客户端类 ==========

class NotificationApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = requireFactoryId(factoryId);
    return `/api/mobile/${currentFactoryId}/notifications`;
  }

  /**
   * 获取通知列表（分页）
   * GET /api/mobile/{factoryId}/notifications
   *
   * @param params 查询参数
   * @returns 分页通知列表
   */
  async getNotifications(params?: {
    page?: number;
    size?: number;
    type?: NotificationType;
    isRead?: boolean;
    factoryId?: string;
  }): Promise<ApiResponse<NotificationListResponse>> {
    const { factoryId, page = 1, size = 20, type, isRead } = params || {};

    notificationLogger.debug('获取通知列表', { page, size, type, isRead });

    const queryParams: Record<string, string | number | boolean> = {
      page,
      size,
    };

    if (type) queryParams.type = type;
    if (isRead !== undefined) queryParams.isRead = isRead;

    return await apiClient.get(this.getPath(factoryId), {
      params: queryParams,
    });
  }

  /**
   * 获取未读通知数量
   * GET /api/mobile/{factoryId}/notifications/unread-count
   *
   * @param factoryId 工厂ID
   * @returns 未读通知数量
   */
  async getUnreadCount(factoryId?: string): Promise<ApiResponse<{ count: number }>> {
    notificationLogger.debug('获取未读通知数量');
    return await apiClient.get(`${this.getPath(factoryId)}/unread-count`);
  }

  /**
   * 获取最近10条通知
   * GET /api/mobile/{factoryId}/notifications/recent
   *
   * @param factoryId 工厂ID
   * @returns 最近通知列表
   */
  async getRecentNotifications(
    factoryId?: string
  ): Promise<ApiResponse<Notification[]>> {
    notificationLogger.debug('获取最近通知');
    return await apiClient.get(`${this.getPath(factoryId)}/recent`);
  }

  /**
   * 获取通知详情
   * GET /api/mobile/{factoryId}/notifications/{id}
   *
   * @param id 通知ID
   * @param factoryId 工厂ID
   * @returns 通知详情
   */
  async getNotificationById(
    id: number,
    factoryId?: string
  ): Promise<ApiResponse<Notification>> {
    notificationLogger.debug('获取通知详情', { id });
    return await apiClient.get(`${this.getPath(factoryId)}/${id}`);
  }

  /**
   * 标记通知为已读
   * PUT /api/mobile/{factoryId}/notifications/{id}/read
   *
   * @param id 通知ID
   * @param factoryId 工厂ID
   * @returns 更新后的通知
   */
  async markAsRead(
    id: number,
    factoryId?: string
  ): Promise<ApiResponse<Notification>> {
    notificationLogger.info('标记通知为已读', { id });
    return await apiClient.put(`${this.getPath(factoryId)}/${id}/read`);
  }

  /**
   * 标记所有通知为已读
   * PUT /api/mobile/{factoryId}/notifications/mark-all-read
   *
   * @param factoryId 工厂ID
   * @returns 更新的数量
   */
  async markAllAsRead(
    factoryId?: string
  ): Promise<ApiResponse<{ updatedCount: number }>> {
    notificationLogger.info('标记所有通知为已读');
    return await apiClient.put(`${this.getPath(factoryId)}/mark-all-read`);
  }

  /**
   * 删除通知
   * DELETE /api/mobile/{factoryId}/notifications/{id}
   *
   * @param id 通知ID
   * @param factoryId 工厂ID
   */
  async deleteNotification(
    id: number,
    factoryId?: string
  ): Promise<ApiResponse<void>> {
    notificationLogger.info('删除通知', { id });
    return await apiClient.delete(`${this.getPath(factoryId)}/${id}`);
  }

  /**
   * 创建通知（系统内部使用）
   * POST /api/mobile/{factoryId}/notifications
   *
   * @param notification 通知数据
   * @param factoryId 工厂ID
   * @returns 创建的通知
   */
  async createNotification(
    notification: Partial<Notification>,
    factoryId?: string
  ): Promise<ApiResponse<Notification>> {
    notificationLogger.info('创建通知', { title: notification.title });
    return await apiClient.post(this.getPath(factoryId), notification);
  }
}

export const notificationApiClient = new NotificationApiClient();
