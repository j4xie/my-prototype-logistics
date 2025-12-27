/**
 * 打卡管理页面
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from 'react-native-paper';

export function ClockInScreen() {
  const navigation = useNavigation();
  const [currentTime, setCurrentTime] = useState(new Date());

  // 模拟今日考勤数据
  const todayAttendance = {
    total: 10,
    clockedIn: 8,
    late: 1,
    absent: 1,
    records: [
      { id: 1, name: '王建国', time: '08:02', status: 'normal' },
      { id: 2, name: '李明辉', time: '07:58', status: 'normal' },
      { id: 3, name: '张伟', time: '08:15', status: 'late' },
      { id: 4, name: '赵丽华', time: '08:00', status: 'normal' },
      { id: 5, name: '陈志强', time: '-', status: 'absent' },
      { id: 6, name: '周婷', time: '07:55', status: 'normal' },
    ],
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'normal':
        return { text: '正常', color: '#52c41a', bg: '#f6ffed' };
      case 'late':
        return { text: '迟到', color: '#faad14', bg: '#fff7e6' };
      case 'absent':
        return { text: '缺勤', color: '#ff4d4f', bg: '#fff1f0' };
      default:
        return { text: '未知', color: '#999', bg: '#f5f5f5' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>打卡管理</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* 时间显示 */}
        <View style={styles.timeCard}>
          <Text style={styles.currentTime}>{formatTime(currentTime)}</Text>
          <Text style={styles.currentDate}>
            {currentTime.toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </Text>
        </View>

        {/* 今日统计 */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#f6ffed' }]}>
            <Text style={[styles.statValue, { color: '#52c41a' }]}>
              {todayAttendance.clockedIn}
            </Text>
            <Text style={styles.statLabel}>已打卡</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fff7e6' }]}>
            <Text style={[styles.statValue, { color: '#faad14' }]}>
              {todayAttendance.late}
            </Text>
            <Text style={styles.statLabel}>迟到</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fff1f0' }]}>
            <Text style={[styles.statValue, { color: '#ff4d4f' }]}>
              {todayAttendance.absent}
            </Text>
            <Text style={styles.statLabel}>缺勤</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#f5f5f5' }]}>
            <Text style={[styles.statValue, { color: '#666' }]}>
              {todayAttendance.total}
            </Text>
            <Text style={styles.statLabel}>应到</Text>
          </View>
        </View>

        {/* 打卡记录 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>今日打卡记录</Text>
          <View style={styles.recordsList}>
            {todayAttendance.records.map((record) => {
              const statusStyle = getStatusStyle(record.status);
              return (
                <View key={record.id} style={styles.recordItem}>
                  <View style={styles.recordAvatar}>
                    <Text style={styles.recordAvatarText}>{record.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.recordInfo}>
                    <Text style={styles.recordName}>{record.name}</Text>
                    <Text style={styles.recordTime}>
                      {record.time === '-' ? '未打卡' : `打卡时间: ${record.time}`}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusText, { color: statusStyle.color }]}>
                      {statusStyle.text}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
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
  content: {
    flex: 1,
    padding: 16,
  },
  timeCard: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  currentTime: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  currentDate: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  recordsList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  recordAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  recordInfo: {
    flex: 1,
    marginLeft: 12,
  },
  recordName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  recordTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ClockInScreen;
