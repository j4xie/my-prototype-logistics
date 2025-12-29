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

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
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

// Mock data
const mockStatistics: AttendanceStatistics = {
  totalWorkDays: 22,
  totalWorkHours: 176,
  averageWorkHours: 8.0,
  overtimeHours: 12.5,
  lateCount: 3,
  earlyLeaveCount: 1,
  absentCount: 0,
  period: {
    startDate: '2024-12-01',
    endDate: '2024-12-31',
  },
};

const mockDepartmentStats: DepartmentStats[] = [
  { id: 'D1', name: '切片车间', total: 12, present: 10, absent: 0, late: 1, onLeave: 1 },
  { id: 'D2', name: '包装车间', total: 8, present: 7, absent: 1, late: 0, onLeave: 0 },
  { id: 'D3', name: '冷冻车间', total: 6, present: 6, absent: 0, late: 0, onLeave: 0 },
  { id: 'D4', name: '质检部门', total: 4, present: 4, absent: 0, late: 1, onLeave: 0 },
];

const mockRecords: AttendanceRecord[] = [
  {
    id: '1',
    employeeId: 'E001',
    employeeName: '张三丰',
    employeeCode: '001',
    department: '切片车间',
    date: '2024-12-27',
    clockInTime: '08:02',
    clockOutTime: '17:35',
    workHours: 8.5,
    overtimeHours: 0.5,
    status: 'overtime',
    anomalies: [],
  },
  {
    id: '2',
    employeeId: 'E002',
    employeeName: '李四海',
    employeeCode: '002',
    department: '切片车间',
    date: '2024-12-27',
    clockInTime: '08:15',
    clockOutTime: '17:00',
    workHours: 7.75,
    status: 'late',
    anomalies: ['迟到15分钟'],
  },
  {
    id: '3',
    employeeId: 'E003',
    employeeName: '王五行',
    employeeCode: '003',
    department: '包装车间',
    date: '2024-12-27',
    clockInTime: '07:55',
    clockOutTime: '16:30',
    workHours: 7.5,
    status: 'early',
    anomalies: ['早退30分钟'],
  },
  {
    id: '4',
    employeeId: 'E004',
    employeeName: '赵六顺',
    employeeCode: '004',
    department: '包装车间',
    date: '2024-12-27',
    status: 'absent',
    anomalies: ['未打卡'],
  },
  {
    id: '5',
    employeeId: 'E005',
    employeeName: '陈七星',
    employeeCode: '005',
    department: '质检部门',
    date: '2024-12-27',
    clockInTime: '08:00',
    clockOutTime: '17:00',
    workHours: 8.0,
    status: 'normal',
    anomalies: [],
  },
];

export default function PersonnelAttendanceScreen() {
  const navigation = useNavigation();

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeType>('today');
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [statistics, setStatistics] = useState<AttendanceStatistics>(mockStatistics);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>(mockDepartmentStats);
  const [records, setRecords] = useState<AttendanceRecord[]>(mockRecords);

  // Callbacks
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // TODO: Fetch real data from API
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleDateRangeChange = (range: DateRangeType) => {
    setDateRange(range);
    // TODO: Fetch data for the selected range
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}

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
        {renderRecordsList()}
      </ScrollView>

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
});
