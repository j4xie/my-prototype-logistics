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

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

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

// Mock 数据
const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const weekDates = [23, 24, 25, 26, 27, 28, 29];
const todayIndex = 5; // 周六

const mockScheduleStats = {
  total: 42,
  confirmed: 38,
  pending: 4,
  conflicts: 0,
};

const mockShifts: { type: ShiftType; name: string; time: string; data: ShiftData }[] = [
  {
    type: 'morning',
    name: '早班',
    time: '08-12',
    data: {
      0: { count: 8 },
      1: { count: 8 },
      2: { count: 7 },
      3: { count: 8 },
      4: { count: 8 },
      5: { count: 6 },
      6: { count: 4, status: 'warning' },
    },
  },
  {
    type: 'afternoon',
    name: '午班',
    time: '12-18',
    data: {
      0: { count: 7 },
      1: { count: 6 },
      2: { count: 7 },
      3: { count: 7 },
      4: { count: 7 },
      5: { count: 5 },
      6: { count: 3, status: 'warning' },
    },
  },
  {
    type: 'evening',
    name: '晚班',
    time: '18-22',
    data: {
      0: { count: 0 },
      1: { count: 0 },
      2: { count: 2, status: 'overtime' },
      3: { count: 0 },
      4: { count: 2, status: 'pending' },
      5: { count: 0 },
      6: { count: 0 },
    },
  },
];

const mockTodayShifts: ShiftDetail[] = [
  {
    type: 'morning',
    name: '早班',
    timeRange: '08:00-12:00',
    workers: [
      { id: '1', name: '张三丰', avatar: '张' },
      { id: '2', name: '李四海', avatar: '李' },
      { id: '3', name: '王五行', avatar: '王' },
      { id: '4', name: '赵六顺', avatar: '赵' },
      { id: '5', name: '陈七星', avatar: '陈' },
      { id: '6', name: '刘八斗', avatar: '刘' },
    ],
  },
  {
    type: 'afternoon',
    name: '午班',
    timeRange: '12:00-18:00',
    workers: [
      { id: '7', name: '钱九龙', avatar: '钱' },
      { id: '8', name: '吴十全', avatar: '吴' },
      { id: '9', name: '郑一鸣', avatar: '郑' },
      { id: '10', name: '冯二虎', avatar: '冯' },
      { id: '11', name: '褚三思', avatar: '褚' },
    ],
  },
];

const workshopFilters = ['全部', '切片', '包装', '冷冻', '仓储'];

export default function PersonnelScheduleScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'list'>('week');
  const [selectedWorkshop, setSelectedWorkshop] = useState('切片');
  const [weekOffset, setWeekOffset] = useState(0);

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

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
      '复制上周排班',
      '确定将上周的排班复制到本周吗？已有的排班将被覆盖。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: () => Alert.alert('成功', '已复制上周排班'),
        },
      ]
    );
  };

  // AI智能排班
  const handleAISchedule = () => {
    navigation.navigate('AIWorkerOptimize');
  };

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
        <Text style={styles.headerTitle}>人员排班</Text>
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
                    {mode === 'week' ? '周视图' : mode === 'month' ? '月视图' : '列表'}
                  </Text>
                </LinearGradient>
              ) : (
                <Text style={styles.viewTabText}>
                  {mode === 'week' ? '周视图' : mode === 'month' ? '月视图' : '列表'}
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
            <Text style={styles.weekTitle}>2025年12月 第4周</Text>
            <Text style={styles.weekRange}>12月23日 - 12月29日</Text>
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
              {mockScheduleStats.total}
            </Text>
            <Text style={styles.statLabel}>本周排班</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: DISPATCHER_THEME.success }]}>
              {mockScheduleStats.confirmed}
            </Text>
            <Text style={styles.statLabel}>已确认</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: DISPATCHER_THEME.warning }]}>
              {mockScheduleStats.pending}
            </Text>
            <Text style={styles.statLabel}>待确认</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: DISPATCHER_THEME.danger }]}>
              {mockScheduleStats.conflicts}
            </Text>
            <Text style={styles.statLabel}>冲突</Text>
          </View>
        </View>

        {/* 车间筛选 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {workshopFilters.map((workshop) => (
            <TouchableOpacity
              key={workshop}
              style={[
                styles.filterChip,
                selectedWorkshop === workshop && styles.filterChipActive,
              ]}
              onPress={() => setSelectedWorkshop(workshop)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedWorkshop === workshop && styles.filterChipTextActive,
                ]}
              >
                {workshop}
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
          {mockShifts.map((shift) => (
            <View key={shift.type} style={styles.calendarRow}>
              <View style={styles.shiftLabel}>
                <Text style={styles.shiftName}>{shift.name}</Text>
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
          <Text style={styles.sectionSubtitle}>{selectedWorkshop}车间</Text>
        </View>

        {mockTodayShifts.map((shift) => (
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
