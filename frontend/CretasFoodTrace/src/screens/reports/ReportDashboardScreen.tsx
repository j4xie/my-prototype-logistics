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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('reports');

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
      title: t('categories.production.title'),
      description: t('categories.production.description'),
      icon: 'factory',
      color: '#2196F3',
      screen: 'ProductionReport',
    },
    {
      id: 'quality',
      title: t('categories.quality.title'),
      description: t('categories.quality.description'),
      icon: 'check-circle',
      color: '#4CAF50',
      screen: 'QualityReport',
    },
    {
      id: 'cost',
      title: t('categories.cost.title'),
      description: t('categories.cost.description'),
      icon: 'currency-usd',
      color: '#FF9800',
      screen: 'CostReport',
    },
    {
      id: 'efficiency',
      title: t('categories.efficiency.title'),
      description: t('categories.efficiency.description'),
      icon: 'speedometer',
      color: '#9C27B0',
      screen: 'EfficiencyReport',
    },
    {
      id: 'trend',
      title: t('categories.trend.title'),
      description: t('categories.trend.description'),
      icon: 'trending-up',
      color: '#00BCD4',
      screen: 'TrendReport',
    },
    {
      id: 'personnel',
      title: t('categories.personnel.title'),
      description: t('categories.personnel.description'),
      icon: 'account-group',
      color: '#795548',
      screen: 'PersonnelReport',
    },
    {
      id: 'kpi',
      title: t('categories.kpi.title'),
      description: t('categories.kpi.description'),
      icon: 'chart-bar',
      color: '#3F51B5',
      screen: 'KPIReport',
    },
    {
      id: 'forecast',
      title: t('categories.forecast.title'),
      description: t('categories.forecast.description'),
      icon: 'crystal-ball',
      color: '#E91E63',
      screen: 'ForecastReport',
    },
    {
      id: 'anomaly',
      title: t('categories.anomaly.title'),
      description: t('categories.anomaly.description'),
      icon: 'alert-circle',
      color: '#F44336',
      screen: 'AnomalyReport',
    },
    {
      id: 'realtime',
      title: t('categories.realtime.title'),
      description: t('categories.realtime.description'),
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
        <Appbar.Content title={t('dashboard.title')} />
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
              {t('dashboard.reportFeatures')}
            </Text>
          </View>
          <Text variant="bodyMedium" style={styles.infoText}>
            {t('dashboard.reportFeaturesDescription')}
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
              {t('dashboard.quickActions')}
            </Text>
            <Divider style={styles.divider} />

            <Button
              mode="outlined"
              icon="file-export"
              onPress={() => navigation.navigate('DataExport', {})}
              style={styles.actionButton}
            >
              {t('dashboard.dataExport')}
            </Button>

            <Button
              mode="outlined"
              icon="calendar-month"
              onPress={() => {
                navigation.navigate('TrendReport' as any);
              }}
              style={styles.actionButton}
            >
              {t('dashboard.monthlySummary')}
            </Button>

            <Button
              mode="outlined"
              icon="chart-timeline-variant"
              onPress={() => {
                navigation.navigate('TrendReport');
              }}
              style={styles.actionButton}
            >
              {t('dashboard.annualReport')}
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
