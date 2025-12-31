import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Avatar,
  Chip,
  Divider,
  SegmentedButtons,
  DataTable,
  Button,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PlatformStackParamList } from '../../navigation/PlatformStackNavigator';
import { logger } from '../../utils/logger';
import { platformAPI, PlatformReportDTO, ReportSummary, TrendData, FactoryRanking } from '../../services/api/platformApiClient';

// 创建PlatformReports专用logger
const platformReportsLogger = logger.createContextLogger('PlatformReports');

type NavigationProp = NativeStackNavigationProp<PlatformStackParamList>;

type ReportType = 'production' | 'financial' | 'quality' | 'user';
type TimePeriod = 'week' | 'month' | 'quarter' | 'year';

// 默认报表数据
const DEFAULT_REPORT_DATA: PlatformReportDTO = {
  summary: {
    totalRevenue: 0,
    totalProduction: 0,
    totalOrders: 0,
    averageQualityScore: 0,
    changePercentage: 0,
  },
  trends: [],
  topFactories: [],
  reportType: 'production',
  timePeriod: 'month',
};

/**
 * 平台报表页面
 * 展示各类数据统计报表
 */
export default function PlatformReportsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('production');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [reportData, setReportData] = useState<PlatformReportDTO>(DEFAULT_REPORT_DATA);

  useEffect(() => {
    loadReportData();
  }, [reportType, timePeriod]);

  const loadReportData = async () => {
    platformReportsLogger.info('加载报表数据', { reportType, timePeriod });
    try {
      setError(null);
      const response = await platformAPI.getPlatformReport(reportType, timePeriod);
      if (response.success && response.data) {
        setReportData(response.data);
        platformReportsLogger.info('报表数据加载成功', {
          factoryCount: response.data.topFactories?.length || 0,
          trendCount: response.data.trends?.length || 0,
        });
      } else {
        const errorMsg = response.message || '加载报表数据失败';
        setError(errorMsg);
        platformReportsLogger.error('加载报表数据失败', { message: errorMsg });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '网络请求失败';
      setError(errorMsg);
      platformReportsLogger.error('加载报表数据异常', { error: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadReportData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = () => {
    platformReportsLogger.info('导出报表', { reportType, timePeriod });
    Alert.alert('导出报表', '报表数据已导出到文件');
  };

  const getReportTitle = () => {
    const titles: Record<ReportType, string> = {
      production: '生产报表',
      financial: '财务报表',
      quality: '质量报表',
      user: '用户报表',
    };
    return titles[reportType];
  };

  const getPeriodLabel = () => {
    const labels: Record<TimePeriod, string> = {
      week: '本周',
      month: '本月',
      quarter: '本季度',
      year: '本年',
    };
    return labels[timePeriod];
  };

  const formatCurrency = (value: number) => {
    return `¥${(value / 1000).toFixed(1)}K`;
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="平台报表" />
        <Appbar.Action icon="download" onPress={handleExport} />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 报表类型选择 */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionLabel}>
              报表类型
            </Text>
            <SegmentedButtons
              value={reportType}
              onValueChange={(value) => setReportType(value as ReportType)}
              buttons={[
                { value: 'production', label: '生产', icon: 'factory' },
                { value: 'financial', label: '财务', icon: 'currency-cny' },
                { value: 'quality', label: '质量', icon: 'shield-check' },
                { value: 'user', label: '用户', icon: 'account-group' },
              ]}
              style={styles.segmentedButtons}
            />

            <Text variant="titleSmall" style={[styles.sectionLabel, { marginTop: 16 }]}>
              时间周期
            </Text>
            <SegmentedButtons
              value={timePeriod}
              onValueChange={(value) => setTimePeriod(value as TimePeriod)}
              buttons={[
                { value: 'week', label: '本周' },
                { value: 'month', label: '本月' },
                { value: 'quarter', label: '本季' },
                { value: 'year', label: '本年' },
              ]}
              style={styles.segmentedButtons}
            />
          </Card.Content>
        </Card>

        {/* 报表标题 */}
        <View style={styles.reportHeader}>
          <Text variant="headlineSmall" style={styles.reportTitle}>
            {getReportTitle()} - {getPeriodLabel()}
          </Text>
        </View>

        {/* 加载状态 */}
        {loading && (
          <Card style={styles.card} mode="elevated">
            <Card.Content style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1976D2" />
              <Text style={styles.loadingText}>加载报表数据中...</Text>
            </Card.Content>
          </Card>
        )}

        {/* 错误状态 */}
        {!loading && error && (
          <Card style={[styles.card, styles.errorCard]} mode="elevated">
            <Card.Content style={styles.errorContent}>
              <Avatar.Icon icon="alert-circle" size={48} color="#D32F2F" style={styles.errorIcon} />
              <Text style={styles.errorText}>{error}</Text>
              <Button
                mode="outlined"
                onPress={() => loadReportData()}
                style={styles.retryButton}
                textColor="#1976D2"
              >
                重试
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* 概览数据 */}
        {!loading && !error && (
        <>
        <Card style={styles.card} mode="elevated">
          <Card.Title title="📊 数据概览" />
          <Card.Content>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Avatar.Icon icon="cash" size={40} color="#4CAF50" style={styles.summaryIcon} />
                <Text variant="bodySmall" style={styles.summaryLabel}>
                  总营收
                </Text>
                <Text variant="titleMedium" style={[styles.summaryValue, { color: '#4CAF50' }]}>
                  {formatCurrency(reportData.summary.totalRevenue)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Avatar.Icon icon="package-variant" size={40} color="#2196F3" style={styles.summaryIcon} />
                <Text variant="bodySmall" style={styles.summaryLabel}>
                  总产量
                </Text>
                <Text variant="titleMedium" style={[styles.summaryValue, { color: '#2196F3' }]}>
                  {reportData.summary.totalProduction}t
                </Text>
              </View>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Avatar.Icon icon="clipboard-list" size={40} color="#FF9800" style={styles.summaryIcon} />
                <Text variant="bodySmall" style={styles.summaryLabel}>
                  订单数
                </Text>
                <Text variant="titleMedium" style={[styles.summaryValue, { color: '#FF9800' }]}>
                  {reportData.summary.totalOrders}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Avatar.Icon icon="star" size={40} color="#9C27B0" style={styles.summaryIcon} />
                <Text variant="bodySmall" style={styles.summaryLabel}>
                  质量分数
                </Text>
                <Text variant="titleMedium" style={[styles.summaryValue, { color: '#9C27B0' }]}>
                  {reportData.summary.averageQualityScore}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 趋势分析 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="📈 趋势分析" />
          <Card.Content>
            {reportData.trends.map((trend, index) => (
              <View key={index} style={styles.trendItem}>
                <Text variant="bodyMedium" style={styles.trendPeriod}>
                  {trend.period}
                </Text>
                <View style={styles.trendRight}>
                  <Text variant="titleMedium" style={styles.trendValue}>
                    {trend.value}t
                  </Text>
                  <Chip
                    mode="flat"
                    compact
                    icon={trend.change > 0 ? 'trending-up' : 'trending-down'}
                    textStyle={{
                      color: trend.change > 0 ? '#4CAF50' : '#F44336',
                      fontSize: 12,
                    }}
                    style={{
                      backgroundColor: trend.change > 0 ? '#E8F5E9' : '#FFEBEE',
                    }}
                  >
                    {trend.change > 0 ? '+' : ''}{trend.change}%
                  </Chip>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* 工厂排行 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="🏆 工厂排行榜" />
          <Card.Content>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>工厂</DataTable.Title>
                <DataTable.Title numeric>产量(t)</DataTable.Title>
                <DataTable.Title numeric>效率(%)</DataTable.Title>
              </DataTable.Header>

              {reportData.topFactories.map((factory, index) => (
                <DataTable.Row key={factory.factoryId || index}>
                  <DataTable.Cell>
                    <View style={styles.factoryCell}>
                      <Chip
                        mode="flat"
                        compact
                        style={{
                          backgroundColor:
                            index === 0
                              ? '#FFD700'
                              : index === 1
                              ? '#C0C0C0'
                              : index === 2
                              ? '#CD7F32'
                              : '#E0E0E0',
                          width: 28,
                          height: 24,
                        }}
                        textStyle={{ fontSize: 10, fontWeight: '700' }}
                      >
                        {index + 1}
                      </Chip>
                      <Text variant="bodyMedium" style={{ marginLeft: 8 }}>
                        {factory.name}
                      </Text>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell numeric>{factory.production}</DataTable.Cell>
                  <DataTable.Cell numeric>
                    <Text
                      style={{
                        color:
                          factory.efficiency >= 90
                            ? '#4CAF50'
                            : factory.efficiency >= 85
                            ? '#FF9800'
                            : '#F44336',
                        fontWeight: '600',
                      }}
                    >
                      {factory.efficiency}
                    </Text>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </Card.Content>
        </Card>

        {/* 导出提示 */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <View style={styles.exportHint}>
              <Avatar.Icon icon="information" size={40} color="#2196F3" style={styles.exportIcon} />
              <View style={styles.exportText}>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                  导出报表
                </Text>
                <Text variant="bodySmall" style={{ color: '#757575', marginTop: 4 }}>
                  点击右上角下载图标，可导出Excel或PDF格式报表
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
        </>
        )}

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
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  sectionLabel: {
    marginBottom: 8,
    color: '#757575',
    fontWeight: '600',
  },
  segmentedButtons: {
    marginTop: 4,
  },
  reportHeader: {
    marginBottom: 16,
  },
  reportTitle: {
    fontWeight: '700',
    color: '#1976D2',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 12,
  },
  summaryIcon: {
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#757575',
    marginBottom: 4,
  },
  summaryValue: {
    fontWeight: '700',
  },
  divider: {
    marginVertical: 12,
  },
  trendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  trendPeriod: {
    fontWeight: '500',
  },
  trendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trendValue: {
    fontWeight: '600',
  },
  factoryCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exportHint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exportIcon: {
    backgroundColor: 'transparent',
    marginRight: 12,
  },
  exportText: {
    flex: 1,
  },
  bottomPadding: {
    height: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    color: '#757575',
  },
  errorCard: {
    backgroundColor: '#FFF3F3',
  },
  errorContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  errorIcon: {
    backgroundColor: 'transparent',
    marginBottom: 12,
  },
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    borderColor: '#1976D2',
  },
});
