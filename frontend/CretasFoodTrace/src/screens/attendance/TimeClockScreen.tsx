import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  ActivityIndicator,
  Divider,
  List,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { timeclockApiClient } from '../../services/api/timeclockApiClient';
import { useAuthStore } from '../../store/authStore';
import { getFactoryId } from '../../types/auth';
import { NeoCard, NeoButton, ScreenWrapper, StatusBadge } from '../../components/ui';
import { theme } from '../../theme';
import { handleError } from '../../utils/errorHandler';

export default function TimeClockScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayRecords, setTodayRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [lastClockIn, setLastClockIn] = useState<any>(null);
  const [gpsLocation, setGpsLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    loadTodayRecords();
    loadGpsLocation();
    return () => clearInterval(timer);
  }, []);

  const getUserId = (): number | null => {
    if (!user?.id) return null;
    const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
    return isNaN(userId) ? null : userId;
  };

  const loadTodayRecords = async () => {
    try {
      setLoadingRecords(true);
      const userId = getUserId();
      const factoryId = getFactoryId(user);
      if (!userId) return;

      try {
        const todayResponse = await timeclockApiClient.getTodayRecord(userId, factoryId);
        if (todayResponse.data) {
          setTodayRecords([todayResponse.data]);
          setLastClockIn(todayResponse.data);
        } else {
          setTodayRecords([]);
          setLastClockIn(null);
        }
      } catch (error) {
        setTodayRecords([]);
        setLastClockIn(null);
      }
    } catch (error) {
      setTodayRecords([]);
      setLastClockIn(null);
    } finally {
      setLoadingRecords(false);
    }
  };

  const loadGpsLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('位置权限被拒绝', '打卡需要获取您的位置信息');
        setGpsLocation(null);
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGpsLocation(location.coords);
    } catch (error) {
      Alert.alert('定位失败', '无法获取位置信息');
      setGpsLocation(null);
    }
  };

  const handleClockIn = async () => {
    if (lastClockIn && lastClockIn.clockInTime && !lastClockIn.clockOutTime) return Alert.alert('提示', '请先下班打卡');
    if (!gpsLocation) return Alert.alert('提示', '正在获取定位...');

    Alert.alert('确认上班打卡', `当前时间：${formatTime(currentTime)}`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        onPress: async () => {
          try {
            setLoading(true);
            const userId = getUserId();
            const factoryId = getFactoryId(user);
            if (!userId) return;
            
            await timeclockApiClient.clockIn({
              userId,
              location: `Lat:${gpsLocation.latitude.toFixed(4)}, Lon:${gpsLocation.longitude.toFixed(4)}`,
              device: 'Mobile',
              latitude: gpsLocation.latitude,
              longitude: gpsLocation.longitude,
            }, factoryId);
            Alert.alert('成功', '上班打卡成功');
            loadTodayRecords();
          } catch (error) {
            handleError(error, {
              title: '打卡失败',
              customMessage: '上班打卡失败，请重试',
            });
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleClockOut = async () => {
    const hasClockIn = lastClockIn && lastClockIn.clockInTime && !lastClockIn.clockOutTime;
    if (!hasClockIn) return Alert.alert('提示', '尚未上班打卡');
    if (!gpsLocation) return Alert.alert('提示', '正在获取定位...');

    Alert.alert('确认下班打卡', `当前时间：${formatTime(currentTime)}`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        onPress: async () => {
          try {
            setLoading(true);
            const userId = getUserId();
            const factoryId = getFactoryId(user);
            if (!userId) return;
            
            await timeclockApiClient.clockOut({ userId }, factoryId);
            Alert.alert('成功', '下班打卡成功');
            loadTodayRecords();
          } catch (error) {
            handleError(error, {
              title: '打卡失败',
              customMessage: '下班打卡失败，请重试',
            });
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const formatTime = (date: Date) => date.toLocaleTimeString('zh-CN', { hour12: false });
  const formatDate = (date: Date) => date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

  const getCurrentStatus = () => {
    if (!lastClockIn || todayRecords.length === 0) return { text: '未打卡', variant: 'default' as const, desc: '今天尚未打卡' };
    const record = lastClockIn;
    if (record.status === 'WORKING') return { text: '工作中', variant: 'success' as const, desc: '已上班' };
    if (record.status === 'OFF_WORK') return { text: '已下班', variant: 'info' as const, desc: '今日已结束' };
    if (record.clockInTime && !record.clockOutTime) return { text: '工作中', variant: 'success' as const, desc: '已上班' };
    if (record.clockInTime && record.clockOutTime) return { text: '已下班', variant: 'info' as const, desc: '今日已结束' };
    return { text: '未知', variant: 'default' as const, desc: '' };
  };

  const status = getCurrentStatus();
  const clockInDisabled = loading || !gpsLocation || (lastClockIn && lastClockIn.clockInTime && !lastClockIn.clockOutTime);
  const clockOutDisabled = loading || !gpsLocation || !lastClockIn || !lastClockIn.clockInTime || !!lastClockIn.clockOutTime;

  return (
    <ScreenWrapper edges={['top']} backgroundColor={theme.colors.background}>
      <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="考勤打卡" />
        <Appbar.Action icon="history" onPress={() => (navigation as any).navigate('AttendanceHistory')} />
        <Appbar.Action icon="refresh" onPress={loadTodayRecords} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Time & Status Card */}
        <NeoCard style={styles.card} padding="l">
          <View style={styles.centerContent}>
            <Text style={styles.dateText}>{formatDate(currentTime)}</Text>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <StatusBadge status={status.text} variant={status.variant} style={styles.statusBadge} />
            <Text style={styles.statusDesc}>{status.desc}</Text>
          </View>
        </NeoCard>

        {/* Location Card */}
        <NeoCard style={styles.card} padding="m">
          <View style={styles.row}>
            <List.Icon icon="map-marker" color={theme.colors.primary} />
            <View style={styles.locationContent}>
              <Text style={styles.cardTitle}>当前位置</Text>
              {gpsLocation ? (
                <View>
                  <Text style={styles.locationText}>Lat: {gpsLocation.latitude.toFixed(6)}</Text>
                  <Text style={styles.locationText}>Lon: {gpsLocation.longitude.toFixed(6)}</Text>
                  <Text style={styles.successText}>定位成功</Text>
                </View>
              ) : (
                <View style={styles.row}>
                  <ActivityIndicator size="small" />
                  <Text style={{ marginLeft: 8 }}>定位中...</Text>
                </View>
              )}
            </View>
          </View>
        </NeoCard>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <NeoButton
            variant="primary"
            size="large"
            onPress={handleClockIn}
            disabled={clockInDisabled}
            loading={loading && !clockInDisabled}
            style={styles.flexButton}
            icon="login"
          >
            上班打卡
          </NeoButton>
          <View style={{ width: 16 }} />
          <NeoButton
            variant="primary"
            size="large"
            onPress={handleClockOut}
            disabled={clockOutDisabled}
            loading={loading && !clockOutDisabled}
            style={styles.flexButton}
            icon="logout"
          >
            下班打卡
          </NeoButton>
        </View>

        {/* Today's Records */}
        <NeoCard style={styles.card} padding="m">
          <Text style={styles.sectionTitle}>今日记录</Text>
          <Divider style={styles.divider} />
          
          {loadingRecords ? (
            <View style={styles.centerContent}><ActivityIndicator /></View>
          ) : todayRecords.length === 0 ? (
            <Text style={styles.emptyText}>暂无记录</Text>
          ) : (
            todayRecords.map((record: any) => (
              <View key={record.id}>
                {record.clockInTime && (
                  <View style={styles.recordRow}>
                    <StatusBadge status="上班" variant="success" />
                    <Text style={styles.recordTime}>{new Date(record.clockInTime).toLocaleTimeString('zh-CN')}</Text>
                  </View>
                )}
                {record.clockOutTime && (
                  <View style={[styles.recordRow, { marginTop: 8 }]}>
                    <StatusBadge status="下班" variant="info" />
                    <Text style={styles.recordTime}>{new Date(record.clockOutTime).toLocaleTimeString('zh-CN')}</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </NeoCard>

        {/* Quick Links */}
        <NeoCard style={styles.card} padding="m">
          <Text style={styles.sectionTitle}>常用功能</Text>
          <View style={styles.grid}>
            <NeoButton variant="outline" size="small" onPress={() => (navigation as any).navigate('AttendanceHistory')} style={styles.gridBtn}>历史记录</NeoButton>
            <NeoButton variant="outline" size="small" onPress={() => (navigation as any).navigate('TimeStatistics')} style={styles.gridBtn}>工时统计</NeoButton>
            <NeoButton variant="outline" size="small" onPress={() => (navigation as any).navigate('WorkRecords')} style={styles.gridBtn}>工作记录</NeoButton>
            <NeoButton variant="outline" size="small" onPress={() => (navigation as any).navigate('DepartmentAttendance')} style={styles.gridBtn}>部门考勤</NeoButton>
          </View>
        </NeoCard>

      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  card: { marginBottom: 16 },
  centerContent: { alignItems: 'center', justifyContent: 'center' },
  dateText: { fontSize: 16, color: theme.colors.textSecondary, marginBottom: 8 },
  timeText: { fontSize: 48, fontWeight: '700', color: theme.colors.text, fontVariant: ['tabular-nums'] },
  statusBadge: { marginVertical: 12, transform: [{ scale: 1.2 }] },
  statusDesc: { color: theme.colors.textTertiary },
  row: { flexDirection: 'row', alignItems: 'center' },
  locationContent: { marginLeft: 8, flex: 1 },
  cardTitle: { fontWeight: '600', fontSize: 16, marginBottom: 4 },
  locationText: { fontSize: 13, color: theme.colors.textSecondary },
  successText: { color: theme.colors.success, fontSize: 12, marginTop: 2 },
  buttonRow: { flexDirection: 'row', marginBottom: 24 },
  flexButton: { flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  divider: { marginBottom: 12 },
  emptyText: { textAlign: 'center', color: theme.colors.textTertiary, padding: 16 },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordTime: { fontSize: 16, fontWeight: '500', color: theme.colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridBtn: { width: '48%' },
});
