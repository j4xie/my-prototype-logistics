/**
 * 工时成本分析
 *
 * 功能:
 * - 总成本/总工时/人均工时统计
 * - 部门成本分布饼图
 * - 员工工时排行榜
 *
 * 对应原型: /docs/prd/prototype/hr-admin/labor-cost.html
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Text, Card, SegmentedButtons, Avatar, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { timeStatsApiClient } from '../../../services/api/timeStatsApiClient';
import {
  HR_THEME,
  type LaborCostSummary,
  type DepartmentCostDistribution,
  type WorkerHoursRank,
} from '../../../types/hrNavigation';

type Period = 'week' | 'month' | 'quarter';

export default function LaborCostScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('month');
  const [summary, setSummary] = useState<LaborCostSummary | null>(null);
  const [deptDistribution, setDeptDistribution] = useState<DepartmentCostDistribution[]>([]);
  const [workerRank, setWorkerRank] = useState<WorkerHoursRank[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [summaryData, deptData, rankData] = await Promise.all([
        timeStatsApiClient.getLaborCostSummary({ period }),
        timeStatsApiClient.getCostByDepartment({ period }),
        timeStatsApiClient.getWorkerHoursRank({ period, limit: 10 }),
      ]);

      // API returns data directly, map to expected types
      if (summaryData) {
        setSummary({
          ...summaryData,
          period: period, // Add period from local state
        });
      }
      if (deptData) {
        // Add color to each department based on index
        const colors: string[] = ['#667eea', '#52c41a', '#fa8c16', '#1890ff', '#722ed1', '#eb2f96'];
        const withColors: DepartmentCostDistribution[] = deptData.map((d, idx) => ({
          departmentId: d.departmentId,
          departmentName: d.departmentName,
          cost: d.cost,
          percentage: d.percentage,
          color: colors[idx % colors.length]!,
        }));
        setDeptDistribution(withColors);
      }
      if (rankData) {
        setWorkerRank(rankData);
      }
    } catch (error) {
      console.error('加载工时成本数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatCurrency = (amount: number): string => {
    return `¥${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={HR_THEME.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={HR_THEME.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>工时成本</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.periodSelector}>
        <SegmentedButtons
          value={period}
          onValueChange={(value) => setPeriod(value as Period)}
          buttons={[
            { value: 'week', label: '本周' },
            { value: 'month', label: '本月' },
            { value: 'quarter', label: '本季' },
          ]}
          style={styles.segmented}
        />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 统计卡片 */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <MaterialCommunityIcons
                name="currency-cny"
                size={24}
                color={HR_THEME.primary}
              />
              <Text style={styles.statValue}>
                {formatCurrency(summary?.totalCost ?? 0)}
              </Text>
              <Text style={styles.statLabel}>总成本</Text>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={24}
                color={HR_THEME.info}
              />
              <Text style={styles.statValue}>
                {formatMinutes(summary?.totalWorkMinutes ?? 0)}
              </Text>
              <Text style={styles.statLabel}>总工时</Text>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <MaterialCommunityIcons
                name="account-group"
                size={24}
                color={HR_THEME.success}
              />
              <Text style={styles.statValue}>
                {summary?.participatingEmployees ?? 0}
              </Text>
              <Text style={styles.statLabel}>参与员工</Text>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <MaterialCommunityIcons
                name="chart-timeline"
                size={24}
                color={HR_THEME.warning}
              />
              <Text style={styles.statValue}>
                {formatCurrency(summary?.avgHourlyRate ?? 0)}
              </Text>
              <Text style={styles.statLabel}>时薪均值</Text>
            </Card.Content>
          </Card>
        </View>

        {/* 部门成本分布 */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>部门成本分布</Text>
            {deptDistribution.length === 0 ? (
              <Text style={styles.emptyText}>暂无数据</Text>
            ) : (
              deptDistribution.map((dept, index) => (
                <View key={dept.departmentId} style={styles.deptRow}>
                  <View style={styles.deptInfo}>
                    <View
                      style={[styles.deptColor, { backgroundColor: dept.color }]}
                    />
                    <Text style={styles.deptName}>{dept.departmentName}</Text>
                  </View>
                  <View style={styles.deptStats}>
                    <Text style={styles.deptCost}>{formatCurrency(dept.cost)}</Text>
                    <Text style={styles.deptPercent}>{dept.percentage.toFixed(1)}%</Text>
                  </View>
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        {/* 员工工时排行 */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>员工工时排行</Text>
            {workerRank.length === 0 ? (
              <Text style={styles.emptyText}>暂无数据</Text>
            ) : (
              workerRank.map((worker) => (
                <TouchableOpacity
                  key={worker.userId}
                  style={styles.rankRow}
                  onPress={() =>
                    navigation.navigate('StaffDetail' as any, { staffId: worker.userId })
                  }
                >
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankNumber}>{worker.rank}</Text>
                  </View>
                  <Avatar.Text
                    size={36}
                    label={worker.userName?.substring(0, 1) || 'U'}
                    style={{ backgroundColor: HR_THEME.primary }}
                  />
                  <View style={styles.rankInfo}>
                    <Text style={styles.rankName}>{worker.userName}</Text>
                    <Text style={styles.rankDept}>{worker.department || '未分配'}</Text>
                  </View>
                  <Text style={styles.rankHours}>{worker.totalHours.toFixed(1)}h</Text>
                </TouchableOpacity>
              ))
            )}
          </Card.Content>
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HR_THEME.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: HR_THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: HR_THEME.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: HR_THEME.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: HR_THEME.textPrimary,
  },
  placeholder: {
    width: 32,
  },
  periodSelector: {
    padding: 16,
    backgroundColor: HR_THEME.cardBackground,
  },
  segmented: {
    backgroundColor: HR_THEME.background,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: HR_THEME.cardBackground,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: HR_THEME.textPrimary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: HR_THEME.textSecondary,
    marginTop: 4,
  },
  sectionCard: {
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: HR_THEME.cardBackground,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: HR_THEME.textPrimary,
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: HR_THEME.textMuted,
    paddingVertical: 20,
  },
  deptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: HR_THEME.border,
  },
  deptInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deptColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  deptName: {
    fontSize: 14,
    color: HR_THEME.textPrimary,
  },
  deptStats: {
    alignItems: 'flex-end',
  },
  deptCost: {
    fontSize: 14,
    fontWeight: '500',
    color: HR_THEME.textPrimary,
  },
  deptPercent: {
    fontSize: 12,
    color: HR_THEME.textSecondary,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: HR_THEME.border,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: HR_THEME.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: HR_THEME.primary,
  },
  rankInfo: {
    flex: 1,
    marginLeft: 12,
  },
  rankName: {
    fontSize: 14,
    fontWeight: '500',
    color: HR_THEME.textPrimary,
  },
  rankDept: {
    fontSize: 12,
    color: HR_THEME.textSecondary,
  },
  rankHours: {
    fontSize: 14,
    fontWeight: '600',
    color: HR_THEME.primary,
  },
  bottomSpacer: {
    height: 80,
  },
});
