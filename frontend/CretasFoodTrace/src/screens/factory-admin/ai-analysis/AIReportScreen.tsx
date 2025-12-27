/**
 * AI报告列表页面
 * 显示历史AI分析报告
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
import { FAAIStackParamList } from '../../../types/navigation';
import { aiApiClient, ReportSummary } from '../../../services/api/aiApiClient';

type NavigationProp = NativeStackNavigationProp<FAAIStackParamList, 'AIReport'>;

type ReportType = 'all' | 'batch' | 'weekly' | 'monthly' | 'custom';

export function AIReportScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ReportType>('all');

  const loadReports = useCallback(async () => {
    try {
      setError(null);
      const params = filterType !== 'all' ? { reportType: filterType } : undefined;
      const response = await aiApiClient.getReports(params);
      setReports(response.reports || []);
    } catch (err) {
      console.error('加载报告列表失败:', err);
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterType]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadReports();
  }, [loadReports]);

  const getReportTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      batch: 'package-variant',
      weekly: 'calendar-week',
      monthly: 'calendar-month',
      custom: 'tune',
    };
    return icons[type] || 'file-document';
  };

  const getReportTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      batch: '#667eea',
      weekly: '#48bb78',
      monthly: '#ed8936',
      custom: '#9f7aea',
    };
    return colors[type] || '#667eea';
  };

  const getReportTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      batch: '批次分析',
      weekly: '周报',
      monthly: '月报',
      custom: '自定义',
    };
    return labels[type] || type;
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderFilterTabs = () => (
    <View style={styles.filterTabs}>
      {(['all', 'batch', 'weekly', 'monthly'] as ReportType[]).map((type) => (
        <TouchableOpacity
          key={type}
          style={[styles.filterTab, filterType === type && styles.filterTabActive]}
          onPress={() => setFilterType(type)}
        >
          <Text
            style={[styles.filterTabText, filterType === type && styles.filterTabTextActive]}
          >
            {type === 'all' ? '全部' : getReportTypeLabel(type)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderReportItem = ({ item }: { item: ReportSummary }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => navigation.navigate('AIReportDetail', {
        reportId: item.reportId,
        reportType: item.reportType,
        title: item.title,
      })}
      activeOpacity={0.7}
    >
      <View style={styles.reportHeader}>
        <View style={[styles.typeIcon, { backgroundColor: getReportTypeColor(item.reportType) + '20' }]}>
          <Icon
            source={getReportTypeIcon(item.reportType)}
            size={20}
            color={getReportTypeColor(item.reportType)}
          />
        </View>
        <View style={styles.reportInfo}>
          <Text style={styles.reportTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.reportMeta}>
            <Text style={styles.reportDate}>{formatDate(item.createdAt)}</Text>
            <View style={[styles.typeBadge, { backgroundColor: getReportTypeColor(item.reportType) + '20' }]}>
              <Text style={[styles.typeText, { color: getReportTypeColor(item.reportType) }]}>
                {getReportTypeLabel(item.reportType)}
              </Text>
            </View>
          </View>
        </View>
        <Icon source="chevron-right" size={20} color="#ccc" />
      </View>

      {/* 报告统计 */}
      {(item.totalCost !== undefined || item.keyFindingsCount !== undefined) && (
        <View style={styles.reportStats}>
          {item.totalCost !== undefined && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>总成本</Text>
              <Text style={styles.statValue}>¥{item.totalCost.toFixed(2)}</Text>
            </View>
          )}
          {item.keyFindingsCount !== undefined && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>关键发现</Text>
              <Text style={styles.statValue}>{item.keyFindingsCount} 项</Text>
            </View>
          )}
          {item.suggestionsCount !== undefined && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>建议</Text>
              <Text style={styles.statValue}>{item.suggestionsCount} 条</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon source="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>数据报表</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>数据报表</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      {renderFilterTabs()}

      {/* 错误提示 */}
      {error && (
        <View style={styles.errorBanner}>
          <Icon source="alert-circle" size={20} color="#e53e3e" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={reports}
        keyExtractor={(item) => String(item.reportId)}
        renderItem={renderReportItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon source="file-document-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>暂无报告</Text>
            <Text style={styles.emptyHint}>完成AI分析后，报告将显示在这里</Text>
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
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  filterTabActive: {
    backgroundColor: '#667eea',
  },
  filterTabText: {
    fontSize: 14,
    color: '#666',
  },
  filterTabTextActive: {
    color: '#fff',
    fontWeight: '500',
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
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#c53030',
  },
  listContent: {
    padding: 16,
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportInfo: {
    flex: 1,
    marginLeft: 12,
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a202c',
    lineHeight: 20,
  },
  reportMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  reportDate: {
    fontSize: 12,
    color: '#999',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  reportStats: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f0f0f0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyHint: {
    marginTop: 4,
    fontSize: 13,
    color: '#999',
  },
});

export default AIReportScreen;
