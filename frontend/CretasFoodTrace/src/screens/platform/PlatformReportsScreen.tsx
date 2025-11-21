import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Avatar,
  Chip,
  Divider,
  SegmentedButtons,
  DataTable,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PlatformStackParamList } from '../../navigation/PlatformStackNavigator';
import { logger } from '../../utils/logger';

// 创建PlatformReports专用logger
const platformReportsLogger = logger.createContextLogger('PlatformReports');

type NavigationProp = NativeStackNavigationProp<PlatformStackParamList>;

type ReportType = 'production' | 'financial' | 'quality' | 'user';
type TimePeriod = 'week' | 'month' | 'quarter' | 'year';

/**
 * 平台报表页面
 * 展示各类数据统计报表
 */
export default function PlatformReportsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('production');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');

  // Mock数据 - 实际应从后端API获取
  const [reportData, setReportData] = useState({
    summary: {
      totalRevenue: 1258600,
      totalProduction: 3420.5,
      totalOrders: 856,
      averageQualityScore: 96.8,
    },
    trends: [
      { period: '第1周', value: 285.3, change: 12.5 },
      { period: '第2周', value: 312.8, change: 9.6 },
      { period: '第3周', value: 298.4, change: -4.6 },
      { period: '第4周', value: 324.0, change: 8.6 },
    ],
    topFactories: [
      { id: 1, name: '上海工厂', production: 856.2, revenue: 345600, efficiency: 94.5 },
      { id: 2, name: '北京工厂', production: 742.8, revenue: 298400, efficiency: 92.3 },
      { id: 3, name: '广州工厂', production: 698.5, revenue: 281200, efficiency: 89.8 },
      { id: 4, name: '深圳工厂', production: 612.3, revenue: 246800, efficiency: 88.2 },
      { id: 5, name: '成都工厂', production: 510.7, revenue: 205600, efficiency: 85.6 },
    ],
  });

  useEffect(() => {
    loadReportData();
  }, [reportType, timePeriod]);

  const loadReportData = async () => {
    platformReportsLogger.info('加载报表数据', { reportType, timePeriod });
    // TODO: 从后端API加载真实数据
    // const response = await platformAPI.getReportData(reportType, timePeriod);
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

        {/* 概览数据 */}
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
                <DataTable.Row key={factory.id}>
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
});
