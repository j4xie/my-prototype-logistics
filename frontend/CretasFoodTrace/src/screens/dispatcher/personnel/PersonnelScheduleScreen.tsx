/**
 * 人员排班日历页面
 *
 * 功能:
 * - 周/月/列表视图切换
 * - 周选择器导航
 * - 班次统计概览
 * - 车间筛选
 * - 周历表格显示排班人数
 * - 今日班次详情及人员列表
 * - 快捷操作(复制上周、AI智能排班)
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { schedulingApiClient } from '../../../services/api/schedulingApiClient';

// 主题色
const DISPATCHER_THEME = {
  primary: '#722ed1',
  secondary: '#a18cd1',
  accent: '#fbc2eb',
  success: '#52c41a',
  warning: '#fa8c16',
  danger: '#ff4d4f',
  info: '#1890ff',
  background: '#f5f5f5',
  cardBackground: '#ffffff',
};

// 班次类型
type ShiftType = 'morning' | 'afternoon' | 'evening';

// 班次数据
interface ShiftData {
  [dayIndex: number]: {
    count: number;
    status?: 'normal' | 'warning' | 'pending' | 'overtime';
  };
}

// 班次详情
interface ShiftDetail {
  type: ShiftType;
  name: string;
  timeRange: string;
  workers: { id: string; name: string; avatar: string }[];
}

// Static data for week display
const weekDayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
const weekDates = [23, 24, 25, 26, 27, 28, 29];
const todayIndex = 5; // 周六

// Schedule stats interface
interface ScheduleStats {
  total: number;
  confirmed: number;
  pending: number;
  conflicts: number;
}

// Transform API schedule stats to local interface
const transformScheduleStats = (apiData: any): ScheduleStats => ({
  total: apiData.total || apiData.totalShifts || 0,
  confirmed: apiData.confirmed || apiData.confirmedShifts || 0,
  pending: apiData.pending || apiData.pendingShifts || 0,
  conflicts: apiData.conflicts || apiData.conflictCount || 0,
});

// Transform API weekly shifts to local interface
const transformWeeklyShifts = (apiData: any[]): { type: ShiftType; time: string; data: ShiftData }[] => {
  if (!apiData || !Array.isArray(apiData)) return [];
  return apiData.map((shift) => {
    const shiftType = (shift.type || shift.shiftType || 'morning').toLowerCase() as ShiftType;
    const shiftData: ShiftData = {};

    // Transform daily data
    const dailyData = shift.data || shift.dailySchedule || shift.days || {};
    for (let i = 0; i < 7; i++) {
      const dayKey = dailyData[i] || dailyData[weekDayKeys[i]] || {};
      shiftData[i] = {
        count: dayKey.count || dayKey.workerCount || 0,
        status: dayKey.status as any || undefined,
      };
    }

    return {
      type: shiftType,
      time: shift.time || shift.timeRange || getDefaultShiftTime(shiftType),
      data: shiftData,
    };
  });
};

// Get default time range for shift type
const getDefaultShiftTime = (type: ShiftType): string => {
  switch (type) {
    case 'morning': return '08-12';
    case 'afternoon': return '12-18';
    case 'evening': return '18-22';
    default: return '';
  }
};

// Transform API today shifts to local interface
const transformTodayShifts = (apiData: any[]): ShiftDetail[] => {
  if (!apiData || !Array.isArray(apiData)) return [];
  return apiData.map((shift) => {
    const workers = (shift.workers || shift.assignedWorkers || []).map((w: any) => ({
      id: String(w.id || w.workerId || w.userId),
      name: w.name || w.workerName || w.realName || '',
      avatar: (w.name || w.realName || '员').charAt(0),
    }));

    return {
      type: (shift.type || shift.shiftType || 'morning').toLowerCase() as ShiftType,
      name: shift.name || shift.shiftName || shift.type || 'morning',
      timeRange: shift.timeRange || shift.time || '08:00-12:00',
      workers,
    };
  });
};

const workshopFilterKeys = ['all', 'slicing', 'packaging', 'freezing', 'storage'];

export default function PersonnelScheduleScreen() {
  const { t } = useTranslation('dispatcher');
  const navigation = useNavigation<any>();

  // Loading and data state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scheduleStats, setScheduleStats] = useState<ScheduleStats>({
    total: 0, confirmed: 0, pending: 0, conflicts: 0
  });
  const [weeklyShifts, setWeeklyShifts] = useState<{ type: ShiftType; time: string; data: ShiftData }[]>([]);
  const [todayShifts, setTodayShifts] = useState<ShiftDetail[]>([]);

  // UI state
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'list'>('week');
  const [selectedWorkshopKey, setSelectedWorkshopKey] = useState('slicing');
  const [weekOffset, setWeekOffset] = useState(0);

  /**
   * Load schedule data from API
   */
  const loadScheduleData = useCallback(async () => {
    try {
      // Load schedule stats
      const statsResponse = await schedulingApiClient.getScheduleStats();
      if (statsResponse.success && statsResponse.data) {
        setScheduleStats(transformScheduleStats(statsResponse.data));
      }

      // Load weekly shifts
      const shiftsResponse = await schedulingApiClient.getWeeklyShifts(weekOffset);
      if (shiftsResponse.success && shiftsResponse.data) {
        const shiftsData = Array.isArray(shiftsResponse.data)
          ? shiftsResponse.data
          : shiftsResponse.data.shifts || shiftsResponse.data.content || [];
        setWeeklyShifts(transformWeeklyShifts(shiftsData));
      }

      // Load today's shifts
      const todayResponse = await schedulingApiClient.getTodayShifts();
      if (todayResponse.success && todayResponse.data) {
        const todayData = Array.isArray(todayResponse.data)
          ? todayResponse.data
          : todayResponse.data.shifts || todayResponse.data.content || [];
        setTodayShifts(transformTodayShifts(todayData));
      }
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401) {
          Alert.alert(t('common.error'), t('common.sessionExpired'));
          navigation.goBack();
          return;
        }
        console.error('Failed to load schedule data:', error.response?.data?.message || error.message);
      } else {
        console.error('Unexpected error loading schedule data:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [navigation, t, weekOffset]);

  // Load data on mount and when weekOffset changes
  useEffect(() => {
    loadScheduleData();
  }, [loadScheduleData]);

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadScheduleData();
    setRefreshing(false);
  }, [loadScheduleData]);

  // 获取班次格子样式
  const getCellStyle = (count: number, status?: string) => {
    if (count === 0) return styles.cellCountEmpty;
    if (status === 'warning' || status === 'pending') return styles.cellCountWarning;
    return styles.cellCountNormal;
  };

  // 获取班次Badge样式
  const getShiftBadgeStyle = (type: ShiftType) => {
    switch (type) {
      case 'morning':
        return styles.shiftBadgeMorning;
      case 'afternoon':
        return styles.shiftBadgeAfternoon;
      case 'evening':
        return styles.shiftBadgeEvening;
    }
  };

  // 复制上周排班
  const handleCopyLastWeek = () => {
    Alert.alert(
      t('personnelScheduleScreen.copyLastWeekTitle'),
      t('personnelScheduleScreen.copyLastWeekMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => Alert.alert(t('common.success'), t('personnelScheduleScreen.copyLastWeekSuccess')),
        },
      ]
    );
  };

  // AI智能排班
  const handleAISchedule = () => {
    navigation.navigate('AIWorkerOptimize');
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient
          colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('personnelScheduleScreen.title')}</Text>
          <View style={styles.addButton} />
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 顶部渐变标题栏 */}
      <LinearGradient
        colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('personnelScheduleScreen.title')}</Text>
        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[DISPATCHER_THEME.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 视图切换 */}
        <View style={styles.viewTabs}>
          {(['week', 'month', 'list'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.viewTab,
                viewMode === mode && styles.viewTabActive,
              ]}
              onPress={() => setViewMode(mode)}
            >
              {viewMode === mode ? (
                <LinearGradient
                  colors={[DISPATCHER_THEME.secondary, DISPATCHER_THEME.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.viewTabGradient}
                >
                  <Text style={styles.viewTabTextActive}>
                    {t(`personnelScheduleScreen.viewModes.${mode}`)}
                  </Text>
                </LinearGradient>
              ) : (
                <Text style={styles.viewTabText}>
                  {t(`personnelScheduleScreen.viewModes.${mode}`)}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* 周选择器 */}
        <View style={styles.weekSelector}>
          <TouchableOpacity
            style={styles.weekNavBtn}
            onPress={() => setWeekOffset(weekOffset - 1)}
          >
            <Ionicons name="chevron-back" size={18} color={DISPATCHER_THEME.primary} />
          </TouchableOpacity>
          <View style={styles.weekInfo}>
            <Text style={styles.weekTitle}>{t('personnelScheduleScreen.weekTitle', { year: 2025, month: 12, week: 4 })}</Text>
            <Text style={styles.weekRange}>{t('personnelScheduleScreen.weekRange', { startMonth: 12, startDay: 23, endMonth: 12, endDay: 29 })}</Text>
          </View>
          <TouchableOpacity
            style={styles.weekNavBtn}
            onPress={() => setWeekOffset(weekOffset + 1)}
          >
            <Ionicons name="chevron-forward" size={18} color={DISPATCHER_THEME.primary} />
          </TouchableOpacity>
        </View>

        {/* 班次统计 */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: DISPATCHER_THEME.primary }]}>
              {scheduleStats.total}
            </Text>
            <Text style={styles.statLabel}>{t('personnelScheduleScreen.stats.thisWeek')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: DISPATCHER_THEME.success }]}>
              {scheduleStats.confirmed}
            </Text>
            <Text style={styles.statLabel}>{t('personnelScheduleScreen.stats.confirmed')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: DISPATCHER_THEME.warning }]}>
              {scheduleStats.pending}
            </Text>
            <Text style={styles.statLabel}>{t('personnelScheduleScreen.stats.pending')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: DISPATCHER_THEME.danger }]}>
              {scheduleStats.conflicts}
            </Text>
            <Text style={styles.statLabel}>{t('personnelScheduleScreen.stats.conflicts')}</Text>
          </View>
        </View>

        {/* 车间筛选 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {workshopFilterKeys.map((workshopKey) => (
            <TouchableOpacity
              key={workshopKey}
              style={[
                styles.filterChip,
                selectedWorkshopKey === workshopKey && styles.filterChipActive,
              ]}
              onPress={() => setSelectedWorkshopKey(workshopKey)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedWorkshopKey === workshopKey && styles.filterChipTextActive,
                ]}
              >
                {t(`personnelScheduleScreen.workshops.${workshopKey}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 周历表格 */}
        <View style={styles.calendar}>
          {/* 表头 */}
          <View style={styles.calendarHeader}>
            <View style={styles.calendarCorner} />
            {weekDays.map((day, index) => (
              <View
                key={day}
                style={[
                  styles.calendarHeaderCell,
                  index === todayIndex && styles.calendarHeaderToday,
                ]}
              >
                <Text style={styles.dayName}>{day}</Text>
                <View style={[
                  styles.dayNumContainer,
                  index === todayIndex && styles.dayNumToday,
                ]}>
                  <Text style={[
                    styles.dayNum,
                    index === todayIndex && styles.dayNumTextToday,
                  ]}>
                    {weekDates[index]}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* 班次行 */}
          {weeklyShifts.map((shift) => (
            <View key={shift.type} style={styles.calendarRow}>
              <View style={styles.shiftLabel}>
                <Text style={styles.shiftName}>{t(`personnelScheduleScreen.shifts.${shift.type}`)}</Text>
                <Text style={styles.shiftTime}>{shift.time}</Text>
              </View>
              {Array.from({ length: 7 }).map((_, dayIndex) => {
                const dayData = shift.data[dayIndex];
                const count = dayData?.count ?? 0;
                const status = dayData?.status;
                return (
                  <TouchableOpacity
                    key={dayIndex}
                    style={[
                      styles.calendarCell,
                      dayIndex === todayIndex && styles.calendarCellToday,
                    ]}
                  >
                    <Text style={getCellStyle(count, status)}>
                      {count === 0 ? '-' : count}
                    </Text>
                    {status === 'overtime' && (
                      <Text style={styles.cellStatus}>加班</Text>
                    )}
                    {status === 'pending' && (
                      <Text style={styles.cellStatus}>待审</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* 今日班次详情 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>今日排班 (12.28 周六)</Text>
          <Text style={styles.sectionSubtitle}>{t(`personnelScheduleScreen.workshops.${selectedWorkshopKey}`)}车间</Text>
        </View>

        {todayShifts.map((shift) => (
          <View key={shift.type} style={styles.shiftDetailCard}>
            <View style={styles.shiftDetailHeader}>
              <View style={styles.shiftDetailTitle}>
                <View style={[styles.shiftBadge, getShiftBadgeStyle(shift.type)]}>
                  <Text style={[
                    styles.shiftBadgeText,
                    shift.type === 'morning' && { color: DISPATCHER_THEME.info },
                    shift.type === 'afternoon' && { color: DISPATCHER_THEME.warning },
                    shift.type === 'evening' && { color: DISPATCHER_THEME.danger },
                  ]}>
                    {shift.name}
                  </Text>
                </View>
                <Text style={styles.shiftTimeLabel}>{shift.timeRange}</Text>
              </View>
              <Text style={styles.shiftCount}>{shift.workers.length}人</Text>
            </View>
            <View style={styles.workerAvatars}>
              {shift.workers.map((worker) => (
                <LinearGradient
                  key={worker.id}
                  colors={[DISPATCHER_THEME.secondary, DISPATCHER_THEME.accent]}
                  style={styles.workerAvatar}
                >
                  <Text style={styles.workerAvatarText}>{worker.avatar}</Text>
                </LinearGradient>
              ))}
              <TouchableOpacity style={styles.addWorkerBtn}>
                <Ionicons name="add" size={18} color="#999" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* 快捷操作 */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionSecondary}
            onPress={handleCopyLastWeek}
          >
            <Ionicons name="copy-outline" size={18} color="#666" />
            <Text style={styles.quickActionSecondaryText}>复制上周</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionPrimary}
            onPress={handleAISchedule}
          >
            <LinearGradient
              colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.quickActionPrimaryGradient}
            >
              <Ionicons name="flash" size={18} color="#fff" />
              <Text style={styles.quickActionPrimaryText}>AI 智能排班</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* 底部间距 */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DISPATCHER_THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  viewTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  viewTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewTabActive: {},
  viewTabGradient: {
    flex: 1,
    width: '100%',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewTabText: {
    fontSize: 14,
    color: '#666',
  },
  viewTabTextActive: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  weekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  weekNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekInfo: {
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  weekRange: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  filterScroll: {
    marginBottom: 16,
  },
  filterContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: DISPATCHER_THEME.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  calendar: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  calendarHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  calendarCorner: {
    width: 56,
  },
  calendarHeaderCell: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  calendarHeaderToday: {
    backgroundColor: '#f8f0ff',
  },
  dayName: {
    fontSize: 11,
    color: '#999',
  },
  dayNumContainer: {
    marginTop: 2,
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  dayNumToday: {
    backgroundColor: DISPATCHER_THEME.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumTextToday: {
    color: '#fff',
  },
  calendarRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  shiftLabel: {
    width: 56,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#fafafa',
    justifyContent: 'center',
  },
  shiftName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  shiftTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  calendarCell: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#f0f0f0',
    minHeight: 48,
  },
  calendarCellToday: {
    backgroundColor: '#f8f0ff',
  },
  cellCountNormal: {
    fontSize: 16,
    fontWeight: '600',
    color: DISPATCHER_THEME.primary,
  },
  cellCountWarning: {
    fontSize: 16,
    fontWeight: '600',
    color: DISPATCHER_THEME.warning,
  },
  cellCountEmpty: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d9d9d9',
  },
  cellStatus: {
    fontSize: 9,
    color: '#999',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#999',
  },
  shiftDetailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  shiftDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shiftDetailTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shiftBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  shiftBadgeMorning: {
    backgroundColor: '#e6f4ff',
  },
  shiftBadgeAfternoon: {
    backgroundColor: '#fff7e6',
  },
  shiftBadgeEvening: {
    backgroundColor: '#fff1f0',
  },
  shiftBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  shiftTimeLabel: {
    fontSize: 12,
    color: '#999',
  },
  shiftCount: {
    fontSize: 14,
    fontWeight: '600',
    color: DISPATCHER_THEME.primary,
  },
  workerAvatars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  workerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workerAvatarText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  addWorkerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  quickActionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    borderRadius: 12,
  },
  quickActionSecondaryText: {
    fontSize: 14,
    color: '#666',
  },
  quickActionPrimary: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  quickActionPrimaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  quickActionPrimaryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
});
