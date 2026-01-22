/**
 * SmartBI - Customer RFM Analysis Screen
 *
 * Placeholder screen for RFM (Recency, Frequency, Monetary) customer analysis.
 * Will provide customer segmentation and targeting insights.
 *
 * Planned Features:
 * - Customer RFM scoring and segmentation
 * - Customer lifecycle analysis
 * - Retention and churn prediction
 * - Marketing strategy recommendations
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
  { icon: 'account-group', label: '客户分群分析' },
  { icon: 'chart-scatter-plot', label: 'RFM 评分模型' },
  { icon: 'target', label: '精准营销建议' },
  { icon: 'account-heart', label: '客户生命周期管理' },
];

export function CustomerRFMScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SmartBIStackParamList>>();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>客户RFM分析</Text>
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
                name="account-star"
                size={80}
                color={SMARTBI_THEME.primary}
              />
            </View>
            <Text style={styles.comingSoonTitle}>客户RFM分析</Text>
            <Text style={styles.comingSoonSubtitle}>
              功能开发中，敬请期待
            </Text>
            <Text style={styles.comingSoonDescription}>
              RFM分析帮助您基于最近消费时间(R)、消费频率(F)和消费金额(M)对客户进行分层，实现精准营销
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
                    color={SMARTBI_THEME.primary}
                  />
                </View>
                <Text style={styles.featureLabel}>{feature.label}</Text>
              </Surface>
            ))}
          </View>
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
                客户RFM分析功能正在紧张开发中，将帮助您更好地了解客户价值并制定针对性营销策略
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
    backgroundColor: `${SMARTBI_THEME.primary}15`,
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
    color: SMARTBI_THEME.primary,
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
    backgroundColor: `${SMARTBI_THEME.primary}10`,
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

export default CustomerRFMScreen;
