import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, Appbar, ActivityIndicator, Dialog, Portal, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProcessingStackParamList } from '../../types/navigation';
import { useAuthStore } from '../../store/authStore';
import { dashboardAPI } from '../../services/api/dashboardApiClient';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建ProcessingDashboard专用logger
const dashboardLogger = logger.createContextLogger('ProcessingDashboard');

type ProcessingDashboardNavigationProp = NativeStackNavigationProp<
  ProcessingStackParamList,
  'ProcessingDashboard'
>;

interface ErrorState {
  message: string;
  canRetry: boolean;
}

/**
 * 生产仪表板 - 生产模块入口页
 */
export default function ProcessingDashboard() {
  const navigation = useNavigation<ProcessingDashboardNavigationProp>();
  const { user } = useAuthStore();

  // 状态管理
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [costAnalysisDialogVisible, setCostAnalysisDialogVisible] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    inProgressBatches: 0,
    totalBatches: 0,
    completedBatches: 0,
    pendingInspection: 0,
    onDutyWorkers: 0,
    totalWorkers: 0,
  });

  // 权限控制 - 简化逻辑
  const userType = user?.userType || 'factory';
  const isPlatformAdmin = userType === 'platform';
  const canOperate = !isPlatformAdmin;  // 只要不是平台管理员就能操作

  // 权限检查日志
  dashboardLogger.debug('权限检查', {
    userType,
    isPlatformAdmin,
    canOperate,
    roleCode: user?.roleCode || user?.factoryUser?.roleCode,
  });

  // 加载仪表板数据
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      dashboardLogger.debug('开始加载仪表板数据');

      // 使用 Dashboard API 获取今日概览数据
      const overviewRes = await dashboardAPI.getDashboardOverview('today');

      dashboardLogger.debug('仪表板数据响应', { success: overviewRes.success });

      // 提取数据 - 后端返回格式是 { success: true, data: {...}, message: "..." }
      const overview = overviewRes.data;
      dashboardLogger.debug('解析后数据', { hasSummary: !!overview?.summary });

      if (overview.summary) {
        const { summary } = overview;

        const newDashboardData = {
          inProgressBatches: summary.activeBatches ?? 0,
          totalBatches: summary.totalBatches ?? 0,
          completedBatches: summary.completedBatches ?? 0,
          pendingInspection: summary.qualityInspections ?? 0,
          onDutyWorkers: summary.onDutyWorkers ?? 0,
          totalWorkers: summary.totalWorkers ?? 0,
        };

        dashboardLogger.info('统计结果', newDashboardData);
        setDashboardData(newDashboardData);
        setError(null);
      } else {
        dashboardLogger.warn('仪表板数据格式错误', { response: overviewRes });
        setError({
          message: 'API返回数据格式错误，请稍后重试',
          canRetry: true,
        });
      }
    } catch (error) {
      dashboardLogger.error('加载仪表板数据失败', error);
      handleError(error, {
        showAlert: false,
        logError: true,
      });
      setError({
        message: error instanceof Error ? error.message : '加载仪表板数据失败，请稍后重试',
        canRetry: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.Content title="生产仪表板" />
        <Appbar.Action icon="refresh" onPress={loadDashboardData} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 今日概览 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="今日生产概览" />
          <Card.Content>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <IconButton icon="alert-circle-outline" size={48} iconColor="#F44336" />
                <Text variant="bodyMedium" style={styles.errorText}>
                  {error.message}
                </Text>
                {error.canRetry && (
                  <Button
                    mode="outlined"
                    icon="refresh"
                    onPress={loadDashboardData}
                    style={styles.retryButton}
                  >
                    重试
                  </Button>
                )}
              </View>
            ) : (
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={styles.statValue}>
                    {dashboardData.inProgressBatches} / {dashboardData.totalBatches}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>进行中批次</Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={styles.statValue}>
                    {dashboardData.completedBatches} / {dashboardData.totalBatches}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>已完成批次</Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={styles.statValue}>
                    {dashboardData.pendingInspection}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>待质检</Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={styles.statValue}>
                    {dashboardData.onDutyWorkers} / {dashboardData.totalWorkers}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>在岗人员</Text>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* 快捷操作 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="快捷操作" />
          <Card.Content>
            {/* 工厂用户操作按钮 */}
            {canOperate && (
              <View style={styles.actionsGrid}>
                <Button
                  mode="contained"
                  icon="truck-delivery"
                  onPress={() => navigation.navigate('CreateBatch')}
                  style={styles.actionButton}
                  buttonColor="#1976D2"
                >
                  原材料入库
                </Button>
                <Button
                  mode="contained"
                  icon="file-document-edit"
                  onPress={() => navigation.navigate('ProductionPlanManagement')}
                  style={styles.actionButton}
                  buttonColor="#388E3C"
                >
                  创建生产计划
                </Button>
              </View>
            )}

            {/* 平台管理员提示 */}
            {isPlatformAdmin && (
              <View style={styles.platformAdminNotice}>
                <Text variant="bodyMedium" style={styles.noticeText}>
                  👁️ 您是平台管理员，只能查看数据
                </Text>
                <Text variant="bodySmall" style={styles.noticeHint}>
                  原材料入库和生产计划管理仅限工厂用户使用
                </Text>
              </View>
            )}

            {/* 通用查看功能 - 所有用户都可以 */}
            <View style={styles.actionsGrid}>
              <Button
                mode="outlined"
                icon="clipboard-list"
                onPress={() => navigation.navigate('BatchList', {})}
                style={styles.actionButton}
              >
                批次列表
              </Button>
              <Button
                mode="outlined"
                icon="check-circle"
                onPress={() => navigation.navigate('QualityInspectionList', {})}
                style={styles.actionButton}
              >
                质检记录
              </Button>
              <Button
                mode="outlined"
                icon="package-variant"
                onPress={() => navigation.navigate('MaterialBatchManagement')}
                style={styles.actionButton}
              >
                原材料管理
              </Button>
              <Button
                mode="outlined"
                icon="monitor-dashboard"
                onPress={() => navigation.navigate('EquipmentMonitoring')}
                style={styles.actionButton}
              >
                设备监控
              </Button>
              <Button
                mode="outlined"
                icon="cash"
                onPress={() => setCostAnalysisDialogVisible(true)}
                style={styles.actionButton}
              >
                成本分析
              </Button>
              <Button
                mode="outlined"
                icon="chart-box"
                onPress={() => navigation.navigate('QualityAnalytics')}
                style={styles.actionButton}
              >
                质检统计
              </Button>
              <Button
                mode="outlined"
                icon="clipboard-check"
                onPress={() => navigation.navigate('InventoryCheck')}
                style={styles.actionButton}
              >
                库存盘点
              </Button>
              <Button
                mode="outlined"
                icon="alert-circle"
                onPress={() => navigation.navigate('ExceptionAlert')}
                style={styles.actionButton}
              >
                异常预警
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* AI智能分析 - Phase 3新增 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title
            title="AI智能分析"
            subtitle="DeepSeek驱动的智能成本分析"
            left={(props) => <Card.Title {...props} titleStyle={{}} />}
          />
          <Card.Content>
            <View style={styles.actionsGrid}>
              <Button
                mode="contained"
                icon="robot"
                onPress={() => navigation.navigate('AIReportList')}
                style={styles.actionButton}
                buttonColor="#9C27B0"
              >
                AI分析报告
              </Button>
              <Button
                mode="contained"
                icon="compare"
                onPress={() => navigation.navigate('CostComparison', {
                  batchIds: ['BATCH_001', 'BATCH_002', 'BATCH_003']
                })}
                style={styles.actionButton}
                buttonColor="#FF9800"
              >
                成本对比
              </Button>
              <Button
                mode="outlined"
                icon="calendar-range"
                onPress={() => navigation.navigate('TimeRangeCostAnalysis')}
                style={styles.actionButton}
              >
                时间范围分析
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* 最近批次 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="最近批次" />
          <Card.Content>
            <Text variant="bodyMedium" style={styles.placeholder}>
              暂无批次数据
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* 成本分析选择对话框 */}
      <Portal>
        <Dialog
          visible={costAnalysisDialogVisible}
          onDismiss={() => setCostAnalysisDialogVisible(false)}
        >
          <Dialog.Title>选择分析方式</Dialog.Title>
          <Dialog.Content>
            <Button
              mode="contained"
              icon="clipboard-list"
              onPress={() => {
                setCostAnalysisDialogVisible(false);
                navigation.navigate('BatchList', {
                  showCostAnalysis: true
                });
              }}
              style={styles.dialogButton}
            >
              按批次分析
            </Button>
            <Button
              mode="contained"
              icon="calendar-range"
              onPress={() => {
                setCostAnalysisDialogVisible(false);
                navigation.navigate('TimeRangeCostAnalysis');
              }}
              style={styles.dialogButton}
            >
              按时间范围分析
            </Button>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCostAnalysisDialogVisible(false)}>
              取消
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
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  statValue: {
    fontWeight: '700',
    color: '#1976D2',
  },
  statLabel: {
    color: '#757575',
    marginTop: 4,
  },
  actionsGrid: {
    gap: 12,
  },
  actionButton: {
    marginBottom: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  dialogButton: {
    marginBottom: 12,
  },
  placeholder: {
    textAlign: 'center',
    color: '#9E9E9E',
    paddingVertical: 24,
  },
  platformAdminNotice: {
    padding: 20,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    marginBottom: 16,
  },
  noticeText: {
    color: '#E65100',
    marginBottom: 8,
    fontWeight: '500',
  },
  noticeHint: {
    color: '#F57C00',
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#F44336',
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    borderColor: '#F44336',
  },
});
