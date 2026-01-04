/**
 * 打卡管理页面
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon, ActivityIndicator } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { timeclockApiClient, DepartmentAttendance, ClockRecord } from '../../../services/api/timeclockApiClient';

// UI record format
interface AttendanceRecord {
  id: number;
  name: string;
  time: string;
  status: 'normal' | 'late' | 'absent';
}

interface AttendanceData {
  total: number;
  clockedIn: number;
  late: number;
  absent: number;
  records: AttendanceRecord[];
}

// Transform API clock record to UI format
function transformClockRecord(record: ClockRecord, index: number): AttendanceRecord {
  const clockInTime = record.clockInTime;
  let time = '-';
  let status: 'normal' | 'late' | 'absent' = 'absent';

  if (clockInTime) {
    const date = new Date(clockInTime);
    time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    // Determine if late (after 8:00 AM)
    const clockHour = date.getHours();
    const clockMinute = date.getMinutes();
    if (clockHour > 8 || (clockHour === 8 && clockMinute > 0)) {
      status = 'late';
    } else {
      status = 'normal';
    }
  }

  return {
    id: record.id || index + 1,
    name: `员工${record.userId}`, // TODO: Backend should return user name with record
    time,
    status,
  };
}

export function ClockInScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('workshop');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceData>({
    total: 0,
    clockedIn: 0,
    late: 0,
    absent: 0,
    records: [],
  });

  const loadAttendance = useCallback(async () => {
    try {
      const response = await timeclockApiClient.getTodayRecords({
        department: 'all',
      });

      if (response.success && response.data) {
        const data = response.data;
        const records = (data.records || []).map(transformClockRecord);

        // Calculate late count from records
        const lateCount = records.filter(r => r.status === 'late').length;

        setAttendance({
          total: data.totalEmployees || 0,
          clockedIn: data.clockedIn || 0,
          late: lateCount,
          absent: data.absent || 0,
          records,
        });
      }
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401) {
          Alert.alert('会话过期', '请重新登录');
        } else {
          console.error('加载考勤数据失败:', error.response?.data?.message || error.message);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAttendance();
    setRefreshing(false);
  }, [loadAttendance]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'normal':
        return { text: t('workers.status.normal'), color: '#52c41a', bg: '#f6ffed' };
      case 'late':
        return { text: t('workers.status.late'), color: '#faad14', bg: '#fff7e6' };
      case 'absent':
        return { text: t('workers.status.absent'), color: '#ff4d4f', bg: '#fff1f0' };
      default:
        return { text: t('workers.status.unknown'), color: '#999', bg: '#f5f5f5' };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon source="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('workers.clockIn.title')}</Text>
          <View style={{ width: 24 }} />
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
        <Text style={styles.headerTitle}>{t('workers.clockIn.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
        }
      >
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
              {attendance.clockedIn}
            </Text>
            <Text style={styles.statLabel}>{t('workers.clockIn.todayStats.clockedIn')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fff7e6' }]}>
            <Text style={[styles.statValue, { color: '#faad14' }]}>
              {attendance.late}
            </Text>
            <Text style={styles.statLabel}>{t('workers.clockIn.todayStats.late')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fff1f0' }]}>
            <Text style={[styles.statValue, { color: '#ff4d4f' }]}>
              {attendance.absent}
            </Text>
            <Text style={styles.statLabel}>{t('workers.clockIn.todayStats.absent')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#f5f5f5' }]}>
            <Text style={[styles.statValue, { color: '#666' }]}>
              {attendance.total}
            </Text>
            <Text style={styles.statLabel}>{t('workers.clockIn.todayStats.expected')}</Text>
          </View>
        </View>

        {/* 打卡记录 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('workers.clockIn.todayRecords')}</Text>
          <View style={styles.recordsList}>
            {attendance.records.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon source="clock-outline" size={40} color="#ccc" />
                <Text style={styles.emptyText}>暂无打卡记录</Text>
              </View>
            ) : (
              attendance.records.map((record) => {
                const statusStyle = getStatusStyle(record.status);
                return (
                  <View key={record.id} style={styles.recordItem}>
                    <View style={styles.recordAvatar}>
                      <Text style={styles.recordAvatarText}>{record.name.charAt(0)}</Text>
                    </View>
                    <View style={styles.recordInfo}>
                      <Text style={styles.recordName}>{record.name}</Text>
                      <Text style={styles.recordTime}>
                        {record.time === '-' ? t('workers.clockIn.notClockedIn') : t('workers.clockIn.clockTime', { time: record.time })}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                      <Text style={[styles.statusText, { color: statusStyle.color }]}>
                        {statusStyle.text}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
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
