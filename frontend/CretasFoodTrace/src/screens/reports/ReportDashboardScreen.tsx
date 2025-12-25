import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Button,
  ActivityIndicator,
  Surface,
  Divider,
  Chip,
  Icon,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { ReportScreenProps, ReportStackParamList } from '../../types/navigation';

/**
 * 报表仪表盘
 * P1-报表: 提供所有报表的快速访问入口
 *
 * 功能:
 * - 9个核心报表分类展示
 * - 快速访问导航
 * - 报表概览统计
 */
export default function ReportDashboardScreen() {
  const navigation = useNavigation<ReportScreenProps<'ReportDashboard'>['navigation']>();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * 报表分类定义
   */
  const reportCategories: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    color: string;
    screen: keyof ReportStackParamList;
  }> = [
    {
      id: 'production',
      title: '生产报表',
      description: '加工批次、产量统计、生产进度',
      icon: 'factory',
      color: '#2196F3',
      screen: 'ProductionReport',
    },
    {
      id: 'quality',
      title: '质量报表',
      description: '质检记录、合格率、问题分析',
      icon: 'check-circle',
      color: '#4CAF50',
      screen: 'QualityReport',
    },
    {
      id: 'cost',
      title: '成本报表',
      description: '成本分析、物料消耗、成本对比',
      icon: 'currency-usd',
      color: '#FF9800',
      screen: 'CostReport',
    },
    {
      id: 'efficiency',
      title: '效率报表',
      description: '设备OEE、人员效率、工时分析',
      icon: 'speedometer',
      color: '#9C27B0',
      screen: 'EfficiencyReport',
    },
    {
      id: 'trend',
      title: '趋势分析',
      description: '历史趋势、周期对比、增长分析',
      icon: 'trending-up',
      color: '#00BCD4',
      screen: 'TrendReport',
    },
    {
      id: 'personnel',
      title: '人员报表',
      description: '人员统计、出勤率、部门分布',
      icon: 'account-group',
      color: '#795548',
      screen: 'PersonnelReport',
    },
    {
      id: 'kpi',
      title: 'KPI指标',
      description: '关键绩效指标、目标达成率',
      icon: 'chart-bar',
      color: '#3F51B5',
      screen: 'KPIReport',
    },
    {
      id: 'forecast',
      title: '预测报表',
      description: 'AI预测、需求预测、库存预警',
      icon: 'crystal-ball',
      color: '#E91E63',
      screen: 'ForecastReport',
    },
    {
      id: 'anomaly',
      title: '异常报表',
      description: '异常检测、质量问题、设备故障',
      icon: 'alert-circle',
      color: '#F44336',
      screen: 'AnomalyReport',
    },
    {
      id: 'realtime',
      title: '实时监控',
      description: '实时数据、当前状态、即时统计',
      icon: 'monitor-dashboard',
      color: '#009688',
      screen: 'RealtimeReport',
    },
  ];

  /**
   * 刷新数据
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // 这里可以加载概览统计数据
    // 目前只是演示刷新效果
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  /**
   * 页面聚焦时刷新
   */
  useFocusEffect(
    useCallback(() => {
      // 可以在这里加载报表概览数据
    }, [])
  );

  /**
   * 获取图标背景色
   */
  const getIconBackgroundColor = (color: string): string => {
    // 将颜色转换为带透明度的背景色
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.12)`;
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="报表中心" />
        <Appbar.Action icon="export" onPress={() => navigation.navigate('DataExport', {})} />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* 顶部说明 */}
        <Surface style={styles.infoCard} elevation={1}>
          <View style={styles.infoHeader}>
            <Icon source="information" size={24} color="#2196F3" />
            <Text variant="titleMedium" style={styles.infoTitle}>
              报表功能
            </Text>
          </View>
          <Text variant="bodyMedium" style={styles.infoText}>
            综合查看生产、质量、成本等各维度数据报表，支持实时监控和趋势分析。
          </Text>
        </Surface>

        {/* 报表分类卡片 */}
        <View style={styles.categoriesContainer}>
          {reportCategories.map((category, index) => (
            <Card
              key={category.id}
              style={styles.categoryCard}
              mode="elevated"
              onPress={() => {
                navigation.navigate(category.screen as any);
              }}
            >
              <Card.Content style={styles.categoryContent}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: getIconBackgroundColor(category.color) },
                  ]}
                >
                  <Icon source={category.icon} size={32} color={category.color} />
                </View>

                <View style={styles.categoryInfo}>
                  <Text
                    variant="titleMedium"
                    style={[styles.categoryTitle, { color: category.color }]}
                  >
                    {category.title}
                  </Text>
                  <Text variant="bodySmall" style={styles.categoryDescription}>
                    {category.description}
                  </Text>
                </View>

                <Icon source="chevron-right" size={24} color="#999" />
              </Card.Content>
            </Card>
          ))}
        </View>

        {/* 快捷操作 */}
        <Card style={styles.actionsCard} mode="elevated">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              快捷操作
            </Text>
            <Divider style={styles.divider} />

            <Button
              mode="outlined"
              icon="file-export"
              onPress={() => navigation.navigate('DataExport', {})}
              style={styles.actionButton}
            >
              数据导出
            </Button>

            <Button
              mode="outlined"
              icon="calendar-month"
              onPress={() => {
                navigation.navigate('TrendReport' as any);
              }}
              style={styles.actionButton}
            >
              月度汇总
            </Button>

            <Button
              mode="outlined"
              icon="chart-timeline-variant"
              onPress={() => {
                navigation.navigate('TrendReport');
              }}
              style={styles.actionButton}
            >
              年度报告
            </Button>
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
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    marginLeft: 8,
    fontWeight: '600',
    color: '#1976D2',
  },
  infoText: {
    color: '#424242',
    lineHeight: 20,
  },
  categoriesContainer: {
    padding: 16,
    paddingTop: 8,
  },
  categoryCard: {
    marginBottom: 12,
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  categoryDescription: {
    color: '#666',
    lineHeight: 18,
  },
  actionsCard: {
    margin: 16,
    marginTop: 0,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#212121',
  },
  divider: {
    marginVertical: 12,
  },
  actionButton: {
    marginBottom: 8,
  },
  bottomPadding: {
    height: 80,
  },
});
