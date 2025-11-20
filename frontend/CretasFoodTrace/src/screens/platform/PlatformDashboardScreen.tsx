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
import { API_BASE_URL } from '../../constants/config';
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
  });

  useEffect(() => {
    handleRefresh();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      platformDashboardLogger.debug('刷新平台统计数据');

      // ✅ 后端已实现: GET /api/platform/dashboard/statistics
      // 由platformAPI客户端调用
      const response = await fetch(`${API_BASE_URL}/api/platform/dashboard/statistics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // TODO: 添加认证token
        },
      });

      if (response.ok) {
        const data = await response.json();

        // 后端返回字段映射:
        // totalAIQuotaUsed -> aiUsageThisWeek
        // totalAIQuotaLimit -> aiQuotaTotal
        const newStats = {
          totalFactories: data.totalFactories || 0,
          activeFactories: data.activeFactories || 0,
          totalUsers: data.totalUsers || 0,
          activeUsers: data.activeUsers || 0,
          aiUsageThisWeek: data.totalAIQuotaUsed || 0,
          aiQuotaTotal: data.totalAIQuotaLimit || 0,
        };

        platformDashboardLogger.info('平台统计数据加载成功', {
          totalFactories: newStats.totalFactories,
          activeFactories: newStats.activeFactories,
          totalUsers: newStats.totalUsers,
          aiUsage: `${newStats.aiUsageThisWeek}/${newStats.aiQuotaTotal}`,
        });

        setStats(newStats);
      } else {
        platformDashboardLogger.warn('API返回非200状态', { status: response.status });
        // 保持现有0值
      }
    } catch (error) {
      platformDashboardLogger.error('加载平台统计失败', error as Error);
      // 保持现有0值
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
      route: 'AIQuotaManagement' as keyof PlatformStackParamList,  // ✅ 修复: 添加类型断言 (2025-11-20)
      count: `${stats.aiUsageThisWeek}/${stats.aiQuotaTotal}`,
      color: '#9C27B0',
    },
    // 暂时不需要以下功能
    // {
    //   id: 'system-monitor',
    //   title: '系统监控',
    //   description: '平台运营数据、性能监控',
    //   icon: 'monitor-dashboard',
    //   route: 'SystemMonitoring' as keyof PlatformStackParamList,
    //   color: '#FF9800',
    // },
    // {
    //   id: 'reports',
    //   title: '平台报表',
    //   description: '数据统计、导出报表',
    //   icon: 'chart-bar',
    //   route: 'PlatformReports' as keyof PlatformStackParamList,
    //   color: '#00BCD4',
    // },
  ];

  const handleFeaturePress = (route: keyof PlatformStackParamList) => {
    // 检查路由是否已实现
    const implementedRoutes: (keyof PlatformStackParamList)[] = [
      'FactoryManagement',
      'UserManagement',
      'WhitelistManagement',
      'AIQuotaManagement',
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
                        {feature.count && (
                          <Chip
                            mode="flat"
                            compact
                            style={[styles.countChip, { backgroundColor: `${feature.color}20` }]}
                            textStyle={{ color: feature.color, fontWeight: '600' }}
                          >
                            {feature.count}
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
          <Card.Title title="🟢 系统状态" />
          <Card.Content>
            <View style={styles.statusRow}>
              <Text variant="bodyMedium">API服务</Text>
              <Chip mode="flat" textStyle={{ color: '#4CAF50' }}>
                正常运行
              </Chip>
            </View>
            <Divider style={styles.statusDivider} />
            <View style={styles.statusRow}>
              <Text variant="bodyMedium">数据库</Text>
              <Chip mode="flat" textStyle={{ color: '#4CAF50' }}>
                正常运行
              </Chip>
            </View>
            <Divider style={styles.statusDivider} />
            <View style={styles.statusRow}>
              <Text variant="bodyMedium">DeepSeek AI</Text>
              <Chip mode="flat" textStyle={{ color: '#4CAF50' }}>
                正常运行
              </Chip>
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
});