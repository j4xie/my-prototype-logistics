/**
 * AI 告警页面
 * 显示设备告警和智能预警
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { FAHomeStackParamList } from '../../../types/navigation';
import { dashboardAPI, AlertsDashboardData } from '../../../services/api/dashboardApiClient';

type NavigationProp = NativeStackNavigationProp<FAHomeStackParamList, 'AIAlerts'>;

interface AlertItem {
  id: string;
  type: string;
  message: string;
  severity: string;
  timestamp: string;
}

export function AIAlertsScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alertsData, setAlertsData] = useState<AlertsDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const response = await dashboardAPI.getAlertsDashboard('week');
      if (response.success && response.data) {
        setAlertsData(response.data);
      }
    } catch (err) {
      console.error('加载告警数据失败:', err);
      setError('数据加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const getSeverityColor = (severity: string): string => {
    const colors: Record<string, string> = {
      critical: '#e53e3e',
      high: '#ed8936',
      medium: '#ecc94b',
      low: '#48bb78',
    };
    return colors[severity] || '#a0aec0';
  };

  const getSeverityLabel = (severity: string): string => {
    const labels: Record<string, string> = {
      critical: '紧急',
      high: '高',
      medium: '中',
      low: '低',
    };
    return labels[severity] || severity;
  };

  const getTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      equipment: 'cog-outline',
      quality: 'alert-circle-outline',
      inventory: 'package-variant',
      production: 'factory',
    };
    return icons[type] || 'alert';
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 60) {
      return `${minutes} 分钟前`;
    } else if (hours < 24) {
      return `${hours} 小时前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  };

  const renderAlertItem = ({ item }: { item: AlertItem }) => (
    <View style={styles.alertCard}>
      <View style={[styles.severityIndicator, { backgroundColor: getSeverityColor(item.severity) }]} />
      <View style={styles.alertContent}>
        <View style={styles.alertHeader}>
          <View style={styles.alertTypeRow}>
            <Icon source={getTypeIcon(item.type)} size={18} color="#666" />
            <Text style={styles.alertType}>{item.type}</Text>
          </View>
          <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(item.severity) + '20' }]}>
            <Text style={[styles.severityText, { color: getSeverityColor(item.severity) }]}>
              {getSeverityLabel(item.severity)}
            </Text>
          </View>
        </View>
        <Text style={styles.alertMessage}>{item.message}</Text>
        <Text style={styles.alertTime}>{formatTime(item.timestamp)}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const summary = alertsData?.summary;
  const recentAlerts = alertsData?.recent || [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>告警中心</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 错误提示 */}
      {error && (
        <View style={styles.errorBanner}>
          <Icon source="alert-circle" size={20} color="#e53e3e" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={recentAlerts}
        keyExtractor={(item) => item.id}
        renderItem={renderAlertItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
        }
        ListHeaderComponent={
          <View style={styles.summarySection}>
            {/* 统计卡片 */}
            <View style={styles.summaryCards}>
              <View style={[styles.summaryCard, { backgroundColor: '#e53e3e' }]}>
                <Text style={styles.summaryValue}>{summary?.criticalAlerts ?? 0}</Text>
                <Text style={styles.summaryLabel}>紧急</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: '#ed8936' }]}>
                <Text style={styles.summaryValue}>{summary?.activeAlerts ?? 0}</Text>
                <Text style={styles.summaryLabel}>活跃</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: '#48bb78' }]}>
                <Text style={styles.summaryValue}>{summary?.resolvedAlerts ?? 0}</Text>
                <Text style={styles.summaryLabel}>已解决</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: '#667eea' }]}>
                <Text style={styles.summaryValue}>{summary?.totalAlerts ?? 0}</Text>
                <Text style={styles.summaryLabel}>总计</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>最近告警</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon source="check-circle" size={48} color="#48bb78" />
            <Text style={styles.emptyText}>暂无告警</Text>
            <Text style={styles.emptySubtext}>系统运行正常</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fed7d7',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#c53030',
  },
  listContent: {
    padding: 16,
  },
  summarySection: {
    marginBottom: 16,
  },
  summaryCards: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 12,
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  severityIndicator: {
    width: 4,
  },
  alertContent: {
    flex: 1,
    padding: 16,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertType: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
    textTransform: 'capitalize',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  severityText: {
    fontSize: 11,
    fontWeight: '500',
  },
  alertMessage: {
    fontSize: 15,
    color: '#1a202c',
    lineHeight: 22,
    marginBottom: 8,
  },
  alertTime: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#48bb78',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#999',
  },
});

export default AIAlertsScreen;
