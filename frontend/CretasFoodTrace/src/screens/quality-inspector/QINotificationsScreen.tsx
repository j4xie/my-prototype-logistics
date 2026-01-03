/**
 * 通知列表页面
 * Quality Inspector - Notifications Screen
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { QI_COLORS } from '../../types/qualityInspector';
import { qualityInspectorApi } from '../../services/api/qualityInspectorApi';
import { useAuthStore } from '../../store/authStore';

interface Notification {
  id: string;
  type: 'urgent' | 'info' | 'success' | 'warning';
  title: string;
  content: string;
  time: string;
  read: boolean;
}

type FilterType = 'all' | 'unread' | 'urgent';

const NOTIFICATION_ICONS: Record<Notification['type'], { icon: string; color: string; bg: string }> = {
  urgent: { icon: 'warning', color: '#D32F2F', bg: '#FFEBEE' },
  info: { icon: 'information-circle', color: '#1976D2', bg: '#E3F2FD' },
  success: { icon: 'checkmark-circle', color: '#388E3C', bg: '#E8F5E9' },
  warning: { icon: 'alert-circle', color: '#F57C00', bg: '#FFF3E0' },
};

export default function QINotificationsScreen() {
  const { t } = useTranslation('quality');
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const factoryId = user?.factoryId;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    if (factoryId) {
      qualityInspectorApi.setFactoryId(factoryId);
      loadNotifications();
    }
  }, [factoryId]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      // TODO: 调用 API 获取通知
      // const data = await qualityInspectorApi.getNotifications();

      // 模拟数据
      const mockData: Notification[] = [
        {
          id: '1',
          type: 'urgent',
          title: '紧急质检任务',
          content: '批次 PB-20251228-001 需要立即进行质检，已等待超过2小时',
          time: '5分钟前',
          read: false,
        },
        {
          id: '2',
          type: 'warning',
          title: '质检异常提醒',
          content: '批次 PB-20251228-002 的外观评分低于标准，请关注',
          time: '30分钟前',
          read: false,
        },
        {
          id: '3',
          type: 'success',
          title: '质检完成通知',
          content: '您今日已完成12批次质检，合格率92%',
          time: '1小时前',
          read: true,
        },
        {
          id: '4',
          type: 'info',
          title: '系统维护通知',
          content: '今晚22:00-23:00将进行系统维护，届时部分功能可能无法使用',
          time: '2小时前',
          read: true,
        },
        {
          id: '5',
          type: 'info',
          title: '考勤提醒',
          content: '您今日尚未打上班卡，请尽快完成打卡',
          time: '3小时前',
          read: true,
        },
      ];

      setNotifications(mockData);
    } catch (error) {
      console.error(t('notifications.loading'), error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, []);

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    Alert.alert(t('notifications.markAllRead'), t('notifications.confirmMarkAll'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: () => {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        },
      },
    ]);
  };

  const handleDelete = (id: string) => {
    Alert.alert(t('notifications.deleteNotification'), t('notifications.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('notifications.delete'),
        style: 'destructive',
        onPress: () => {
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        },
      },
    ]);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'urgent') return n.type === 'urgent';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderFilterTab = (type: FilterType, label: string, count?: number) => (
    <TouchableOpacity
      style={[styles.filterTab, filter === type && styles.filterTabActive]}
      onPress={() => setFilter(type)}
    >
      <Text style={[styles.filterText, filter === type && styles.filterTextActive]}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={[styles.filterBadge, filter === type && styles.filterBadgeActive]}>
          <Text style={[styles.filterBadgeText, filter === type && styles.filterBadgeTextActive]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const iconConfig = NOTIFICATION_ICONS[item.type];

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.read && styles.notificationUnread]}
        onPress={() => handleMarkAsRead(item.id)}
        onLongPress={() => handleDelete(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconConfig.bg }]}>
          <Ionicons name={iconConfig.icon as any} size={22} color={iconConfig.color} />
        </View>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={[styles.notificationTitle, !item.read && styles.titleUnread]}>
              {item.title}
            </Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notificationText} numberOfLines={2}>
            {item.content}
          </Text>
          <Text style={styles.notificationTime}>{item.time}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={64} color={QI_COLORS.disabled} />
      <Text style={styles.emptyTitle}>{t('notifications.noNotifications')}</Text>
      <Text style={styles.emptySubtitle}>
        {filter === 'unread' ? t('notifications.noUnread') : filter === 'urgent' ? t('notifications.noUrgent') : t('notifications.emptyList')}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={QI_COLORS.primary} />
        <Text style={styles.loadingText}>{t('notifications.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 筛选栏 */}
      <View style={styles.filterBar}>
        <View style={styles.filterTabs}>
          {renderFilterTab('all', t('notifications.all'))}
          {renderFilterTab('unread', t('notifications.unread'), unreadCount)}
          {renderFilterTab('urgent', t('notifications.urgent'))}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllAsRead}>
            <Text style={styles.markAllText}>{t('notifications.markAllRead')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 通知列表 */}
      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotificationItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[QI_COLORS.primary]}
          />
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QI_COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: QI_COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    color: QI_COLORS.textSecondary,
    fontSize: 14,
  },

  // 筛选栏
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: QI_COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: QI_COLORS.border,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: QI_COLORS.background,
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: QI_COLORS.primary,
  },
  filterText: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: QI_COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  filterBadgeTextActive: {
    color: '#fff',
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 14,
    color: QI_COLORS.primary,
  },

  // 列表
  listContent: {
    padding: 16,
  },

  // 通知项
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  notificationUnread: {
    borderLeftWidth: 3,
    borderLeftColor: QI_COLORS.primary,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  notificationTitle: {
    fontSize: 15,
    color: QI_COLORS.text,
    flex: 1,
  },
  titleUnread: {
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: QI_COLORS.primary,
    marginLeft: 8,
  },
  notificationText: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: QI_COLORS.disabled,
  },

  // 空状态
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: QI_COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },
});
