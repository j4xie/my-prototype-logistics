/**
 * SmartBI - Customer RFM Analysis Screen
 *
 * Displays RFM (Recency, Frequency, Monetary) customer segmentation
 * with segment distribution cards, detailed R/F/M scores, and
 * marketing recommendations for each segment.
 *
 * @version 2.0.0
 * @since 2026-03-15
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Text, Card, Surface, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslation } from 'react-i18next';
import { smartBIApiClient } from '../../services/api/smartbi';
import { useAuthStore } from '../../store/authStore';
import type { SmartBIStackParamList } from '../../types/smartbi';

type MaterialCommunityIconName = keyof typeof MaterialCommunityIcons.glyphMap;

const { width: screenWidth } = Dimensions.get('window');

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

interface RFMSegment {
  name: string;
  nameEn: string;
  count: number;
  percentage: number;
  avgRecency: number;
  avgFrequency: number;
  avgMonetary: number;
  color: string;
  icon: MaterialCommunityIconName;
  suggestion: string;
}

const DEMO_SEGMENTS: RFMSegment[] = [
  {
    name: '高价值客户',
    nameEn: 'Champions',
    count: 45,
    percentage: 18,
    avgRecency: 5,
    avgFrequency: 12,
    avgMonetary: 85000,
    color: '#10B981',
    icon: 'crown',
    suggestion: '维护关系，提供VIP专属优惠',
  },
  {
    name: '忠实客户',
    nameEn: 'Loyal',
    count: 68,
    percentage: 27,
    avgRecency: 15,
    avgFrequency: 8,
    avgMonetary: 52000,
    color: '#3B82F6',
    icon: 'account-heart',
    suggestion: '交叉销售，提升客单价',
  },
  {
    name: '潜力客户',
    nameEn: 'Potential',
    count: 52,
    percentage: 21,
    avgRecency: 25,
    avgFrequency: 4,
    avgMonetary: 35000,
    color: '#F59E0B',
    icon: 'trending-up',
    suggestion: '引导复购，培养忠诚度',
  },
  {
    name: '风险客户',
    nameEn: 'At Risk',
    count: 35,
    percentage: 14,
    avgRecency: 60,
    avgFrequency: 6,
    avgMonetary: 48000,
    color: '#EF4444',
    icon: 'alert',
    suggestion: '立即挽回，发送专属优惠券',
  },
  {
    name: '沉睡客户',
    nameEn: 'Hibernating',
    count: 30,
    percentage: 12,
    avgRecency: 90,
    avgFrequency: 2,
    avgMonetary: 18000,
    color: '#8B5CF6',
    icon: 'sleep',
    suggestion: '激活唤醒，推送新品信息',
  },
  {
    name: '流失客户',
    nameEn: 'Lost',
    count: 20,
    percentage: 8,
    avgRecency: 180,
    avgFrequency: 1,
    avgMonetary: 8000,
    color: '#6B7280',
    icon: 'account-off',
    suggestion: '分析流失原因，低成本触达',
  },
];

function formatMonetary(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return value.toLocaleString();
}

// Segment summary card (top grid)
interface SegmentCardProps {
  segment: RFMSegment;
  onPress: () => void;
  isSelected: boolean;
}

const SegmentCard: React.FC<SegmentCardProps> = ({ segment, onPress, isSelected }) => {
  const { t } = useTranslation('smartbi');
  return (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.segmentCard,
      isSelected && { borderColor: segment.color, borderWidth: 2 },
    ]}
    activeOpacity={0.8}
  >
    <Surface style={[styles.segmentCardInner, { backgroundColor: segment.color + '12' }]} elevation={0}>
      <View style={[styles.segmentIconWrap, { backgroundColor: segment.color + '25' }]}>
        <MaterialCommunityIcons name={segment.icon} size={20} color={segment.color} />
      </View>
      <Text style={[styles.segmentName, { color: segment.color }]}>{segment.name}</Text>
      <Text style={styles.segmentCount}>{segment.count}{t('units.people', { ns: 'common', defaultValue: '人' })}</Text>
      <View style={styles.segmentPctRow}>
        <View style={[styles.segmentPctBar, { backgroundColor: SMARTBI_THEME.border }]}>
          <View style={[styles.segmentPctFill, { width: `${segment.percentage}%`, backgroundColor: segment.color }]} />
        </View>
        <Text style={[styles.segmentPct, { color: segment.color }]}>{segment.percentage}%</Text>
      </View>
    </Surface>
  </TouchableOpacity>
  );
};

// RFM score bar
interface ScoreBarProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  unit?: string;
}

const ScoreBar: React.FC<ScoreBarProps> = ({ label, value, maxValue, color, unit }) => {
  const pct = Math.min((value / maxValue) * 100, 100);
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.scoreBarWrap}>
        <View style={[styles.scoreBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.scoreValue}>
        {value}{unit ?? ''}
      </Text>
    </View>
  );
};

export function CustomerRFMScreen() {
  const { t } = useTranslation('smartbi');
  const navigation = useNavigation<NativeStackNavigationProp<SmartBIStackParamList>>();
  const { getFactoryId } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [segments, setSegments] = useState<RFMSegment[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [usingDemo, setUsingDemo] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const factoryId = getFactoryId();
      const response = await smartBIApiClient.getRFMAnalysis(factoryId ?? undefined);

      // Try to map backend RFM data; fall back to demo if not present
      const rfmData = response.success && response.data?.segments;
      if (rfmData && Array.isArray(rfmData) && rfmData.length > 0) {
        // Map backend segment shape to local RFMSegment
        const mapped: RFMSegment[] = rfmData.map((s: Record<string, unknown>, idx: number) => ({
          name: (s.segment ?? s.name ?? `分群 ${idx + 1}`) as string,
          nameEn: (s.nameEn ?? '') as string,
          count: Number(s.count ?? 0),
          percentage: Number(s.percentage ?? 0),
          avgRecency: Number(s.avgRecency ?? 0),
          avgFrequency: Number(s.avgFrequency ?? 0),
          avgMonetary: Number(s.avgMonetary ?? s.avgValue ?? 0),
          color: DEMO_SEGMENTS[idx % DEMO_SEGMENTS.length]?.color ?? SMARTBI_THEME.primary,
          icon: DEMO_SEGMENTS[idx % DEMO_SEGMENTS.length]?.icon ?? 'account',
          suggestion: (s.strategy ?? s.suggestion ?? '制定针对性营销策略') as string,
        }));
        setSegments(mapped);
        setUsingDemo(false);
      } else {
        setSegments(DEMO_SEGMENTS);
        setUsingDemo(true);
      }
    } catch (err) {
      console.error('Load RFM data failed:', err);
      setSegments(DEMO_SEGMENTS);
      setUsingDemo(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getFactoryId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('rfm.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={SMARTBI_THEME.primary} />
          <Text style={styles.loadingText}>{t('loading', { ns: 'common', defaultValue: '加载中...' })}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalCustomers = segments.reduce((acc, s) => acc + s.count, 0);
  const selected = segments[selectedIndex] ?? segments[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('rfm.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[SMARTBI_THEME.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Demo data banner */}
        {usingDemo && (
          <View style={styles.infoBanner}>
            <MaterialCommunityIcons name="information-outline" size={16} color={SMARTBI_THEME.info} />
            <Text style={styles.infoBannerText}>{t('rfm.demo_data_message')}</Text>
          </View>
        )}

        {/* Summary row */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{totalCustomers}</Text>
                <Text style={styles.summaryLabel}>{t('rfm.total_customers')}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{segments.length}</Text>
                <Text style={styles.summaryLabel}>{t('rfm.segments_count')}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: SMARTBI_THEME.success }]}>
                  {segments[0] ? `${segments[0].percentage}%` : '-'}
                </Text>
                <Text style={styles.summaryLabel}>{t('rfm.high_value_ratio')}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Segment grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('rfm.segments_distribution')}</Text>
          <Text style={styles.sectionHint}>{t('rfm.tap_segment_hint')}</Text>
          <View style={styles.segmentGrid}>
            {segments.map((seg, idx) => (
              <SegmentCard
                key={seg.nameEn}
                segment={seg}
                isSelected={selectedIndex === idx}
                onPress={() => setSelectedIndex(idx)}
              />
            ))}
          </View>
        </View>

        {/* Selected segment detail */}
        {selected && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('rfm.segment_detail', { name: selected.name })}
            </Text>
            <Card style={[styles.detailCard, { borderLeftWidth: 4, borderLeftColor: selected.color }]}>
              <Card.Content>
                {/* R/F/M bars */}
                <Text style={styles.detailSubtitle}>{t('rfm.rfm_score')}</Text>
                <ScoreBar
                  label={t('rfm.recency_label')}
                  value={selected.avgRecency}
                  maxValue={200}
                  color={selected.color}
                  unit="天"
                />
                <ScoreBar
                  label={t('rfm.frequency_label')}
                  value={selected.avgFrequency}
                  maxValue={20}
                  color={selected.color}
                  unit="次"
                />
                <ScoreBar
                  label={t('rfm.monetary_label')}
                  value={selected.avgMonetary}
                  maxValue={100000}
                  color={selected.color}
                />
                <Divider style={styles.divider} />
                {/* Average monetary */}
                <View style={styles.monetaryRow}>
                  <Text style={styles.monetaryLabel}>{t('rfm.avg_customer_value')}</Text>
                  <Text style={[styles.monetaryValue, { color: selected.color }]}>
                    ¥{formatMonetary(selected.avgMonetary)}
                  </Text>
                </View>
                <Divider style={styles.divider} />
                {/* Marketing suggestion */}
                <View style={styles.suggestionRow}>
                  <View style={[styles.suggestionIcon, { backgroundColor: selected.color + '20' }]}>
                    <MaterialCommunityIcons name="bullhorn-outline" size={16} color={selected.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionTitle}>{t('rfm.marketing_suggestion')}</Text>
                    <Text style={styles.suggestionText}>{selected.suggestion}</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          </View>
        )}

        {/* All segments quick suggestion list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('rfm.all_segments_strategies')}</Text>
          <Card style={styles.card}>
            {segments.map((seg, idx) => (
              <React.Fragment key={seg.nameEn}>
                <TouchableOpacity
                  style={styles.strategyRow}
                  onPress={() => setSelectedIndex(idx)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.strategyDot, { backgroundColor: seg.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.strategyName}>{seg.name}  <Text style={styles.strategyCount}>({seg.count}{t('units.people', { ns: 'common', defaultValue: '人' })})</Text></Text>
                    <Text style={styles.strategyText} numberOfLines={1}>{seg.suggestion}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={SMARTBI_THEME.textMuted} />
                </TouchableOpacity>
                {idx < segments.length - 1 && <Divider style={styles.divider} />}
              </React.Fragment>
            ))}
          </Card>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  summaryCard: { borderRadius: 12, backgroundColor: SMARTBI_THEME.cardBackground, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '700', color: SMARTBI_THEME.textPrimary },
  summaryLabel: { fontSize: 12, color: SMARTBI_THEME.textSecondary, marginTop: 4 },
  summaryDivider: { width: 1, backgroundColor: SMARTBI_THEME.border },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: SMARTBI_THEME.textPrimary, marginBottom: 4 },
  sectionHint: { fontSize: 12, color: SMARTBI_THEME.textMuted, marginBottom: 12 },
  segmentGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  segmentCard: {
    width: (screenWidth - 32 - 20) / 3,
    marginHorizontal: 3.3,
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  segmentCardInner: { padding: 10, alignItems: 'center', borderRadius: 8 },
  segmentIconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  segmentName: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  segmentCount: { fontSize: 13, fontWeight: '700', color: SMARTBI_THEME.textPrimary },
  segmentPctRow: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '100%', marginTop: 6 },
  segmentPctBar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  segmentPctFill: { height: '100%', borderRadius: 2 },
  segmentPct: { fontSize: 11, fontWeight: '600', minWidth: 28, textAlign: 'right' },
  detailCard: { borderRadius: 12, backgroundColor: SMARTBI_THEME.cardBackground, overflow: 'hidden' },
  detailSubtitle: { fontSize: 13, fontWeight: '600', color: SMARTBI_THEME.textSecondary, marginBottom: 12 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  scoreLabel: { fontSize: 12, color: SMARTBI_THEME.textSecondary, width: 64 },
  scoreBarWrap: { flex: 1, height: 8, backgroundColor: SMARTBI_THEME.border, borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
  scoreBarFill: { height: '100%', borderRadius: 4 },
  scoreValue: { fontSize: 12, color: SMARTBI_THEME.textPrimary, fontWeight: '600', minWidth: 44, textAlign: 'right' },
  monetaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  monetaryLabel: { fontSize: 14, color: SMARTBI_THEME.textSecondary },
  monetaryValue: { fontSize: 16, fontWeight: '700' },
  suggestionRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingTop: 10 },
  suggestionIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  suggestionTitle: { fontSize: 12, fontWeight: '600', color: SMARTBI_THEME.textSecondary, marginBottom: 2 },
  suggestionText: { fontSize: 13, color: SMARTBI_THEME.textPrimary, lineHeight: 18 },
  card: { borderRadius: 12, backgroundColor: SMARTBI_THEME.cardBackground },
  strategyRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  strategyDot: { width: 10, height: 10, borderRadius: 5 },
  strategyName: { fontSize: 14, fontWeight: '600', color: SMARTBI_THEME.textPrimary },
  strategyCount: { fontSize: 12, color: SMARTBI_THEME.textMuted, fontWeight: '400' },
  strategyText: { fontSize: 12, color: SMARTBI_THEME.textSecondary, marginTop: 2 },
  divider: { marginHorizontal: 0 },
});

export default CustomerRFMScreen;
