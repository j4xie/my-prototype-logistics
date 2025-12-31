/**
 * 通知中心屏幕
 *
 * 功能：
 * - 通知列表展示（分页加载）
 * - 按类型筛选（全部/告警/信息/警告/成功/系统）
 * - 未读/已读状态区分
 * - 滑动删除单条通知
 * - 标记已读/全部已读
 * - 点击跳转到相关页面
 * - 下拉刷新
 *
 * @version 1.0.0
 * @since 2025-12-31
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { isAxiosError } from 'axios';
import {
  notificationApiClient,
  Notification,
  NotificationType,
} from '../../services/api/notificationApiClient';
import { logger } from '../../utils/logger';

const notificationLogger = logger.createContextLogger('NotificationCenter');

// 类型图标映射
const TYPE_ICONS: Record<NotificationType, string> = {
  ALERT: 'alert-circle',
  INFO: 'information',
  WARNING: 'alert',
  SUCCESS: 'check-circle',
  SYSTEM: 'cog',
};

// 类型颜色映射
const TYPE_COLORS: Record<NotificationType, string> = {
  ALERT: '#F44336',
  INFO: '#2196F3',
  WARNING: '#FF9800',
  SUCCESS: '#4CAF50',
  SYSTEM: '#9E9E9E',
};

const FILTER_OPTIONS: Array<{ label: string; value: NotificationType | 'ALL' }> = [
  { label: '全部', value: 'ALL' },
  { label: '告警', value: 'ALERT' },
  { label: '信息', value: 'INFO' },
  { label: '警告', value: 'WARNING' },
  { label: '成功', value: 'SUCCESS' },
  { label: '系统', value: 'SYSTEM' },
];

export default function NotificationCenterScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<NotificationType | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // 加载通知列表
  const loadNotifications = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      try {
        if (pageNum === 1) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const params: {
          page: number;
          size: number;
          type?: NotificationType;
        } = {
          page: pageNum,
          size: 20,
        };

        if (selectedFilter !== 'ALL') {
          params.type = selectedFilter;
        }

        const response = await notificationApiClient.getNotifications(params);

        if (response.success && response.data) {
          const newNotifications = response.data.content;

          if (append) {
            setNotifications((prev) => [...prev, ...newNotifications]);
          } else {
            setNotifications(newNotifications);
          }

          setHasMore(response.data.page < response.data.totalPages);
          setPage(pageNum);
        }
      } catch (error) {
        notificationLogger.error('加载通知列表失败', error);
        if (isAxiosError(error)) {
          Alert.alert('错误', error.response?.data?.message || '加载通知列表失败');
        } else if (error instanceof Error) {
          Alert.alert('错误', error.message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [selectedFilter]
  );

  // 加载未读数量
  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await notificationApiClient.getUnreadCount();
      if (response.success && response.data) {
        setUnreadCount(response.data.count);
      }
    } catch (error) {
      notificationLogger.error('加载未读数量失败', error);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    loadNotifications(1);
    loadUnreadCount();
  }, [selectedFilter]);

  // 下拉刷新
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications(1);
    loadUnreadCount();
  }, [loadNotifications, loadUnreadCount]);

  // 加载更多
  const onLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadNotifications(page + 1, true);
    }
  }, [loadingMore, hasMore, page, loadNotifications]);

  // 标记单条为已读
  const markAsRead = useCallback(
    async (notification: Notification) => {
      if (notification.isRead) return;

      try {
        const response = await notificationApiClient.markAsRead(notification.id);
        if (response.success) {
          // 更新本地状态
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notification.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
            )
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
          notificationLogger.info('标记为已读成功', { id: notification.id });
        }
      } catch (error) {
        notificationLogger.error('标记已读失败', error);
      }
    },
    []
  );

  // 标记全部已读
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await notificationApiClient.markAllAsRead();
      if (response.success) {
        // 更新本地状态
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
        Alert.alert('成功', `已标记 ${response.data.updatedCount} 条通知为已读`);
        notificationLogger.info('全部标记已读成功', { count: response.data.updatedCount });
      }
    } catch (error) {
      notificationLogger.error('全部标记已读失败', error);
      if (isAxiosError(error)) {
        Alert.alert('错误', error.response?.data?.message || '操作失败');
      }
    }
  }, []);

  // 删除通知
  const deleteNotification = useCallback(async (notification: Notification) => {
    Alert.alert('确认删除', '确定要删除这条通知吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await notificationApiClient.deleteNotification(notification.id);
            if (response.success) {
              setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
              if (!notification.isRead) {
                setUnreadCount((prev) => Math.max(0, prev - 1));
              }
              notificationLogger.info('删除通知成功', { id: notification.id });
            }
          } catch (error) {
            notificationLogger.error('删除通知失败', error);
            if (isAxiosError(error)) {
              Alert.alert('错误', error.response?.data?.message || '删除失败');
            }
          }
        },
      },
    ]);
  }, []);

  // 点击通知项
  const onNotificationPress = useCallback(
    async (notification: Notification) => {
      // 标记为已读
      await markAsRead(notification);

      // 根据 source 跳转到相关页面
      if (notification.source && notification.sourceId) {
        switch (notification.source) {
          case 'SCHEDULING':
            // 跳转到调度计划详情
            navigation.navigate('PlanDetail', { planId: notification.sourceId });
            break;
          case 'BATCH':
            // 跳转到批次详情
            navigation.navigate('ProductionBatchDetail', { batchId: notification.sourceId });
            break;
          case 'QUALITY':
            // 跳转到质检详情
            navigation.navigate('QualityInspectionDetail', { inspectionId: notification.sourceId });
            break;
          case 'ALERT':
            // 跳转到告警详情
            navigation.navigate('AlertDetail', { alertId: notification.sourceId });
            break;
          default:
            // 未知来源，仅标记已读
            break;
        }
      }
    },
    [navigation, markAsRead]
  );

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  // 渲染通知项
  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const iconName = TYPE_ICONS[item.type];
    const iconColor = TYPE_COLORS[item.type];
    const isHighPriority = item.type === 'ALERT' || item.type === 'WARNING';

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.isRead && styles.notificationItemUnread,
          isHighPriority && styles.notificationItemHighPriority,
        ]}
        onPress={() => onNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name={iconName as keyof typeof MaterialCommunityIcons.glyphMap} size={24} color={iconColor} />
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.contentContainer}>
          <Text
            style={[styles.title, !item.isRead && styles.titleUnread]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <Text style={styles.content} numberOfLines={2}>
            {item.content}
          </Text>
          <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteNotification(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="close" size={18} color="#9E9E9E" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // 渲染空状态
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="bell-off-outline" size={64} color="#BDBDBD" />
      <Text style={styles.emptyText}>暂无通知</Text>
    </View>
  );

  // 渲染底部加载指示器
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#1976D2" />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 顶部栏 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#212121" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>通知中心</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
            <Text style={styles.markAllText}>全部已读</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 筛选栏 */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={FILTER_OPTIONS}
          keyExtractor={(item) => item.value}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedFilter === item.value && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedFilter(item.value)}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === item.value && styles.filterTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* 通知列表 */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976D2" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderNotificationItem}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#1976D2']}
            />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={notifications.length === 0 ? styles.emptyList : undefined}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // 平衡左侧返回按钮
  },
  markAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#E3F2FD',
  },
  markAllText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  filterButtonActive: {
    backgroundColor: '#1976D2',
  },
  filterText: {
    fontSize: 14,
    color: '#757575',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9E9E9E',
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginVertical: 4,
    marginHorizontal: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  notificationItemUnread: {
    backgroundColor: '#F3F8FF',
  },
  notificationItemHighPriority: {
    borderLeftColor: '#F44336',
  },
  iconContainer: {
    marginRight: 12,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F44336',
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    color: '#424242',
    marginBottom: 4,
  },
  titleUnread: {
    fontWeight: 'bold',
    color: '#212121',
  },
  content: {
    fontSize: 13,
    color: '#757575',
    lineHeight: 18,
    marginBottom: 6,
  },
  time: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
