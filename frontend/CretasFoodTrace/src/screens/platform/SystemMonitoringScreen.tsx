import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Avatar,
  Chip,
  Divider,
  ProgressBar,
  List,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PlatformStackParamList } from '../../navigation/PlatformStackNavigator';
import { logger } from '../../utils/logger';

// 创建SystemMonitoring专用logger
const systemMonitorLogger = logger.createContextLogger('SystemMonitoring');

type NavigationProp = NativeStackNavigationProp<PlatformStackParamList>;

const { width } = Dimensions.get('window');

/**
 * 系统监控页面
 * 实时监控平台运行状态和性能指标
 */
export default function SystemMonitoringScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [refreshing, setRefreshing] = useState(false);

  // Mock数据 - 实际应从后端API获取
  const [systemMetrics, setSystemMetrics] = useState({
    cpuUsage: 45.2,
    memoryUsage: 62.8,
    diskUsage: 38.5,
    networkIn: 125.6, // MB/s
    networkOut: 89.3, // MB/s
    activeConnections: 342,
    requestsPerMinute: 1250,
    averageResponseTime: 85, // ms
    errorRate: 0.02, // %
    uptime: '15天 6小时 32分钟',
  });

  const [recentActivity, setRecentActivity] = useState([
    { id: 1, type: 'info', message: '系统健康检查完成', time: '2分钟前', icon: 'check-circle', color: '#4CAF50' },
    { id: 2, type: 'warning', message: 'CPU使用率超过45%', time: '5分钟前', icon: 'alert-circle', color: '#FF9800' },
    { id: 3, type: 'info', message: '数据库备份完成', time: '15分钟前', icon: 'database-check', color: '#2196F3' },
    { id: 4, type: 'info', message: 'AI服务响应正常', time: '30分钟前', icon: 'robot', color: '#9C27B0' },
    { id: 5, type: 'success', message: '系统更新成功', time: '1小时前', icon: 'update', color: '#00BCD4' },
  ]);

  useEffect(() => {
    loadSystemMetrics();
  }, []);

  const loadSystemMetrics = async () => {
    systemMonitorLogger.info('加载系统监控数据');
    // TODO: 从后端API加载真实数据
    // const response = await platformAPI.getSystemMetrics();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadSystemMetrics();
    } finally {
      setRefreshing(false);
    }
  };

  const getUsageColor = (usage: number) => {
    if (usage < 50) return '#4CAF50';
    if (usage < 80) return '#FF9800';
    return '#F44336';
  };

  const getUsageStatus = (usage: number) => {
    if (usage < 50) return '正常';
    if (usage < 80) return '警告';
    return '危险';
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="系统监控" />
        <Appbar.Action icon="refresh" onPress={handleRefresh} />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 系统状态总览 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="⚡ 系统状态" />
          <Card.Content>
            <View style={styles.statusGrid}>
              <View style={styles.statusItem}>
                <Avatar.Icon icon="server" size={40} color="#4CAF50" style={styles.statusIcon} />
                <Text variant="bodySmall" style={styles.statusLabel}>
                  运行时间
                </Text>
                <Text variant="bodyMedium" style={styles.statusValue}>
                  {systemMetrics.uptime}
                </Text>
              </View>
              <View style={styles.statusItem}>
                <Avatar.Icon icon="connection" size={40} color="#2196F3" style={styles.statusIcon} />
                <Text variant="bodySmall" style={styles.statusLabel}>
                  活跃连接
                </Text>
                <Text variant="bodyMedium" style={styles.statusValue}>
                  {systemMetrics.activeConnections}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 性能指标 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="📊 性能指标" />
          <Card.Content>
            {/* CPU使用率 */}
            <View style={styles.metricItem}>
              <View style={styles.metricHeader}>
                <View style={styles.metricLeft}>
                  <Avatar.Icon icon="cpu-64-bit" size={32} color={getUsageColor(systemMetrics.cpuUsage)} style={styles.metricIcon} />
                  <Text variant="bodyLarge" style={styles.metricLabel}>
                    CPU使用率
                  </Text>
                </View>
                <View style={styles.metricRight}>
                  <Text variant="titleMedium" style={{ color: getUsageColor(systemMetrics.cpuUsage), fontWeight: '700' }}>
                    {systemMetrics.cpuUsage}%
                  </Text>
                  <Chip
                    mode="flat"
                    compact
                    textStyle={{ color: getUsageColor(systemMetrics.cpuUsage), fontSize: 10 }}
                    style={{ backgroundColor: `${getUsageColor(systemMetrics.cpuUsage)}20`, marginLeft: 8 }}
                  >
                    {getUsageStatus(systemMetrics.cpuUsage)}
                  </Chip>
                </View>
              </View>
              <ProgressBar
                progress={systemMetrics.cpuUsage / 100}
                color={getUsageColor(systemMetrics.cpuUsage)}
                style={styles.progressBar}
              />
            </View>

            <Divider style={styles.divider} />

            {/* 内存使用率 */}
            <View style={styles.metricItem}>
              <View style={styles.metricHeader}>
                <View style={styles.metricLeft}>
                  <Avatar.Icon icon="memory" size={32} color={getUsageColor(systemMetrics.memoryUsage)} style={styles.metricIcon} />
                  <Text variant="bodyLarge" style={styles.metricLabel}>
                    内存使用率
                  </Text>
                </View>
                <View style={styles.metricRight}>
                  <Text variant="titleMedium" style={{ color: getUsageColor(systemMetrics.memoryUsage), fontWeight: '700' }}>
                    {systemMetrics.memoryUsage}%
                  </Text>
                  <Chip
                    mode="flat"
                    compact
                    textStyle={{ color: getUsageColor(systemMetrics.memoryUsage), fontSize: 10 }}
                    style={{ backgroundColor: `${getUsageColor(systemMetrics.memoryUsage)}20`, marginLeft: 8 }}
                  >
                    {getUsageStatus(systemMetrics.memoryUsage)}
                  </Chip>
                </View>
              </View>
              <ProgressBar
                progress={systemMetrics.memoryUsage / 100}
                color={getUsageColor(systemMetrics.memoryUsage)}
                style={styles.progressBar}
              />
            </View>

            <Divider style={styles.divider} />

            {/* 磁盘使用率 */}
            <View style={styles.metricItem}>
              <View style={styles.metricHeader}>
                <View style={styles.metricLeft}>
                  <Avatar.Icon icon="harddisk" size={32} color={getUsageColor(systemMetrics.diskUsage)} style={styles.metricIcon} />
                  <Text variant="bodyLarge" style={styles.metricLabel}>
                    磁盘使用率
                  </Text>
                </View>
                <View style={styles.metricRight}>
                  <Text variant="titleMedium" style={{ color: getUsageColor(systemMetrics.diskUsage), fontWeight: '700' }}>
                    {systemMetrics.diskUsage}%
                  </Text>
                  <Chip
                    mode="flat"
                    compact
                    textStyle={{ color: getUsageColor(systemMetrics.diskUsage), fontSize: 10 }}
                    style={{ backgroundColor: `${getUsageColor(systemMetrics.diskUsage)}20`, marginLeft: 8 }}
                  >
                    {getUsageStatus(systemMetrics.diskUsage)}
                  </Chip>
                </View>
              </View>
              <ProgressBar
                progress={systemMetrics.diskUsage / 100}
                color={getUsageColor(systemMetrics.diskUsage)}
                style={styles.progressBar}
              />
            </View>
          </Card.Content>
        </Card>

        {/* 网络流量 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="🌐 网络流量" />
          <Card.Content>
            <View style={styles.networkGrid}>
              <View style={styles.networkItem}>
                <Avatar.Icon icon="download" size={40} color="#4CAF50" style={styles.networkIcon} />
                <Text variant="bodySmall" style={styles.networkLabel}>
                  入站流量
                </Text>
                <Text variant="titleMedium" style={[styles.networkValue, { color: '#4CAF50' }]}>
                  {systemMetrics.networkIn} MB/s
                </Text>
              </View>
              <View style={styles.networkItem}>
                <Avatar.Icon icon="upload" size={40} color="#FF9800" style={styles.networkIcon} />
                <Text variant="bodySmall" style={styles.networkLabel}>
                  出站流量
                </Text>
                <Text variant="titleMedium" style={[styles.networkValue, { color: '#FF9800' }]}>
                  {systemMetrics.networkOut} MB/s
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* API性能 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="🚀 API性能" />
          <Card.Content>
            <View style={styles.apiMetrics}>
              <View style={styles.apiMetricItem}>
                <Text variant="bodySmall" style={styles.apiLabel}>
                  请求/分钟
                </Text>
                <Text variant="headlineSmall" style={[styles.apiValue, { color: '#2196F3' }]}>
                  {systemMetrics.requestsPerMinute}
                </Text>
              </View>
              <Divider style={{ width: 1, height: '100%' }} />
              <View style={styles.apiMetricItem}>
                <Text variant="bodySmall" style={styles.apiLabel}>
                  平均响应时间
                </Text>
                <Text variant="headlineSmall" style={[styles.apiValue, { color: '#4CAF50' }]}>
                  {systemMetrics.averageResponseTime}ms
                </Text>
              </View>
              <Divider style={{ width: 1, height: '100%' }} />
              <View style={styles.apiMetricItem}>
                <Text variant="bodySmall" style={styles.apiLabel}>
                  错误率
                </Text>
                <Text variant="headlineSmall" style={[styles.apiValue, { color: '#F44336' }]}>
                  {systemMetrics.errorRate}%
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 最近活动 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="📋 最近活动" />
          <Card.Content>
            {recentActivity.map((activity, index) => (
              <React.Fragment key={activity.id}>
                <View style={styles.activityItem}>
                  <Avatar.Icon
                    icon={activity.icon}
                    size={32}
                    color={activity.color}
                    style={styles.activityIcon}
                  />
                  <View style={styles.activityContent}>
                    <Text variant="bodyMedium" style={styles.activityMessage}>
                      {activity.message}
                    </Text>
                    <Text variant="bodySmall" style={styles.activityTime}>
                      {activity.time}
                    </Text>
                  </View>
                </View>
                {index < recentActivity.length - 1 && <Divider style={styles.divider} />}
              </React.Fragment>
            ))}
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
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
  },
  statusIcon: {
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  statusLabel: {
    color: '#757575',
    marginBottom: 4,
  },
  statusValue: {
    fontWeight: '600',
  },
  metricItem: {
    paddingVertical: 8,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricIcon: {
    backgroundColor: 'transparent',
    marginRight: 12,
  },
  metricLabel: {
    fontWeight: '500',
  },
  metricRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  divider: {
    marginVertical: 12,
  },
  networkGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  networkItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
  },
  networkIcon: {
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  networkLabel: {
    color: '#757575',
    marginBottom: 8,
  },
  networkValue: {
    fontWeight: '700',
  },
  apiMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  apiMetricItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  apiLabel: {
    color: '#757575',
    marginBottom: 8,
    textAlign: 'center',
  },
  apiValue: {
    fontWeight: '700',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  activityIcon: {
    backgroundColor: 'transparent',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    fontWeight: '500',
    marginBottom: 4,
  },
  activityTime: {
    color: '#757575',
  },
  bottomPadding: {
    height: 20,
  },
});
