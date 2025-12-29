/**
 * AI人员优化建议屏幕
 *
 * 功能:
 * - 优化收益展示（完成概率提升、效率提升、时间节省）
 * - 人员分配对比（优化前后）
 * - 人员调动建议列表
 * - 各车间人员分布对比图
 * - AI优化算法说明
 * - 应用/手动调整操作
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// 主题颜色
const DISPATCHER_THEME = {
  primary: '#722ed1',
  secondary: '#a18cd1',
  accent: '#fbc2eb',
  success: '#52c41a',
  warning: '#fa8c16',
  danger: '#ff4d4f',
  info: '#1890ff',
  background: '#f5f5f5',
  cardBackground: '#ffffff',
};

// 优化收益类型
interface BenefitStat {
  value: string;
  label: string;
  change: string;
}

// 人员对比类型
interface LineComparison {
  id: string;
  workshop: string;
  before: number;
  after: number;
}

// 调动建议类型
interface AdjustmentSuggestion {
  id: string;
  name: string;
  avatar: string;
  skill: string;
  skillLevel: string;
  from: string;
  to: string;
}

// 车间分布类型
interface DistributionData {
  id: string;
  workshop: string;
  before: number;
  after: number;
  maxValue: number;
}

// Mock 数据
const mockBenefits: BenefitStat[] = [
  { value: '92%', label: '完成概率', change: '↑ +7%' },
  { value: '12%', label: '效率提升', change: '↑ 优化' },
  { value: '-2h', label: '预计节省', change: '↑ 提前' },
];

const mockComparisons: LineComparison[] = [
  { id: '1', workshop: '切片A线', before: 4, after: 6 },
  { id: '2', workshop: '切片B线', before: 3, after: 4 },
];

const mockAdjustments: AdjustmentSuggestion[] = [
  {
    id: '1',
    name: '张小明',
    avatar: '张',
    skill: '切片技能',
    skillLevel: 'Lv.3 (熟练)',
    from: '机动',
    to: '切片A线',
  },
  {
    id: '2',
    name: '李小红',
    avatar: '李',
    skill: '切片技能',
    skillLevel: 'Lv.2 (会操作)',
    from: '包装',
    to: '切片A线',
  },
  {
    id: '3',
    name: '王大力',
    avatar: '王',
    skill: '切片技能',
    skillLevel: 'Lv.2 (会操作)',
    from: '冷冻',
    to: '切片B线',
  },
];

const mockDistribution: DistributionData[] = [
  { id: '1', workshop: '切片A线', before: 4, after: 6, maxValue: 10 },
  { id: '2', workshop: '切片B线', before: 3, after: 4, maxValue: 10 },
  { id: '3', workshop: '包装A线', before: 5, after: 4, maxValue: 10 },
  { id: '4', workshop: '冷冻车间', before: 3, after: 2, maxValue: 10 },
  { id: '5', workshop: '机动人员', before: 4, after: 3, maxValue: 10 },
];

export default function AIWorkerOptimizeScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: 调用API刷新数据
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // 应用优化方案
  const handleApplyOptimization = () => {
    Alert.alert(
      '应用优化方案',
      '确定要应用AI推荐的人员优化方案吗？将生成3个人员调动申请。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: () => {
            Alert.alert(
              '成功',
              '人员优化方案已应用！\n\n已提交 3 个人员调动申请，等待审批。\n预计完成概率提升至 92%。'
            );
          },
        },
      ]
    );
  };

  // 手动调整
  const handleManualAdjust = () => {
    // TODO: 导航到人员调动页面
    Alert.alert('提示', '即将跳转到人员调动页面');
  };

  // 渲染收益统计项
  const renderBenefitStat = (stat: BenefitStat, index: number) => (
    <View key={index} style={styles.benefitStat}>
      <Text style={styles.benefitValue}>{stat.value}</Text>
      <Text style={styles.benefitLabel}>{stat.label}</Text>
      <Text style={styles.benefitChange}>{stat.change}</Text>
    </View>
  );

  // 渲染对比卡片
  const renderComparisonRow = (comparison: LineComparison) => (
    <View key={comparison.id} style={styles.compareRow}>
      <View style={styles.compareCard}>
        <View style={styles.compareCardHeader}>
          <Text style={styles.compareCardDot}>○</Text>
          <Text style={styles.compareCardLabel}>当前分配</Text>
        </View>
        <Text style={styles.compareWorkshop}>{comparison.workshop}</Text>
        <Text style={styles.compareCount}>
          {comparison.before}<Text style={styles.compareSuffix}>人</Text>
        </Text>
      </View>
      <View style={[styles.compareCard, styles.compareCardAfter]}>
        <View style={styles.compareCardHeader}>
          <Text style={styles.compareCardCheck}>✓</Text>
          <Text style={[styles.compareCardLabel, { color: DISPATCHER_THEME.primary }]}>
            AI 优化后
          </Text>
        </View>
        <Text style={styles.compareWorkshop}>{comparison.workshop}</Text>
        <Text style={[styles.compareCount, { color: DISPATCHER_THEME.primary }]}>
          {comparison.after}<Text style={styles.compareSuffix}>人</Text>
        </Text>
      </View>
    </View>
  );

  // 渲染调动建议项
  const renderAdjustmentItem = (adjustment: AdjustmentSuggestion) => (
    <View key={adjustment.id} style={styles.adjustmentItem}>
      <LinearGradient
        colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
        style={styles.adjustmentAvatar}
      >
        <Text style={styles.adjustmentAvatarText}>{adjustment.avatar}</Text>
      </LinearGradient>
      <View style={styles.adjustmentInfo}>
        <Text style={styles.adjustmentName}>{adjustment.name}</Text>
        <Text style={styles.adjustmentSkill}>
          {adjustment.skill} <Text style={styles.adjustmentSkillLevel}>{adjustment.skillLevel}</Text>
        </Text>
      </View>
      <View style={styles.adjustmentArrow}>
        <Text style={styles.adjustmentFrom}>{adjustment.from}</Text>
        <Text style={styles.adjustmentArrowIcon}>↓</Text>
        <Text style={styles.adjustmentTo}>{adjustment.to}</Text>
      </View>
    </View>
  );

  // 渲染分布图行
  const renderDistributionRow = (data: DistributionData) => (
    <View key={data.id} style={styles.distributionRow}>
      <Text style={styles.distributionLabel}>{data.workshop}</Text>
      <View style={styles.distributionBars}>
        <View style={styles.distributionBarRow}>
          <View
            style={[
              styles.distributionBar,
              styles.distributionBarBefore,
              { width: `${(data.before / data.maxValue) * 100}%` },
            ]}
          />
          <Text style={styles.distributionValue}>{data.before}人</Text>
        </View>
        <View style={styles.distributionBarRow}>
          <LinearGradient
            colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.distributionBar,
              { width: `${(data.after / data.maxValue) * 100}%` },
            ]}
          />
          <Text style={styles.distributionValue}>{data.after}人</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>人员优化建议</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>OR-Tools</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[DISPATCHER_THEME.primary]}
            tintColor={DISPATCHER_THEME.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 优化收益卡片 */}
        <View style={styles.benefitCard}>
          <View style={styles.benefitIcon}>
            <Text style={styles.benefitIconText}>📈</Text>
          </View>
          <Text style={styles.benefitTitle}>应用 AI 优化方案后预计收益</Text>
          <View style={styles.benefitStats}>
            {mockBenefits.map(renderBenefitStat)}
          </View>
        </View>

        {/* 人员分配对比 */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionIcon}>👥</Text>
            <Text style={styles.sectionTitle}>人员分配对比</Text>
          </View>
          {mockComparisons.map(renderComparisonRow)}
        </View>

        {/* 调动建议列表 */}
        <View style={styles.adjustmentCard}>
          <View style={styles.adjustmentHeader}>
            <Text style={styles.adjustmentTitle}>人员调动建议</Text>
            <View style={styles.adjustmentCount}>
              <Text style={styles.adjustmentCountText}>{mockAdjustments.length} 人</Text>
            </View>
          </View>
          {mockAdjustments.map(renderAdjustmentItem)}
        </View>

        {/* 车间分布图 */}
        <View style={styles.distributionCard}>
          <Text style={styles.distributionTitle}>各车间人员分布</Text>
          {mockDistribution.map(renderDistributionRow)}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotBefore]} />
              <Text style={styles.legendText}>优化前</Text>
            </View>
            <View style={styles.legendItem}>
              <LinearGradient
                colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.legendDot, { borderRadius: 2 }]}
              />
              <Text style={styles.legendText}>优化后</Text>
            </View>
          </View>
        </View>

        {/* AI说明 */}
        <View style={styles.explanationCard}>
          <View style={styles.explanationHeader}>
            <Text style={styles.explanationIcon}>🤖</Text>
            <Text style={styles.explanationTitle}>优化算法说明</Text>
          </View>
          <Text style={styles.explanationContent}>
            本次优化使用 <Text style={styles.explanationHighlight}>OR-Tools 约束规划</Text> 算法，综合考虑以下因素：
            {'\n\n'}
            ✓ 员工技能等级与岗位匹配度{'\n'}
            ✓ 各产线最低/最高人数约束{'\n'}
            ✓ 批次优先级与交期紧迫度{'\n'}
            ✓ 人员调动成本最小化
            {'\n\n'}
            在 <Text style={styles.explanationHighlight}>0.8秒</Text> 内完成求解，找到全局最优解。
          </Text>
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionButtonSecondary}
          onPress={handleManualAdjust}
        >
          <Text style={styles.actionButtonSecondaryText}>手动调整</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButtonPrimary}
          onPress={handleApplyOptimization}
        >
          <LinearGradient
            colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionButtonGradient}
          >
            <Text style={styles.actionButtonPrimaryText}>应用优化方案</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DISPATCHER_THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
  },
  headerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerBadgeText: {
    fontSize: 11,
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  benefitCard: {
    backgroundColor: '#f6ffed',
    borderWidth: 1,
    borderColor: '#b7eb8f',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  benefitIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: DISPATCHER_THEME.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  benefitIconText: {
    fontSize: 28,
  },
  benefitTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  benefitStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  benefitStat: {
    alignItems: 'center',
  },
  benefitValue: {
    fontSize: 32,
    fontWeight: '700',
    color: DISPATCHER_THEME.success,
  },
  benefitLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  benefitChange: {
    fontSize: 12,
    color: DISPATCHER_THEME.success,
    marginTop: 2,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  compareRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  compareCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: '#d9d9d9',
  },
  compareCardAfter: {
    borderColor: DISPATCHER_THEME.primary,
    backgroundColor: '#f9f5ff',
  },
  compareCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  compareCardDot: {
    fontSize: 12,
    color: '#999',
  },
  compareCardCheck: {
    fontSize: 12,
    color: DISPATCHER_THEME.primary,
  },
  compareCardLabel: {
    fontSize: 12,
    color: '#999',
  },
  compareWorkshop: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  compareCount: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  compareSuffix: {
    fontSize: 14,
    color: '#999',
  },
  adjustmentCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  adjustmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  adjustmentTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  adjustmentCount: {
    backgroundColor: DISPATCHER_THEME.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  adjustmentCountText: {
    fontSize: 12,
    color: '#fff',
  },
  adjustmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  adjustmentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustmentAvatarText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  adjustmentInfo: {
    flex: 1,
  },
  adjustmentName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  adjustmentSkill: {
    fontSize: 12,
    color: '#999',
  },
  adjustmentSkillLevel: {
    color: DISPATCHER_THEME.primary,
    fontWeight: '500',
  },
  adjustmentArrow: {
    alignItems: 'center',
    gap: 4,
  },
  adjustmentFrom: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  adjustmentArrowIcon: {
    fontSize: 18,
    color: DISPATCHER_THEME.primary,
  },
  adjustmentTo: {
    fontSize: 13,
    color: DISPATCHER_THEME.primary,
    fontWeight: '500',
  },
  distributionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  distributionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 16,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  distributionLabel: {
    width: 70,
    fontSize: 13,
    color: '#666',
  },
  distributionBars: {
    flex: 1,
    gap: 4,
  },
  distributionBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distributionBar: {
    height: 16,
    borderRadius: 4,
  },
  distributionBarBefore: {
    backgroundColor: '#d9d9d9',
  },
  distributionValue: {
    fontSize: 12,
    color: '#666',
    minWidth: 30,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendDotBefore: {
    backgroundColor: '#d9d9d9',
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  explanationCard: {
    backgroundColor: '#f9f5ff',
    borderWidth: 1,
    borderColor: '#d3adf7',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  explanationIcon: {
    fontSize: 24,
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: DISPATCHER_THEME.primary,
  },
  explanationContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  explanationHighlight: {
    color: DISPATCHER_THEME.primary,
    fontWeight: '600',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    paddingBottom: 34,
  },
  actionButtonSecondary: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonSecondaryText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  actionButtonPrimary: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionButtonPrimaryText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },
});
