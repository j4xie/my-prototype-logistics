/**
 * 通知列表页面
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from 'react-native-paper';

interface Notification {
  id: string;
  type: 'task' | 'alert' | 'info' | 'success';
  title: string;
  content: string;
  time: string;
  isRead: boolean;
}

export function NotificationsScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  const [notifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'task',
      title: '新任务分配',
      content: '批次 PB-20251227-004 已分配给您，请及时处理',
      time: '5分钟前',
      isRead: false,
    },
    {
      id: '2',
      type: 'alert',
      title: '设备告警',
      content: '切片机A (EQ-001) 温度异常，请检查',
      time: '15分钟前',
      isRead: false,
    },
    {
      id: '3',
      type: 'info',
      title: '人员请假',
      content: '陈志强 (EMP-005) 今日请假',
      time: '1小时前',
      isRead: true,
    },
    {
      id: '4',
      type: 'success',
      title: '批次完成',
      content: '批次 PB-20251226-008 已完成，产量85kg',
      time: '昨天 16:30',
      isRead: true,
    },
  ]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
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

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>通知</Text>
        <TouchableOpacity>
          <Text style={styles.headerAction}>全部已读</Text>
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
            <Text style={styles.emptyText}>暂无通知</Text>
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
