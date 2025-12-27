/**
 * AI成本分析页面
 * 支持时间范围选择和多维度分析
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { FAAIStackParamList } from '../../../types/navigation';
import { aiApiClient, AICostAnalysisResponse } from '../../../services/api/aiApiClient';
import { MarkdownRenderer } from '../../../components/common/MarkdownRenderer';

type NavigationProp = NativeStackNavigationProp<FAAIStackParamList, 'AICostAnalysis'>;

type Dimension = 'overall' | 'daily' | 'weekly';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

export function AICostAnalysisScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [loading, setLoading] = useState(false);
  const [dimension, setDimension] = useState<Dimension>('overall');
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7); // 默认7天
    return { startDate: start, endDate: end };
  });
  const [result, setResult] = useState<AICostAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 快速日期范围选项
  const quickRanges = [
    { label: '最近7天', days: 7 },
    { label: '最近30天', days: 30 },
    { label: '最近90天', days: 90 },
  ];

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateRange({ startDate: start, endDate: end });
  };

  const formatDate = (date: Date): string => {
    const isoString = date.toISOString();
    return isoString.split('T')[0] ?? isoString.substring(0, 10);
  };

  const formatDisplayDate = (date: Date): string => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDimensionLabel = (dim: Dimension): string => {
    const labels: Record<Dimension, string> = {
      overall: '综合分析',
      daily: '按日分析',
      weekly: '按周分析',
    };
    return labels[dim];
  };

  const runAnalysis = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await aiApiClient.analyzeTimeRangeCost({
        startDate: formatDate(dateRange.startDate),
        endDate: formatDate(dateRange.endDate),
        dimension,
      });

      if (response.success) {
        setResult(response);
      } else {
        setError(response.errorMessage || '分析失败，请稍后重试');
      }
    } catch (err) {
      console.error('成本分析失败:', err);
      setError('分析请求失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  }, [dateRange, dimension]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>成本分析</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 时间范围选择 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>时间范围</Text>
          <View style={styles.dateRangeCard}>
            <View style={styles.dateDisplay}>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>开始日期</Text>
                <Text style={styles.dateValue}>{formatDisplayDate(dateRange.startDate)}</Text>
              </View>
              <Icon source="arrow-right" size={20} color="#999" />
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>结束日期</Text>
                <Text style={styles.dateValue}>{formatDisplayDate(dateRange.endDate)}</Text>
              </View>
            </View>
            <View style={styles.quickRanges}>
              {quickRanges.map((range) => (
                <TouchableOpacity
                  key={range.days}
                  style={styles.quickRangeBtn}
                  onPress={() => setQuickRange(range.days)}
                >
                  <Text style={styles.quickRangeText}>{range.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 分析维度 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>分析维度</Text>
          <View style={styles.dimensionGrid}>
            {(['overall', 'daily', 'weekly'] as Dimension[]).map((dim) => (
              <TouchableOpacity
                key={dim}
                style={[
                  styles.dimensionItem,
                  dimension === dim && styles.dimensionItemActive,
                ]}
                onPress={() => setDimension(dim)}
              >
                <Icon
                  source={
                    dim === 'overall' ? 'chart-pie' :
                    dim === 'daily' ? 'calendar-today' : 'calendar-week'
                  }
                  size={24}
                  color={dimension === dim ? '#fff' : '#667eea'}
                />
                <Text
                  style={[
                    styles.dimensionLabel,
                    dimension === dim && styles.dimensionLabelActive,
                  ]}
                >
                  {getDimensionLabel(dim)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 开始分析按钮 */}
        <TouchableOpacity
          style={[styles.analyzeBtn, loading && styles.analyzeBtnDisabled]}
          onPress={runAnalysis}
          disabled={loading}
        >
          {loading ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.analyzeBtnText}>分析中...</Text>
            </>
          ) : (
            <>
              <Icon source="robot" size={20} color="#fff" />
              <Text style={styles.analyzeBtnText}>开始 AI 分析</Text>
            </>
          )}
        </TouchableOpacity>

        {/* 错误提示 */}
        {error && (
          <View style={styles.errorCard}>
            <Icon source="alert-circle" size={20} color="#e53e3e" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* 分析结果 */}
        {result && (
          <View style={styles.resultSection}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>分析结果</Text>
              {result.quota && (
                <Text style={styles.quotaInfo}>
                  配额: {result.quota.remainingQuota}/{result.quota.weeklyQuota}
                </Text>
              )}
            </View>
            <View style={styles.resultCard}>
              <MarkdownRenderer content={result.analysis} />
            </View>
            {result.responseTimeMs && (
              <Text style={styles.responseTime}>
                响应时间: {result.responseTimeMs}ms
                {result.cacheHit ? ' (缓存)' : ''}
              </Text>
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 12,
  },
  dateRangeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateItem: {
    flex: 1,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  quickRanges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickRangeBtn: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    backgroundColor: '#f0f3ff',
    borderRadius: 8,
    alignItems: 'center',
  },
  quickRangeText: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '500',
  },
  dimensionGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  dimensionItem: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dimensionItemActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  dimensionLabel: {
    marginTop: 8,
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  dimensionLabelActive: {
    color: '#fff',
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    backgroundColor: '#667eea',
    borderRadius: 12,
    gap: 8,
  },
  analyzeBtnDisabled: {
    opacity: 0.7,
  },
  analyzeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fed7d7',
    borderRadius: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#c53030',
  },
  resultSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
  quotaInfo: {
    fontSize: 12,
    color: '#667eea',
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  responseTime: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
});

export default AICostAnalysisScreen;
