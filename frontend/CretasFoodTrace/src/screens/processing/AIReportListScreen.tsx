import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Appbar,
  Card,
  SegmentedButtons,
  Chip,
  ActivityIndicator,
  IconButton,
  Divider,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { ProcessingScreenProps } from '../../types/navigation';
import { aiApiClient, ReportSummary } from '../../services/api/aiApiClient';
import { useAuthStore } from '../../store/authStore';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建AIReportList专用logger
const aiReportListLogger = logger.createContextLogger('AIReportList');

type AIReportListScreenProps = ProcessingScreenProps<'AIReportList'>;

/**
 * AI报告列表界面
 *
 * 功能:
 * - 展示所有历史AI报告列表
 * - 按报告类型分类显示(批次分析/周报/月报/自定义)
 * - 显示生成时间、报告标题、批次号
 * - 点击查看完整报告详情
 * - 下拉刷新和加载更多
 *
 * @version 1.0.0
 * @since 2025-11-05
 */
export default function AIReportListScreen() {
  const navigation = useNavigation<AIReportListScreenProps['navigation']>();
  const { user } = useAuthStore();

  // 状态管理
  const [selectedType, setSelectedType] = useState<string>('all');
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // 页面加载时获取报告
  useEffect(() => {
    fetchReports();
  }, [selectedType]);

  /**
   * 获取报告列表
   */
  const fetchReports = async () => {
    try {
      setLoading(true);

      const factoryId = user?.factoryUser?.factoryId;
      if (!factoryId) {
        Alert.alert('错误', '用户信息不完整');
        return;
      }

      // 构建查询参数
      const params: any = {};
      if (selectedType !== 'all') {
        params.reportType = selectedType;
      }

      aiReportListLogger.debug('获取AI报告列表', { factoryId, params, selectedType });

      const response = await aiApiClient.getReports(params, factoryId);

      if (response && response.reports) {
        aiReportListLogger.info('AI报告列表加载成功', {
          factoryId,
          reportCount: response.reports.length,
          reportType: selectedType,
        });
        setReports(response.reports);
      } else {
        setReports([]);
      }
    } catch (error) {
      aiReportListLogger.error('获取AI报告列表失败', error as Error, {
        factoryId,
        selectedType,
      });
      Alert.alert('加载失败', error.response?.data?.message || error.message || '请稍后重试');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 下拉刷新
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  };

  /**
   * 查看报告详情
   */
  const handleViewReport = (report: ReportSummary) => {
    navigation.navigate('AIAnalysisDetail', {
      reportId: report.reportId,
      reportType: report.reportType,
      title: report.title,
    });
  };

  /**
   * 获取报告类型徽章
   */
  const getReportTypeChip = (type: string) => {
    const typeMap = {
      batch: { label: '批次分析', icon: 'package-variant', color: '#2196F3' },
      weekly: { label: '周报', icon: 'calendar-week', color: '#4CAF50' },
      monthly: { label: '月报', icon: 'calendar-month', color: '#FF9800' },
      custom: { label: '自定义', icon: 'tune', color: '#9C27B0' },
    };

    const config = typeMap[type as keyof typeof typeMap] || typeMap.custom;

    return (
      <Chip
        icon={config.icon}
        mode="outlined"
        compact
        style={[styles.typeChip, { borderColor: config.color }]}
        textStyle={{ color: config.color, fontSize: 11 }}
      >
        {config.label}
      </Chip>
    );
  };

  /**
   * 格式化时间
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  /**
   * 渲染报告卡片
   */
  const renderReportCard = ({ item }: { item: ReportSummary }) => (
    <TouchableOpacity
      onPress={() => handleViewReport(item)}
      activeOpacity={0.7}
    >
      <Card style={styles.reportCard} mode="elevated">
        <Card.Content>
          {/* 报告头部 */}
          <View style={styles.cardHeader}>
            <View style={styles.titleContainer}>
              <Text variant="titleMedium" style={styles.reportTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {getReportTypeChip(item.reportType)}
            </View>
            <IconButton
              icon="chevron-right"
              size={24}
              iconColor="#9E9E9E"
              onPress={() => handleViewReport(item)}
            />
          </View>

          {/* 报告元数据 */}
          <View style={styles.metadataContainer}>
            {/* 批次号 */}
            {item.batchNumber && (
              <View style={styles.metadataRow}>
                <Text variant="bodySmall" style={styles.metadataLabel}>批次:</Text>
                <Text variant="bodySmall" style={styles.metadataValue}>
                  {item.batchNumber}
                </Text>
              </View>
            )}

            {/* 时间范围 */}
            {item.startDate && item.endDate && (
              <View style={styles.metadataRow}>
                <Text variant="bodySmall" style={styles.metadataLabel}>时间:</Text>
                <Text variant="bodySmall" style={styles.metadataValue}>
                  {new Date(item.startDate).toLocaleDateString('zh-CN')} - {new Date(item.endDate).toLocaleDateString('zh-CN')}
                </Text>
              </View>
            )}

            {/* 成本 */}
            {item.totalCost !== undefined && item.totalCost !== null && (
              <View style={styles.metadataRow}>
                <Text variant="bodySmall" style={styles.metadataLabel}>成本:</Text>
                <Text variant="bodySmall" style={[styles.metadataValue, styles.costValue]}>
                  ¥{item.totalCost.toFixed(2)}
                </Text>
              </View>
            )}
          </View>

          <Divider style={styles.divider} />

          {/* 报告统计 */}
          <View style={styles.statsContainer}>
            {item.keyFindingsCount !== undefined && item.keyFindingsCount > 0 && (
              <View style={styles.statItem}>
                <Text variant="bodySmall" style={styles.statIcon}>🔍</Text>
                <Text variant="bodySmall" style={styles.statText}>
                  {item.keyFindingsCount}个发现
                </Text>
              </View>
            )}

            {item.suggestionsCount !== undefined && item.suggestionsCount > 0 && (
              <View style={styles.statItem}>
                <Text variant="bodySmall" style={styles.statIcon}>💡</Text>
                <Text variant="bodySmall" style={styles.statText}>
                  {item.suggestionsCount}条建议
                </Text>
              </View>
            )}

            <View style={styles.statItem}>
              <Text variant="bodySmall" style={styles.statIcon}>📅</Text>
              <Text variant="bodySmall" style={styles.statText}>
                {formatDate(item.createdAt)}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* 顶部导航栏 */}
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="AI分析报告" />
      </Appbar.Header>

      {/* 报告类型筛选 */}
      <SegmentedButtons
        value={selectedType}
        onValueChange={setSelectedType}
        buttons={[
          { value: 'all', label: '全部' },
          { value: 'batch', label: '批次' },
          { value: 'weekly', label: '周报' },
          { value: 'monthly', label: '月报' },
        ]}
        style={styles.segmentedButtons}
      />

      {/* 报告列表 */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyMedium" style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          renderItem={renderReportCard}
          keyExtractor={(item) => item.reportId.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text variant="displaySmall" style={styles.emptyIcon}>📊</Text>
              <Text variant="titleMedium" style={styles.emptyText}>
                暂无AI分析报告
              </Text>
              <Text variant="bodyMedium" style={styles.emptyHint}>
                使用AI成本分析功能后，报告将显示在这里
              </Text>
            </View>
          }
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
  segmentedButtons: {
    marginHorizontal: 16,
    marginVertical: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#757575',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  reportCard: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    gap: 8,
  },
  reportTitle: {
    fontWeight: '700',
    color: '#212121',
    flex: 1,
  },
  typeChip: {
    alignSelf: 'flex-start',
    height: 24,
  },
  metadataContainer: {
    gap: 6,
    marginBottom: 12,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metadataLabel: {
    color: '#757575',
    width: 50,
    fontWeight: '500',
  },
  metadataValue: {
    color: '#424242',
    flex: 1,
  },
  costValue: {
    color: '#2196F3',
    fontWeight: '600',
  },
  divider: {
    marginVertical: 12,
    backgroundColor: '#E0E0E0',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    fontSize: 14,
  },
  statText: {
    color: '#757575',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 16,
    opacity: 0.3,
  },
  emptyText: {
    color: '#9E9E9E',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    color: '#BDBDBD',
    textAlign: 'center',
  },
});
