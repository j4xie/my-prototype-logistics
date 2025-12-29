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
  ProgressBar,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { qualityInspectionApiClient } from '../../services/api/qualityInspectionApiClient';
import { getFactoryId } from '../../types/auth';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建QualityReport专用logger
const qualityReportLogger = logger.createContextLogger('QualityReport');

/**
 * 质量报表页面
 * 集成数据来源:
 * - qualityInspectionApiClient: 质检记录、质检统计
 *
 * 展示内容:
 * - 质检合格率统计
 * - 问题分类分析
 * - 质量趋势
 */
export default function QualityReportScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('week');

  // 数据状态
  const [qualityStats, setQualityStats] = useState<any>(null);
  const [recentInspections, setRecentInspections] = useState<any[]>([]);

  /**
   * 加载质检数据
   */
  const loadQualityData = async () => {
    setLoading(true);
    try {
      const factoryId = getFactoryId(user);

      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息，请重新登录');
        return;
      }

      qualityReportLogger.debug('加载质量报表数据', { timeRange, factoryId });

      // 加载质检记录列表
      const inspectionsResponse = await qualityInspectionApiClient.getInspections(
        {
          page: 1,
          size: 20,
        },
        factoryId
      );

      if (inspectionsResponse.success && inspectionsResponse.data) {
        const inspections = inspectionsResponse.data.content || inspectionsResponse.data || [];
        setRecentInspections(Array.isArray(inspections) ? inspections : []);

        // 计算统计数据
        const stats = calculateQualityStats(inspections);
        setQualityStats(stats);

        qualityReportLogger.info('质量报表数据加载成功', {
          inspectionCount: inspections.length,
          passRate: stats.passRate.toFixed(1) + '%',
          factoryId,
        });
      } else {
        qualityReportLogger.warn('获取质检数据失败', {
          message: inspectionsResponse.message,
          factoryId,
        });
        setRecentInspections([]);
        setQualityStats(null);
      }
    } catch (error) {
      qualityReportLogger.error('加载质量报表失败', error as Error, {
        factoryId: getFactoryId(user),
        timeRange,
      });
      handleError(error, {
        title: '加载失败',
        customMessage: '加载质检数据失败，请稍后重试',
      });
      setRecentInspections([]);
      setQualityStats(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 计算质检统计
   */
  const calculateQualityStats = (inspections: any[]) => {
    const totalInspections = inspections.length;
    const passedInspections = inspections.filter(
      (i) => i.result === 'PASSED' || i.result === 'passed' || i.inspectionResult === 'PASSED'
    ).length;
    const failedInspections = inspections.filter(
      (i) => i.result === 'FAILED' || i.result === 'failed' || i.inspectionResult === 'FAILED'
    ).length;
    const conditionalInspections = inspections.filter(
      (i) =>
        i.result === 'CONDITIONAL' ||
        i.result === 'conditional' ||
        i.inspectionResult === 'CONDITIONAL'
    ).length;

    const passRate = totalInspections > 0 ? (passedInspections / totalInspections) * 100 : 0;

    // 问题分类统计
    const issueCategories: Record<string, number> = {};
    inspections.forEach((inspection) => {
      if (inspection.issues && Array.isArray(inspection.issues)) {
        inspection.issues.forEach((issue: any) => {
          const category = issue.category || '其他问题';
          issueCategories[category] = (issueCategories[category] || 0) + 1;
        });
      }
    });

    return {
      totalInspections,
      passedInspections,
      failedInspections,
      conditionalInspections,
      passRate,
      issueCategories,
    };
  };

  /**
   * 刷新数据
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadQualityData();
    setRefreshing(false);
  };

  /**
   * 页面聚焦时加载数据
   */
  useFocusEffect(
    useCallback(() => {
      loadQualityData();
    }, [timeRange])
  );

  /**
   * 获取结果标签
   */
  const getResultChip = (result: string) => {
    const resultMap: Record<string, { label: string; color: string; bgColor: string }> = {
      PASSED: { label: '合格', color: '#4CAF50', bgColor: '#E8F5E9' },
      passed: { label: '合格', color: '#4CAF50', bgColor: '#E8F5E9' },
      FAILED: { label: '不合格', color: '#F44336', bgColor: '#FFEBEE' },
      failed: { label: '不合格', color: '#F44336', bgColor: '#FFEBEE' },
      CONDITIONAL: { label: '待定', color: '#FF9800', bgColor: '#FFF3E0' },
      conditional: { label: '待定', color: '#FF9800', bgColor: '#FFF3E0' },
    };

    const config = resultMap[result] ?? resultMap['CONDITIONAL'];

    return (
      <Chip
        mode="flat"
        compact
        style={{ backgroundColor: config?.bgColor ?? '#FFF3E0' }}
        textStyle={{ color: config?.color ?? '#FF9800', fontSize: 12 }}
      >
        {config?.label ?? '待定'}
      </Chip>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="质量报表" />
        <Appbar.Action icon="refresh" onPress={loadQualityData} />
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

        {/* 统计概览 */}
        <Surface style={styles.statsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.statsTitle}>
            质检统计
          </Text>
          <Divider style={styles.divider} />

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : qualityStats ? (
            <>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{qualityStats.totalInspections}</Text>
                  <Text style={styles.statLabel}>总质检数</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                    {qualityStats.passedInspections}
                  </Text>
                  <Text style={styles.statLabel}>合格</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: '#F44336' }]}>
                    {qualityStats.failedInspections}
                  </Text>
                  <Text style={styles.statLabel}>不合格</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: '#FF9800' }]}>
                    {qualityStats.conditionalInspections}
                  </Text>
                  <Text style={styles.statLabel}>待定</Text>
                </View>
              </View>

              {/* 合格率 */}
              <View style={styles.passRateContainer}>
                <View style={styles.passRateHeader}>
                  <Text style={styles.passRateLabel}>合格率</Text>
                  <Text style={styles.passRateValue}>{qualityStats.passRate.toFixed(1)}%</Text>
                </View>
                <ProgressBar
                  progress={qualityStats.passRate / 100}
                  color={qualityStats.passRate >= 95 ? '#4CAF50' : '#FF9800'}
                  style={styles.progressBar}
                />
              </View>
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无统计数据</Text>
            </View>
          )}
        </Surface>

        {/* 最近质检记录 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="最近质检记录" titleVariant="titleMedium" />
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>批次号</DataTable.Title>
              <DataTable.Title>质检员</DataTable.Title>
              <DataTable.Title>结果</DataTable.Title>
            </DataTable.Header>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : recentInspections.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  暂无质检记录
                </Text>
              </View>
            ) : (
              recentInspections.slice(0, 10).map((inspection, index) => (
                <DataTable.Row key={inspection.id || index}>
                  <DataTable.Cell>
                    <Text variant="bodySmall">
                      {inspection.batchNumber || `批次${inspection.batchId}`}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <Text variant="bodySmall">
                      {inspection.inspectorName || `质检员${inspection.inspectorId}`}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    {getResultChip(inspection.result || inspection.inspectionResult || 'CONDITIONAL')}
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
  passRateContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  passRateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  passRateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  passRateValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
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
  bottomPadding: {
    height: 80,
  },
});
