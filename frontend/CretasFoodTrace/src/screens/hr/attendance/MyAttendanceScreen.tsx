/**
 * 我的考勤
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { Text, Card, Button, ActivityIndicator, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { timeclockApiClient } from '../../../services/api/timeclockApiClient';
import { useAuthStore } from '../../../store/authStore';
import { HR_THEME } from '../../../types/hrNavigation';

interface TodayRecord {
  id?: string;
  clockInTime?: string;
  clockOutTime?: string;
  workMinutes?: number;
  status: 'not_started' | 'working' | 'completed';
}

interface MonthSummary {
  workDays: number;
  totalHours: number;
  lateDays: number;
  earlyLeaveDays: number;
  avgHoursPerDay: number;
}

export default function MyAttendanceScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { t } = useTranslation('hr');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);
  const [todayRecord, setTodayRecord] = useState<TodayRecord>({ status: 'not_started' });
  const [monthSummary, setMonthSummary] = useState<MonthSummary | null>(null);

  const loadData = useCallback(async () => {
    try {
      const userId = user?.id;
      if (!userId) {
        console.warn('用户未登录');
        return;
      }

      const [todayRes, summaryRes] = await Promise.all([
        timeclockApiClient.getTodayRecord(userId as number),
        timeclockApiClient.getMonthSummary(userId as number),
      ]);

      // getTodayRecord 返回 ApiResponse<ClockRecord | null>
      if (todayRes?.data) {
        const record = todayRes.data;
        let status: TodayRecord['status'] = 'not_started';
        if (record.clockInTime && record.clockOutTime) {
          status = 'completed';
        } else if (record.clockInTime) {
          status = 'working';
        }
        setTodayRecord({
          id: record.id ? String(record.id) : undefined,
          clockInTime: record.clockInTime,
          clockOutTime: record.clockOutTime,
          workMinutes: record.workDuration,
          status,
        });
      }

      // getMonthSummary 直接返回统计对象 (AttendanceStatistics)
      if (summaryRes) {
        setMonthSummary({
          workDays: summaryRes.totalWorkDays,
          totalHours: summaryRes.totalWorkHours,
          lateDays: summaryRes.lateCount,
          earlyLeaveDays: summaryRes.earlyLeaveCount,
          avgHoursPerDay: summaryRes.averageWorkHours,
        });
      }
    } catch (error) {
      console.error('加载考勤数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleClockIn = async () => {
    const userId = user?.id;
    if (!userId) {
      Alert.alert(t('messages.error'), t('attendance.myAttendance.alerts.loginRequired'));
      return;
    }
    setClockLoading(true);
    try {
      const res = await timeclockApiClient.clockIn({
        userId: userId as number,
        location: '办公室',
      });
      if (res?.success) {
        Alert.alert(t('messages.success'), t('attendance.myAttendance.alerts.clockInSuccess'));
        loadData();
      } else {
        Alert.alert(t('messages.error'), res?.message || t('attendance.myAttendance.alerts.clockFailed'));
      }
    } catch (error) {
      Alert.alert(t('messages.error'), t('attendance.myAttendance.alerts.clockFailedRetry'));
    } finally {
      setClockLoading(false);
    }
  };

  const handleClockOut = async () => {
    const userId = user?.id;
    if (!userId) {
      Alert.alert(t('messages.error'), t('attendance.myAttendance.alerts.loginRequired'));
      return;
    }
    setClockLoading(true);
    try {
      const res = await timeclockApiClient.clockOut({
        userId: userId as number,
      });
      if (res?.success) {
        Alert.alert(t('messages.success'), t('attendance.myAttendance.alerts.clockOutSuccess'));
        loadData();
      } else {
        Alert.alert(t('messages.error'), res?.message || t('attendance.myAttendance.alerts.clockFailed'));
      }
    } catch (error) {
      Alert.alert(t('messages.error'), t('attendance.myAttendance.alerts.clockFailedRetry'));
    } finally {
      setClockLoading(false);
    }
  };

  const formatTime = (timeStr?: string): string => {
    if (!timeStr) return '--:--';
    const date = new Date(timeStr);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatMinutes = (minutes?: number): string => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getStatusConfig = (status: TodayRecord['status']) => {
    switch (status) {
      case 'completed':
        return { label: t('attendance.myAttendance.status.completed'), color: HR_THEME.success, bgColor: '#f6ffed' };
      case 'working':
        return { label: t('attendance.myAttendance.status.working'), color: HR_THEME.info, bgColor: '#e6f7ff' };
      default:
        return { label: t('attendance.myAttendance.status.notStarted'), color: HR_THEME.textMuted, bgColor: '#f5f5f5' };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={HR_THEME.primary} />
      </View>
    );
  }

  const statusConfig = getStatusConfig(todayRecord.status);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={HR_THEME.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('attendance.myAttendance.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* 今日打卡 */}
        <Card style={styles.todayCard}>
          <Card.Content>
            <View style={styles.todayHeader}>
              <Text style={styles.todayTitle}>{t('attendance.myAttendance.today')}</Text>
              <Chip
                mode="flat"
                textStyle={{ fontSize: 11, color: statusConfig.color }}
                style={[styles.statusChip, { backgroundColor: statusConfig.bgColor }]}
              >
                {statusConfig.label}
              </Chip>
            </View>

            <View style={styles.clockTimes}>
              <View style={styles.clockItem}>
                <View style={[styles.clockIcon, { backgroundColor: HR_THEME.success + '15' }]}>
                  <MaterialCommunityIcons name="login" size={24} color={HR_THEME.success} />
                </View>
                <Text style={styles.clockLabel}>{t('attendance.myAttendance.clockIn')}</Text>
                <Text style={styles.clockTime}>{formatTime(todayRecord.clockInTime)}</Text>
              </View>

              <View style={styles.clockDivider} />

              <View style={styles.clockItem}>
                <View style={[styles.clockIcon, { backgroundColor: HR_THEME.warning + '15' }]}>
                  <MaterialCommunityIcons name="logout" size={24} color={HR_THEME.warning} />
                </View>
                <Text style={styles.clockLabel}>{t('attendance.myAttendance.clockOut')}</Text>
                <Text style={styles.clockTime}>{formatTime(todayRecord.clockOutTime)}</Text>
              </View>
            </View>

            {todayRecord.workMinutes && todayRecord.workMinutes > 0 && (
              <View style={styles.workDuration}>
                <MaterialCommunityIcons name="clock-outline" size={16} color={HR_THEME.textSecondary} />
                <Text style={styles.durationText}>{t('attendance.myAttendance.workDuration')}: {formatMinutes(todayRecord.workMinutes)}</Text>
              </View>
            )}

            <View style={styles.clockActions}>
              {todayRecord.status === 'not_started' && (
                <Button
                  mode="contained"
                  onPress={handleClockIn}
                  loading={clockLoading}
                  disabled={clockLoading}
                  style={styles.clockButton}
                  buttonColor={HR_THEME.success}
                  icon="login"
                >
                  {t('attendance.myAttendance.clockInBtn')}
                </Button>
              )}
              {todayRecord.status === 'working' && (
                <Button
                  mode="contained"
                  onPress={handleClockOut}
                  loading={clockLoading}
                  disabled={clockLoading}
                  style={styles.clockButton}
                  buttonColor={HR_THEME.warning}
                  icon="logout"
                >
                  {t('attendance.myAttendance.clockOutBtn')}
                </Button>
              )}
              {todayRecord.status === 'completed' && (
                <View style={styles.completedBadge}>
                  <MaterialCommunityIcons name="check-circle" size={20} color={HR_THEME.success} />
                  <Text style={styles.completedText}>{t('attendance.myAttendance.completedToday')}</Text>
                </View>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* 本月汇总 */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>{t('attendance.myAttendance.monthSummary')}</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: HR_THEME.success }]}>
                  {monthSummary?.workDays ?? 0}
                </Text>
                <Text style={styles.summaryLabel}>{t('attendance.myAttendance.workDays')}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: HR_THEME.primary }]}>
                  {monthSummary?.totalHours?.toFixed(1) ?? 0}h
                </Text>
                <Text style={styles.summaryLabel}>{t('attendance.myAttendance.totalHours')}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: HR_THEME.warning }]}>
                  {monthSummary?.lateDays ?? 0}
                </Text>
                <Text style={styles.summaryLabel}>{t('attendance.myAttendance.lateDays')}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: HR_THEME.info }]}>
                  {monthSummary?.avgHoursPerDay?.toFixed(1) ?? 0}h
                </Text>
                <Text style={styles.summaryLabel}>{t('attendance.myAttendance.avgHoursPerDay')}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 快捷入口 */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>{t('attendance.myAttendance.quickActions')}</Text>
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickItem}
                onPress={() => navigation.navigate('AttendanceStats' as any)}
              >
                <View style={[styles.quickIcon, { backgroundColor: HR_THEME.primary + '15' }]}>
                  <MaterialCommunityIcons name="chart-bar" size={24} color={HR_THEME.primary} />
                </View>
                <Text style={styles.quickLabel}>{t('attendance.myAttendance.statsAnalysis')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickItem}
                onPress={() => navigation.navigate('AttendanceAnomaly' as any)}
              >
                <View style={[styles.quickIcon, { backgroundColor: HR_THEME.warning + '15' }]}>
                  <MaterialCommunityIcons name="alert-circle" size={24} color={HR_THEME.warning} />
                </View>
                <Text style={styles.quickLabel}>{t('attendance.myAttendance.anomalyRecords')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickItem}
                onPress={() => navigation.navigate('AttendanceManage' as any)}
              >
                <View style={[styles.quickIcon, { backgroundColor: HR_THEME.info + '15' }]}>
                  <MaterialCommunityIcons name="calendar-clock" size={24} color={HR_THEME.info} />
                </View>
                <Text style={styles.quickLabel}>{t('attendance.myAttendance.manage')}</Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HR_THEME.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: HR_THEME.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: HR_THEME.cardBackground, borderBottomWidth: 1, borderBottomColor: HR_THEME.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: HR_THEME.textPrimary },
  content: { flex: 1, padding: 16 },
  todayCard: { borderRadius: 12, marginBottom: 16, backgroundColor: HR_THEME.cardBackground },
  todayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  todayTitle: { fontSize: 16, fontWeight: '600', color: HR_THEME.textPrimary },
  statusChip: { height: 24 },
  clockTimes: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  clockItem: { flex: 1, alignItems: 'center' },
  clockIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  clockLabel: { fontSize: 13, color: HR_THEME.textSecondary },
  clockTime: { fontSize: 20, fontWeight: 'bold', color: HR_THEME.textPrimary, marginTop: 4 },
  clockDivider: { width: 1, height: 60, backgroundColor: HR_THEME.border },
  workDuration: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  durationText: { fontSize: 14, color: HR_THEME.textSecondary, marginLeft: 6 },
  clockActions: { alignItems: 'center' },
  clockButton: { minWidth: 160, borderRadius: 8 },
  completedBadge: { flexDirection: 'row', alignItems: 'center' },
  completedText: { fontSize: 14, color: HR_THEME.success, marginLeft: 6 },
  sectionCard: { borderRadius: 12, marginBottom: 16, backgroundColor: HR_THEME.cardBackground },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: HR_THEME.textPrimary, marginBottom: 16 },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 24, fontWeight: 'bold' },
  summaryLabel: { fontSize: 12, color: HR_THEME.textSecondary, marginTop: 4 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-around' },
  quickItem: { alignItems: 'center' },
  quickIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  quickLabel: { fontSize: 12, color: HR_THEME.textSecondary, marginTop: 8 },
  bottomSpacer: { height: 40 },
});
