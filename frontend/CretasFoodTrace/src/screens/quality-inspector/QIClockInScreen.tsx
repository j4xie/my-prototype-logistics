/**
 * 考勤打卡页面
 * Quality Inspector - Clock In Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';

import { QI_COLORS } from '../../types/qualityInspector';
import { useAuthStore } from '../../store/authStore';

interface ClockRecord {
  type: 'in' | 'out';
  time: string;
  location: string;
}

export default function QIClockInScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const factoryId = user?.factoryId;
  const { t } = useTranslation('quality');

  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [location, setLocation] = useState<string | null>(null);
  const [clockedIn, setClockedIn] = useState(false);
  const [clockedOut, setClockedOut] = useState(false);
  const [todayRecords, setTodayRecords] = useState<ClockRecord[]>([]);

  // 更新时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 获取位置
  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocation(t('clock.locationDenied'));
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const [address] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (address) {
        const locationStr = [address.district, address.street, address.name]
          .filter(Boolean)
          .join('');
        setLocation(locationStr || t('clock.locationSuccess'));
      } else {
        setLocation(t('clock.locationSuccess'));
      }
    } catch (error) {
      console.error('获取位置失败:', error);
      setLocation(t('clock.locationFailed'));
    } finally {
      setLocationLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  const handleClockIn = async () => {
    if (clockedIn) {
      Alert.alert(t('clock.hint'), t('clock.alreadyClockedIn'));
      return;
    }

    try {
      setLoading(true);
      // TODO: 调用 API 打卡
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const now = new Date();
      const record: ClockRecord = {
        type: 'in',
        time: formatTime(now),
        location: location || t('clock.unknownLocation'),
      };

      setTodayRecords((prev) => [...prev, record]);
      setClockedIn(true);
      Alert.alert(t('clock.clockInSuccess'), t('clock.clockInTime', { time: formatTime(now) }));
    } catch (error) {
      console.error('打卡失败:', error);
      Alert.alert(t('clock.clockInFailed'), t('clock.retryLater'));
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!clockedIn) {
      Alert.alert(t('clock.hint'), t('clock.clockInFirst'));
      return;
    }

    if (clockedOut) {
      Alert.alert(t('clock.hint'), t('clock.alreadyClockedOut'));
      return;
    }

    try {
      setLoading(true);
      // TODO: 调用 API 打卡
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const now = new Date();
      const record: ClockRecord = {
        type: 'out',
        time: formatTime(now),
        location: location || t('clock.unknownLocation'),
      };

      setTodayRecords((prev) => [...prev, record]);
      setClockedOut(true);
      Alert.alert(t('clock.clockOutSuccess'), t('clock.clockOutTime', { time: formatTime(now) }));
    } catch (error) {
      console.error('打卡失败:', error);
      Alert.alert(t('clock.clockOutFailed'), t('clock.retryLater'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
    >
      {/* 日期时间显示 */}
      <View style={styles.timeCard}>
        <Text style={styles.currentDate}>{formatDate(currentTime)}</Text>
        <Text style={styles.currentTime}>{formatTime(currentTime)}</Text>
      </View>

      {/* 位置信息 */}
      <View style={styles.locationCard}>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={20} color={QI_COLORS.primary} />
          {locationLoading ? (
            <ActivityIndicator size="small" color={QI_COLORS.primary} />
          ) : (
            <Text style={styles.locationText}>{location}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={getLocation}>
          <Ionicons name="refresh-outline" size={18} color={QI_COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* 打卡按钮 */}
      <View style={styles.clockButtons}>
        <TouchableOpacity
          style={[
            styles.clockBtn,
            styles.clockInBtn,
            clockedIn && styles.clockBtnDisabled,
          ]}
          onPress={handleClockIn}
          disabled={loading || clockedIn}
          activeOpacity={0.8}
        >
          {loading && !clockedIn ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <>
              <Ionicons
                name={clockedIn ? 'checkmark-circle' : 'log-in-outline'}
                size={36}
                color="#fff"
              />
              <Text style={styles.clockBtnText}>
                {clockedIn ? t('clock.clocked') : t('clock.clockIn')}
              </Text>
              {clockedIn && todayRecords.find((r) => r.type === 'in') && (
                <Text style={styles.clockBtnTime}>
                  {todayRecords.find((r) => r.type === 'in')?.time}
                </Text>
              )}
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.clockBtn,
            styles.clockOutBtn,
            (!clockedIn || clockedOut) && styles.clockBtnDisabled,
          ]}
          onPress={handleClockOut}
          disabled={loading || !clockedIn || clockedOut}
          activeOpacity={0.8}
        >
          {loading && clockedIn && !clockedOut ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <>
              <Ionicons
                name={clockedOut ? 'checkmark-circle' : 'log-out-outline'}
                size={36}
                color="#fff"
              />
              <Text style={styles.clockBtnText}>
                {clockedOut ? t('clock.clocked') : t('clock.clockOut')}
              </Text>
              {clockedOut && todayRecords.find((r) => r.type === 'out') && (
                <Text style={styles.clockBtnTime}>
                  {todayRecords.find((r) => r.type === 'out')?.time}
                </Text>
              )}
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* 今日打卡记录 */}
      <View style={styles.recordsSection}>
        <Text style={styles.sectionTitle}>{t('clock.todayRecords')}</Text>
        {todayRecords.length === 0 ? (
          <View style={styles.emptyRecords}>
            <Ionicons name="time-outline" size={48} color={QI_COLORS.disabled} />
            <Text style={styles.emptyText}>{t('clock.noRecords')}</Text>
          </View>
        ) : (
          <View style={styles.recordsList}>
            {todayRecords.map((record, index) => (
              <View key={index} style={styles.recordItem}>
                <View style={styles.recordIcon}>
                  <Ionicons
                    name={record.type === 'in' ? 'log-in-outline' : 'log-out-outline'}
                    size={20}
                    color={record.type === 'in' ? QI_COLORS.primary : QI_COLORS.warning}
                  />
                </View>
                <View style={styles.recordInfo}>
                  <Text style={styles.recordType}>
                    {record.type === 'in' ? t('clock.clockIn') : t('clock.clockOut')}
                  </Text>
                  <Text style={styles.recordLocation}>{record.location}</Text>
                </View>
                <Text style={styles.recordTime}>{record.time}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 工作时长 */}
      {clockedIn && clockedOut && (
        <View style={styles.workDurationCard}>
          <Ionicons name="timer-outline" size={24} color={QI_COLORS.primary} />
          <View style={styles.workDurationInfo}>
            <Text style={styles.workDurationLabel}>{t('clock.todayWorkDuration')}</Text>
            <Text style={styles.workDurationValue}>{t('clock.workDurationValue')}</Text>
          </View>
        </View>
      )}

      {/* 提示信息 */}
      <View style={styles.tipCard}>
        <Ionicons name="information-circle-outline" size={20} color={QI_COLORS.secondary} />
        <Text style={styles.tipText}>
          {t('clock.tipMessage')}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QI_COLORS.background,
  },
  content: {
    padding: 16,
  },

  // 时间卡片
  timeCard: {
    backgroundColor: QI_COLORS.primary,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  currentDate: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  currentTime: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },

  // 位置卡片
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  locationText: {
    fontSize: 14,
    color: QI_COLORS.text,
    flex: 1,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: QI_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 打卡按钮
  clockButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  clockBtn: {
    flex: 1,
    height: 140,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  clockInBtn: {
    backgroundColor: QI_COLORS.primary,
  },
  clockOutBtn: {
    backgroundColor: QI_COLORS.warning,
  },
  clockBtnDisabled: {
    opacity: 0.6,
  },
  clockBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  clockBtnTime: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },

  // 打卡记录
  recordsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: QI_COLORS.text,
    marginBottom: 12,
  },
  emptyRecords: {
    alignItems: 'center',
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
    marginTop: 8,
  },
  recordsList: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: QI_COLORS.border,
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: QI_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recordInfo: {
    flex: 1,
  },
  recordType: {
    fontSize: 15,
    fontWeight: '500',
    color: QI_COLORS.text,
  },
  recordLocation: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    marginTop: 2,
  },
  recordTime: {
    fontSize: 15,
    fontWeight: '600',
    color: QI_COLORS.text,
  },

  // 工作时长
  workDurationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  workDurationInfo: {
    flex: 1,
  },
  workDurationLabel: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
  },
  workDurationValue: {
    fontSize: 18,
    fontWeight: '600',
    color: QI_COLORS.primary,
    marginTop: 2,
  },

  // 提示
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    lineHeight: 20,
  },
});
