import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NotificationService } from '../services/notification/notificationService';
import { AlertService } from '../services/alert/alertService';
import { useNavigation } from '@react-navigation/native';

/**
 * 推送通知钩子
 * 管理应用的推送通知功能
 */
export const useNotifications = () => {
  const navigation = useNavigation();
  const appState = useRef(AppState.currentState);
  const notificationListeners = useRef<{
    foregroundSubscription?: Notifications.Subscription;
    backgroundSubscription?: Notifications.Subscription;
  }>({});

  useEffect(() => {
    let mounted = true;

    // 初始化推送通知
    const initializeNotifications = async () => {
      try {
        await NotificationService.initialize();
        
        if (mounted) {
          // 设置通知监听器
          const listeners = NotificationService.setupNotificationListeners();
          notificationListeners.current = listeners;
          
          // 设置自定义点击处理
          setupNotificationHandlers();
          
          console.log('推送通知钩子初始化成功');
        }
      } catch (error) {
        console.error('推送通知钩子初始化失败:', error);
      }
    };

    // 监听应用状态变化
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('应用进入前台，检查新告警');
        // 应用从后台进入前台时，检查是否有新告警
        checkForNewAlerts();
      }
      appState.current = nextAppState;
    };

    // 设置通知处理器
    const setupNotificationHandlers = () => {
      // 重新设置前台通知处理
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          console.log('收到前台通知:', notification);
          
          const notificationData = notification.request.content.data;
          
          // 根据通知类型决定是否显示
          if (notificationData?.type === 'alert_notification') {
            // 告警通知始终显示
            return {
              shouldShowAlert: true,
              shouldPlaySound: notificationData.severity === 'critical' || notificationData.severity === 'high',
              shouldSetBadge: true,
            };
          }
          
          return {
            shouldShowAlert: true,
            shouldPlaySound: false,
            shouldSetBadge: true,
          };
        },
      });
    };

    // 检查新告警
    const checkForNewAlerts = async () => {
      try {
        // 获取最近的告警
        const response = await AlertService.getAlerts({
          page: 1,
          limit: 5,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          useCache: false
        });

        if (response.success && response.data) {
          const recentAlerts = response.data.alerts.filter(alert => {
            // 检查是否是最近5分钟内的新告警
            const alertTime = new Date(alert.createdAt).getTime();
            const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
            return alertTime > fiveMinutesAgo && alert.status === 'new';
          });

          if (recentAlerts.length > 0) {
            console.log(`发现 ${recentAlerts.length} 个新告警`);
            
            // 显示批量通知
            await NotificationService.showBatchAlertNotifications(recentAlerts);
          }
        }
      } catch (error) {
        console.error('检查新告警失败:', error);
      }
    };

    initializeNotifications();

    // 添加应用状态监听器
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      mounted = false;
      
      // 清理监听器
      if (notificationListeners.current.foregroundSubscription) {
        notificationListeners.current.foregroundSubscription.remove();
      }
      if (notificationListeners.current.backgroundSubscription) {
        notificationListeners.current.backgroundSubscription.remove();
      }
      
      // 清理应用状态监听器
      appStateSubscription?.remove();
    };
  }, []);

  // 处理通知导航
  useEffect(() => {
    // 设置自定义的通知响应处理
    const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
      const notificationData = response.notification.request.content.data;
      
      if (notificationData?.type === 'alert_notification') {
        const alertId = notificationData.alertId;
        if (alertId) {
          console.log('导航到告警详情:', alertId);
          navigation.navigate('AlertDetail' as never, { alertId } as never);
        }
      } else if (notificationData?.type === 'batch_alert_notification') {
        console.log('导航到告警列表');
        navigation.navigate('AlertList' as never);
      }
    };

    // 检查是否有待处理的通知响应
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) {
        handleNotificationResponse(response);
      }
    });

  }, [navigation]);

  return {
    // 显示告警通知
    showAlertNotification: NotificationService.showAlertNotification,
    
    // 显示批量告警通知
    showBatchAlertNotifications: NotificationService.showBatchAlertNotifications,
    
    // 清除所有通知
    clearAllNotifications: NotificationService.clearAllNotifications,
    
    // 获取通知设置
    getNotificationSettings: NotificationService.getNotificationSettings,
    
    // 请求权限
    requestPermissions: NotificationService.requestPermissions,
    
    // 设置徽章数量
    setBadgeCount: NotificationService.setBadgeCount,
    
    // 获取徽章数量
    getBadgeCount: NotificationService.getBadgeCount,
  };
};