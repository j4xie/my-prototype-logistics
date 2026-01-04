/**
 * 通知列表页面
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon, ActivityIndicator } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { notificationApiClient, Notification as ApiNotification } from '../../../services/api/notificationApiClient';

interface Notification {
  id: string;
  type: 'task' | 'alert' | 'info' | 'success';
  title: string;
  content: string;
  time: string;
  isRead: boolean;
}

// Transform API notification type to UI type
function mapNotificationType(apiType: string): 'task' | 'alert' | 'info' | 'success' {
  switch (apiType) {
    case 'ALERT':
    case 'WARNING':
      return 'alert';
    case 'SUCCESS':
      return 'success';
    case 'INFO':
    case 'SYSTEM':
      return 'info';
    default:
      return 'task';
  }
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN');
}

export function NotificationsScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('workshop');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await notificationApiClient.getNotifications({
        page: 1,
        size: 50,
      });

      if (response.success && response.data?.content) {
        const transformed = response.data.content.map((item: ApiNotification) => ({
          id: String(item.id),
          type: mapNotificationType(item.type),
          title: item.title,
          content: item.content,
          time: formatRelativeTime(item.createdAt),
          isRead: item.isRead,
        }));
        setNotifications(transformed);
      }
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401) {
          Alert.alert('会话过期', '请重新登录');
        } else {
          console.error('加载通知失败:', error.response?.data?.message || error.message);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      const response = await notificationApiClient.markAllAsRead();
      if (response.success) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      }
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  }, []);

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'task':
        return { icon: 'clipboard-text', color: '#667eea', bg: '#f0f5ff' };
      case 'alert':
        return { icon: 'alert-circle', color: '#ff4d4f', bg: '#fff1f0' };
      case 'info':
        return { icon: 'information', color: '#1890ff', bg: '#e6f7ff' };
      case 'success':
        return { icon: 'check-circle', color: '#52c41a', bg: '#f6ffed' };
      default:
        return { icon: 'bell', color: '#666', bg: '#f5f5f5' };
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const typeStyle = getTypeStyle(item.type);
    return (
      <TouchableOpacity style={[styles.notificationCard, !item.isRead && styles.unread]}>
        <View style={[styles.iconContainer, { backgroundColor: typeStyle.bg }]}>
          <Icon source={typeStyle.icon} size={20} color={typeStyle.color} />
        </View>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={[styles.notificationTitle, !item.isRead && styles.unreadTitle]}>
              {item.title}
            </Text>
            <Text style={styles.notificationTime}>{item.time}</Text>
          </View>
          <Text style={styles.notificationText} numberOfLines={2}>
            {item.content}
          </Text>
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon source="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
        <TouchableOpacity onPress={handleMarkAllRead}>
          <Text style={styles.headerAction}>{t('notifications.markAllRead')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon source="bell-off-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#667eea',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerAction: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  listContainer: {
    padding: 16,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  unread: {
    backgroundColor: '#fafafa',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  unreadTitle: {
    fontWeight: '600',
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  notificationText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4d4f',
    marginLeft: 8,
    marginTop: 6,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
});

export default NotificationsScreen;
