/**
 * 排班管理
 *
 * 功能:
 * - 日历视图显示排班
 * - 班次分配情况
 * - 添加/编辑排班
 *
 * 对应原型: /docs/prd/prototype/hr-admin/work-schedule.html
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Text, Card, FAB, Avatar, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { schedulingApiClient } from '../../../services/api/schedulingApiClient';
import {
  HR_THEME,
  SHIFT_CONFIG,
  type WorkScheduleItem,
  type ShiftType,
} from '../../../types/hrNavigation';

export default function WorkScheduleScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [schedules, setSchedules] = useState<WorkScheduleItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      // getWorkSchedules takes { startDate, endDate?, ... } and returns { content, totalElements, totalPages } directly
      const res = await schedulingApiClient.getWorkSchedules({ startDate: dateStr, endDate: dateStr });

      if (res?.content) {
        setSchedules(res.content as WorkScheduleItem[]);
      }
    } catch (error) {
      console.error('加载排班数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const formatDate = (date: Date): string => {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${date.getMonth() + 1}月${date.getDate()}日 ${days[date.getDay()]}`;
  };

  const goToPrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
    setLoading(true);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
    setLoading(true);
  };

  const renderShiftCard = (schedule: WorkScheduleItem) => {
    const config = SHIFT_CONFIG[schedule.shiftType as ShiftType] || SHIFT_CONFIG.morning;

    return (
      <Card key={schedule.id} style={styles.shiftCard}>
        <Card.Content>
          <View style={styles.shiftHeader}>
            <View style={styles.shiftTitleRow}>
              <View
                style={[styles.shiftDot, { backgroundColor: config.color }]}
              />
              <Text style={styles.shiftTitle}>{config.label}</Text>
              <Text style={styles.shiftTime}>{config.timeRange}</Text>
            </View>
            <Text style={styles.shiftCount}>
              {schedule.confirmedCount}/{schedule.assignedCount}
            </Text>
          </View>

          <View style={styles.employeesRow}>
            {schedule.employees?.slice(0, 6).map((emp, index) => (
              <View
                key={emp.id}
                style={[
                  styles.employeeAvatar,
                  { marginLeft: index > 0 ? -12 : 0 },
                ]}
              >
                <Avatar.Text
                  size={32}
                  label={emp.name?.substring(0, 1) || 'U'}
                  style={{
                    backgroundColor: emp.isConfirmed
                      ? HR_THEME.success
                      : HR_THEME.warning,
                  }}
                />
              </View>
            ))}
            {(schedule.employees?.length || 0) > 6 && (
              <View style={[styles.employeeAvatar, { marginLeft: -12 }]}>
                <View style={styles.moreAvatar}>
                  <Text style={styles.moreText}>
                    +{(schedule.employees?.length || 0) - 6}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.shiftStats}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons
                name="check-circle"
                size={16}
                color={HR_THEME.success}
              />
              <Text style={styles.statText}>已确认 {schedule.confirmedCount}</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={16}
                color={HR_THEME.warning}
              />
              <Text style={styles.statText}>
                待确认 {schedule.assignedCount - schedule.confirmedCount}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={HR_THEME.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={HR_THEME.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>排班管理</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 日期选择器 */}
      <View style={styles.dateSelector}>
        <TouchableOpacity onPress={goToPrevDay} style={styles.dateArrow}>
          <MaterialCommunityIcons
            name="chevron-left"
            size={28}
            color={HR_THEME.textPrimary}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateDisplay}>
          <MaterialCommunityIcons
            name="calendar"
            size={20}
            color={HR_THEME.primary}
          />
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToNextDay} style={styles.dateArrow}>
          <MaterialCommunityIcons
            name="chevron-right"
            size={28}
            color={HR_THEME.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {schedules.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="calendar-blank-outline"
              size={64}
              color={HR_THEME.textMuted}
            />
            <Text style={styles.emptyText}>当日暂无排班安排</Text>
            <Text style={styles.emptySubtext}>点击下方按钮添加排班</Text>
          </View>
        ) : (
          schedules.map(renderShiftCard)
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          // TODO: 打开添加排班弹窗
        }}
        color="#fff"
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: HR_THEME.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: HR_THEME.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: HR_THEME.textPrimary,
  },
  placeholder: {
    width: 32,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: HR_THEME.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: HR_THEME.border,
  },
  dateArrow: {
    padding: 8,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: HR_THEME.primary + '10',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
    color: HR_THEME.textPrimary,
    marginLeft: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  shiftCard: {
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: HR_THEME.cardBackground,
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shiftTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shiftDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  shiftTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: HR_THEME.textPrimary,
  },
  shiftTime: {
    fontSize: 12,
    color: HR_THEME.textSecondary,
    marginLeft: 8,
  },
  shiftCount: {
    fontSize: 16,
    fontWeight: '600',
    color: HR_THEME.primary,
  },
  employeesRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  employeeAvatar: {
    zIndex: 1,
  },
  moreAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: HR_THEME.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  shiftStats: {
    flexDirection: 'row',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: HR_THEME.border,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statText: {
    fontSize: 13,
    color: HR_THEME.textSecondary,
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: HR_THEME.textSecondary,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: HR_THEME.textMuted,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: HR_THEME.primary,
  },
  bottomSpacer: {
    height: 80,
  },
});
