import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, Appbar, ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProcessingStackParamList } from '../../types/navigation';
import { useAuthStore } from '../../store/authStore';
import { dashboardAPI } from '../../services/api/dashboardApiClient';

type ProcessingDashboardNavigationProp = NativeStackNavigationProp<
  ProcessingStackParamList,
  'ProcessingDashboard'
>;

/**
 * 生产仪表板 - 生产模块入口页
 */
export default function ProcessingDashboard() {
  const navigation = useNavigation<ProcessingDashboardNavigationProp>();
  const { user } = useAuthStore();

  // 状态管理
  const [loading, setLoading] = useState(false);
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

  // 调试日志
  console.log('🔍 ProcessingDashboard权限检查:', {
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
      console.log('🔄 ProcessingDashboard - 开始加载仪表板数据...');

      // 使用 Dashboard API 获取今日概览数据
      const overviewRes = await dashboardAPI.getDashboardOverview('today');

      console.log('📊 ProcessingDashboard - 仪表板数据响应:', overviewRes);

      // 提取数据 - 后端返回格式是 { success: true, data: {...}, message: "..." }
      const overview = (overviewRes as any).data || overviewRes;
      console.log('📊 ProcessingDashboard - 解析后数据:', overview);

      if (overview.summary) {
        const { summary } = overview;

        const newDashboardData = {
          inProgressBatches: summary.activeBatches || 0,
          totalBatches: summary.totalBatches || 0,
          completedBatches: summary.completedBatches || 0,
          pendingInspection: summary.qualityInspections || 0,
          onDutyWorkers: summary.onDutyWorkers || 0,
          totalWorkers: summary.totalWorkers || 0,
        };

        console.log('📈 ProcessingDashboard - 统计结果:', newDashboardData);
        setDashboardData(newDashboardData);
      } else {
        console.warn('⚠️ ProcessingDashboard - 仪表板数据加载失败:', overviewRes);
        // 即使失败也设置为0
        setDashboardData({
          inProgressBatches: 0,
          totalBatches: 0,
          completedBatches: 0,
          pendingInspection: 0,
          onDutyWorkers: 0,
          totalWorkers: 0,
        });
      }
    } catch (error) {
      console.error('❌ ProcessingDashboard - 加载仪表板数据失败:', error);
      // 即使失败也设置为0
      setDashboardData({
        inProgressBatches: 0,
        totalBatches: 0,
        completedBatches: 0,
        pendingInspection: 0,
        onDutyWorkers: 0,
        totalWorkers: 0,
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
                icon="monitor-dashboard"
                onPress={() => {
                  Alert.alert(
                    '功能开发中',
                    '设备监控功能正在开发中，敬请期待',
                    [{ text: '确定', onPress: () => {} }]
                  );
                }}
                disabled={true}
                style={[styles.actionButton, styles.disabledButton]}
              >
                设备监控（开发中）
              </Button>
              <Button
                mode="outlined"
                icon="cash"
                onPress={() => navigation.navigate('CostAnalysisDashboard', {})}
                style={styles.actionButton}
              >
                成本分析
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
});
