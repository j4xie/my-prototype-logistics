import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Chip,
  DataTable,
  Button,
  Searchbar,
  ActivityIndicator,
  Divider,
  Dialog,
  Portal,
  TextInput,
  IconButton,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../store/authStore';
import { timeclockApiClient, ClockRecord, ApiResponse, PagedResponse } from '../../services/api/timeclockApiClient';
import { getFactoryId, isPlatformUser, isFactoryUser } from '../../types/auth';
import { handleError } from '../../utils/errorHandler';

interface AttendanceRecord {
  id: string;
  date: Date;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  workHours: number;
  overtimeHours: number;
  workType: string;
  status: 'normal' | 'late' | 'early_leave' | 'absent';
}

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
 * 考勤历史查询页面
 * 功能：
 * - 日期范围筛选
 * - 打卡记录列表显示
 * - 工时统计
 * - 导出功能
 */
export default function AttendanceHistoryScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  // 数据状态
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);

  // UI状态
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 日期筛选
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // 分页
  const [page, setPage] = useState(0);
  const [itemsPerPage] = useState(10);

  // 编辑对话框状态
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editingClockIn, setEditingClockIn] = useState('');
  const [editingClockOut, setEditingClockOut] = useState('');
  const [editReason, setEditReason] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  /**
   * 获取用户ID
   */
  const getUserId = (): number => {
    if (!user) return 0;

    if (isPlatformUser(user)) {
      return user.platformUser?.id || 0;
    }
    if (isFactoryUser(user)) {
      return user.factoryUser?.id || 0;
    }
    return 0;
  };

  /**
   * 转换后端ClockRecord为前端AttendanceRecord
   */
  const transformClockRecord = (record: ClockRecord): AttendanceRecord => {
    const clockInTime = record.clockInTime ? new Date(record.clockInTime) : null;
    const clockOutTime = record.clockOutTime ? new Date(record.clockOutTime) : null;

    // 计算工作小时数
    const workHours = record.workDuration ? record.workDuration / 60 : 0;

    // 标准工作时间：8小时
    const standardHours = 8;
    const overtimeHours = Math.max(0, workHours - standardHours);

    // 判断考勤状态
    let status: AttendanceRecord['status'] = 'normal';
    if (!clockInTime) {
      status = 'absent';
    } else {
      const checkInHour = clockInTime.getHours();
      const checkInMinute = clockInTime.getMinutes();

      // 迟到：晚于8:00打卡
      if (checkInHour > 8 || (checkInHour === 8 && checkInMinute > 0)) {
        status = 'late';
      }

      // 早退：早于17:00下班且有打卡记录
      if (clockOutTime) {
        const checkOutHour = clockOutTime.getHours();
        if (checkOutHour < 17) {
          status = 'early_leave';
        }
      }
    }

    return {
      id: String(record.id || 0),
      date: clockInTime || new Date(),
      checkInTime: clockInTime,
      checkOutTime: clockOutTime,
      workHours: Math.round(workHours * 10) / 10,
      overtimeHours: Math.round(overtimeHours * 10) / 10,
      workType: record.remarks || '生产加工',
      status,
    };
  };

  /**
   * 加载考勤记录
   */
  const loadAttendanceRecords = async () => {
    setLoading(true);
    try {
      const userId = getUserId();
      const factoryId = getFactoryId(user);

      if (!userId || !factoryId) {
        Alert.alert('错误', '无法获取用户信息，请重新登录');
        return;
      }

      // 并行加载打卡历史和统计数据
      const [historyResponse] = await Promise.all([
        // 加载打卡历史
        timeclockApiClient.getClockHistory(
          userId,
          {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
            page: 0,
            size: 100, // 获取所有记录，前端做分页
          },
          factoryId
        ),
        // 加载考勤统计（不阻塞，错误时静默失败）
        loadAttendanceStatistics(),
      ]);

      if (historyResponse.success && historyResponse.data) {
        // historyResponse.data 是 PagedResponse<ClockRecord> 类型
        const clockRecords: ClockRecord[] = historyResponse.data.content || [];

        // 转换为AttendanceRecord格式
        const attendanceRecords = clockRecords.map(transformClockRecord);

        setRecords(attendanceRecords);
        setFilteredRecords(attendanceRecords);
      } else {
        console.warn('获取考勤记录失败:', historyResponse.message);
        setRecords([]);
        setFilteredRecords([]);
      }
    } catch (error) {
      console.error('加载考勤记录失败:', error);
      Alert.alert('加载失败', '无法加载考勤记录，请稍后重试');
      setRecords([]);
      setFilteredRecords([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 刷新数据
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAttendanceRecords();
    setRefreshing(false);
  };

  /**
   * 页面聚焦时加载数据
   */
  useFocusEffect(
    useCallback(() => {
      loadAttendanceRecords();
    }, [startDate, endDate])
  );

  /**
   * 搜索筛选
   */
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredRecords(records);
      return;
    }

    const filtered = records.filter(record =>
      record.workType.toLowerCase().includes(query.toLowerCase()) ||
      record.date.toLocaleDateString().includes(query)
    );
    setFilteredRecords(filtered);
    setPage(0);
  };

  /**
   * 获取状态标签
   */
  const getStatusChip = (status: AttendanceRecord['status']) => {
    const statusMap = {
      normal: { label: '正常', color: '#4CAF50' },
      late: { label: '迟到', color: '#FF9800' },
      early_leave: { label: '早退', color: '#FF9800' },
      absent: { label: '缺勤', color: '#F44336' },
    };

    const config = statusMap[status];
    return (
      <Chip
        mode="flat"
        compact
        style={{ backgroundColor: config.color + '20' }}
        textStyle={{ color: config.color, fontSize: 12 }}
      >
        {config.label}
      </Chip>
    );
  };

  /**
   * 加载考勤统计（使用API）
   */
  const [apiStats, setApiStats] = useState<{
    totalWorkDuration?: number;
    avgWorkDuration?: number;
    totalOvertimeDuration?: number;
    attendanceDays?: number;
    lateDays?: number;
    earlyLeaveDays?: number;
  } | null>(null);

  const loadAttendanceStatistics = async () => {
    try {
      const userId = getUserId();
      const factoryId = getFactoryId(user);

      if (!userId || !factoryId) {
        return;
      }

      console.log('📊 Loading attendance statistics from API...');

      const response = await timeclockApiClient.getAttendanceStatistics(
        userId,
        {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        },
        factoryId
      );

      if (response.success && response.data) {
        console.log('✅ Attendance statistics loaded:', response.data);
        setApiStats(response.data);
      }
    } catch (error) {
      console.error('❌ Failed to load attendance statistics:', error);
      // 不显示错误，静默失败，使用本地计算
      setApiStats(null);
    }
  };

  /**
   * 计算统计数据（本地计算作为后备）
   */
  const calculateStats = () => {
    // 如果API统计可用，优先使用API数据
    if (apiStats) {
      const totalWorkHours = (apiStats.totalWorkDuration || 0) / 60;
      const totalOvertimeHours = (apiStats.totalOvertimeDuration || 0) / 60;
      const avgWorkHours = (apiStats.avgWorkDuration || 0) / 60;

      return {
        totalWorkHours,
        totalOvertimeHours,
        normalDays: apiStats.attendanceDays || 0,
        lateDays: apiStats.lateDays || 0,
        absentDays: 0, // API暂不提供
        avgWorkHours,
      };
    }

    // 否则使用本地计算
    const totalWorkHours = filteredRecords.reduce((sum, r) => sum + r.workHours, 0);
    const totalOvertimeHours = filteredRecords.reduce((sum, r) => sum + r.overtimeHours, 0);
    const normalDays = filteredRecords.filter(r => r.status === 'normal').length;
    const lateDays = filteredRecords.filter(r => r.status === 'late').length;
    const absentDays = filteredRecords.filter(r => r.status === 'absent').length;

    return {
      totalWorkHours,
      totalOvertimeHours,
      normalDays,
      lateDays,
      absentDays,
      avgWorkHours: filteredRecords.length > 0 ? totalWorkHours / filteredRecords.length : 0,
    };
  };

  const stats = calculateStats();

  /**
   * 导出考勤记录
   */
  const handleExport = () => {
    // @ts-expect-error - DataExport is in ProfileStack/ReportStack, cross-stack navigation
    navigation.navigate('DataExport', { reportType: 'attendance' });
  };

  /**
   * 打开编辑对话框
   */
  const openEditDialog = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditingClockIn(
      record.checkInTime
        ? record.checkInTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        : ''
    );
    setEditingClockOut(
      record.checkOutTime
        ? record.checkOutTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        : ''
    );
    setEditReason('');
    setEditDialogVisible(true);
  };

  /**
   * 关闭编辑对话框
   */
  const closeEditDialog = () => {
    if (savingEdit) {
      return; // 保存时不允许关闭
    }
    setEditDialogVisible(false);
    setEditingRecord(null);
    setEditingClockIn('');
    setEditingClockOut('');
    setEditReason('');
  };

  /**
   * 保存编辑
   */
  const handleSaveEdit = async () => {
    if (!editingRecord) {
      return;
    }

    if (!editReason.trim()) {
      Alert.alert('验证失败', '请填写修改原因');
      return;
    }

    // 验证时间格式 (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (editingClockIn && !timeRegex.test(editingClockIn)) {
      Alert.alert('验证失败', '上班时间格式不正确，请使用24小时制（如：08:30）');
      return;
    }
    if (editingClockOut && !timeRegex.test(editingClockOut)) {
      Alert.alert('验证失败', '下班时间格式不正确，请使用24小时制（如：17:30）');
      return;
    }

    try {
      setSavingEdit(true);
      console.log('📝 Saving attendance edit...');

      const userId = getUserId();
      const factoryId = getFactoryId(user);

      // 构建编辑后的时间
      const recordDate = editingRecord.date;
      let clockInTime: string | undefined;
      let clockOutTime: string | undefined;

      if (editingClockIn) {
        const [hour, minute] = editingClockIn.split(':');
        const clockInDate = new Date(recordDate);
        clockInDate.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
        clockInTime = clockInDate.toISOString();
      }

      if (editingClockOut) {
        const [hour, minute] = editingClockOut.split(':');
        const clockOutDate = new Date(recordDate);
        clockOutDate.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
        clockOutTime = clockOutDate.toISOString();
      }

      // 调用编辑API
      await timeclockApiClient.editClockRecord(
        parseInt(editingRecord.id, 10),
        {
          clockInTime,
          clockOutTime,
        },
        {
          editedBy: userId,
          reason: editReason,
        },
        factoryId
      );

      console.log('✅ Attendance record edited successfully');

      // 关闭对话框并刷新数据
      closeEditDialog();
      Alert.alert('修改成功', '考勤记录已更新', [
        { text: '确定', onPress: () => loadAttendanceRecords() },
      ]);
    } catch (error) {
      console.error('❌ Failed to edit attendance record:', error);
      const errorMessage =
        error.response?.data?.message || error.message || '修改考勤记录失败，请重试';
      Alert.alert('修改失败', errorMessage);
    } finally {
      setSavingEdit(false);
    }
  };

  // 分页数据
  const from = page * itemsPerPage;
  const to = Math.min((page + 1) * itemsPerPage, filteredRecords.length);
  const paginatedRecords = filteredRecords.slice(from, to);

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="考勤历史" />
        <Appbar.Action icon="download" onPress={handleExport} />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* 日期范围筛选 */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <View style={styles.dateFilterRow}>
              <View style={styles.dateItem}>
                <Text variant="bodySmall" style={styles.dateLabel}>
                  开始日期
                </Text>
                <Chip
                  icon="calendar"
                  onPress={() => setShowStartPicker(true)}
                  style={styles.dateChip}
                >
                  {startDate.toLocaleDateString('zh-CN')}
                </Chip>
              </View>

              <Text variant="bodyLarge" style={styles.dateSeparator}>
                -
              </Text>

              <View style={styles.dateItem}>
                <Text variant="bodySmall" style={styles.dateLabel}>
                  结束日期
                </Text>
                <Chip
                  icon="calendar"
                  onPress={() => setShowEndPicker(true)}
                  style={styles.dateChip}
                >
                  {endDate.toLocaleDateString('zh-CN')}
                </Chip>
              </View>
            </View>

            {/* 快捷日期 */}
            <View style={styles.quickDates}>
              <Button
                mode="outlined"
                compact
                onPress={() => {
                  setStartDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
                  setEndDate(new Date());
                }}
                style={styles.quickButton}
              >
                近7天
              </Button>
              <Button
                mode="outlined"
                compact
                onPress={() => {
                  setStartDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
                  setEndDate(new Date());
                }}
                style={styles.quickButton}
              >
                近30天
              </Button>
              <Button
                mode="outlined"
                compact
                onPress={() => {
                  const now = new Date();
                  setStartDate(new Date(now.getFullYear(), now.getMonth(), 1));
                  setEndDate(now);
                }}
                style={styles.quickButton}
              >
                本月
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* 统计数据 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="统计概览" titleVariant="titleMedium" />
          <Card.Content>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={styles.statValue}>
                  {stats.totalWorkHours.toFixed(1)}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  总工时
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={[styles.statValue, { color: '#FF9800' }]}>
                  {stats.totalOvertimeHours.toFixed(1)}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  加班时长
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={[styles.statValue, { color: '#4CAF50' }]}>
                  {stats.normalDays}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  正常天数
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={[styles.statValue, { color: '#F44336' }]}>
                  {stats.lateDays}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  迟到次数
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 搜索栏 */}
        <Searchbar
          placeholder="搜索工作类型或日期"
          value={searchQuery}
          onChangeText={handleSearch}
          style={styles.searchbar}
        />

        {/* 考勤记录表格 */}
        <Card style={styles.card} mode="elevated">
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>日期</DataTable.Title>
              <DataTable.Title>上班</DataTable.Title>
              <DataTable.Title>下班</DataTable.Title>
              <DataTable.Title numeric>工时</DataTable.Title>
              <DataTable.Title>状态</DataTable.Title>
              <DataTable.Title>操作</DataTable.Title>
            </DataTable.Header>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : paginatedRecords.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  暂无考勤记录
                </Text>
              </View>
            ) : (
              paginatedRecords.map((record) => (
                <DataTable.Row key={record.id}>
                  <DataTable.Cell>
                    {record.date.toLocaleDateString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                    })}
                  </DataTable.Cell>
                  <DataTable.Cell>
                    {record.checkInTime
                      ? record.checkInTime.toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </DataTable.Cell>
                  <DataTable.Cell>
                    {record.checkOutTime
                      ? record.checkOutTime.toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    {record.workHours > 0 ? record.workHours.toFixed(1) : '-'}
                  </DataTable.Cell>
                  <DataTable.Cell>{getStatusChip(record.status)}</DataTable.Cell>
                  <DataTable.Cell>
                    <IconButton
                      icon="pencil"
                      size={20}
                      onPress={() => openEditDialog(record)}
                      disabled={loading}
                    />
                  </DataTable.Cell>
                </DataTable.Row>
              ))
            )}

            <DataTable.Pagination
              page={page}
              numberOfPages={Math.ceil(filteredRecords.length / itemsPerPage)}
              onPageChange={(page) => setPage(page)}
              label={`${from + 1}-${to} / ${filteredRecords.length}`}
              numberOfItemsPerPage={itemsPerPage}
              showFastPaginationControls
            />
          </DataTable>
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* 日期选择器 */}
      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartPicker(false);
            if (selectedDate) {
              setStartDate(selectedDate);
            }
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndPicker(false);
            if (selectedDate) {
              setEndDate(selectedDate);
            }
          }}
        />
      )}

      {/* 编辑对话框 */}
      <Portal>
        <Dialog visible={editDialogVisible} onDismiss={closeEditDialog} style={styles.dialog}>
          <Dialog.Title>修改考勤记录</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogDescription}>
              修改日期：{editingRecord?.date.toLocaleDateString('zh-CN')}
            </Text>

            <TextInput
              label="上班时间 (如: 08:30)"
              value={editingClockIn}
              onChangeText={setEditingClockIn}
              mode="outlined"
              style={styles.timeInput}
              placeholder="08:30"
              disabled={savingEdit}
              keyboardType="numbers-and-punctuation"
            />

            <TextInput
              label="下班时间 (如: 17:30)"
              value={editingClockOut}
              onChangeText={setEditingClockOut}
              mode="outlined"
              style={styles.timeInput}
              placeholder="17:30"
              disabled={savingEdit}
              keyboardType="numbers-and-punctuation"
            />

            <TextInput
              label="修改原因（必填）"
              value={editReason}
              onChangeText={setEditReason}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.reasonInput}
              placeholder="请填写修改原因，如：忘记打卡、设备故障等"
              disabled={savingEdit}
            />

            {savingEdit && (
              <View style={styles.savingContainer}>
                <ActivityIndicator size="small" />
                <Text style={styles.savingText}>正在保存修改...</Text>
              </View>
            )}
          </Dialog.Content>

          <Dialog.Actions>
            <Button onPress={closeEditDialog} disabled={savingEdit}>
              取消
            </Button>
            <Button
              onPress={handleSaveEdit}
              disabled={savingEdit || !editReason.trim()}
              mode="contained"
            >
              保存
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    color: '#666',
    marginBottom: 8,
  },
  dateChip: {
    backgroundColor: '#E3F2FD',
  },
  dateSeparator: {
    marginHorizontal: 8,
    color: '#666',
  },
  quickDates: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  quickButton: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    minWidth: '22%',
  },
  statValue: {
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  searchbar: {
    margin: 16,
    marginBottom: 0,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
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
  dialog: {
    maxWidth: 500,
    alignSelf: 'center',
    width: '90%',
  },
  dialogDescription: {
    marginBottom: 16,
    color: '#666',
  },
  timeInput: {
    marginTop: 12,
  },
  reasonInput: {
    marginTop: 12,
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  savingText: {
    marginLeft: 12,
    color: '#666',
  },
});
