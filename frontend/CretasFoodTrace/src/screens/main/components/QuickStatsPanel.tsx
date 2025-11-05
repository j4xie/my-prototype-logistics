import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Chip, Icon, ActivityIndicator } from 'react-native-paper';
import { User } from '../../../types/auth';
import { dashboardAPI } from '../../../services/api/dashboardApiClient';

interface QuickStatsPanelProps {
  user: User;
}

/**
 * 快捷信息面板
 * 根据用户角色显示不同的快捷信息
 */
export const QuickStatsPanel: React.FC<QuickStatsPanelProps> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [statsData, setStatsData] = useState({
    todayOutput: 0, // 今日产量 (kg)
    completedBatches: 0,
    totalBatches: 0,
    onDutyWorkers: 0,
    totalWorkers: 0,
    activeEquipment: 0,
    totalEquipment: 0,
  });

  useEffect(() => {
    loadStatsData();
  }, [user]);

  const loadStatsData = async () => {
    const role = user.userType === 'platform'
      ? user.platformUser?.role || 'viewer'
      : user.factoryUser?.role || 'viewer';

    console.log('🏠 QuickStatsPanel - 开始加载数据, 角色:', role);

    try {
      setLoading(true);

      // 工厂用户加载仪表板数据
      if (role === 'factory_super_admin' || role === 'department_admin' || role === 'operator') {
        console.log('📡 QuickStatsPanel - 调用 Dashboard API...');

        // 并行获取概览数据和生产统计
        const [overviewRes, productionRes, equipmentRes] = await Promise.all([
          dashboardAPI.getDashboardOverview('today'),
          dashboardAPI.getProductionStatistics({
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
          }),
          dashboardAPI.getEquipmentDashboard(),
        ]);

        console.log('📊 QuickStatsPanel - 概览数据:', overviewRes);
        console.log('📊 QuickStatsPanel - 生产统计:', productionRes);
        console.log('📊 QuickStatsPanel - 设备数据:', equipmentRes);

        // 提取概览数据 - 后端返回格式是 { success: true, data: {...}, message: "..." }
        const overview = (overviewRes as any).data || overviewRes;
        const production = (productionRes as any).data || productionRes;
        const equipment = (equipmentRes as any).data || equipmentRes;

        console.log('📊 QuickStatsPanel - 解析后概览:', overview);
        console.log('📊 QuickStatsPanel - 解析后生产:', production);
        console.log('📊 QuickStatsPanel - 解析后设备:', equipment);

        // 计算今日产量
        let todayOutput = 0;
        if (production.batchStatusDistribution) {
          todayOutput = production.batchStatusDistribution.reduce(
            (sum: number, stat: any) => sum + (stat.totalQuantity || 0),
            0
          );
          console.log('📈 QuickStatsPanel - 今日产量:', todayOutput);
        }

        const newStatsData = {
          todayOutput,
          completedBatches: overview.summary?.completedBatches || 0,
          totalBatches: overview.summary?.totalBatches || 0,
          onDutyWorkers: overview.summary?.onDutyWorkers || 0,
          totalWorkers: overview.summary?.totalWorkers || 0,
          activeEquipment: equipment.summary?.activeEquipment || 0,
          totalEquipment: equipment.summary?.totalEquipment || 0,
        };

        console.log('✅ QuickStatsPanel - 最终数据:', newStatsData);
        setStatsData(newStatsData);
      }
    } catch (error: any) {
      console.error('❌ QuickStatsPanel - 加载统计数据失败:', error);
      console.error('❌ 错误详情:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        url: error?.config?.url,
      });
      // 即使失败也设置为0，而不是保持默认的--
      setStatsData({
        todayOutput: 0,
        completedBatches: 0,
        totalBatches: 0,
        onDutyWorkers: 0,
        totalWorkers: 0,
        activeEquipment: 0,
        totalEquipment: 0,
      });
    } finally {
      setLoading(false);
    }
  };
  const renderStatsContent = () => {
    const role = user.userType === 'platform'
      ? user.platformUser?.role || 'viewer'
      : user.factoryUser?.role || 'viewer';

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
        if (loading) {
          return (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
            </View>
          );
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
        if (loading) {
          return (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
            </View>
          );
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
        if (loading) {
          return (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
              <Text variant="bodySmall" style={styles.loadingText}>加载中...</Text>
            </View>
          );
        }

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
});
