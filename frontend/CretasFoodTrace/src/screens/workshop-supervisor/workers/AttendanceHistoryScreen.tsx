/**
 * 考勤历史页面
 * 查看历史考勤记录
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from 'react-native-paper';

interface AttendanceRecord {
  date: string;
  weekday: string;
  clockIn: string | null;
  clockOut: string | null;
  workHours: number;
  status: 'normal' | 'late' | 'early' | 'absent' | 'leave';
}

export function AttendanceHistoryScreen() {
  const navigation = useNavigation();

  // 当前月份
  const [currentMonth, setCurrentMonth] = useState('2025年12月');

  // 统计数据
  const stats = {
    workDays: 20,
    actualDays: 18,
    lateDays: 1,
    absentDays: 1,
    totalHours: 156,
  };

  // 历史记录
  const records: AttendanceRecord[] = [
    { date: '27日', weekday: '周五', clockIn: '08:02', clockOut: '17:05', workHours: 9.0, status: 'normal' },
    { date: '26日', weekday: '周四', clockIn: '07:58', clockOut: '17:10', workHours: 9.2, status: 'normal' },
    { date: '25日', weekday: '周三', clockIn: '08:15', clockOut: '17:00', workHours: 8.75, status: 'late' },
    { date: '24日', weekday: '周二', clockIn: '08:00', clockOut: '17:05', workHours: 9.1, status: 'normal' },
    { date: '23日', weekday: '周一', clockIn: '-', clockOut: '-', workHours: 0, status: 'absent' },
    { date: '22日', weekday: '周日', clockIn: '-', clockOut: '-', workHours: 0, status: 'leave' },
    { date: '21日', weekday: '周六', clockIn: '-', clockOut: '-', workHours: 0, status: 'leave' },
    { date: '20日', weekday: '周五', clockIn: '07:55', clockOut: '17:00', workHours: 9.1, status: 'normal' },
    { date: '19日', weekday: '周四', clockIn: '08:00', clockOut: '16:30', workHours: 8.5, status: 'early' },
    { date: '18日', weekday: '周三', clockIn: '08:05', clockOut: '17:15', workHours: 9.2, status: 'normal' },
  ];

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'normal':
        return { text: '正常', color: '#52c41a', bg: '#f6ffed' };
      case 'late':
        return { text: '迟到', color: '#faad14', bg: '#fff7e6' };
      case 'early':
        return { text: '早退', color: '#faad14', bg: '#fff7e6' };
      case 'absent':
        return { text: '缺勤', color: '#ff4d4f', bg: '#fff1f0' };
      case 'leave':
        return { text: '休息', color: '#999', bg: '#f5f5f5' };
      default:
        return { text: '未知', color: '#999', bg: '#f5f5f5' };
    }
  };

  const renderRecord = ({ item }: { item: AttendanceRecord }) => {
    const statusStyle = getStatusStyle(item.status);
    return (
      <View style={styles.recordItem}>
        <View style={styles.dateColumn}>
          <Text style={styles.dateText}>{item.date}</Text>
          <Text style={styles.weekdayText}>{item.weekday}</Text>
        </View>
        <View style={styles.timeColumn}>
          <View style={styles.timeRow}>
            <Icon source="login" size={14} color="#666" />
            <Text style={styles.timeText}>{item.clockIn || '-'}</Text>
          </View>
          <View style={styles.timeRow}>
            <Icon source="logout" size={14} color="#666" />
            <Text style={styles.timeText}>{item.clockOut || '-'}</Text>
          </View>
        </View>
        <View style={styles.hoursColumn}>
          <Text style={styles.hoursText}>
            {item.workHours > 0 ? `${item.workHours}h` : '-'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.color }]}>
            {statusStyle.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>考勤历史</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* 月份选择 */}
      <View style={styles.monthSelector}>
        <TouchableOpacity style={styles.monthArrow}>
          <Icon source="chevron-left" size={24} color="#667eea" />
        </TouchableOpacity>
        <Text style={styles.monthText}>{currentMonth}</Text>
        <TouchableOpacity style={styles.monthArrow}>
          <Icon source="chevron-right" size={24} color="#667eea" />
        </TouchableOpacity>
      </View>

      {/* 统计卡片 */}
      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.actualDays}/{stats.workDays}</Text>
            <Text style={styles.statLabel}>出勤天数</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#faad14' }]}>{stats.lateDays}</Text>
            <Text style={styles.statLabel}>迟到</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#ff4d4f' }]}>{stats.absentDays}</Text>
            <Text style={styles.statLabel}>缺勤</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalHours}h</Text>
            <Text style={styles.statLabel}>总工时</Text>
          </View>
        </View>
      </View>

      {/* 记录列表 */}
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderCell}>日期</Text>
          <Text style={styles.listHeaderCell}>打卡</Text>
          <Text style={styles.listHeaderCell}>工时</Text>
          <Text style={styles.listHeaderCell}>状态</Text>
        </View>
        <FlatList
          data={records}
          renderItem={renderRecord}
          keyExtractor={(item) => item.date}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </View>
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
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  monthArrow: {
    padding: 8,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 16,
  },
  statsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#f0f0f0',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  listHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  listHeaderCell: {
    flex: 1,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 16,
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  dateColumn: {
    flex: 1,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  weekdayText: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  timeColumn: {
    flex: 1,
    alignItems: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  hoursColumn: {
    flex: 1,
    alignItems: 'center',
  },
  hoursText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  statusBadge: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default AttendanceHistoryScreen;
