import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Chip,
  DataTable,
  ActivityIndicator,
  Divider,
  SegmentedButtons,
  Surface,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../store/authStore';
import { timeclockApiClient } from '../../services/api/timeclockApiClient';
import { getFactoryId } from '../../types/auth';
import { handleError } from '../../utils/errorHandler';

/**
 * 格式化日期为 ISO 字符串 (YYYY-MM-DD)
 */
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 部门考勤查询页面
 * P2-考勤: 集成getDepartmentAttendance API
 *
 * 功能:
 * - 按部门和日期查询考勤
 * - 显示部门员工打卡列表
 * - 出勤率统计
 * - 迟到/早退/缺勤标记
 */
export default function DepartmentAttendanceScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  // UI状态
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 查询参数
  const [selectedDepartment, setSelectedDepartment] = useState('PROCESSING'); // 默认加工部
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 数据状态
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);

  /**
   * 部门列表
   */
  const departments = [
    { value: 'PROCESSING', label: '加工部', code: 'PROCESSING' },
    { value: 'QUALITY', label: '质检部', code: 'QUALITY' },
    { value: 'LOGISTICS', label: '物流部', code: 'LOGISTICS' },
    { value: 'FARMING', label: '养殖部', code: 'FARMING' },
    { value: 'MANAGEMENT', label: '管理部门', code: 'MANAGEMENT' },
  ];

  /**
   * 加载部门考勤数据
   */
  const loadDepartmentAttendance = async () => {
    setLoading(true);
    try {
      const factoryId = getFactoryId(user);

      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息，请重新登录');
        return;
      }

      console.log('📊 Loading department attendance...', {
        department: selectedDepartment,
        date: formatDate(selectedDate),
        factoryId,
      });

      // 调用部门考勤API
      const response = await timeclockApiClient.getDepartmentAttendance(
        selectedDepartment,
        formatDate(selectedDate),
        factoryId
      );

      console.log('✅ Department attendance loaded:', response);

      if (response.success && response.data) {
        setAttendanceData(response.data);

        // 提取员工记录列表
        const records = response.data.records || response.data.employees || [];
        setAttendanceRecords(Array.isArray(records) ? records : []);
      } else {
        console.warn('获取部门考勤失败:', response.message);
        setAttendanceData(null);
        setAttendanceRecords([]);
      }
    } catch (error) {
      console.error('❌ Failed to load department attendance:', error);
      const errorMessage =
        error.response?.data?.message || error.message || '加载部门考勤失败，请稍后重试';
      Alert.alert('加载失败', errorMessage);
      setAttendanceData(null);
      setAttendanceRecords([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 刷新数据
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDepartmentAttendance();
    setRefreshing(false);
  };

  /**
   * 页面聚焦时加载数据
   */
  useFocusEffect(
    useCallback(() => {
      loadDepartmentAttendance();
    }, [selectedDepartment, selectedDate])
  );

  /**
   * 获取状态标签
   */
  const getStatusChip = (status: string) => {
    const statusMap: Record<
      string,
      { label: string; color: string; bgColor: string }
    > = {
      present: { label: '正常', color: '#4CAF50', bgColor: '#E8F5E9' },
      late: { label: '迟到', color: '#FF9800', bgColor: '#FFF3E0' },
      early_leave: { label: '早退', color: '#FF9800', bgColor: '#FFF3E0' },
      absent: { label: '缺勤', color: '#F44336', bgColor: '#FFEBEE' },
      on_leave: { label: '请假', color: '#2196F3', bgColor: '#E3F2FD' },
    };

    const config = statusMap[status] || statusMap['absent'];

    return (
      <Chip
        mode="flat"
        compact
        style={{ backgroundColor: config.bgColor }}
        textStyle={{ color: config.color, fontSize: 12 }}
      >
        {config.label}
      </Chip>
    );
  };

  /**
   * 计算统计数据
   */
  const calculateStats = () => {
    const total = attendanceRecords.length;
    const present = attendanceRecords.filter(
      (r) => r.status === 'present' || r.clockInTime
    ).length;
    const late = attendanceRecords.filter((r) => r.status === 'late').length;
    const absent = attendanceRecords.filter(
      (r) => r.status === 'absent' || !r.clockInTime
    ).length;
    const attendanceRate = total > 0 ? (present / total) * 100 : 0;

    return {
      total,
      present,
      late,
      absent,
      attendanceRate,
    };
  };

  const stats = calculateStats();

  /**
   * 快捷日期选择
   */
  const setQuickDate = (days: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="部门考勤查询" />
        <Appbar.Action icon="refresh" onPress={loadDepartmentAttendance} />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 日期选择 */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text variant="bodyMedium" style={styles.sectionLabel}>
              查询日期
            </Text>
            <View style={styles.dateRow}>
              <Chip
                icon="calendar"
                onPress={() => setShowDatePicker(true)}
                style={styles.dateChip}
              >
                {selectedDate.toLocaleDateString('zh-CN')}
              </Chip>

              {/* 快捷日期 */}
              <View style={styles.quickDates}>
                <Chip
                  mode={
                    formatDate(selectedDate) === formatDate(new Date()) ? 'flat' : 'outlined'
                  }
                  compact
                  onPress={() => setSelectedDate(new Date())}
                  style={styles.quickDateChip}
                >
                  今天
                </Chip>
                <Chip
                  mode="outlined"
                  compact
                  onPress={() => setQuickDate(-1)}
                  style={styles.quickDateChip}
                >
                  昨天
                </Chip>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 部门选择 */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text variant="bodyMedium" style={styles.sectionLabel}>
              选择部门
            </Text>
            <View style={styles.departmentGrid}>
              {departments.map((dept) => (
                <Chip
                  key={dept.value}
                  mode={selectedDepartment === dept.value ? 'flat' : 'outlined'}
                  selected={selectedDepartment === dept.value}
                  onPress={() => setSelectedDepartment(dept.value)}
                  style={styles.departmentChip}
                >
                  {dept.label}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* 统计概览 */}
        <Surface style={styles.statsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.statsTitle}>
            考勤统计
          </Text>
          <Divider style={styles.divider} />

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>应出勤</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#4CAF50' }]}>{stats.present}</Text>
                <Text style={styles.statLabel}>实际出勤</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#FF9800' }]}>{stats.late}</Text>
                <Text style={styles.statLabel}>迟到</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#F44336' }]}>{stats.absent}</Text>
                <Text style={styles.statLabel}>缺勤</Text>
              </View>
            </View>
          )}

          {!loading && stats.total > 0 && (
            <View style={styles.attendanceRateContainer}>
              <Text style={styles.attendanceRateLabel}>出勤率</Text>
              <Text style={styles.attendanceRateValue}>
                {stats.attendanceRate.toFixed(1)}%
              </Text>
            </View>
          )}
        </Surface>

        {/* 员工打卡列表 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="员工打卡记录" titleVariant="titleMedium" />
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>姓名</DataTable.Title>
              <DataTable.Title>上班</DataTable.Title>
              <DataTable.Title>下班</DataTable.Title>
              <DataTable.Title numeric>工时</DataTable.Title>
              <DataTable.Title>状态</DataTable.Title>
            </DataTable.Header>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : attendanceRecords.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  暂无考勤记录
                </Text>
              </View>
            ) : (
              attendanceRecords.map((record, index) => (
                <DataTable.Row key={record.userId || index}>
                  <DataTable.Cell>
                    <Text variant="bodyMedium">{record.userName || record.employeeName || `员工${record.userId}`}</Text>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    {record.clockInTime
                      ? new Date(record.clockInTime).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </DataTable.Cell>
                  <DataTable.Cell>
                    {record.clockOutTime
                      ? new Date(record.clockOutTime).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    {record.workDuration
                      ? (record.workDuration / 60).toFixed(1)
                      : record.workHours
                      ? record.workHours.toFixed(1)
                      : '-'}
                  </DataTable.Cell>
                  <DataTable.Cell>
                    {getStatusChip(record.status || (record.clockInTime ? 'present' : 'absent'))}
                  </DataTable.Cell>
                </DataTable.Row>
              ))
            )}
          </DataTable>
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* 日期选择器 */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) {
              setSelectedDate(date);
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  card: {
    margin: 16,
    marginBottom: 0,
  },
  sectionLabel: {
    color: '#666',
    marginBottom: 12,
    fontWeight: '500',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateChip: {
    backgroundColor: '#E3F2FD',
  },
  quickDates: {
    flexDirection: 'row',
    gap: 8,
  },
  quickDateChip: {
    height: 32,
  },
  departmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  departmentChip: {
    minWidth: 80,
  },
  statsCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 0,
  },
  statsTitle: {
    fontWeight: '600',
    color: '#212121',
  },
  divider: {
    marginVertical: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 12,
    color: '#999',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBox: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2196F3',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
  },
  attendanceRateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  attendanceRateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  attendanceRateValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
  },
  bottomPadding: {
    height: 80,
  },
});
