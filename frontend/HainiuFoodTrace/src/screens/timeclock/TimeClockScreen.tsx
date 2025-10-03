import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { timeclockApiClient } from '../../services/api/timeclockApiClient';
import { WorkTypeSelector } from '../../components/timeclock/WorkTypeSelector';

interface ClockStatus {
  currentStatus: 'not_started' | 'working' | 'on_break' | 'finished';
  permissions: {
    canClockIn: boolean;
    canClockOut: boolean;
    canBreakStart: boolean;
    canBreakEnd: boolean;
  };
  todayWorkMinutes: number;
  summary: {
    clockInTime: string | null;
    clockOutTime: string | null;
    totalBreakMinutes: number;
    workType: any | null;
  };
}

export const TimeClockScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  const [selectedWorkType, setSelectedWorkType] = useState<string | null>(null);
  const [showWorkTypeSelector, setShowWorkTypeSelector] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadClockStatus();
    getCurrentLocation();
    
    // 每秒更新时间
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadClockStatus = async () => {
    try {
      setLoading(true);
      const response = await timeclockApiClient.getClockStatus();
      if (response.success) {
        setClockStatus(response.data);
        // 如果当前有活动工作时段，设置选中的工作类型
        if (response.data.activeSession?.workType) {
          setSelectedWorkType(response.data.activeSession.workType.id);
        }
      }
    } catch (error) {
      console.error('获取打卡状态失败:', error);
      Alert.alert('错误', '获取打卡状态失败，请重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限提示', '需要位置权限来记录打卡位置');
        return;
      }

      const locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(locationData);
    } catch (error) {
      console.error('获取位置失败:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadClockStatus();
  };

  const handleClockIn = async () => {
    if (!selectedWorkType) {
      setShowWorkTypeSelector(true);
      return;
    }

    try {
      setActionLoading(true);

      const locationData = location ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy
      } : undefined;

      const deviceInfo = {
        deviceId: 'react-native-device', // 在实际应用中应该获取真实设备ID
        platform: 'react-native',
        model: 'mobile-app'
      };

      const response = await timeclockApiClient.clockIn({
        workTypeId: selectedWorkType,
        locationData,
        deviceInfo
      });

      if (response.success) {
        Alert.alert('成功', response.message);
        loadClockStatus();
      } else {
        Alert.alert('失败', response.message);
      }
    } catch (error) {
      console.error('上班打卡失败:', error);
      Alert.alert('错误', '上班打卡失败，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setActionLoading(true);
      const response = await timeclockApiClient.clockOut({});
      
      if (response.success) {
        Alert.alert('成功', response.message);
        loadClockStatus();
        setSelectedWorkType(null); // 清除选中的工作类型
      } else {
        Alert.alert('失败', response.message);
      }
    } catch (error) {
      console.error('下班打卡失败:', error);
      Alert.alert('错误', '下班打卡失败，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBreakStart = async () => {
    try {
      setActionLoading(true);
      const response = await timeclockApiClient.breakStart({});
      
      if (response.success) {
        Alert.alert('成功', response.message);
        loadClockStatus();
      } else {
        Alert.alert('失败', response.message);
      }
    } catch (error) {
      console.error('开始休息失败:', error);
      Alert.alert('错误', '开始休息失败，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBreakEnd = async () => {
    try {
      setActionLoading(true);
      const response = await timeclockApiClient.breakEnd({});
      
      if (response.success) {
        Alert.alert('成功', response.message);
        loadClockStatus();
      } else {
        Alert.alert('失败', response.message);
      }
    } catch (error) {
      console.error('结束休息失败:', error);
      Alert.alert('错误', '结束休息失败，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}小时${mins}分钟`;
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'not_started': return '未开始工作';
      case 'working': return '正在工作';
      case 'on_break': return '休息中';
      case 'finished': return '已下班';
      default: return '未知状态';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_started': return '#6b7280';
      case 'working': return '#10b981';
      case 'on_break': return '#f59e0b';
      case 'finished': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!clockStatus) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>获取打卡状态失败</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadClockStatus}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
      >
        {/* 头部信息 */}
        <View style={styles.header}>
          <Text style={styles.title}>员工打卡</Text>
          <Text style={styles.subtitle}>欢迎，{user?.fullName || user?.username}</Text>
        </View>

        {/* 当前时间和状态 */}
        <View style={styles.statusCard}>
          <View style={styles.timeContainer}>
            <Text style={styles.currentTime}>{formatTime(currentTime)}</Text>
            <Text style={styles.currentDate}>{currentTime.toLocaleDateString('zh-CN')}</Text>
          </View>
          
          <View style={styles.statusContainer}>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(clockStatus.currentStatus) }]} />
            <Text style={styles.statusText}>{getStatusText(clockStatus.currentStatus)}</Text>
          </View>
        </View>

        {/* 今日统计 */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>今日统计</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{formatMinutes(clockStatus.todayWorkMinutes)}</Text>
              <Text style={styles.statLabel}>工作时长</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{formatMinutes(clockStatus.summary.totalBreakMinutes)}</Text>
              <Text style={styles.statLabel}>休息时长</Text>
            </View>
          </View>
          
          {clockStatus.summary.clockInTime && (
            <View style={styles.timeInfo}>
              <Text style={styles.timeInfoText}>
                上班时间: {new Date(clockStatus.summary.clockInTime).toLocaleTimeString('zh-CN')}
              </Text>
              {clockStatus.summary.clockOutTime && (
                <Text style={styles.timeInfoText}>
                  下班时间: {new Date(clockStatus.summary.clockOutTime).toLocaleTimeString('zh-CN')}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* 工作类型选择 */}
        {(clockStatus.permissions.canClockIn || clockStatus.currentStatus === 'working') && (
          <View style={styles.workTypeCard}>
            <Text style={styles.workTypeTitle}>当前工作类型</Text>
            <TouchableOpacity
              style={styles.workTypeSelector}
              onPress={() => setShowWorkTypeSelector(true)}
              disabled={clockStatus.currentStatus === 'working'}
            >
              <Text style={[
                styles.workTypeSelectorText,
                !selectedWorkType && styles.workTypePlaceholder
              ]}>
                {clockStatus.summary.workType?.typeName || '请选择工作类型'}
              </Text>
              {clockStatus.currentStatus !== 'working' && (
                <Ionicons name="chevron-down" size={20} color="#007AFF" />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 操作按钮区域 */}
        <View style={styles.actionsContainer}>
          {/* 上班打卡按钮 */}
          {clockStatus.permissions.canClockIn && (
            <TouchableOpacity
              style={[styles.actionButton, styles.clockInButton]}
              onPress={handleClockIn}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="play-circle" size={28} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>上班打卡</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* 下班打卡按钮 */}
          {clockStatus.permissions.canClockOut && (
            <TouchableOpacity
              style={[styles.actionButton, styles.clockOutButton]}
              onPress={handleClockOut}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="stop-circle" size={28} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>下班打卡</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* 休息按钮 */}
          <View style={styles.breakButtonsRow}>
            {clockStatus.permissions.canBreakStart && (
              <TouchableOpacity
                style={[styles.actionButton, styles.breakButton, styles.halfButton]}
                onPress={handleBreakStart}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="pause-circle" size={24} color="#FFFFFF" />
                    <Text style={styles.breakButtonText}>开始休息</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {clockStatus.permissions.canBreakEnd && (
              <TouchableOpacity
                style={[styles.actionButton, styles.resumeButton, styles.halfButton]}
                onPress={handleBreakEnd}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="play-circle" size={24} color="#FFFFFF" />
                    <Text style={styles.breakButtonText}>结束休息</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 位置信息 */}
        {location && (
          <View style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <Ionicons name="location" size={20} color="#007AFF" />
              <Text style={styles.locationTitle}>打卡位置</Text>
            </View>
            <Text style={styles.locationText}>
              经度: {location.coords.longitude.toFixed(6)}
            </Text>
            <Text style={styles.locationText}>
              纬度: {location.coords.latitude.toFixed(6)}
            </Text>
            <Text style={styles.locationText}>
              精度: {location.coords.accuracy?.toFixed(0) || 'N/A'}m
            </Text>
          </View>
        )}
      </ScrollView>

      {/* 工作类型选择器 */}
      <WorkTypeSelector
        visible={showWorkTypeSelector}
        selectedWorkTypeId={selectedWorkType}
        onSelect={setSelectedWorkType}
        onClose={() => setShowWorkTypeSelector(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  timeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  currentTime: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1A1A1A',
    fontFamily: 'monospace',
  },
  currentDate: {
    fontSize: 16,
    color: '#666666',
    marginTop: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666666',
  },
  timeInfo: {
    borderTopWidth: 1,
    borderTopColor: '#E1E5E9',
    paddingTop: 16,
  },
  timeInfoText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  workTypeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  workTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  workTypeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  workTypeSelectorText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  workTypePlaceholder: {
    color: '#999999',
  },
  actionsContainer: {
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  clockInButton: {
    backgroundColor: '#10b981',
  },
  clockOutButton: {
    backgroundColor: '#ef4444',
  },
  breakButton: {
    backgroundColor: '#f59e0b',
  },
  resumeButton: {
    backgroundColor: '#10b981',
  },
  breakButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfButton: {
    flex: 1,
  },
  breakButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});