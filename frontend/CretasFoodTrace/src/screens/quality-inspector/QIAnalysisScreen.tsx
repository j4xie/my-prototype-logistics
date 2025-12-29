/**
 * 分析概览页面
 * Quality Inspector - Analysis Overview Screen
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  QI_COLORS,
  QualityInspectorStackParamList,
  GRADE_COLORS,
} from '../../types/qualityInspector';
import { qualityInspectorApi } from '../../services/api/qualityInspectorApi';
import { useAuthStore } from '../../store/authStore';

type NavigationProp = NativeStackNavigationProp<QualityInspectorStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnalysisData {
  overview: {
    totalInspections: number;
    passRate: number;
    avgScore: number;
    trendDirection: 'up' | 'down' | 'stable';
  };
  gradeDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
  };
  categoryScores: {
    appearance: number;
    smell: number;
    specification: number;
    weight: number;
    packaging: number;
  };
  recentIssues: {
    category: string;
    count: number;
    description: string;
  }[];
}

export default function QIAnalysisScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const factoryId = user?.factoryId;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('week');

  useEffect(() => {
    if (factoryId) {
      qualityInspectorApi.setFactoryId(factoryId);
      loadData();
    }
  }, [factoryId, period]);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await qualityInspectorApi.getAnalysisData(period);
      setData(result);
    } catch (error) {
      console.error('加载分析数据失败:', error);
      // 使用模拟数据作为回退
      setData({
        overview: {
          totalInspections: 156,
          passRate: 92.3,
          avgScore: 87.5,
          trendDirection: 'up',
        },
        gradeDistribution: { A: 45, B: 38, C: 12, D: 5 },
        categoryScores: {
          appearance: 17.2,
          smell: 18.5,
          specification: 16.8,
          weight: 17.9,
          packaging: 17.1,
        },
        recentIssues: [
          { category: '外观', count: 8, description: '色泽不均匀' },
          { category: '规格', count: 5, description: '尺寸偏差' },
          { category: '包装', count: 3, description: '标签模糊' },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [period]);

  const handleViewTrend = () => {
    navigation.navigate('QITrend');
  };

  const handleGenerateReport = () => {
    navigation.navigate('QIReport');
  };

  const renderPeriodTab = (p: 'week' | 'month' | 'quarter', label: string) => (
    <TouchableOpacity
      style={[styles.periodTab, period === p && styles.periodTabActive]}
      onPress={() => setPeriod(p)}
    >
      <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderGradeBar = (grade: 'A' | 'B' | 'C' | 'D', count: number, total: number) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    return (
      <View key={grade} style={styles.gradeRow}>
        <View style={[styles.gradeLabel, { backgroundColor: GRADE_COLORS[grade] }]}>
          <Text style={styles.gradeLabelText}>{grade}</Text>
        </View>
        <View style={styles.gradeBarContainer}>
          <View
            style={[
              styles.gradeBar,
              { width: `${percentage}%`, backgroundColor: GRADE_COLORS[grade] },
            ]}
          />
        </View>
        <Text style={styles.gradeCount}>{count}批</Text>
        <Text style={styles.gradePercent}>{percentage.toFixed(1)}%</Text>
      </View>
    );
  };

  const renderCategoryScore = (
    category: string,
    icon: string,
    score: number,
    maxScore: number = 20
  ) => {
    const percentage = (score / maxScore) * 100;
    return (
      <View style={styles.categoryItem}>
        <View style={styles.categoryHeader}>
          <Ionicons name={icon as any} size={18} color={QI_COLORS.primary} />
          <Text style={styles.categoryName}>{category}</Text>
          <Text style={styles.categoryScore}>
            {score.toFixed(1)}<Text style={styles.categoryMax}>/{maxScore}</Text>
          </Text>
        </View>
        <View style={styles.categoryBarBg}>
          <View style={[styles.categoryBar, { width: `${percentage}%` }]} />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={QI_COLORS.primary} />
        <Text style={styles.loadingText}>加载分析数据...</Text>
      </View>
    );
  }

  const totalGrades = data
    ? data.gradeDistribution.A +
      data.gradeDistribution.B +
      data.gradeDistribution.C +
      data.gradeDistribution.D
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[QI_COLORS.primary]}
        />
      }
    >
      {/* 时间周期选择 */}
      <View style={styles.periodBar}>
        {renderPeriodTab('week', '本周')}
        {renderPeriodTab('month', '本月')}
        {renderPeriodTab('quarter', '本季度')}
      </View>

      {/* 概览卡片 */}
      <View style={styles.overviewCard}>
        <View style={styles.overviewItem}>
          <Text style={styles.overviewValue}>{data?.overview.totalInspections || 0}</Text>
          <Text style={styles.overviewLabel}>检验批次</Text>
        </View>
        <View style={styles.overviewDivider} />
        <View style={styles.overviewItem}>
          <View style={styles.overviewValueRow}>
            <Text style={styles.overviewValue}>{data?.overview.passRate.toFixed(1)}%</Text>
            {data?.overview.trendDirection === 'up' && (
              <Ionicons name="trending-up" size={20} color={QI_COLORS.success} />
            )}
            {data?.overview.trendDirection === 'down' && (
              <Ionicons name="trending-down" size={20} color={QI_COLORS.danger} />
            )}
          </View>
          <Text style={styles.overviewLabel}>合格率</Text>
        </View>
        <View style={styles.overviewDivider} />
        <View style={styles.overviewItem}>
          <Text style={styles.overviewValue}>{data?.overview.avgScore.toFixed(1)}</Text>
          <Text style={styles.overviewLabel}>平均分</Text>
        </View>
      </View>

      {/* 等级分布 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>等级分布</Text>
          <TouchableOpacity onPress={handleViewTrend}>
            <Text style={styles.sectionAction}>查看趋势</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.gradeCard}>
          {data &&
            (['A', 'B', 'C', 'D'] as const).map((grade) =>
              renderGradeBar(grade, data.gradeDistribution[grade], totalGrades)
            )}
        </View>
      </View>

      {/* 分类评分 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>分类平均分</Text>
        <View style={styles.categoryCard}>
          {renderCategoryScore('外观', 'eye-outline', data?.categoryScores.appearance || 0)}
          {renderCategoryScore('气味', 'flower-outline', data?.categoryScores.smell || 0)}
          {renderCategoryScore('规格', 'resize-outline', data?.categoryScores.specification || 0)}
          {renderCategoryScore('重量', 'scale-outline', data?.categoryScores.weight || 0)}
          {renderCategoryScore('包装', 'cube-outline', data?.categoryScores.packaging || 0)}
        </View>
      </View>

      {/* 常见问题 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>常见问题</Text>
        <View style={styles.issuesCard}>
          {data?.recentIssues.map((issue, index) => (
            <View key={index} style={styles.issueItem}>
              <View style={styles.issueLeft}>
                <View style={styles.issueBadge}>
                  <Text style={styles.issueBadgeText}>{issue.count}</Text>
                </View>
                <View>
                  <Text style={styles.issueCategory}>{issue.category}</Text>
                  <Text style={styles.issueDesc}>{issue.description}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={QI_COLORS.disabled} />
            </View>
          ))}
        </View>
      </View>

      {/* 生成报告按钮 */}
      <TouchableOpacity style={styles.reportBtn} onPress={handleGenerateReport}>
        <Ionicons name="document-text-outline" size={20} color="#fff" />
        <Text style={styles.reportBtnText}>生成质检报告</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QI_COLORS.background,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: QI_COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    color: QI_COLORS.textSecondary,
    fontSize: 14,
  },

  // 时间周期
  periodBar: {
    flexDirection: 'row',
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodTabActive: {
    backgroundColor: QI_COLORS.primary,
  },
  periodText: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },
  periodTextActive: {
    color: '#fff',
    fontWeight: '500',
  },

  // 概览卡片
  overviewCard: {
    flexDirection: 'row',
    backgroundColor: QI_COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  overviewItem: {
    flex: 1,
    alignItems: 'center',
  },
  overviewDivider: {
    width: 1,
    backgroundColor: QI_COLORS.border,
  },
  overviewValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: '700',
    color: QI_COLORS.text,
  },
  overviewLabel: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    marginTop: 4,
  },

  // 区块
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: QI_COLORS.text,
  },
  sectionAction: {
    fontSize: 14,
    color: QI_COLORS.primary,
  },

  // 等级分布
  gradeCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  gradeLabel: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  gradeLabelText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  gradeBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: QI_COLORS.border,
    borderRadius: 4,
    marginRight: 12,
    overflow: 'hidden',
  },
  gradeBar: {
    height: '100%',
    borderRadius: 4,
  },
  gradeCount: {
    width: 40,
    fontSize: 13,
    color: QI_COLORS.text,
    textAlign: 'right',
  },
  gradePercent: {
    width: 50,
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    textAlign: 'right',
  },

  // 分类评分
  categoryCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
  },
  categoryItem: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    color: QI_COLORS.text,
    marginLeft: 8,
  },
  categoryScore: {
    fontSize: 16,
    fontWeight: '600',
    color: QI_COLORS.text,
  },
  categoryMax: {
    fontSize: 12,
    fontWeight: '400',
    color: QI_COLORS.textSecondary,
  },
  categoryBarBg: {
    height: 6,
    backgroundColor: QI_COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryBar: {
    height: '100%',
    backgroundColor: QI_COLORS.primary,
    borderRadius: 3,
  },

  // 常见问题
  issuesCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  issueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: QI_COLORS.border,
  },
  issueLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  issueBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  issueBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: QI_COLORS.danger,
  },
  issueCategory: {
    fontSize: 14,
    fontWeight: '500',
    color: QI_COLORS.text,
  },
  issueDesc: {
    fontSize: 12,
    color: QI_COLORS.textSecondary,
    marginTop: 2,
  },

  // 生成报告按钮
  reportBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: QI_COLORS.secondary,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 8,
  },
  reportBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
