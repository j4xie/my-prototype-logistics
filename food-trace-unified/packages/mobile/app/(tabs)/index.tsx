import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Text,
  Avatar,
  Chip,
  List
} from 'react-native-paper';
import { useDashboardStore, useAuthStore } from '@food-trace/core';
import { 
  Card, 
  Button, 
  Loading, 
  StatisticsGrid, 
  StatData 
} from '@food-trace/ui-shared';
import { useQuery } from '@tanstack/react-query';

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const { 
    stats, 
    realtimeData, 
    alerts,
    fetchStats, 
    fetchRealtimeData, 
    fetchAlerts,
    isLoading 
  } = useDashboardStore();

  // 使用 React Query 来管理数据获取
  const { refetch, isRefreshing } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      await Promise.all([
        fetchStats(),
        fetchRealtimeData(),
        fetchAlerts({ limit: 5 })
      ]);
      return true;
    },
    refetchInterval: 30000, // 30秒自动刷新
  });

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return <Loading text="加载仪表盘数据..." style={styles.loadingContainer} />;
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      {/* 用户欢迎卡片 */}
      <Card style={styles.welcomeCard}>
        <Card.Content>
          <View style={styles.welcomeContent}>
            <Avatar.Icon 
              size={60} 
              icon="account" 
              style={styles.avatar} 
            />
            <View style={styles.welcomeText}>
              <Text variant="headlineSmall">
                欢迎回来，{user?.username || '用户'}
              </Text>
              <Text variant="bodyMedium" style={styles.subtitle}>
                {new Date().toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long'
                })}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* 实时数据卡片 */}
      <Card style={styles.card}>
        <Text variant="titleLarge" style={styles.cardTitle}>
          实时数据
        </Text>
        <StatisticsGrid
          stats={[
            {
              value: realtimeData?.activeBatches || 0,
              label: '活跃批次',
              icon: 'factory',
              color: '#2196F3'
            },
            {
              value: realtimeData?.todayProduction || 0,
              label: '今日产量',
              icon: 'package-variant',
              color: '#ff9800'
            },
            {
              value: `${realtimeData?.qualityScore || 0}%`,
              label: '质量评分',
              icon: 'check-circle',
              color: '#4caf50'
            },
            {
              value: realtimeData?.alerts || 0,
              label: '待处理预警',
              icon: 'alert-circle',
              color: '#f44336'
            }
          ] as StatData[]}
          columns={2}
          variant="compact"
        />
      </Card>

      {/* 统计概览 */}
      {stats && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              统计概览
            </Text>
            <View style={styles.statsRow}>
              <Chip icon="factory" style={styles.chip}>
                总批次: {stats.totalBatches || 0}
              </Chip>
              <Chip icon="package-variant" style={styles.chip}>
                总产品: {stats.totalProducts || 0}
              </Chip>
            </View>
            <View style={styles.statsRow}>
              <Chip icon="truck" style={styles.chip}>
                在途: {stats.inTransit || 0}
              </Chip>
              <Chip icon="check-circle" style={styles.chip}>
                已完成: {stats.completed || 0}
              </Chip>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* 最新预警 */}
      {alerts && alerts.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              最新预警
            </Text>
            {alerts.slice(0, 3).map((alert, index) => (
              <List.Item
                key={index}
                title={alert.title || '预警信息'}
                description={alert.message || '暂无描述'}
                left={(props) => (
                  <List.Icon 
                    {...props} 
                    icon="alert-circle" 
                    color={getSeverityColor(alert.severity)}
                  />
                )}
                right={(props) => (
                  <Text {...props} variant="bodySmall">
                    {formatTime(alert.createdAt)}
                  </Text>
                )}
                style={styles.alertItem}
              />
            ))}
            <Button mode="outlined" style={styles.viewAllButton}>
              查看全部预警
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* 快捷操作 */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.cardTitle}>
            快捷操作
          </Text>
          <View style={styles.quickActions}>
            <Button 
              mode="contained" 
              icon="qrcode-scan" 
              style={styles.actionButton}
            >
              扫码溯源
            </Button>
            <Button 
              mode="contained" 
              icon="plus" 
              style={styles.actionButton}
            >
              新建批次
            </Button>
            <Button 
              mode="contained" 
              icon="check-circle" 
              style={styles.actionButton}
            >
              质量检测
            </Button>
            <Button 
              mode="contained" 
              icon="truck" 
              style={styles.actionButton}
            >
              物流跟踪
            </Button>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

// 辅助函数
function getSeverityColor(severity?: string) {
  switch (severity) {
    case 'critical': return '#f44336';
    case 'high': return '#ff9800';
    case 'medium': return '#ffc107';
    case 'low': return '#4caf50';
    default: return '#757575';
  }
}

function formatTime(timestamp?: string) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) return '刚刚';
  if (diffHours < 24) return `${diffHours}小时前`;
  return date.toLocaleDateString('zh-CN');
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  welcomeCard: {
    margin: 16,
    marginBottom: 8,
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 16,
  },
  welcomeText: {
    flex: 1,
  },
  subtitle: {
    opacity: 0.7,
    marginTop: 4,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  cardTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  statNumber: {
    fontWeight: 'bold',
    color: '#2196F3',
  },
  qualityScore: {
    color: '#4caf50',
  },
  alertCount: {
    color: '#f44336',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    marginRight: 8,
    marginBottom: 4,
  },
  alertItem: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  viewAllButton: {
    marginTop: 12,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    marginBottom: 8,
  },
});