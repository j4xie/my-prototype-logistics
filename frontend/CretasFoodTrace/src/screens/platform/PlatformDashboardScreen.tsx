import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  List,
  Avatar,
  Divider,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PlatformStackParamList } from '../../navigation/PlatformStackNavigator';
import { useAuthStore } from '../../store/authStore';
import { platformAPI } from '../../services/api/platformApiClient';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建PlatformDashboard专用logger
const platformDashboardLogger = logger.createContextLogger('PlatformDashboard');

type NavigationProp = NativeStackNavigationProp<PlatformStackParamList>;

/**
 * 平台管理主仪表板
 * 平台管理员的功能入口页面
 */
export default function PlatformDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalFactories: 0,
    activeFactories: 0,
    totalUsers: 0,
    activeUsers: 0,
    aiUsageThisWeek: 0,
    aiQuotaTotal: 0,
    // 生产相关统计
    totalProductionToday: 0,
    totalBatches: 0,
    completedBatches: 0,
    // 系统健康状态
    systemHealth: 'healthy' as 'healthy' | 'warning' | 'error',
  });
  const [factories, setFactories] = useState<any[]>([]);

  useEffect(() => {
    handleRefresh();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      platformDashboardLogger.debug('刷新平台统计数据');

      // ✅ 使用platformAPI客户端（带认证token）
      const [statsResponse, factoriesResponse] = await Promise.all([
        platformAPI.getPlatformStatistics(),
        platformAPI.getFactories(),
      ]);

      // 📊 调试日志：查看API响应结构
      platformDashboardLogger.debug('API响应结构', {
        stats: {
          hasSuccess: !!statsResponse.success,
          hasData: !!statsResponse.data,
          dataKeys: statsResponse.data ? Object.keys(statsResponse.data) : [],
        },
        factories: {
          hasSuccess: !!factoriesResponse.success,
          hasData: !!factoriesResponse.data,
          count: Array.isArray(factoriesResponse.data) ? factoriesResponse.data.length : 0,
        },
      });

      if (statsResponse.success && statsResponse.data) {
        const data = statsResponse.data;

        // 后端返回字段映射:
        // totalAIRequests -> aiUsageThisWeek
        // totalAICost -> aiQuotaTotal
        const newStats = {
          totalFactories: data.totalFactories || 0,
          activeFactories: data.activeFactories || 0,
          totalUsers: data.totalUsers || 0,
          activeUsers: data.totalUsers || 0, // 后端未返回activeUsers，使用totalUsers
          aiUsageThisWeek: data.totalAIRequests || 0,
          aiQuotaTotal: data.totalAICost || 0,
          // 生产相关统计 - 后端暂未返回这些字段
          totalProductionToday: 0,
          totalBatches: data.totalBatches || 0,
          completedBatches: 0,
          // 系统健康状态 - 后端暂未返回此字段
          systemHealth: 'healthy' as 'healthy' | 'warning' | 'error',
        };

        platformDashboardLogger.info('平台统计数据加载成功', {
          totalFactories: newStats.totalFactories,
          activeFactories: newStats.activeFactories,
          totalUsers: newStats.totalUsers,
          aiUsage: `${newStats.aiUsageThisWeek}/${newStats.aiQuotaTotal}`,
          production: {
            today: newStats.totalProductionToday,
            totalBatches: newStats.totalBatches,
            completedBatches: newStats.completedBatches,
          },
        });

        setStats(newStats);
      } else {
        platformDashboardLogger.warn('API返回空数据', { statsResponse });
      }

      // 处理工厂列表数据
      if (factoriesResponse.success && factoriesResponse.data) {
        const factoriesData = Array.isArray(factoriesResponse.data)
          ? factoriesResponse.data
          : [];

        // 只显示前5个工厂作为预览
        setFactories(factoriesData.slice(0, 5));

        platformDashboardLogger.info('工厂列表加载成功', {
          total: factoriesData.length,
          displayed: Math.min(factoriesData.length, 5),
        });
      } else {
        platformDashboardLogger.warn('工厂列表返回空数据', { factoriesResponse });
      }
    } catch (error) {
      platformDashboardLogger.error('加载平台统计失败', error as Error);
      handleError(error, {
        title: '加载失败',
        customMessage: '无法加载平台统计数据',
      });
    } finally {
      setRefreshing(false);
    }
  };

  // 管理功能列表
  const managementFeatures = [
    {
      id: 'factories',
      title: '工厂管理',
      description: '管理所有工厂信息、配置',
      icon: 'factory',
      route: 'FactoryManagement' as keyof PlatformStackParamList,
      count: stats.totalFactories,
      color: '#2196F3',
    },
    {
      id: 'users',
      title: '用户管理',
      description: '跨工厂用户管理、权限设置',
      icon: 'account-group',
      route: 'UserManagement' as keyof PlatformStackParamList,
      count: stats.totalUsers,
      color: '#4CAF50',
    },
    {
      id: 'whitelist',
      title: '白名单管理',
      description: '注册白名单、邀请码管理',
      icon: 'shield-check',
      route: 'WhitelistManagement' as keyof PlatformStackParamList,
      color: '#607D8B',
    },
    {
      id: 'ai-quota',
      title: 'AI配额管理',
      description: '管理各工厂AI调用配额',
      icon: 'robot',
      route: 'AIQuotaManagement' as keyof PlatformStackParamList,
      count: `${stats.aiUsageThisWeek}/${stats.aiQuotaTotal}`,
      color: '#9C27B0',
    },
    {
      id: 'system-monitor',
      title: '系统监控',
      description: '平台运营数据、性能监控',
      icon: 'monitor-dashboard',
      route: 'SystemMonitoring' as keyof PlatformStackParamList,
      color: '#FF9800',
    },
    {
      id: 'reports',
      title: '平台报表',
      description: '数据统计、导出报表',
      icon: 'chart-bar',
      route: 'PlatformReports' as keyof PlatformStackParamList,
      color: '#00BCD4',
    },
  ];

  const handleFeaturePress = (route: keyof PlatformStackParamList) => {
    // 检查路由是否已实现
    const implementedRoutes: (keyof PlatformStackParamList)[] = [
      'FactoryManagement',
      'UserManagement',
      'WhitelistManagement',
      'AIQuotaManagement',
      'SystemMonitoring',
      'PlatformReports',
    ];

    if (implementedRoutes.includes(route)) {
      platformDashboardLogger.debug('导航到管理功能', { route });
      navigation.navigate(route);
    } else {
      // 显示开发中提示
      platformDashboardLogger.info('功能开发中', { route });
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.Content title="平台管理中心" />
        <Appbar.Action icon="bell-outline" onPress={() => {}} />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 欢迎卡片 */}
        <Card style={styles.welcomeCard} mode="elevated">
          <Card.Content>
            <View style={styles.welcomeHeader}>
              <Avatar.Icon size={48} icon="crown" style={styles.crownAvatar} />
              <View style={styles.welcomeText}>
                <Text variant="titleLarge" style={styles.welcomeTitle}>
                  欢迎回来，{user?.fullName || '管理员'}
                </Text>
                <Text variant="bodyMedium" style={styles.welcomeSubtitle}>
                  平台超级管理员
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 快速统计 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="📊 平台概览" />
          <Card.Content>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={[styles.statValue, { color: '#2196F3' }]}>
                  {stats.totalFactories}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  工厂总数
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={[styles.statValue, { color: '#4CAF50' }]}>
                  {stats.totalUsers}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  用户总数
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={[styles.statValue, { color: '#9C27B0' }]}>
                  {stats.aiUsageThisWeek}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  本周AI调用
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 生产概览 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="🏭 生产概览" />
          <Card.Content>
            <View style={styles.productionGrid}>
              <View style={styles.productionMainStat}>
                <Text variant="displaySmall" style={[styles.productionValue, { color: '#FF6B35' }]}>
                  {stats.totalProductionToday.toFixed(1)}
                </Text>
                <Text variant="bodyMedium" style={styles.productionLabel}>
                  今日总产量 (吨)
                </Text>
              </View>
              <Divider style={styles.productionDivider} />
              <View style={styles.productionSubStats}>
                <View style={styles.productionSubItem}>
                  <View style={styles.productionSubHeader}>
                    <Avatar.Icon
                      icon="package-variant"
                      size={32}
                      color="#2196F3"
                      style={styles.productionIcon}
                    />
                    <View style={styles.productionSubText}>
                      <Text variant="headlineSmall" style={{ color: '#2196F3', fontWeight: '700' }}>
                        {stats.totalBatches}
                      </Text>
                      <Text variant="bodySmall" style={styles.productionSubLabel}>
                        总批次数
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.productionSubItem}>
                  <View style={styles.productionSubHeader}>
                    <Avatar.Icon
                      icon="check-circle"
                      size={32}
                      color="#4CAF50"
                      style={styles.productionIcon}
                    />
                    <View style={styles.productionSubText}>
                      <Text variant="headlineSmall" style={{ color: '#4CAF50', fontWeight: '700' }}>
                        {stats.completedBatches}
                      </Text>
                      <Text variant="bodySmall" style={styles.productionSubLabel}>
                        已完成批次
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.productionSubItem}>
                  <View style={styles.productionSubHeader}>
                    <Avatar.Icon
                      icon="chart-line"
                      size={32}
                      color="#FF9800"
                      style={styles.productionIcon}
                    />
                    <View style={styles.productionSubText}>
                      <Text variant="headlineSmall" style={{ color: '#FF9800', fontWeight: '700' }}>
                        {stats.totalBatches > 0
                          ? ((stats.completedBatches / stats.totalBatches) * 100).toFixed(1)
                          : '0.0'}%
                      </Text>
                      <Text variant="bodySmall" style={styles.productionSubLabel}>
                        完成率
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 工厂状态列表 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title
            title="🏢 工厂状态"
            right={(props) => (
              <Pressable onPress={() => navigation.navigate('FactoryManagement')}>
                <Text variant="bodyMedium" style={{ color: '#2196F3', marginRight: 16 }}>
                  查看全部
                </Text>
              </Pressable>
            )}
          />
          <Card.Content>
            {factories.length > 0 ? (
              <>
                {factories.map((factory, index) => (
                  <React.Fragment key={factory.id}>
                    <Pressable onPress={() => {
                      platformDashboardLogger.debug('查看工厂详情', { factoryId: factory.id });
                      navigation.navigate('FactoryManagement');
                    }}>
                      <View style={styles.factoryItem}>
                        <View style={styles.factoryHeader}>
                          <Avatar.Icon
                            icon="factory"
                            size={40}
                            color={factory.status === 'active' ? '#4CAF50' : '#9E9E9E'}
                            style={styles.factoryIcon}
                          />
                          <View style={styles.factoryInfo}>
                            <Text variant="titleMedium" style={styles.factoryName}>
                              {factory.name || factory.factoryName}
                            </Text>
                            <Text variant="bodySmall" style={styles.factoryMeta}>
                              {factory.industry || '食品加工'} • {factory.address || '地址未设置'}
                            </Text>
                          </View>
                          <Chip
                            mode="flat"
                            compact
                            textStyle={{
                              color: factory.status === 'active' ? '#4CAF50' : '#9E9E9E',
                              fontWeight: '600',
                            }}
                            style={{
                              backgroundColor: factory.status === 'active' ? '#E8F5E9' : '#F5F5F5',
                            }}
                          >
                            {factory.status === 'active' ? '运营中' : '已停用'}
                          </Chip>
                        </View>
                        <View style={styles.factoryStats}>
                          <View style={styles.factoryStatItem}>
                            <Text variant="bodySmall" style={styles.factoryStatLabel}>
                              用户数
                            </Text>
                            <Text variant="bodyMedium" style={styles.factoryStatValue}>
                              {factory.totalUsers || 0}
                            </Text>
                          </View>
                          <View style={styles.factoryStatItem}>
                            <Text variant="bodySmall" style={styles.factoryStatLabel}>
                              批次数
                            </Text>
                            <Text variant="bodyMedium" style={styles.factoryStatValue}>
                              {factory.totalBatches || 0}
                            </Text>
                          </View>
                          <View style={styles.factoryStatItem}>
                            <Text variant="bodySmall" style={styles.factoryStatLabel}>
                              联系人
                            </Text>
                            <Text variant="bodyMedium" style={styles.factoryStatValue}>
                              {factory.contactName || factory.contactPerson || '-'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </Pressable>
                    {index < factories.length - 1 && <Divider style={styles.factoryDivider} />}
                  </React.Fragment>
                ))}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Avatar.Icon icon="factory" size={48} color="#BDBDBD" style={{ backgroundColor: 'transparent' }} />
                <Text variant="bodyMedium" style={styles.emptyText}>
                  暂无工厂数据
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* 管理功能列表 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="🛠️ 管理功能" />
          <Card.Content>
            {managementFeatures.map((feature, index) => (
              <React.Fragment key={feature.id}>
                <Pressable onPress={() => handleFeaturePress(feature.route)}>
                  <List.Item
                    title={feature.title}
                    description={feature.description}
                    left={(props) => (
                      <Avatar.Icon
                        {...props}
                        icon={feature.icon}
                        size={48}
                        style={{ backgroundColor: feature.color }}
                      />
                    )}
                    right={(props) => (
                      <View style={styles.rightContainer}>
                        {feature.count !== undefined && feature.count !== null && (
                          <Chip
                            mode="flat"
                            compact
                            style={[styles.countChip, { backgroundColor: `${feature.color}20` }]}
                            textStyle={{ color: feature.color, fontWeight: '600' }}
                          >
                            {String(feature.count)}
                          </Chip>
                        )}
                        <List.Icon {...props} icon="chevron-right" />
                      </View>
                    )}
                    style={styles.listItem}
                  />
                </Pressable>
                {index < managementFeatures.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </Card.Content>
        </Card>

        {/* 快捷操作 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="⚡ 快捷操作" />
          <Card.Content>
            <View style={styles.quickActionsGrid}>
              <Pressable
                style={styles.quickAction}
                onPress={() => navigation.navigate('FactoryManagement')}
              >
                <Avatar.Icon icon="plus-circle" size={40} color="#2196F3" style={styles.quickIcon} />
                <Text variant="bodySmall" style={styles.quickText}>
                  添加工厂
                </Text>
              </Pressable>
              <Pressable
                style={styles.quickAction}
                onPress={() => navigation.navigate('UserManagement')}
              >
                <Avatar.Icon icon="account-plus" size={40} color="#4CAF50" style={styles.quickIcon} />
                <Text variant="bodySmall" style={styles.quickText}>
                  添加用户
                </Text>
              </Pressable>
              <Pressable
                style={styles.quickAction}
                onPress={() => navigation.navigate('WhitelistManagement')}
              >
                <Avatar.Icon icon="shield-plus" size={40} color="#607D8B" style={styles.quickIcon} />
                <Text variant="bodySmall" style={styles.quickText}>
                  添加白名单
                </Text>
              </Pressable>
              <Pressable
                style={styles.quickAction}
                onPress={() => navigation.navigate('AIQuotaManagement')}
              >
                <Avatar.Icon icon="robot" size={40} color="#9C27B0" style={styles.quickIcon} />
                <Text variant="bodySmall" style={styles.quickText}>
                  AI配额
                </Text>
              </Pressable>
            </View>
          </Card.Content>
        </Card>

        {/* 系统状态 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title
            title={
              stats.systemHealth === 'healthy'
                ? '🟢 系统状态'
                : stats.systemHealth === 'warning'
                ? '🟡 系统状态'
                : '🔴 系统状态'
            }
          />
          <Card.Content>
            {/* 总体健康状态 */}
            <View style={styles.healthOverview}>
              <View style={styles.healthIndicator}>
                <Avatar.Icon
                  icon={
                    stats.systemHealth === 'healthy'
                      ? 'check-circle'
                      : stats.systemHealth === 'warning'
                      ? 'alert-circle'
                      : 'close-circle'
                  }
                  size={48}
                  color={
                    stats.systemHealth === 'healthy'
                      ? '#4CAF50'
                      : stats.systemHealth === 'warning'
                      ? '#FF9800'
                      : '#F44336'
                  }
                  style={{ backgroundColor: 'transparent' }}
                />
                <View style={styles.healthText}>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                    {stats.systemHealth === 'healthy'
                      ? '系统运行正常'
                      : stats.systemHealth === 'warning'
                      ? '系统存在警告'
                      : '系统异常'}
                  </Text>
                  <Text variant="bodySmall" style={{ color: '#757575', marginTop: 4 }}>
                    {stats.systemHealth === 'healthy'
                      ? '所有服务正常运行'
                      : stats.systemHealth === 'warning'
                      ? '部分服务存在异常，建议检查'
                      : '系统服务异常，请立即处理'}
                  </Text>
                </View>
              </View>
            </View>

            <Divider style={styles.statusDivider} />

            {/* 服务详细状态 */}
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <Avatar.Icon icon="api" size={32} color="#2196F3" style={styles.statusIcon} />
                <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                  API服务
                </Text>
              </View>
              <Chip
                mode="flat"
                icon="check"
                textStyle={{ color: '#4CAF50', fontWeight: '600' }}
                style={{ backgroundColor: '#E8F5E9' }}
              >
                正常
              </Chip>
            </View>
            <Divider style={styles.statusDivider} />
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <Avatar.Icon icon="database" size={32} color="#FF9800" style={styles.statusIcon} />
                <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                  数据库
                </Text>
              </View>
              <Chip
                mode="flat"
                icon="check"
                textStyle={{ color: '#4CAF50', fontWeight: '600' }}
                style={{ backgroundColor: '#E8F5E9' }}
              >
                正常
              </Chip>
            </View>
            <Divider style={styles.statusDivider} />
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <Avatar.Icon icon="robot" size={32} color="#9C27B0" style={styles.statusIcon} />
                <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                  DeepSeek AI
                </Text>
              </View>
              <Chip
                mode="flat"
                icon="check"
                textStyle={{ color: '#4CAF50', fontWeight: '600' }}
                style={{ backgroundColor: '#E8F5E9' }}
              >
                正常
              </Chip>
            </View>
            <Divider style={styles.statusDivider} />
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <Avatar.Icon icon="upload-network" size={32} color="#00BCD4" style={styles.statusIcon} />
                <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                  文件服务
                </Text>
              </View>
              <Chip
                mode="flat"
                icon="check"
                textStyle={{ color: '#4CAF50', fontWeight: '600' }}
                style={{ backgroundColor: '#E8F5E9' }}
              >
                正常
              </Chip>
            </View>

            {/* 系统指标 */}
            <Divider style={{ marginVertical: 16 }} />
            <Text variant="bodyMedium" style={{ fontWeight: '600', marginBottom: 12 }}>
              系统指标
            </Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>
                  活跃工厂
                </Text>
                <Text variant="titleMedium" style={[styles.metricValue, { color: '#4CAF50' }]}>
                  {stats.activeFactories}/{stats.totalFactories}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>
                  活跃用户
                </Text>
                <Text variant="titleMedium" style={[styles.metricValue, { color: '#2196F3' }]}>
                  {stats.activeUsers}/{stats.totalUsers}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>
                  完成率
                </Text>
                <Text variant="titleMedium" style={[styles.metricValue, { color: '#FF9800' }]}>
                  {stats.totalBatches > 0
                    ? ((stats.completedBatches / stats.totalBatches) * 100).toFixed(0)
                    : '0'}%
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
  welcomeCard: {
    marginBottom: 16,
    backgroundColor: '#E3F2FD',
  },
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  crownAvatar: {
    backgroundColor: '#FFD700',
  },
  welcomeText: {
    marginLeft: 16,
    flex: 1,
  },
  welcomeTitle: {
    fontWeight: '700',
    color: '#1976D2',
  },
  welcomeSubtitle: {
    color: '#757575',
    marginTop: 4,
  },
  card: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontWeight: '700',
  },
  statLabel: {
    marginTop: 4,
    color: '#757575',
  },
  listItem: {
    paddingVertical: 8,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countChip: {
    height: 28,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  quickAction: {
    width: '22%',
    alignItems: 'center',
  },
  quickIcon: {
    backgroundColor: 'transparent',
  },
  quickText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#757575',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusDivider: {
    marginVertical: 12,
  },
  bottomPadding: {
    height: 20,
  },
  // 生产概览样式
  productionGrid: {
    gap: 16,
  },
  productionMainStat: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  productionValue: {
    fontWeight: '700',
    fontSize: 48,
  },
  productionLabel: {
    marginTop: 8,
    color: '#757575',
    fontWeight: '500',
  },
  productionDivider: {
    marginVertical: 8,
  },
  productionSubStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  productionSubItem: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 12,
  },
  productionSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productionIcon: {
    backgroundColor: 'transparent',
  },
  productionSubText: {
    flex: 1,
  },
  productionSubLabel: {
    marginTop: 4,
    color: '#757575',
  },
  // 工厂状态列表样式
  factoryItem: {
    paddingVertical: 12,
  },
  factoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  factoryIcon: {
    backgroundColor: 'transparent',
  },
  factoryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  factoryName: {
    fontWeight: '600',
  },
  factoryMeta: {
    color: '#757575',
    marginTop: 4,
  },
  factoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginLeft: 52,
  },
  factoryStatItem: {
    alignItems: 'center',
  },
  factoryStatLabel: {
    color: '#757575',
    marginBottom: 4,
  },
  factoryStatValue: {
    fontWeight: '600',
  },
  factoryDivider: {
    marginVertical: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: '#9E9E9E',
    marginTop: 8,
  },
  // 系统状态样式
  healthOverview: {
    paddingVertical: 12,
  },
  healthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthText: {
    marginLeft: 16,
    flex: 1,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIcon: {
    backgroundColor: 'transparent',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricItem: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  metricLabel: {
    color: '#757575',
    marginBottom: 4,
  },
  metricValue: {
    fontWeight: '700',
  },
});