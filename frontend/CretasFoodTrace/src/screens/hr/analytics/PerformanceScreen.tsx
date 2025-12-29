/**
 * 绩效分析
 *
 * 功能:
 * - 绩效等级分布
 * - 优秀/需关注员工统计
 * - 员工绩效列表
 *
 * 对应原型: /docs/prd/prototype/hr-admin/performance.html
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Text, Card, Chip, Avatar, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { hrApiClient } from '../../../services/api/hrApiClient';
import {
  HR_THEME,
  PERFORMANCE_GRADE_CONFIG,
  type PerformanceStats,
  type EmployeePerformance,
  type PerformanceGrade,
} from '../../../types/hrNavigation';

type Period = 'month' | 'quarter' | 'year';

export default function PerformanceScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('month');
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [employees, setEmployees] = useState<EmployeePerformance[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [statsData, listData] = await Promise.all([
        hrApiClient.getPerformanceStats({ period }),
        hrApiClient.getEmployeePerformanceList(), // period filter not supported, using default list
      ]);

      // API returns data directly
      if (statsData) {
        setStats(statsData as PerformanceStats);
      }
      if (listData?.content) {
        setEmployees(listData.content as EmployeePerformance[]);
      }
    } catch (error) {
      console.error('加载绩效数据失败:', error);
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

  const renderHeader = () => (
    <View>
      {/* 统计卡片 */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <MaterialCommunityIcons
              name="chart-arc"
              size={24}
              color={HR_THEME.primary}
            />
            <Text style={styles.statValue}>
              {stats?.avgScore?.toFixed(1) ?? '-'}
            </Text>
            <Text style={styles.statLabel}>平均分</Text>
          </Card.Content>
        </Card>
        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <MaterialCommunityIcons
              name="star"
              size={24}
              color={HR_THEME.success}
            />
            <Text style={styles.statValue}>
              {stats?.excellentCount ?? 0}
            </Text>
            <Text style={styles.statLabel}>优秀</Text>
          </Card.Content>
        </Card>
        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={24}
              color={HR_THEME.warning}
            />
            <Text style={styles.statValue}>
              {stats?.needAttentionCount ?? 0}
            </Text>
            <Text style={styles.statLabel}>需关注</Text>
          </Card.Content>
        </Card>
      </View>

      {/* 等级分布 */}
      <Card style={styles.distributionCard}>
        <Card.Content>
          <Text style={styles.sectionTitle}>绩效等级分布</Text>
          <View style={styles.gradeBar}>
            {stats?.gradeDistribution?.map((item) => {
              const config = PERFORMANCE_GRADE_CONFIG[item.grade];
              return (
                <View
                  key={item.grade}
                  style={[
                    styles.gradeSegment,
                    {
                      flex: item.percentage || 1,
                      backgroundColor: config.color,
                    },
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.gradeLegend}>
            {Object.entries(PERFORMANCE_GRADE_CONFIG).map(([grade, config]) => (
              <View key={grade} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: config.color }]}
                />
                <Text style={styles.legendText}>{config.label}</Text>
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>

      <Text style={styles.listTitle}>员工绩效列表</Text>
    </View>
  );

  const renderItem = ({ item }: { item: EmployeePerformance }) => {
    const gradeConfig = PERFORMANCE_GRADE_CONFIG[item.grade];

    return (
      <TouchableOpacity
        onPress={() =>
          navigation.navigate('StaffDetail' as any, { staffId: item.userId })
        }
      >
        <Card style={styles.employeeCard}>
          <Card.Content style={styles.employeeContent}>
            <Avatar.Text
              size={44}
              label={item.userName?.substring(0, 1) || 'U'}
              style={{ backgroundColor: HR_THEME.primary }}
            />
            <View style={styles.employeeInfo}>
              <Text style={styles.employeeName}>{item.userName}</Text>
              <Text style={styles.employeeDept}>
                {item.department} · {item.position || '员工'}
              </Text>
            </View>
            <View style={styles.scoreContainer}>
              <Text style={[styles.score, { color: gradeConfig.color }]}>
                {item.score}
              </Text>
              <Chip
                mode="flat"
                textStyle={{ fontSize: 10, color: gradeConfig.color }}
                style={[styles.gradeChip, { backgroundColor: gradeConfig.bgColor }]}
              >
                {gradeConfig.label}
              </Chip>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
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
        <Text style={styles.headerTitle}>绩效分析</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.periodSelector}>
        <SegmentedButtons
          value={period}
          onValueChange={(value) => setPeriod(value as Period)}
          buttons={[
            { value: 'month', label: '本月' },
            { value: 'quarter', label: '本季' },
            { value: 'year', label: '本年' },
          ]}
          style={styles.segmented}
        />
      </View>

      <FlatList
        data={employees}
        keyExtractor={(item) => String(item.userId)}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="chart-box-outline"
              size={64}
              color={HR_THEME.textMuted}
            />
            <Text style={styles.emptyText}>暂无绩效数据</Text>
          </View>
        }
      />
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
  listContent: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 16,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: HR_THEME.textPrimary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: HR_THEME.textSecondary,
    marginTop: 4,
  },
  distributionCard: {
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
  gradeBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  gradeSegment: {
    minWidth: 4,
  },
  gradeLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginTop: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: HR_THEME.textSecondary,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: HR_THEME.textPrimary,
    marginBottom: 12,
  },
  employeeCard: {
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: HR_THEME.cardBackground,
  },
  employeeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: '500',
    color: HR_THEME.textPrimary,
  },
  employeeDept: {
    fontSize: 13,
    color: HR_THEME.textSecondary,
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  score: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  gradeChip: {
    height: 22,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    color: HR_THEME.textMuted,
  },
});
