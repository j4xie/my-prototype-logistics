/**
 * 考勤管理
 *
 * 功能:
 * - 今日/历史考勤记录
 * - 考勤统计
 * - 异常处理
 *
 * 对应原型: /docs/prd/prototype/hr-admin/attendance.html
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Text, Card, Searchbar, Chip, Avatar, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { timeclockApiClient } from '../../../services/api/timeclockApiClient';
import { HR_THEME } from '../../../types/hrNavigation';

type ViewMode = 'today' | 'history';

interface AttendanceRecord {
  id: string;
  userId: number;
  userName: string;
  userAvatar?: string;
  department?: string;
  clockInTime?: string;
  clockOutTime?: string;
  workMinutes?: number;
  status: 'normal' | 'late' | 'early_leave' | 'absent' | 'working';
  date: string;
}

export default function AttendanceManageScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('hr');

  const STATUS_CONFIG = {
    normal: { label: t('attendance.department.statusLabels.present'), color: HR_THEME.success, bgColor: '#f6ffed' },
    late: { label: t('attendance.department.statusLabels.late'), color: HR_THEME.warning, bgColor: '#fff7e6' },
    early_leave: { label: t('attendance.department.statusLabels.earlyLeave'), color: '#faad14', bgColor: '#fffbe6' },
    absent: { label: t('attendance.department.statusLabels.absent'), color: HR_THEME.danger, bgColor: '#fff2f0' },
    working: { label: t('attendance.manage.title'), color: HR_THEME.info, bgColor: '#e6f7ff' },
  };
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const loadData = useCallback(async () => {
    try {
      if (viewMode === 'today') {
        const res = await timeclockApiClient.getTodayRecords();
        // getTodayRecords 返回 ApiResponse<DepartmentAttendance>，记录在 data.records 中
        if (res?.data?.records) {
          const mappedRecords = res.data.records.map((r): AttendanceRecord => ({
            id: String(r.id || r.userId),
            userId: r.userId,
            userName: '用户' + r.userId, // TODO: 从用户列表获取名字
            department: undefined,
            clockInTime: r.clockInTime,
            clockOutTime: r.clockOutTime,
            workMinutes: r.workDuration,
            status: r.clockOutTime ? 'normal' : (r.clockInTime ? 'working' : 'absent'),
            date: new Date().toISOString().split('T')[0] ?? '',
          }));
          setRecords(mappedRecords);
        }
      } else {
        const res = await timeclockApiClient.getHistoryRecords({ page: 1, size: 50 });
        // getHistoryRecords 返回 ApiResponse<PagedResponse<ClockRecord>>
        if (res?.data?.content) {
          const mappedRecords = res.data.content.map((r): AttendanceRecord => ({
            id: String(r.id || r.userId),
            userId: r.userId,
            userName: '用户' + r.userId,
            department: undefined,
            clockInTime: r.clockInTime,
            clockOutTime: r.clockOutTime,
            workMinutes: r.workDuration,
            status: r.clockOutTime ? 'normal' : (r.clockInTime ? 'working' : 'absent'),
            date: r.createdAt?.split('T')[0] || '',
          }));
          setRecords(mappedRecords);
        }
      }
    } catch (error) {
      console.error(t('common.loading'), error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [viewMode]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const filteredData = records.filter(
    (item) =>
      item.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timeStr?: string): string => {
    if (!timeStr) return '-';
    const date = new Date(timeStr);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatMinutes = (minutes?: number): string => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const renderItem = ({ item }: { item: AttendanceRecord }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.normal;

    return (
      <Card style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Avatar.Text
            size={44}
            label={item.userName?.substring(0, 1) || 'U'}
            style={{ backgroundColor: HR_THEME.primary }}
          />
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{item.userName}</Text>
              <Chip
                mode="flat"
                textStyle={{ fontSize: 10, color: statusConfig.color }}
                style={[styles.statusChip, { backgroundColor: statusConfig.bgColor }]}
              >
                {statusConfig.label}
              </Chip>
            </View>
            <Text style={styles.department}>{item.department || t('staff.card.noDepartment')}</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeItem}>
                <MaterialCommunityIcons name="login" size={14} color={HR_THEME.success} />
                <Text style={styles.timeText}>{formatTime(item.clockInTime)}</Text>
              </View>
              <View style={styles.timeItem}>
                <MaterialCommunityIcons name="logout" size={14} color={HR_THEME.warning} />
                <Text style={styles.timeText}>{formatTime(item.clockOutTime)}</Text>
              </View>
              <View style={styles.timeItem}>
                <MaterialCommunityIcons name="clock" size={14} color={HR_THEME.info} />
                <Text style={styles.timeText}>{formatMinutes(item.workMinutes)}</Text>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading && records.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={HR_THEME.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('attendance.manage.title')}</Text>
      </View>

      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={viewMode}
          onValueChange={(value) => setViewMode(value as ViewMode)}
          buttons={[
            { value: 'today', label: t('attendance.department.today') },
            { value: 'history', label: t('attendance.history.title') },
          ]}
          style={styles.segmented}
        />
      </View>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder={t('staff.search.placeholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
        />
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="calendar-check-outline"
              size={64}
              color={HR_THEME.textMuted}
            />
            <Text style={styles.emptyText}>{t('attendance.department.noRecords')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HR_THEME.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: HR_THEME.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: HR_THEME.primary,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  filterContainer: {
    padding: 16,
    backgroundColor: HR_THEME.cardBackground,
  },
  segmented: {
    backgroundColor: HR_THEME.background,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: HR_THEME.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: HR_THEME.border,
  },
  searchbar: {
    backgroundColor: HR_THEME.background,
    elevation: 0,
  },
  listContent: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: HR_THEME.cardBackground,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: HR_THEME.textPrimary,
    marginRight: 8,
  },
  statusChip: {
    height: 22,
  },
  department: {
    fontSize: 13,
    color: HR_THEME.textSecondary,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  timeText: {
    fontSize: 12,
    color: HR_THEME.textSecondary,
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    color: HR_THEME.textMuted,
  },
});
