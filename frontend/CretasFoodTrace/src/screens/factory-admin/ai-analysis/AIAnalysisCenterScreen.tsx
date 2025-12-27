/**
 * AI 分析中心
 * 包含: 成本分析、数据报表、AI对话、质检分析、新建计划
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { FAAIStackParamList } from '../../../types/navigation';
import { aiApiClient, AIQuotaInfo } from '../../../services/api/aiApiClient';

type NavigationProp = NativeStackNavigationProp<FAAIStackParamList, 'AIAnalysisCenter'>;

interface MenuItemProps {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
}

function MenuItem({ icon, title, subtitle, color, onPress }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIcon, { backgroundColor: color + '20' }]}>
        <Icon source={icon} size={24} color={color} />
      </View>
      <View style={styles.menuText}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Icon source="chevron-right" size={24} color="#ccc" />
    </TouchableOpacity>
  );
}

export function AIAnalysisCenterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<AIQuotaInfo | null>(null);

  const loadQuota = useCallback(async () => {
    try {
      const quota = await aiApiClient.getQuotaInfo();
      setQuotaInfo(quota);
    } catch (err) {
      console.error('加载AI配额失败:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadQuota();
  }, [loadQuota]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadQuota();
  }, [loadQuota]);

  const getQuotaStatusColor = (status?: string): string => {
    switch (status) {
      case 'active': return '#48bb78';
      case 'warning': return '#ed8936';
      case 'exhausted': return '#e53e3e';
      default: return '#667eea';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>AI 分析</Text>
          <Text style={styles.subtitle}>智能数据分析与决策支持</Text>
        </View>

        {/* AI 配额卡片 */}
        <View style={styles.quotaCard}>
          <View style={styles.quotaHeader}>
            <Icon source="robot" size={24} color="#667eea" />
            <Text style={styles.quotaTitle}>AI 分析配额</Text>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color="#667eea" style={{ marginVertical: 16 }} />
          ) : quotaInfo ? (
            <>
              <View style={styles.quotaProgress}>
                <View style={styles.quotaBar}>
                  <View
                    style={[
                      styles.quotaFill,
                      {
                        width: `${quotaInfo.usagePercentage}%`,
                        backgroundColor: getQuotaStatusColor(quotaInfo.status),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.quotaText}>
                  {quotaInfo.remainingQuota} / {quotaInfo.weeklyQuota} 次剩余
                </Text>
              </View>
              <Text style={styles.quotaReset}>
                重置时间: {quotaInfo.resetDate ? new Date(quotaInfo.resetDate).toLocaleDateString('zh-CN') : '下周一'}
              </Text>
            </>
          ) : (
            <Text style={styles.quotaError}>无法获取配额信息</Text>
          )}
        </View>

        {/* 快捷分析 */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>快捷分析</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => navigation.navigate('AICostAnalysis')}
            >
              <View style={[styles.quickIcon, { backgroundColor: '#667eea20' }]}>
                <Icon source="chart-line" size={28} color="#667eea" />
              </View>
              <Text style={styles.quickLabel}>成本趋势</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => navigation.navigate('QualityAnalysis')}
            >
              <View style={[styles.quickIcon, { backgroundColor: '#1890ff20' }]}>
                <Icon source="clipboard-check-outline" size={28} color="#1890ff" />
              </View>
              <Text style={styles.quickLabel}>质量分析</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => navigation.navigate('AIChat')}
            >
              <View style={[styles.quickIcon, { backgroundColor: '#fa8c1620' }]}>
                <Icon source="robot" size={28} color="#fa8c16" />
              </View>
              <Text style={styles.quickLabel}>AI 对话</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => navigation.navigate('CreatePlan')}
            >
              <View style={[styles.quickIcon, { backgroundColor: '#eb2f9620' }]}>
                <Icon source="calendar-plus" size={28} color="#eb2f96" />
              </View>
              <Text style={styles.quickLabel}>新建计划</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 功能菜单 */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>全部功能</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="chart-line"
              title="成本分析"
              subtitle="生产成本趋势与优化建议"
              color="#667eea"
              onPress={() => navigation.navigate('AICostAnalysis')}
            />
            <MenuItem
              icon="file-document-outline"
              title="数据报表"
              subtitle="生产、库存、财务等报表"
              color="#52c41a"
              onPress={() => navigation.navigate('AIReport')}
            />
            <MenuItem
              icon="robot"
              title="AI 对话"
              subtitle="与AI助手对话获取分析建议"
              color="#fa8c16"
              onPress={() => navigation.navigate('AIChat')}
            />
            <MenuItem
              icon="clipboard-check-outline"
              title="质检分析"
              subtitle="质量检测数据分析"
              color="#1890ff"
              onPress={() => navigation.navigate('QualityAnalysis')}
            />
            <MenuItem
              icon="calendar-plus"
              title="新建计划"
              subtitle="创建生产计划"
              color="#eb2f96"
              onPress={() => navigation.navigate('CreatePlan')}
            />
          </View>
        </View>

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
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a202c',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  quotaCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  quotaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  quotaTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginLeft: 8,
  },
  quotaProgress: {
    marginBottom: 8,
  },
  quotaBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  quotaFill: {
    height: '100%',
    borderRadius: 4,
  },
  quotaText: {
    fontSize: 14,
    color: '#666',
  },
  quotaReset: {
    fontSize: 12,
    color: '#999',
  },
  quotaError: {
    fontSize: 14,
    color: '#e53e3e',
    marginVertical: 8,
  },
  quickActions: {
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 12,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickItem: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  quickIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a202c',
  },
  menuSection: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
    marginLeft: 12,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a202c',
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
});

export default AIAnalysisCenterScreen;
