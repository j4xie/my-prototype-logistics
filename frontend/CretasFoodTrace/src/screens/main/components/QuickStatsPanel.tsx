import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Chip, Icon, ActivityIndicator, Button } from 'react-native-paper';
import { User, getFactoryId } from '../../../types/auth';
import { dashboardAPI } from '../../../services/api/dashboardApiClient';
import { handleError } from '../../../utils/errorHandler';
import { logger } from '../../../utils/logger';

// 创建QuickStatsPanel专用logger
const quickStatsLogger = logger.createContextLogger('QuickStatsPanel');

interface QuickStatsPanelProps {
  user: User;
}

interface StatsError {
  message: string;
  canRetry: boolean;
}

/**
 * 快捷信息面板
 * 根据用户角色显示不同的快捷信息
 */
export const QuickStatsPanel: React.FC<QuickStatsPanelProps> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<StatsError | null>(null);
  const [statsData, setStatsData] = useState<{
    todayOutput: number;
    completedBatches: number;
    totalBatches: number;
    onDutyWorkers: number;
    totalWorkers: number;
    activeEquipment: number;
    totalEquipment: number;
  } | null>(null);

  useEffect(() => {
    loadStatsData();
  }, [user]);

  const loadStatsData = async () => {
    const role = user.userType === 'platform'
      ? user.platformUser?.role || 'viewer'
      : user.factoryUser?.role || 'viewer';

    quickStatsLogger.debug('开始加载统计数据', { role, userType: user.userType });

    try {
      setLoading(true);
      setError(null); // 清除之前的错误

      // 工厂用户加载仪表板数据
      if (role === 'factory_super_admin' || role === 'department_admin' || role === 'operator') {
        const factoryId = getFactoryId(user);

        if (!factoryId) {
          quickStatsLogger.warn('工厂ID不存在，无法加载统计数据', { userId: user.id });
          setError({
            message: '工厂信息不完整，无法加载统计数据',
            canRetry: false,
          });
          return;
        }

        quickStatsLogger.debug('调用Dashboard API', { factoryId });

        // ✅ 使用已实现的dashboard API
        const overviewRes = await dashboardAPI.getDashboardOverview('today', factoryId);

        quickStatsLogger.debug('Dashboard API响应', { success: overviewRes.success });

        if (overviewRes.success && overviewRes.data) {
          const overview = overviewRes.data;
          // 支持两种格式：包装格式(summary/todayStats) 或 扁平格式
          // 使用 Record<string, any> 兼容多种后端响应格式
          const summary = (overview.summary || overview) as Record<string, number>;
          const todayStats = (overview.todayStats || overview) as Record<string, number>;

          quickStatsLogger.debug('解析概览数据', { overview });

          // 从概览数据中提取统计信息（兼容两种字段名格式）
          const newStatsData = {
            // 批次统计
            completedBatches: summary.completedBatches ?? 0,
            totalBatches: summary.todayBatches ?? summary.totalBatches ?? 0,
            inProgressBatches: summary.inProgressBatches ?? summary.activeBatches ?? 0,
            onDutyWorkers: summary.onDutyWorkers ?? 0,
            totalWorkers: summary.totalWorkers ?? 0,

            // 今日/月度统计
            todayOutput: todayStats.todayOutputKg ?? todayStats.monthlyOutput ?? 0,
            activeEquipment: todayStats.activeEquipment ?? 0,
            totalEquipment: todayStats.totalEquipment ?? 0,

            // 额外字段
            monthlyYieldRate: summary.monthlyYieldRate ?? 0,
            lowStockMaterials: summary.lowStockMaterials ?? 0,
          };

          quickStatsLogger.info('统计数据加载成功', {
            todayOutput: newStatsData.todayOutput,
            completedBatches: newStatsData.completedBatches,
            onDutyWorkers: newStatsData.onDutyWorkers,
          });
          setStatsData(newStatsData);
          setError(null); // 成功后清除错误
        } else {
          quickStatsLogger.warn('Dashboard API返回失败', { success: overviewRes.success });
          setError({
            message: 'API返回失败，请稍后重试',
            canRetry: true,
          });
        }
      }
    } catch (error) {
      quickStatsLogger.error('加载统计数据失败', error, { role });

      // ✅ GOOD: 不返回假数据，设置错误状态
      handleError(error, {
        showAlert: false, // 不显示Alert，使用内联错误UI
        logError: true,
      });

      setError({
        message: error instanceof Error ? error.message : '加载统计数据失败，请稍后重试',
        canRetry: true,
      });
      setStatsData(null); // 不显示假数据
    } finally {
      setLoading(false);
    }
  };
  // ✅ 新增：渲染错误UI
  const renderError = () => (
    <View style={styles.errorContainer}>
      <Icon source="alert-circle-outline" size={32} color="#F44336" />
      <Text variant="bodyMedium" style={styles.errorText}>
        {error?.message || '加载失败'}
      </Text>
      {error?.canRetry && (
        <Button
          mode="outlined"
          onPress={loadStatsData}
          style={styles.retryButton}
          compact
        >
          重试
        </Button>
      )}
    </View>
  );

  const renderStatsContent = () => {
    const role = user.userType === 'platform'
      ? user.platformUser?.role ?? 'viewer'
      : user.factoryUser?.role ?? 'viewer';

    // ✅ 显示加载状态
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" />
          <Text variant="bodySmall" style={styles.loadingText}>加载中...</Text>
        </View>
      );
    }

    // ✅ 显示错误状态
    if (error) {
      return renderError();
    }

    switch (role) {
      case 'operator':
        // 操作员:显示今日工时和打卡状态
        return (
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Icon source="clock-outline" size={24} color="#FF9800" />
              <Text variant="bodySmall" style={styles.statLabel}>今日工时</Text>
              <Text variant="titleMedium" style={styles.statValue}>0.0 小时</Text>
            </View>
            <View style={styles.statItem}>
              <Icon source="account-clock" size={24} color="#4CAF50" />
              <Text variant="bodySmall" style={styles.statLabel}>打卡状态</Text>
              <Chip mode="flat" compact style={styles.statusChip}>
                <Text style={styles.statusText}>未打卡</Text>
              </Chip>
            </View>
          </View>
        );

      case 'department_admin':
        // 部门管理员:显示部门今日生产数据
        // ✅ statsData可能为null，需要判断
        if (!statsData) {
          return null;
        }
        return (
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Icon source="package-variant" size={24} color="#2196F3" />
              <Text variant="bodySmall" style={styles.statLabel}>进行中批次</Text>
              <Text variant="titleMedium" style={styles.statValue}>{statsData.totalBatches} 个</Text>
            </View>
            <View style={styles.statItem}>
              <Icon source="account-group" size={24} color="#4CAF50" />
              <Text variant="bodySmall" style={styles.statLabel}>今日出勤</Text>
              <Text variant="titleMedium" style={styles.statValue}>{statsData.onDutyWorkers} / {statsData.totalWorkers}</Text>
            </View>
            <View style={styles.statItem}>
              <Icon source="alert-circle" size={24} color="#F44336" />
              <Text variant="bodySmall" style={styles.statLabel}>待处理</Text>
              <Text variant="titleMedium" style={styles.statValue}>-- 项</Text>
            </View>
          </View>
        );

      case 'factory_super_admin':
        // 工厂超级管理员:显示工厂概览
        // ✅ statsData可能为null，需要判断
        if (!statsData) {
          return null;
        }
        return (
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Icon source="factory" size={24} color="#2196F3" />
              <Text variant="bodySmall" style={styles.statLabel}>今日产量</Text>
              <Text variant="titleMedium" style={styles.statValue}>
                {statsData.todayOutput.toFixed(1)} kg
              </Text>
            </View>
            <View style={styles.statItem}>
              <Icon source="check-circle" size={24} color="#4CAF50" />
              <Text variant="bodySmall" style={styles.statLabel}>完成批次</Text>
              <Text variant="titleMedium" style={styles.statValue}>
                {statsData.completedBatches} / {statsData.totalBatches}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Icon source="account-multiple" size={24} color="#FF9800" />
              <Text variant="bodySmall" style={styles.statLabel}>在岗人员</Text>
              <Text variant="titleMedium" style={styles.statValue}>
                {statsData.onDutyWorkers} / {statsData.totalWorkers}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Icon source="cog" size={24} color="#9C27B0" />
              <Text variant="bodySmall" style={styles.statLabel}>设备运行</Text>
              <Text variant="titleMedium" style={styles.statValue}>
                {statsData.activeEquipment} / {statsData.totalEquipment}
              </Text>
            </View>
          </View>
        );

      case 'platform_admin':
        // 平台管理员:显示平台级数据
        return (
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Icon source="domain" size={24} color="#2196F3" />
              <Text variant="bodySmall" style={styles.statLabel}>活跃工厂</Text>
              <Text variant="titleMedium" style={styles.statValue}>-- / --</Text>
            </View>
            <View style={styles.statItem}>
              <Icon source="account-group" size={24} color="#4CAF50" />
              <Text variant="bodySmall" style={styles.statLabel}>总用户数</Text>
              <Text variant="titleMedium" style={styles.statValue}>-- 人</Text>
            </View>
            <View style={styles.statItem}>
              <Icon source="cube-outline" size={24} color="#FF9800" />
              <Text variant="bodySmall" style={styles.statLabel}>今日批次</Text>
              <Text variant="titleMedium" style={styles.statValue}>-- 个</Text>
            </View>
            <View style={styles.statItem}>
              <Icon source="chart-line" size={24} color="#9C27B0" />
              <Text variant="bodySmall" style={styles.statLabel}>平台产量</Text>
              <Text variant="titleMedium" style={styles.statValue}>-- kg</Text>
            </View>
          </View>
        );

      case 'permission_admin':
        // 权限管理员:显示用户统计
        return (
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Icon source="account-check" size={24} color="#4CAF50" />
              <Text variant="bodySmall" style={styles.statLabel}>激活用户</Text>
              <Text variant="titleMedium" style={styles.statValue}>-- 人</Text>
            </View>
            <View style={styles.statItem}>
              <Icon source="account-clock" size={24} color="#FF9800" />
              <Text variant="bodySmall" style={styles.statLabel}>待审核</Text>
              <Text variant="titleMedium" style={styles.statValue}>-- 人</Text>
            </View>
          </View>
        );

      case 'viewer':
        // 查看者:只显示欢迎信息
        return (
          <View style={styles.welcomeContainer}>
            <Icon source="eye-outline" size={32} color="#9E9E9E" />
            <Text variant="bodyMedium" style={styles.welcomeText}>
              您当前为查看者权限,可浏览工厂数据
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        {renderStatsContent()}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontWeight: '600',
  },
  subtitle: {
    color: '#757575',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
  },
  statItem: {
    flex: 1,
    minWidth: 70,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  statLabel: {
    color: '#757575',
    marginTop: 8,
    textAlign: 'center',
  },
  statValue: {
    fontWeight: '600',
    marginTop: 4,
    color: '#212121',
  },
  statusChip: {
    marginTop: 4,
    backgroundColor: '#E3F2FD',
  },
  statusText: {
    color: '#1976D2',
    fontSize: 12,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  welcomeText: {
    color: '#757575',
    marginTop: 12,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    color: '#757575',
    marginTop: 12,
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
