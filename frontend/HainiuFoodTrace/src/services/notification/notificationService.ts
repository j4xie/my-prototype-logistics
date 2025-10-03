import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { StorageService } from '../storage/storageService';
import { AlertNotification } from '../api/alertApiClient';
import { NetworkManager } from '../networkManager';

/**
 * 推送通知服务
 * 处理告警的推送通知功能
 */
export class NotificationService {
  private static readonly NOTIFICATION_PERMISSION_KEY = 'notification_permission';
  private static readonly PUSH_TOKEN_KEY = 'push_token';

  /**
   * 初始化推送通知服务
   */
  static async initialize(): Promise<void> {
    try {
      // 设置通知处理器
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          console.log('收到通知:', notification);
          
          return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          };
        },
      });

      // 检查设备支持
      if (!Device.isDevice) {
        console.warn('推送通知仅在真实设备上工作');
        return;
      }

      // 请求通知权限
      await this.requestPermissions();

      // 获取推送令牌
      await this.registerForPushNotifications();

      console.log('推送通知服务初始化成功');
    } catch (error) {
      console.error('推送通知服务初始化失败:', error);
    }
  }

  /**
   * 请求通知权限
   */
  static async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      const hasPermission = finalStatus === 'granted';
      
      // 保存权限状态
      await StorageService.setItem(this.NOTIFICATION_PERMISSION_KEY, hasPermission.toString());

      if (!hasPermission) {
        console.warn('未获得推送通知权限');
        return false;
      }

      console.log('推送通知权限已获得');
      return true;
    } catch (error) {
      console.error('请求通知权限失败:', error);
      return false;
    }
  }

  /**
   * 注册推送通知
   */
  static async registerForPushNotifications(): Promise<string | null> {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: '默认',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });

        // 创建告警通知渠道
        await Notifications.setNotificationChannelAsync('alerts', {
          name: '系统告警',
          description: '重要的系统告警通知',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: '#FF4444',
          sound: 'default',
        });
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PROJECT_ID,
      });

      console.log('推送令牌获取成功:', token.data);

      // 保存推送令牌
      await StorageService.setSecureItem(this.PUSH_TOKEN_KEY, token.data);

      // TODO: 将推送令牌发送到后端
      await this.registerTokenWithBackend(token.data);

      return token.data;
    } catch (error) {
      console.error('注册推送通知失败:', error);
      return null;
    }
  }

  /**
   * 向后端注册推送令牌
   */
  private static async registerTokenWithBackend(token: string): Promise<void> {
    try {
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        console.log('网络不可用，稍后同步推送令牌');
        return;
      }

      // TODO: 实现向后端注册推送令牌的API调用
      console.log('向后端注册推送令牌:', token);
      
      // 示例 API 调用（需要后端支持）
      // const response = await apiClient.post('/api/mobile/notifications/register-token', {
      //   pushToken: token,
      //   platform: Platform.OS,
      // });
      
      // console.log('推送令牌注册成功:', response);
    } catch (error) {
      console.error('向后端注册推送令牌失败:', error);
    }
  }

  /**
   * 检查通知权限状态
   */
  static async hasNotificationPermission(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('检查通知权限失败:', error);
      return false;
    }
  }

  /**
   * 显示本地通知（用于测试或离线场景）
   */
  static async showLocalNotification(alert: AlertNotification): Promise<void> {
    try {
      const hasPermission = await this.hasNotificationPermission();
      if (!hasPermission) {
        console.warn('没有通知权限，无法显示通知');
        return;
      }

      const severityInfo = this.getSeverityInfo(alert.severity);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${severityInfo.emoji} ${alert.title}`,
          body: alert.message,
          data: {
            alertId: alert.id,
            alertType: alert.alertType,
            severity: alert.severity,
            type: 'alert_notification',
          },
          categoryIdentifier: 'alert',
          sound: alert.severity === 'critical' ? 'default' : true,
        },
        trigger: null, // 立即显示
      });

      console.log('本地通知已发送:', alert.id);
    } catch (error) {
      console.error('显示本地通知失败:', error);
    }
  }

  /**
   * 显示告警通知
   */
  static async showAlertNotification(alert: AlertNotification, options?: {
    sound?: boolean;
    vibrate?: boolean;
  }): Promise<void> {
    try {
      const hasPermission = await this.hasNotificationPermission();
      if (!hasPermission) {
        console.warn('没有通知权限，无法显示告警通知');
        return;
      }

      const severityInfo = this.getSeverityInfo(alert.severity);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${severityInfo.emoji} 系统告警`,
          body: `${alert.title}\n${alert.message}`,
          data: {
            alertId: alert.id,
            alertType: alert.alertType,
            severity: alert.severity,
            type: 'alert_notification',
            action: 'view_alert',
          },
          categoryIdentifier: 'alert',
          sound: options?.sound !== false && (alert.severity === 'critical' || alert.severity === 'high') ? 'default' : undefined,
        },
        trigger: null,
      });

      console.log('告警通知已发送:', alert.id);
    } catch (error) {
      console.error('显示告警通知失败:', error);
    }
  }

  /**
   * 批量显示告警通知
   */
  static async showBatchAlertNotifications(alerts: AlertNotification[]): Promise<void> {
    try {
      if (alerts.length === 0) return;

      const hasPermission = await this.hasNotificationPermission();
      if (!hasPermission) {
        console.warn('没有通知权限，无法显示批量告警通知');
        return;
      }

      // 按严重程度分组
      const criticalAlerts = alerts.filter(a => a.severity === 'critical');
      const highAlerts = alerts.filter(a => a.severity === 'high');
      const otherAlerts = alerts.filter(a => !['critical', 'high'].includes(a.severity));

      // 显示紧急告警
      if (criticalAlerts.length > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚨 紧急告警',
            body: `收到 ${criticalAlerts.length} 个紧急告警，请立即处理`,
            data: {
              alertCount: criticalAlerts.length,
              severity: 'critical',
              type: 'batch_alert_notification',
              action: 'view_alerts',
            },
            sound: 'default',
          },
          trigger: null,
        });
      }

      // 显示高级告警
      if (highAlerts.length > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ 高级告警',
            body: `收到 ${highAlerts.length} 个高级告警`,
            data: {
              alertCount: highAlerts.length,
              severity: 'high',
              type: 'batch_alert_notification',
              action: 'view_alerts',
            },
            sound: true,
          },
          trigger: null,
        });
      }

      // 显示其他告警（合并显示）
      if (otherAlerts.length > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '📋 系统通知',
            body: `收到 ${otherAlerts.length} 个系统告警`,
            data: {
              alertCount: otherAlerts.length,
              type: 'batch_alert_notification',
              action: 'view_alerts',
            },
          },
          trigger: null,
        });
      }

      console.log(`批量告警通知已发送，共 ${alerts.length} 个告警`);
    } catch (error) {
      console.error('显示批量告警通知失败:', error);
    }
  }

  /**
   * 设置通知监听器
   */
  static setupNotificationListeners(): {
    foregroundSubscription: Notifications.Subscription;
    backgroundSubscription: Notifications.Subscription;
  } {
    // 前台通知监听器
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('前台收到通知:', notification);
      
      // 可以在这里处理前台通知的自定义逻辑
      const notificationData = notification.request.content.data;
      
      if (notificationData?.type === 'alert_notification') {
        console.log('收到告警通知:', notificationData);
        // 可以触发告警列表刷新等操作
      }
    });

    // 后台/点击通知监听器
    const backgroundSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('点击通知:', response);
      
      const notificationData = response.notification.request.content.data;
      
      if (notificationData?.type === 'alert_notification') {
        console.log('点击告警通知:', notificationData);
        // 导航到告警详情页面
        this.handleAlertNotificationClick(notificationData);
      } else if (notificationData?.type === 'batch_alert_notification') {
        console.log('点击批量告警通知:', notificationData);
        // 导航到告警列表页面
        this.handleBatchAlertNotificationClick(notificationData);
      }
    });

    return { foregroundSubscription, backgroundSubscription };
  }

  /**
   * 处理告警通知点击
   */
  private static handleAlertNotificationClick(notificationData: any): void {
    try {
      console.log('处理告警通知点击:', notificationData);
      
      // TODO: 实现导航到告警详情页面的逻辑
      // 可以使用 React Navigation 的深度链接功能
      // 或者发送事件给应用程序来处理导航
      
      const alertId = notificationData.alertId;
      if (alertId) {
        console.log('导航到告警详情页面:', alertId);
        // 示例: NavigationService.navigate('AlertDetail', { alertId });
      }
    } catch (error) {
      console.error('处理告警通知点击失败:', error);
    }
  }

  /**
   * 处理批量告警通知点击
   */
  private static handleBatchAlertNotificationClick(notificationData: any): void {
    try {
      console.log('处理批量告警通知点击:', notificationData);
      
      // TODO: 实现导航到告警列表页面的逻辑
      console.log('导航到告警列表页面');
      // 示例: NavigationService.navigate('AlertList');
    } catch (error) {
      console.error('处理批量告警通知点击失败:', error);
    }
  }

  /**
   * 清除所有通知
   */
  static async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('所有通知已清除');
    } catch (error) {
      console.error('清除通知失败:', error);
    }
  }

  /**
   * 取消所有待发送的通知
   */
  static async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('所有待发送通知已取消');
    } catch (error) {
      console.error('取消通知失败:', error);
    }
  }

  /**
   * 获取未读通知数量
   */
  static async getBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('获取徽章数量失败:', error);
      return 0;
    }
  }

  /**
   * 设置应用徽章数量
   */
  static async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
      console.log('应用徽章数量已设置:', count);
    } catch (error) {
      console.error('设置徽章数量失败:', error);
    }
  }

  /**
   * 获取严重程度信息
   */
  private static getSeverityInfo(severity: AlertNotification['severity']): {
    emoji: string;
    color: string;
  } {
    const severityMap = {
      critical: { emoji: '🚨', color: '#FF4444' },
      high: { emoji: '⚠️', color: '#FF8800' },
      medium: { emoji: '⚡', color: '#FFBB33' },
      low: { emoji: '📋', color: '#00AA88' }
    };
    return severityMap[severity] || severityMap.medium;
  }

  /**
   * 获取推送令牌
   */
  static async getPushToken(): Promise<string | null> {
    try {
      return await StorageService.getSecureItem(this.PUSH_TOKEN_KEY);
    } catch (error) {
      console.error('获取推送令牌失败:', error);
      return null;
    }
  }

  /**
   * 检查通知设置状态
   */
  static async getNotificationSettings(): Promise<{
    hasPermission: boolean;
    pushToken: string | null;
  }> {
    try {
      const hasPermission = await this.hasNotificationPermission();
      const pushToken = await this.getPushToken();
      
      return {
        hasPermission,
        pushToken
      };
    } catch (error) {
      console.error('获取通知设置失败:', error);
      return {
        hasPermission: false,
        pushToken: null
      };
    }
  }
}