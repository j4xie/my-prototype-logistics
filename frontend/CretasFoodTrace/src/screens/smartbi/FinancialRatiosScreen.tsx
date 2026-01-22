/**
 * SmartBI - Financial Ratios Analysis Screen
 *
 * Placeholder screen for comprehensive financial ratio analysis.
 * Will provide key financial metrics and benchmarking.
 *
 * Planned Features:
 * - Profitability ratios (ROE, ROA, Gross Margin)
 * - Liquidity ratios (Current, Quick, Cash)
 * - Efficiency ratios (Turnover ratios)
 * - Leverage ratios (Debt ratio, Interest coverage)
 *
 * @version 1.0.0
 * @since 2026-01-22
 */

import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Text, Card, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { SmartBIStackParamList } from '../../types/smartbi';

// Theme colors for SmartBI
const SMARTBI_THEME = {
  primary: '#4F46E5',
  secondary: '#10B981',
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

// Feature list for coming soon display
const PLANNED_FEATURES = [
  { icon: 'percent', label: '盈利能力分析' },
  { icon: 'water-percent', label: '流动性分析' },
  { icon: 'rotate-3d-variant', label: '运营效率分析' },
  { icon: 'scale-balance', label: '偿债能力分析' },
];

export function FinancialRatiosScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SmartBIStackParamList>>();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>财务比率分析</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Coming Soon Card */}
        <Card style={styles.comingSoonCard}>
          <Card.Content style={styles.comingSoonContent}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name="chart-box"
                size={80}
                color={SMARTBI_THEME.warning}
              />
            </View>
            <Text style={styles.comingSoonTitle}>财务比率分析</Text>
            <Text style={styles.comingSoonSubtitle}>
              功能开发中，敬请期待
            </Text>
            <Text style={styles.comingSoonDescription}>
              通过关键财务比率深度分析企业盈利能力、流动性、运营效率和偿债能力，提供行业对标和改进建议
            </Text>
          </Card.Content>
        </Card>

        {/* Planned Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>即将推出的功能</Text>
          <View style={styles.featuresGrid}>
            {PLANNED_FEATURES.map((feature, index) => (
              <Surface key={index} style={styles.featureItem} elevation={1}>
                <View style={styles.featureIconContainer}>
                  <MaterialCommunityIcons
                    name={feature.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                    size={28}
                    color={SMARTBI_THEME.warning}
                  />
                </View>
                <Text style={styles.featureLabel}>{feature.label}</Text>
              </Surface>
            ))}
          </View>
        </View>

        {/* Ratio Categories Preview */}
        <View style={styles.ratioPreviewSection}>
          <Text style={styles.sectionTitle}>财务比率指标预览</Text>
          <Card style={styles.ratioCard}>
            <Card.Content>
              <View style={styles.ratioCategory}>
                <View style={styles.ratioCategoryHeader}>
                  <MaterialCommunityIcons name="trending-up" size={20} color={SMARTBI_THEME.success} />
                  <Text style={styles.ratioCategoryTitle}>盈利能力</Text>
                </View>
                <Text style={styles.ratioCategoryItems}>ROE / ROA / 毛利率 / 净利率</Text>
              </View>
              <View style={styles.ratioDivider} />
              <View style={styles.ratioCategory}>
                <View style={styles.ratioCategoryHeader}>
                  <MaterialCommunityIcons name="water" size={20} color={SMARTBI_THEME.info} />
                  <Text style={styles.ratioCategoryTitle}>流动性</Text>
                </View>
                <Text style={styles.ratioCategoryItems}>流动比率 / 速动比率 / 现金比率</Text>
              </View>
              <View style={styles.ratioDivider} />
              <View style={styles.ratioCategory}>
                <View style={styles.ratioCategoryHeader}>
                  <MaterialCommunityIcons name="cog-sync" size={20} color={SMARTBI_THEME.warning} />
                  <Text style={styles.ratioCategoryTitle}>运营效率</Text>
                </View>
                <Text style={styles.ratioCategoryItems}>存货周转 / 应收账款周转 / 总资产周转</Text>
              </View>
              <View style={styles.ratioDivider} />
              <View style={styles.ratioCategory}>
                <View style={styles.ratioCategoryHeader}>
                  <MaterialCommunityIcons name="shield-account" size={20} color={SMARTBI_THEME.danger} />
                  <Text style={styles.ratioCategoryTitle}>偿债能力</Text>
                </View>
                <Text style={styles.ratioCategoryItems}>资产负债率 / 利息保障倍数 / 权益乘数</Text>
              </View>
            </Card.Content>
          </Card>
        </View>

        {/* Info Card */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <View style={styles.infoContent}>
              <MaterialCommunityIcons
                name="information"
                size={20}
                color={SMARTBI_THEME.info}
              />
              <Text style={styles.infoText}>
                财务比率分析功能正在紧张开发中，将帮助您全面评估企业财务健康状况并与行业标杆对比
              </Text>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SMARTBI_THEME.background,
  },
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  comingSoonCard: {
    borderRadius: 16,
    backgroundColor: SMARTBI_THEME.cardBackground,
    marginBottom: 20,
  },
  comingSoonContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${SMARTBI_THEME.warning}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  comingSoonTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: SMARTBI_THEME.textPrimary,
    marginBottom: 8,
  },
  comingSoonSubtitle: {
    fontSize: 16,
    color: SMARTBI_THEME.warning,
    fontWeight: '600',
    marginBottom: 16,
  },
  comingSoonDescription: {
    fontSize: 14,
    color: SMARTBI_THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  featuresSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
    marginBottom: 12,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  featureItem: {
    width: '47%',
    marginHorizontal: '1.5%',
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
    alignItems: 'center',
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${SMARTBI_THEME.warning}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: SMARTBI_THEME.textPrimary,
    textAlign: 'center',
  },
  ratioPreviewSection: {
    marginBottom: 20,
  },
  ratioCard: {
    borderRadius: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
  },
  ratioCategory: {
    paddingVertical: 12,
  },
  ratioCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  ratioCategoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
  },
  ratioCategoryItems: {
    fontSize: 13,
    color: SMARTBI_THEME.textSecondary,
    marginLeft: 28,
  },
  ratioDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SMARTBI_THEME.border,
  },
  infoCard: {
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
  },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: SMARTBI_THEME.info,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
  },
});

export default FinancialRatiosScreen;
