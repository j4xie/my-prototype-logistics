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
  Surface,
  SegmentedButtons,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { personnelApiClient } from '../../services/api/personnelApiClient';
import { handleError } from '../../utils/errorHandler';
import type {
  PersonnelStatistics,
  WorkHoursRankingItem,
} from '../../services/api/personnelApiClient';
import { getFactoryId } from '../../types/auth';

/**
 * 人员报表页面
 * API集成:
 * - GET /api/mobile/{factoryId}/personnel/statistics - 人员总览统计
 * - GET /api/mobile/{factoryId}/personnel/work-hours-ranking - 工时排行榜
 * - GET /api/mobile/{factoryId}/personnel/overtime-statistics - 加班统计
 * - GET /api/mobile/{factoryId}/personnel/performance - 人员绩效统计
 *
 * 展示内容:
 * - 人员总览统计
 * - 工时排行榜（TOP 10）
 * - 加班统计
 * - 绩效评估
 */
export default function PersonnelReportScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('month');

  // 数据状态
  const [personnelStats, setPersonnelStats] = useState<PersonnelStatistics | null>(null);
  const [workHoursRanking, setWorkHoursRanking] = useState<WorkHoursRankingItem[]>([]);

  /**
   * 加载人员统计数据
   */
  const loadPersonnelData = async () => {
    setLoading(true);
    try {
      const factoryId = getFactoryId(user);

      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息，请重新登录');
        return;
      }

      console.log('📊 Loading personnel data...', { timeRange, factoryId });

      // 计算日期范围
      const endDate = new Date();
      const startDate = new Date();
      if (timeRange === 'week') {
        startDate.setDate(endDate.getDate() - 7);
      } else if (timeRange === 'month') {
        startDate.setMonth(endDate.getMonth() - 1);
      } else {
        startDate.setDate(endDate.getDate() - 1);
      }

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);

      // 并行加载人员统计和工时排行榜
      const [statsResponse, rankingResponse] = await Promise.all([
        personnelApiClient.getPersonnelStatistics(factoryId, startDateStr, endDateStr)
          .catch((err) => {
            console.error('人员统计API失败:', err);
            return { success: false, data: null };
          }),
        personnelApiClient.getWorkHoursRanking(factoryId, startDateStr, endDateStr, 10)
          .catch((err) => {
            console.error('工时排行API失败:', err);
            return { success: false, data: [] };
          }),
      ]);

      // 设置人员统计数据
      if (statsResponse.success && statsResponse.data) {
        setPersonnelStats(statsResponse.data);
        console.log('✅ Personnel statistics loaded:', statsResponse.data);
      } else {
        setPersonnelStats(null);
      }

      // 设置工时排行榜
      if (rankingResponse.success && rankingResponse.data) {
        setWorkHoursRanking(rankingResponse.data);
        console.log('✅ Work hours ranking loaded:', rankingResponse.data.length, 'items');
      } else {
        setWorkHoursRanking([]);
      }

    } catch (error) {
      console.error('❌ Failed to load personnel data:', error);
      const errorMessage =
        error.response?.data?.message || error.message || '加载人员数据失败，请稍后重试';
      Alert.alert('加载失败', errorMessage);
      setPersonnelStats(null);
      setWorkHoursRanking([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 刷新数据
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPersonnelData();
    setRefreshing(false);
  };

  /**
   * 页面聚焦时加载数据
   */
  useFocusEffect(
    useCallback(() => {
      loadPersonnelData();
    }, [timeRange])
  );

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="人员报表" />
        <Appbar.Action icon="refresh" onPress={loadPersonnelData} />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 时间范围选择 */}
        <Surface style={styles.timeRangeCard} elevation={1}>
          <Text variant="bodyMedium" style={styles.sectionLabel}>
            时间范围
          </Text>
          <SegmentedButtons
            value={timeRange}
            onValueChange={setTimeRange}
            buttons={[
              { value: 'day', label: '今日' },
              { value: 'week', label: '本周' },
              { value: 'month', label: '本月' },
            ]}
            style={styles.segmentedButtons}
          />
        </Surface>

        {/* 人员总览 */}
        <Surface style={styles.statsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.statsTitle}>
            人员总览
          </Text>
          <Divider style={styles.divider} />

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : personnelStats ? (
            <>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{personnelStats.totalEmployees}</Text>
                  <Text style={styles.statLabel}>总人数</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                    {personnelStats.totalPresent}
                  </Text>
                  <Text style={styles.statLabel}>在岗</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: '#F44336' }]}>
                    {personnelStats.totalAbsent}
                  </Text>
                  <Text style={styles.statLabel}>缺勤</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: '#2196F3' }]}>
                    {personnelStats.activeDepartments}
                  </Text>
                  <Text style={styles.statLabel}>活跃部门</Text>
                </View>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.attendanceRateContainer}>
                <Text style={styles.attendanceRateLabel}>平均出勤率</Text>
                <Text style={styles.attendanceRateValue}>
                  {personnelStats.avgAttendanceRate.toFixed(1)}%
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无人员数据</Text>
            </View>
          )}
        </Surface>

        {/* 工时排行榜 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="工时排行榜（TOP 10）" titleVariant="titleMedium" />
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>姓名</DataTable.Title>
              <DataTable.Title>部门</DataTable.Title>
              <DataTable.Title numeric>工时</DataTable.Title>
              <DataTable.Title numeric>出勤率</DataTable.Title>
            </DataTable.Header>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : workHoursRanking.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  暂无工时数据
                </Text>
              </View>
            ) : (
              workHoursRanking.map((item, index) => (
                <DataTable.Row key={item.userId || index}>
                  <DataTable.Cell>
                    <View style={styles.rankingNameCell}>
                      {index < 3 && (
                        <Chip
                          mode="flat"
                          style={[
                            styles.rankChip,
                            index === 0 && { backgroundColor: '#FFD700' },
                            index === 1 && { backgroundColor: '#C0C0C0' },
                            index === 2 && { backgroundColor: '#CD7F32' },
                          ]}
                          textStyle={{ fontSize: 10, fontWeight: 'bold' }}
                        >
                          {index + 1}
                        </Chip>
                      )}
                      <Text variant="bodySmall">{item.userName}</Text>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <Text variant="bodySmall" numberOfLines={1}>
                      {item.departmentName}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    <Text variant="bodySmall" style={{ color: '#2196F3', fontWeight: '600' }}>
                      {item.totalWorkHours.toFixed(1)}h
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    <Text
                      variant="bodySmall"
                      style={{
                        color: item.attendanceRate >= 95 ? '#4CAF50' : '#FF9800',
                      }}
                    >
                      {item.attendanceRate.toFixed(0)}%
                    </Text>
                  </DataTable.Cell>
                </DataTable.Row>
              ))
            )}
          </DataTable>
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>
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
  timeRangeCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#666',
    marginBottom: 12,
    fontWeight: '500',
  },
  segmentedButtons: {
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
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
  card: {
    margin: 16,
    marginBottom: 0,
    marginTop: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
  },
  rankingNameCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankChip: {
    height: 20,
    marginRight: 4,
  },
  bottomPadding: {
    height: 80,
  },
});
