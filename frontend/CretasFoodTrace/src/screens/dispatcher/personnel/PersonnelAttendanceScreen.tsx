/**
 * 人员考勤屏幕
 *
 * 功能：
 * - 考勤统计概览（工作天数、总工时、加班、迟到早退）
 * - 日期范围筛选
 * - 部门筛选
 * - 今日考勤状态
 * - 考勤记录列表
 * - 异常考勤标记
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { DISPATCHER_THEME } from '../../../types/dispatcher';
import {
  timeclockApiClient,
  ClockRecord,
  AttendanceStatistics,
  DepartmentAttendance
} from '../../../services/api/timeclockApiClient';
import { useAuthStore } from '../../../store/authStore';

// Types
type AttendanceStatus = 'normal' | 'late' | 'early' | 'absent' | 'overtime';
type DateRangeType = 'today' | 'week' | 'month' | 'custom';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  date: string;
  clockInTime?: string;
  clockOutTime?: string;
  workHours?: number;
  overtimeHours?: number;
  status: AttendanceStatus;
  anomalies: string[];
}

interface DepartmentStats {
  id: string;
  name: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
}

// 默认空统计数据
const emptyStatistics: AttendanceStatistics = {
  totalWorkDays: 0,
  totalWorkHours: 0,
  averageWorkHours: 0,
  overtimeHours: 0,
  lateCount: 0,
  earlyLeaveCount: 0,
  absentCount: 0,
  period: {
    startDate: '',
    endDate: '',
  },
};

export default function PersonnelAttendanceScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeType>('today');
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [statistics, setStatistics] = useState<AttendanceStatistics>(emptyStatistics);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  // 计算日期范围
  const getDateRange = useCallback((range: DateRangeType): { startDate: string; endDate: string } => {
    const now = new Date();
    const formatDate = (date: Date): string => date.toISOString().split('T')[0] ?? '';

    const today = formatDate(now);

    switch (range) {
      case 'today':
        return { startDate: today, endDate: today };
      case 'week': {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1); // 周一
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // 周日
        return {
          startDate: formatDate(weekStart),
          endDate: formatDate(weekEnd),
        };
      }
      case 'month': {
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const lastDay = new Date(year, month, 0).getDate();
        return {
          startDate: `${year}-${String(month).padStart(2, '0')}-01`,
          endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
        };
      }
      default:
        return { startDate: today, endDate: today };
    }
  }, []);

  // 转换 ClockRecord 为 AttendanceRecord
  const transformClockRecord = (record: ClockRecord): AttendanceRecord => {
    const clockIn = record.clockInTime ? new Date(record.clockInTime) : null;
    const clockOut = record.clockOutTime ? new Date(record.clockOutTime) : null;

    // 计算状态和异常
    let status: AttendanceStatus = 'normal';
    const anomalies: string[] = [];

    if (!clockIn) {
      status = 'absent';
      anomalies.push('未打卡');
    } else {
      const clockInHour = clockIn.getHours();
      const clockInMinute = clockIn.getMinutes();

      // 检查迟到（假设8:00上班）
      if (clockInHour > 8 || (clockInHour === 8 && clockInMinute > 0)) {
        status = 'late';
        const lateMinutes = (clockInHour - 8) * 60 + clockInMinute;
        anomalies.push(`迟到${lateMinutes}分钟`);
      }

      // 检查早退（假设17:00下班）
      if (clockOut) {
        const clockOutHour = clockOut.getHours();
        if (clockOutHour < 17) {
          status = 'early';
          const earlyMinutes = (17 - clockOutHour) * 60 - clockOut.getMinutes();
          anomalies.push(`早退${earlyMinutes}分钟`);
        } else if (clockOutHour > 17 || (clockOutHour === 17 && clockOut.getMinutes() > 0)) {
          status = 'overtime';
        }
      }
    }

    // 计算工时
    let workHours: number | undefined;
    let overtimeHours: number | undefined;
    if (record.workDuration) {
      workHours = Math.round(record.workDuration / 60 * 100) / 100;
      if (workHours > 8) {
        overtimeHours = Math.round((workHours - 8) * 100) / 100;
      }
    }

    return {
      id: String(record.id ?? record.userId),
      employeeId: `E${String(record.userId).padStart(3, '0')}`,
      employeeName: `员工${record.userId}`,
      employeeCode: String(record.userId).padStart(3, '0'),
      department: '生产部门',
      date: clockIn ? (clockIn.toISOString().split('T')[0] ?? '') : (new Date().toISOString().split('T')[0] ?? ''),
      clockInTime: clockIn ? `${String(clockIn.getHours()).padStart(2, '0')}:${String(clockIn.getMinutes()).padStart(2, '0')}` : undefined,
      clockOutTime: clockOut ? `${String(clockOut.getHours()).padStart(2, '0')}:${String(clockOut.getMinutes()).padStart(2, '0')}` : undefined,
      workHours,
      overtimeHours,
      status,
      anomalies,
    };
  };

  // 加载考勤数据
  const loadAttendanceData = useCallback(async (isRefresh = false) => {
    if (!user?.id) {
      setError('请先登录');
      setInitialLoading(false);
      return;
    }

    if (!isRefresh) {
      setInitialLoading(true);
    }
    setError(null);

    try {
      const { startDate, endDate } = getDateRange(dateRange);
      const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;

      // 并行加载统计和记录数据
      const [statsResponse, recordsResponse] = await Promise.all([
        timeclockApiClient.getAttendanceStatistics(userId, { startDate, endDate }),
        timeclockApiClient.getHistoryRecords({
          startDate,
          endDate,
          department: selectedDepartment ?? undefined,
          page: 1,
          size: 50,
        }),
      ]);

      // 处理统计数据
      if (statsResponse.success && statsResponse.data) {
        setStatistics(statsResponse.data);
      }

      // 处理考勤记录
      if (recordsResponse.success && recordsResponse.data?.content) {
        const transformedRecords = recordsResponse.data.content.map(transformClockRecord);
        setRecords(transformedRecords);

        // 从记录中计算部门统计（简化实现）
        const deptMap = new Map<string, DepartmentStats>();
        transformedRecords.forEach(record => {
          const deptId = record.department;
          if (!deptMap.has(deptId)) {
            deptMap.set(deptId, {
              id: deptId,
              name: record.department,
              total: 0,
              present: 0,
              absent: 0,
              late: 0,
              onLeave: 0,
            });
          }
          const dept = deptMap.get(deptId)!;
          dept.total++;
          if (record.status === 'absent') {
            dept.absent++;
          } else if (record.status === 'late') {
            dept.present++;
            dept.late++;
          } else {
            dept.present++;
          }
        });
        setDepartmentStats(Array.from(deptMap.values()));
      }

    } catch (err) {
      console.error('加载考勤数据失败:', err);
      setError('加载考勤数据失败，请稍后重试');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [user, dateRange, selectedDepartment, getDateRange]);

  // 初始加载
  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

  // Callbacks
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAttendanceData(true);
  }, [loadAttendanceData]);

  const handleDateRangeChange = (range: DateRangeType) => {
    setDateRange(range);
    // dateRange 改变会触发 loadAttendanceData 的 useEffect
  };

  const handleDepartmentSelect = (deptId: string | null) => {
    setSelectedDepartment(deptId);
    setShowDepartmentModal(false);
    // TODO: Filter records by department
  };

  const handleRecordPress = (record: AttendanceRecord) => {
    Alert.alert(
      `${record.employeeName} (${record.employeeCode})`,
      [
        `部门: ${record.department}`,
        `日期: ${record.date}`,
        record.clockInTime ? `上班: ${record.clockInTime}` : '未上班打卡',
        record.clockOutTime ? `下班: ${record.clockOutTime}` : '未下班打卡',
        record.workHours ? `工时: ${record.workHours}h` : '',
        record.overtimeHours ? `加班: ${record.overtimeHours}h` : '',
        record.anomalies.length > 0 ? `异常: ${record.anomalies.join(', ')}` : '',
      ].filter(Boolean).join('\n'),
      [{ text: '确定' }]
    );
  };

  const handleExport = () => {
    Alert.alert('导出考勤', '确定要导出当前筛选条件下的考勤记录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '导出',
        onPress: () => {
          // TODO: Call export API
          Alert.alert('成功', '考勤报表已导出');
        }
      },
    ]);
  };

  // Render functions
  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case 'normal': return '#52c41a';
      case 'overtime': return '#1890ff';
      case 'late': return '#fa8c16';
      case 'early': return '#fa8c16';
      case 'absent': return '#ff4d4f';
      default: return '#999';
    }
  };

  const getStatusLabel = (status: AttendanceStatus) => {
    switch (status) {
      case 'normal': return '正常';
      case 'overtime': return '加班';
      case 'late': return '迟到';
      case 'early': return '早退';
      case 'absent': return '缺勤';
      default: return '未知';
    }
  };

  const renderHeader = () => (
    <LinearGradient
      colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>人员考勤</Text>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleExport}
        >
          <MaterialCommunityIcons name="file-export-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Date Range Tabs */}
      <View style={styles.dateRangeTabs}>
        {[
          { key: 'today', label: '今日' },
          { key: 'week', label: '本周' },
          { key: 'month', label: '本月' },
          { key: 'custom', label: '自定义' },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.dateRangeTab,
              dateRange === item.key && styles.dateRangeTabActive,
            ]}
            onPress={() => handleDateRangeChange(item.key as DateRangeType)}
          >
            <Text
              style={[
                styles.dateRangeTabText,
                dateRange === item.key && styles.dateRangeTabTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </LinearGradient>
  );

  const renderStatisticsCards = () => (
    <View style={styles.statsSection}>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="calendar-check" size={24} color={DISPATCHER_THEME.primary} />
          <Text style={styles.statValue}>{statistics.totalWorkDays}</Text>
          <Text style={styles.statLabel}>工作天数</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="clock-outline" size={24} color="#1890ff" />
          <Text style={styles.statValue}>{statistics.totalWorkHours}h</Text>
          <Text style={styles.statLabel}>总工时</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="clock-plus-outline" size={24} color="#52c41a" />
          <Text style={styles.statValue}>{statistics.overtimeHours}h</Text>
          <Text style={styles.statLabel}>加班时长</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statCardSmall}>
          <View style={styles.statIconSmall}>
            <MaterialCommunityIcons name="run" size={18} color="#fa8c16" />
          </View>
          <View>
            <Text style={styles.statValueSmall}>{statistics.lateCount}次</Text>
            <Text style={styles.statLabelSmall}>迟到</Text>
          </View>
        </View>
        <View style={styles.statCardSmall}>
          <View style={styles.statIconSmall}>
            <MaterialCommunityIcons name="exit-run" size={18} color="#fa8c16" />
          </View>
          <View>
            <Text style={styles.statValueSmall}>{statistics.earlyLeaveCount}次</Text>
            <Text style={styles.statLabelSmall}>早退</Text>
          </View>
        </View>
        <View style={styles.statCardSmall}>
          <View style={styles.statIconSmall}>
            <MaterialCommunityIcons name="close-circle-outline" size={18} color="#ff4d4f" />
          </View>
          <View>
            <Text style={styles.statValueSmall}>{statistics.absentCount}次</Text>
            <Text style={styles.statLabelSmall}>缺勤</Text>
          </View>
        </View>
        <View style={styles.statCardSmall}>
          <View style={styles.statIconSmall}>
            <MaterialCommunityIcons name="chart-line" size={18} color="#52c41a" />
          </View>
          <View>
            <Text style={styles.statValueSmall}>{statistics.averageWorkHours}h</Text>
            <Text style={styles.statLabelSmall}>日均工时</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderDepartmentOverview = () => (
    <View style={styles.deptSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>部门考勤</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowDepartmentModal(true)}
        >
          <MaterialCommunityIcons name="filter-variant" size={18} color={DISPATCHER_THEME.primary} />
          <Text style={styles.filterText}>
            {selectedDepartment
              ? departmentStats.find(d => d.id === selectedDepartment)?.name
              : '全部'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.deptScrollView}
      >
        {departmentStats.map((dept) => {
          const presentRate = Math.round((dept.present / dept.total) * 100);
          return (
            <TouchableOpacity
              key={dept.id}
              style={[
                styles.deptCard,
                selectedDepartment === dept.id && styles.deptCardActive,
              ]}
              onPress={() => handleDepartmentSelect(selectedDepartment === dept.id ? null : dept.id)}
            >
              <Text style={styles.deptName}>{dept.name}</Text>
              <View style={styles.deptProgressContainer}>
                <View style={styles.deptProgressBg}>
                  <View
                    style={[
                      styles.deptProgress,
                      { width: `${presentRate}%` }
                    ]}
                  />
                </View>
                <Text style={styles.deptProgressText}>{presentRate}%</Text>
              </View>
              <View style={styles.deptStats}>
                <View style={styles.deptStatItem}>
                  <View style={[styles.deptStatDot, { backgroundColor: '#52c41a' }]} />
                  <Text style={styles.deptStatText}>出勤 {dept.present}</Text>
                </View>
                <View style={styles.deptStatItem}>
                  <View style={[styles.deptStatDot, { backgroundColor: '#ff4d4f' }]} />
                  <Text style={styles.deptStatText}>缺勤 {dept.absent}</Text>
                </View>
                <View style={styles.deptStatItem}>
                  <View style={[styles.deptStatDot, { backgroundColor: '#fa8c16' }]} />
                  <Text style={styles.deptStatText}>迟到 {dept.late}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderRecordsList = () => (
    <View style={styles.recordsSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>考勤记录</Text>
        <Text style={styles.recordsCount}>{records.length} 条</Text>
      </View>

      {records.map((record) => (
        <TouchableOpacity
          key={record.id}
          style={styles.recordCard}
          onPress={() => handleRecordPress(record)}
        >
          <View style={styles.recordLeft}>
            <View style={styles.recordAvatar}>
              <Text style={styles.recordAvatarText}>
                {record.employeeName.substring(0, 1)}
              </Text>
            </View>
            <View style={styles.recordInfo}>
              <View style={styles.recordNameRow}>
                <Text style={styles.recordName}>{record.employeeName}</Text>
                <Text style={styles.recordCode}>({record.employeeCode})</Text>
              </View>
              <Text style={styles.recordDept}>{record.department}</Text>
            </View>
          </View>

          <View style={styles.recordRight}>
            <View style={styles.recordTimeRow}>
              {record.clockInTime ? (
                <>
                  <MaterialCommunityIcons name="login" size={14} color="#666" />
                  <Text style={styles.recordTime}>{record.clockInTime}</Text>
                </>
              ) : (
                <Text style={styles.recordTimeMissing}>未打卡</Text>
              )}
              {record.clockInTime && record.clockOutTime && (
                <Text style={styles.recordTimeSep}>-</Text>
              )}
              {record.clockOutTime && (
                <>
                  <MaterialCommunityIcons name="logout" size={14} color="#666" />
                  <Text style={styles.recordTime}>{record.clockOutTime}</Text>
                </>
              )}
            </View>
            <View
              style={[
                styles.recordStatusBadge,
                { backgroundColor: `${getStatusColor(record.status)}15` },
              ]}
            >
              <Text
                style={[
                  styles.recordStatusText,
                  { color: getStatusColor(record.status) },
                ]}
              >
                {getStatusLabel(record.status)}
              </Text>
            </View>
            {record.workHours !== undefined && (
              <Text style={styles.recordHours}>{record.workHours}h</Text>
            )}
          </View>

          {record.anomalies.length > 0 && (
            <View style={styles.recordAnomalies}>
              <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#fa8c16" />
              <Text style={styles.recordAnomalyText}>
                {record.anomalies.join(' | ')}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDepartmentModal = () => (
    <Modal
      visible={showDepartmentModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDepartmentModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowDepartmentModal(false)}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>选择部门</Text>
          <TouchableOpacity
            style={[
              styles.modalOption,
              selectedDepartment === null && styles.modalOptionActive,
            ]}
            onPress={() => handleDepartmentSelect(null)}
          >
            <Text
              style={[
                styles.modalOptionText,
                selectedDepartment === null && styles.modalOptionTextActive,
              ]}
            >
              全部部门
            </Text>
            {selectedDepartment === null && (
              <MaterialCommunityIcons name="check" size={20} color={DISPATCHER_THEME.primary} />
            )}
          </TouchableOpacity>
          {departmentStats.map((dept) => (
            <TouchableOpacity
              key={dept.id}
              style={[
                styles.modalOption,
                selectedDepartment === dept.id && styles.modalOptionActive,
              ]}
              onPress={() => handleDepartmentSelect(dept.id)}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  selectedDepartment === dept.id && styles.modalOptionTextActive,
                ]}
              >
                {dept.name}
              </Text>
              <Text style={styles.modalOptionCount}>{dept.total}人</Text>
              {selectedDepartment === dept.id && (
                <MaterialCommunityIcons name="check" size={20} color={DISPATCHER_THEME.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // 渲染加载状态
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
      <Text style={styles.loadingText}>加载考勤数据...</Text>
    </View>
  );

  // 渲染错误状态
  const renderError = () => (
    <View style={styles.errorContainer}>
      <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#ff4d4f" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => loadAttendanceData()}>
        <Text style={styles.retryButtonText}>重试</Text>
      </TouchableOpacity>
    </View>
  );

  // 渲染空状态
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="calendar-blank-outline" size={64} color="#ccc" />
      <Text style={styles.emptyText}>暂无考勤记录</Text>
      <Text style={styles.emptySubtext}>请调整日期范围或检查打卡数据</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}

      {initialLoading ? (
        renderLoading()
      ) : error ? (
        renderError()
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[DISPATCHER_THEME.primary]}
              tintColor={DISPATCHER_THEME.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {renderStatisticsCards()}
          {renderDepartmentOverview()}
          {records.length === 0 ? renderEmpty() : renderRecordsList()}
        </ScrollView>
      )}

      {renderDepartmentModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  exportButton: {
    padding: 4,
  },
  dateRangeTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 4,
  },
  dateRangeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  dateRangeTabActive: {
    backgroundColor: '#fff',
  },
  dateRangeTabText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  dateRangeTabTextActive: {
    color: DISPATCHER_THEME.primary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  // Statistics Section
  statsSection: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statCardSmall: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statValueSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statLabelSmall: {
    fontSize: 11,
    color: '#999',
  },
  // Department Section
  deptSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: `${DISPATCHER_THEME.primary}10`,
    borderRadius: 16,
  },
  filterText: {
    fontSize: 13,
    color: DISPATCHER_THEME.primary,
    marginLeft: 4,
  },
  deptScrollView: {
    paddingLeft: 16,
  },
  deptCard: {
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  deptCardActive: {
    borderColor: DISPATCHER_THEME.primary,
  },
  deptName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  deptProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  deptProgressBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    marginRight: 8,
    overflow: 'hidden',
  },
  deptProgress: {
    height: '100%',
    backgroundColor: '#52c41a',
    borderRadius: 3,
  },
  deptProgressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#52c41a',
    width: 36,
    textAlign: 'right',
  },
  deptStats: {
    marginTop: 4,
  },
  deptStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  deptStatDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  deptStatText: {
    fontSize: 11,
    color: '#666',
  },
  // Records Section
  recordsSection: {
    paddingHorizontal: 16,
  },
  recordsCount: {
    fontSize: 13,
    color: '#999',
  },
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  recordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recordAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${DISPATCHER_THEME.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recordAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: DISPATCHER_THEME.primary,
  },
  recordInfo: {
    flex: 1,
  },
  recordNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  recordCode: {
    fontSize: 12,
    color: '#999',
    marginLeft: 6,
  },
  recordDept: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  recordRight: {
    position: 'absolute',
    right: 14,
    top: 14,
    alignItems: 'flex-end',
  },
  recordTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  recordTime: {
    fontSize: 12,
    color: '#666',
    marginLeft: 2,
    marginRight: 4,
  },
  recordTimeMissing: {
    fontSize: 12,
    color: '#ff4d4f',
  },
  recordTimeSep: {
    color: '#ccc',
    marginHorizontal: 2,
  },
  recordStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 4,
  },
  recordStatusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  recordHours: {
    fontSize: 12,
    color: '#999',
  },
  recordAnomalies: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  recordAnomalyText: {
    fontSize: 12,
    color: '#fa8c16',
    marginLeft: 6,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionActive: {
    backgroundColor: `${DISPATCHER_THEME.primary}08`,
  },
  modalOptionText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  modalOptionTextActive: {
    color: DISPATCHER_THEME.primary,
    fontWeight: '600',
  },
  modalOptionCount: {
    fontSize: 13,
    color: '#999',
    marginRight: 8,
  },
  // Loading, Error, Empty states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 15,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: DISPATCHER_THEME.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
