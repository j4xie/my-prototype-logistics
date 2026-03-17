/**
 * SmartBI - Financial Ratios Analysis Screen
 *
 * Displays four categories of financial ratios (Profitability, Liquidity,
 * Efficiency, Leverage) with benchmark comparisons, progress bars,
 * and status indicators. Expandable category sections.
 *
 * @version 2.0.0
 * @since 2026-03-15
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Modal,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Text, Card, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslation } from 'react-i18next';
import { smartBIApiClient } from '../../services/api/smartbi';
import { useAuthStore } from '../../store/authStore';
import type { SmartBIStackParamList } from '../../types/smartbi';

type MaterialCommunityIconName = keyof typeof MaterialCommunityIcons.glyphMap;

// Enable layout animation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SMARTBI_THEME = {
  primary: '#4F46E5',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  background: '#F5F7FA',
  cardBackground: '#FFFFFF',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
};

interface FinancialRatio {
  name: string;
  value: number;
  unit: string;
  benchmark: number;
  status: 'good' | 'warning' | 'danger';
  description: string;
}

interface RatioCategory {
  title: string;
  icon: MaterialCommunityIconName;
  color: string;
  ratios: FinancialRatio[];
}

const DEMO_CATEGORIES: RatioCategory[] = [
  {
    title: '盈利能力',
    icon: 'trending-up',
    color: '#10B981',
    ratios: [
      { name: 'ROE (净资产收益率)', value: 15.8, unit: '%', benchmark: 12.0, status: 'good', description: '每单位净资产创造的净利润' },
      { name: 'ROA (总资产收益率)', value: 8.2, unit: '%', benchmark: 6.5, status: 'good', description: '每单位总资产创造的净利润' },
      { name: '毛利率', value: 35.6, unit: '%', benchmark: 30.0, status: 'good', description: '销售毛利占销售收入的比率' },
      { name: '净利率', value: 12.3, unit: '%', benchmark: 8.0, status: 'good', description: '净利润占销售收入的比率' },
    ],
  },
  {
    title: '流动性',
    icon: 'water',
    color: '#3B82F6',
    ratios: [
      { name: '流动比率', value: 1.85, unit: '', benchmark: 2.0, status: 'warning', description: '流动资产 / 流动负债' },
      { name: '速动比率', value: 1.2, unit: '', benchmark: 1.0, status: 'good', description: '(流动资产 - 存货) / 流动负债' },
      { name: '现金比率', value: 0.65, unit: '', benchmark: 0.5, status: 'good', description: '现金及等价物 / 流动负债' },
    ],
  },
  {
    title: '运营效率',
    icon: 'cog-sync',
    color: '#F59E0B',
    ratios: [
      { name: '存货周转率', value: 8.5, unit: '次', benchmark: 6.0, status: 'good', description: '年销售成本 / 平均存货' },
      { name: '应收账款周转率', value: 12.3, unit: '次', benchmark: 10.0, status: 'good', description: '年销售收入 / 平均应收账款' },
      { name: '总资产周转率', value: 1.5, unit: '次', benchmark: 1.2, status: 'good', description: '年销售收入 / 平均总资产' },
    ],
  },
  {
    title: '偿债能力',
    icon: 'shield-account',
    color: '#EF4444',
    ratios: [
      { name: '资产负债率', value: 42.5, unit: '%', benchmark: 50.0, status: 'good', description: '总负债 / 总资产（越低越好）' },
      { name: '利息保障倍数', value: 5.8, unit: '倍', benchmark: 3.0, status: 'good', description: 'EBIT / 利息支出' },
      { name: '权益乘数', value: 1.74, unit: '', benchmark: 2.0, status: 'good', description: '总资产 / 净资产' },
    ],
  },
];

const DATE_RANGE_OPTIONS = [
  { labelKey: 'dateRange.last7days', days: 7 },
  { labelKey: 'dateRange.last30days', days: 30 },
  { labelKey: 'dateRange.thisQuarter', days: 90 },
  { labelKey: 'dateRange.thisYear', days: 365 },
];

// Map backend ratios data into local RatioCategory shape
function mapBackendRatios(apiData: Record<string, unknown>): RatioCategory[] | null {
  // If backend returns named ratio objects, try to map them
  const ratios = apiData?.ratios;
  if (!ratios || typeof ratios !== 'object') return null;

  // Simple: if there's at least one recognizable ratio key, map to demo categories
  // but replace values from the API response
  const r = ratios as Record<string, number>;
  if (Object.keys(r).length === 0) return null;

  return DEMO_CATEGORIES.map((cat) => ({
    ...cat,
    ratios: cat.ratios.map((ratio) => {
      // Try snake_case and camelCase lookups
      const key = ratio.name.toLowerCase().replace(/[^a-z]/g, '');
      const found = Object.entries(r).find(([k]) => k.toLowerCase().replace(/[^a-z]/g, '').includes(key.slice(0, 4)));
      if (found) {
        const newVal = found[1];
        const status: FinancialRatio['status'] =
          Math.abs(newVal - ratio.benchmark) / ratio.benchmark < 0.1
            ? 'good'
            : Math.abs(newVal - ratio.benchmark) / ratio.benchmark < 0.25
            ? 'warning'
            : 'danger';
        return { ...ratio, value: newVal, status };
      }
      return ratio;
    }),
  }));
}

// Status badge colors (labels translated at render time)
const statusConfig: Record<FinancialRatio['status'], { color: string; labelKey: string }> = {
  good: { color: '#10B981', labelKey: 'ratios.status.good' },
  warning: { color: '#F59E0B', labelKey: 'ratios.status.warning' },
  danger: { color: '#EF4444', labelKey: 'ratios.status.danger' },
};

// Single ratio row
interface RatioRowProps {
  ratio: FinancialRatio;
  accentColor: string;
}

const RatioRow: React.FC<RatioRowProps> = ({ ratio, accentColor }) => {
  const { t } = useTranslation('smartbi');
  const sc = statusConfig[ratio.status];
  // For bar: show how ratio compares to benchmark.
  // Width = (value / (benchmark * 1.5)) capped at 100%
  const barMax = ratio.benchmark * 1.6 || 1;
  const barPct = Math.min((ratio.value / barMax) * 100, 100);
  const benchmarkPct = Math.min((ratio.benchmark / barMax) * 100, 100);

  return (
    <View style={styles.ratioRow}>
      <View style={styles.ratioHeader}>
        <Text style={styles.ratioName}>{ratio.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: sc.color + '20' }]}>
          <Text style={[styles.statusText, { color: sc.color }]}>{t(sc.labelKey)}</Text>
        </View>
      </View>
      <Text style={styles.ratioDescription}>{ratio.description}</Text>
      {/* Progress bar with benchmark marker */}
      <View style={styles.barWrapper}>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${barPct}%`, backgroundColor: accentColor }]} />
          {/* Benchmark marker */}
          <View style={[styles.benchmarkMarker, { left: `${benchmarkPct}%` }]} />
        </View>
        <View style={styles.barLabels}>
          <Text style={[styles.ratioCurrentVal, { color: accentColor }]}>
            {ratio.value.toFixed(ratio.unit === '%' ? 1 : ratio.unit === '倍' || ratio.unit === '次' ? 1 : 2)}{ratio.unit}
          </Text>
          <Text style={styles.benchmarkLabel}>{t('ratios.benchmark_label', { value: ratio.benchmark, unit: ratio.unit })}</Text>
        </View>
      </View>
    </View>
  );
};

// Expandable category section
interface CategorySectionProps {
  category: RatioCategory;
  isExpanded: boolean;
  onToggle: () => void;
}

const CATEGORY_TITLE_KEYS: Record<string, string> = {
  '盈利能力': 'ratios.categories.profitability',
  '流动性': 'ratios.categories.liquidity',
  '运营效率': 'ratios.categories.efficiency',
  '偿债能力': 'ratios.categories.leverage',
};

const CategorySection: React.FC<CategorySectionProps> = ({ category, isExpanded, onToggle }) => {
  const { t } = useTranslation('smartbi');
  const goodCount = category.ratios.filter((r) => r.status === 'good').length;
  const warningCount = category.ratios.filter((r) => r.status === 'warning').length;
  const dangerCount = category.ratios.filter((r) => r.status === 'danger').length;

  return (
    <Card style={[styles.categoryCard, { borderLeftWidth: 4, borderLeftColor: category.color }]}>
      {/* Category header */}
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={styles.categoryHeader}>
        <View style={[styles.categoryIconWrap, { backgroundColor: category.color + '20' }]}>
          <MaterialCommunityIcons name={category.icon} size={20} color={category.color} />
        </View>
        <View style={styles.categoryTitleBlock}>
          <Text style={styles.categoryTitle}>{t(CATEGORY_TITLE_KEYS[category.title] ?? category.title, { defaultValue: category.title })}</Text>
          <View style={styles.categoryStatusRow}>
            {goodCount > 0 && (
              <View style={[styles.miniStatusBadge, { backgroundColor: '#10B98120' }]}>
                <Text style={[styles.miniStatusText, { color: '#10B981' }]}>{goodCount}{t('ratios.status.good')}</Text>
              </View>
            )}
            {warningCount > 0 && (
              <View style={[styles.miniStatusBadge, { backgroundColor: '#F59E0B20' }]}>
                <Text style={[styles.miniStatusText, { color: '#F59E0B' }]}>{warningCount}{t('ratios.status.warning')}</Text>
              </View>
            )}
            {dangerCount > 0 && (
              <View style={[styles.miniStatusBadge, { backgroundColor: '#EF444420' }]}>
                <Text style={[styles.miniStatusText, { color: '#EF4444' }]}>{dangerCount}{t('ratios.status.danger')}</Text>
              </View>
            )}
          </View>
        </View>
        <MaterialCommunityIcons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={SMARTBI_THEME.textMuted}
        />
      </TouchableOpacity>

      {/* Expanded ratios */}
      {isExpanded && (
        <View style={styles.ratiosContainer}>
          <Divider />
          {category.ratios.map((ratio, idx) => (
            <React.Fragment key={ratio.name}>
              <RatioRow ratio={ratio} accentColor={category.color} />
              {idx < category.ratios.length - 1 && <Divider style={styles.innerDivider} />}
            </React.Fragment>
          ))}
        </View>
      )}
    </Card>
  );
};

export function FinancialRatiosScreen() {
  const { t } = useTranslation('smartbi');
  const navigation = useNavigation<NativeStackNavigationProp<SmartBIStackParamList>>();
  const { getFactoryId } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<RatioCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set([0]));
  const [usingDemo, setUsingDemo] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      startDate: start.toISOString().split('T')[0] ?? '',
      endDate: end.toISOString().split('T')[0] ?? '',
    };
  });

  const loadData = useCallback(async () => {
    try {
      const factoryId = getFactoryId();
      const response = await smartBIApiClient.getFinancialRatios({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        factoryId: factoryId ?? undefined,
      });

      const apiData = response.success && response.data
        ? (response.data as Record<string, unknown>)
        : null;

      const mapped = apiData ? mapBackendRatios(apiData) : null;
      if (mapped) {
        setCategories(mapped);
        setUsingDemo(false);
      } else {
        setCategories(DEMO_CATEGORIES);
        setUsingDemo(true);
      }
    } catch (err) {
      console.error('Load financial ratios failed:', err);
      setCategories(DEMO_CATEGORIES);
      setUsingDemo(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, getFactoryId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const toggleCategory = (idx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleDateSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateRange({
      startDate: start.toISOString().split('T')[0] ?? '',
      endDate: end.toISOString().split('T')[0] ?? '',
    });
    setShowDatePicker(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('ratios.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={SMARTBI_THEME.primary} />
          <Text style={styles.loadingText}>{t('loading', { ns: 'common', defaultValue: '加载中...' })}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Overall health summary
  const allRatios = categories.flatMap((c) => c.ratios);
  const overallGood = allRatios.filter((r) => r.status === 'good').length;
  const overallWarning = allRatios.filter((r) => r.status === 'warning').length;
  const overallDanger = allRatios.filter((r) => r.status === 'danger').length;
  const healthScore = Math.round((overallGood / (allRatios.length || 1)) * 100);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('ratios.title')}</Text>
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.backButton}>
          <MaterialCommunityIcons name="calendar" size={22} color={SMARTBI_THEME.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[SMARTBI_THEME.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Date selector */}
        <TouchableOpacity style={styles.dateRangeDisplay} onPress={() => setShowDatePicker(true)}>
          <MaterialCommunityIcons name="calendar-range" size={18} color={SMARTBI_THEME.primary} />
          <Text style={styles.dateRangeText}>{dateRange.startDate} ~ {dateRange.endDate}</Text>
          <MaterialCommunityIcons name="chevron-down" size={18} color={SMARTBI_THEME.textSecondary} />
        </TouchableOpacity>

        {/* Demo data banner */}
        {usingDemo && (
          <View style={styles.infoBanner}>
            <MaterialCommunityIcons name="information-outline" size={16} color={SMARTBI_THEME.info} />
            <Text style={styles.infoBannerText}>{t('ratios.demo_data_message')}</Text>
          </View>
        )}

        {/* Health summary card */}
        <Card style={styles.healthCard}>
          <Card.Content>
            <View style={styles.healthRow}>
              <View style={styles.healthScoreWrap}>
                <Text style={[styles.healthScore, { color: healthScore >= 70 ? SMARTBI_THEME.success : healthScore >= 50 ? SMARTBI_THEME.warning : SMARTBI_THEME.danger }]}>
                  {healthScore}
                </Text>
                <Text style={styles.healthScoreLabel}>{t('ratios.health_score')}</Text>
              </View>
              <View style={styles.healthStats}>
                <View style={styles.healthStat}>
                  <MaterialCommunityIcons name="check-circle" size={16} color={SMARTBI_THEME.success} />
                  <Text style={[styles.healthStatValue, { color: SMARTBI_THEME.success }]}>{overallGood}</Text>
                  <Text style={styles.healthStatLabel}>{t('ratios.status.good')}</Text>
                </View>
                <View style={styles.healthStat}>
                  <MaterialCommunityIcons name="alert-circle" size={16} color={SMARTBI_THEME.warning} />
                  <Text style={[styles.healthStatValue, { color: SMARTBI_THEME.warning }]}>{overallWarning}</Text>
                  <Text style={styles.healthStatLabel}>{t('ratios.status.warning')}</Text>
                </View>
                <View style={styles.healthStat}>
                  <MaterialCommunityIcons name="close-circle" size={16} color={SMARTBI_THEME.danger} />
                  <Text style={[styles.healthStatValue, { color: SMARTBI_THEME.danger }]}>{overallDanger}</Text>
                  <Text style={styles.healthStatLabel}>{t('ratios.status.danger')}</Text>
                </View>
                <View style={styles.healthStat}>
                  <MaterialCommunityIcons name="chart-pie" size={16} color={SMARTBI_THEME.info} />
                  <Text style={[styles.healthStatValue, { color: SMARTBI_THEME.info }]}>{allRatios.length}</Text>
                  <Text style={styles.healthStatLabel}>{t('ratios.total_metrics')}</Text>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Category sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ratios.detail_section')}</Text>
          <Text style={styles.sectionHint}>{t('ratios.expand_hint')}</Text>
          {categories.map((cat, idx) => (
            <View key={cat.title} style={styles.categoryWrapper}>
              <CategorySection
                category={cat}
                isExpanded={expandedCategories.has(idx)}
                onToggle={() => toggleCategory(idx)}
              />
            </View>
          ))}
        </View>

        {/* Legend */}
        <Card style={styles.legendCard}>
          <Card.Content>
            <Text style={styles.legendTitle}>{t('ratios.legend_title')}</Text>
            <View style={styles.legendRow}>
              <View style={styles.benchmarkMarkerLegend} />
              <Text style={styles.legendText}>{t('ratios.benchmark_line')}</Text>
              <MaterialCommunityIcons name="check-circle" size={14} color={SMARTBI_THEME.success} style={{ marginLeft: 16 }} />
              <Text style={styles.legendText}>{t('ratios.status.good_above')}</Text>
            </View>
            <View style={styles.legendRow}>
              <MaterialCommunityIcons name="alert-circle" size={14} color={SMARTBI_THEME.warning} />
              <Text style={styles.legendText}>{t('ratios.status.warning_near')}</Text>
              <MaterialCommunityIcons name="close-circle" size={14} color={SMARTBI_THEME.danger} style={{ marginLeft: 16 }} />
              <Text style={styles.legendText}>{t('ratios.status.danger_below')}</Text>
            </View>
          </Card.Content>
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('dateRange.selectRange', { ns: 'common', defaultValue: '选择日期范围' })}</Text>
            {DATE_RANGE_OPTIONS.map((opt) => (
              <TouchableOpacity key={opt.days} style={styles.modalOption} onPress={() => handleDateSelect(opt.days)}>
                <Text style={styles.modalOptionText}>{t(opt.labelKey, { ns: 'common', defaultValue: opt.labelKey })}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={SMARTBI_THEME.textMuted} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.modalCancelText}>{t('cancel', { ns: 'common', defaultValue: '取消' })}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SMARTBI_THEME.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SMARTBI_THEME.border,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: SMARTBI_THEME.textPrimary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: SMARTBI_THEME.textSecondary },
  content: { flex: 1, padding: 16 },
  dateRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SMARTBI_THEME.cardBackground,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  dateRangeText: { fontSize: 14, color: SMARTBI_THEME.textPrimary },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  infoBannerText: { flex: 1, fontSize: 12, color: SMARTBI_THEME.info },
  healthCard: { borderRadius: 12, backgroundColor: SMARTBI_THEME.cardBackground, marginBottom: 16 },
  healthRow: { flexDirection: 'row', alignItems: 'center' },
  healthScoreWrap: { alignItems: 'center', marginRight: 24 },
  healthScore: { fontSize: 48, fontWeight: '800' },
  healthScoreLabel: { fontSize: 12, color: SMARTBI_THEME.textSecondary, marginTop: 2 },
  healthStats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  healthStat: { alignItems: 'center', gap: 2 },
  healthStatValue: { fontSize: 18, fontWeight: '700' },
  healthStatLabel: { fontSize: 11, color: SMARTBI_THEME.textSecondary },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: SMARTBI_THEME.textPrimary, marginBottom: 4 },
  sectionHint: { fontSize: 12, color: SMARTBI_THEME.textMuted, marginBottom: 12 },
  categoryWrapper: { marginBottom: 12 },
  categoryCard: { borderRadius: 12, backgroundColor: SMARTBI_THEME.cardBackground, overflow: 'hidden' },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  categoryIconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  categoryTitleBlock: { flex: 1 },
  categoryTitle: { fontSize: 15, fontWeight: '600', color: SMARTBI_THEME.textPrimary },
  categoryStatusRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  miniStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  miniStatusText: { fontSize: 11, fontWeight: '500' },
  ratiosContainer: { paddingHorizontal: 14, paddingBottom: 8 },
  ratioRow: { paddingVertical: 12 },
  ratioHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ratioName: { fontSize: 14, fontWeight: '600', color: SMARTBI_THEME.textPrimary, flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '600' },
  ratioDescription: { fontSize: 12, color: SMARTBI_THEME.textMuted, marginBottom: 8 },
  barWrapper: { },
  barTrack: {
    height: 10,
    backgroundColor: SMARTBI_THEME.border,
    borderRadius: 5,
    overflow: 'visible',
    position: 'relative',
  },
  barFill: { height: '100%', borderRadius: 5 },
  benchmarkMarker: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 16,
    backgroundColor: '#374151',
    borderRadius: 1,
    marginLeft: -1,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  ratioCurrentVal: { fontSize: 13, fontWeight: '700' },
  benchmarkLabel: { fontSize: 11, color: SMARTBI_THEME.textMuted },
  innerDivider: { marginHorizontal: 0, marginVertical: 0 },
  legendCard: { borderRadius: 12, backgroundColor: SMARTBI_THEME.cardBackground, marginBottom: 16 },
  legendTitle: { fontSize: 13, fontWeight: '600', color: SMARTBI_THEME.textSecondary, marginBottom: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  legendText: { fontSize: 12, color: SMARTBI_THEME.textSecondary },
  benchmarkMarkerLegend: { width: 2, height: 14, backgroundColor: '#374151', borderRadius: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: SMARTBI_THEME.textPrimary, textAlign: 'center', marginBottom: 16 },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SMARTBI_THEME.border,
  },
  modalOptionText: { fontSize: 16, color: SMARTBI_THEME.textPrimary },
  modalCancel: { marginTop: 16, paddingVertical: 14, backgroundColor: SMARTBI_THEME.background, borderRadius: 8, alignItems: 'center' },
  modalCancelText: { fontSize: 16, color: SMARTBI_THEME.textSecondary },
});

export default FinancialRatiosScreen;
