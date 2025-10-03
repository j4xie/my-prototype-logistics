import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CostCard } from '../../components/processing';
import { processingApiClient } from '../../services/api/processingApiClient';
import { CostAnalysis, formatCurrency, formatDuration } from '../../types/costAccounting';

interface CostAnalysisDashboardProps {
  navigation: any;
  route: any;
}

/**
 * 成本分析看板
 * 显示批次的详细成本分析和利润分析
 */
export const CostAnalysisDashboard: React.FC<CostAnalysisDashboardProps> = ({ navigation, route }) => {
  const { batchId } = route.params;
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [analysis, setAnalysis] = useState<CostAnalysis | null>(null);

  // AI分析相关状态
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  useEffect(() => {
    loadCostAnalysis();
  }, [batchId]);

  const loadCostAnalysis = async () => {
    try {
      setLoading(true);
      const response = await processingApiClient.getBatchCostAnalysis(batchId);

      if (response.success) {
        setAnalysis(response.data);
      } else {
        Alert.alert('错误', response.message || '加载成本分析失败');
      }
    } catch (error: any) {
      console.error('加载成本分析失败:', error);
      Alert.alert('错误', error.message || '网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const response = await processingApiClient.recalculateBatchCost(batchId);

      if (response.success) {
        Alert.alert('成功', '成本已重新计算');
        loadCostAnalysis();
      } else {
        Alert.alert('失败', response.message || '重新计算失败');
      }
    } catch (error: any) {
      console.error('重新计算成本失败:', error);
      Alert.alert('错误', error.message || '网络错误');
    } finally {
      setRecalculating(false);
    }
  };

  const handleAIAnalysis = async () => {
    try {
      setAiAnalyzing(true);
      const response = await processingApiClient.getAICostAnalysis({
        batchId,
        session_id: aiSessionId || undefined
      });

      if (response.success) {
        setAiAnalysis(response.data.analysis);
        setAiSessionId(response.data.session_id);
        setShowAiPanel(true);
      } else {
        Alert.alert('AI分析失败', response.message || '无法获取AI分析');
      }
    } catch (error: any) {
      console.error('AI分析失败:', error);
      Alert.alert('错误', error.message || 'AI服务暂时不可用');
    } finally {
      setAiAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>加载成本分析...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!analysis) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>暂无成本分析数据</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { batch, laborStats, equipmentStats, costBreakdown, profitAnalysis } = analysis;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>成本分析</Text>
          <Text style={styles.headerSubtitle}>{batch.batchNumber}</Text>
        </View>
        <TouchableOpacity onPress={handleRecalculate} disabled={recalculating}>
          <Ionicons
            name="refresh"
            size={28}
            color={recalculating ? '#D1D5DB' : '#3B82F6'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 批次信息 */}
        <View style={styles.batchInfoCard}>
          <View style={styles.batchInfoRow}>
            <Text style={styles.batchInfoLabel}>产品类型:</Text>
            <Text style={styles.batchInfoValue}>{batch.productType}</Text>
          </View>
          <View style={styles.batchInfoRow}>
            <Text style={styles.batchInfoLabel}>原材料:</Text>
            <Text style={styles.batchInfoValue}>{batch.rawMaterialCategory}</Text>
          </View>
          <View style={styles.batchInfoRow}>
            <Text style={styles.batchInfoLabel}>状态:</Text>
            <Text style={[
              styles.batchInfoValue,
              { color: batch.status === 'completed' ? '#10B981' : '#F59E0B' }
            ]}>
              {batch.status === 'completed' ? '已完成' : '进行中'}
            </Text>
          </View>
        </View>

        {/* 总成本和利润 */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>总成本</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(costBreakdown.totalCost)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>利润率</Text>
            <Text style={[
              styles.summaryValue,
              {
                color: profitAnalysis.profitRate && profitAnalysis.profitRate > 0
                  ? '#10B981'
                  : '#EF4444'
              }
            ]}>
              {profitAnalysis.profitRate ? `${profitAnalysis.profitRate.toFixed(1)}%` : '--'}
            </Text>
          </View>
        </View>

        {/* AI分析按钮 */}
        <TouchableOpacity
          style={styles.aiAnalysisButton}
          onPress={handleAIAnalysis}
          disabled={aiAnalyzing}
        >
          <View style={styles.aiButtonContent}>
            <Ionicons
              name="sparkles"
              size={24}
              color="#FFFFFF"
            />
            <Text style={styles.aiButtonText}>
              {aiAnalyzing ? 'AI分析中...' : 'AI 智能分析'}
            </Text>
          </View>
          {aiAnalyzing && <ActivityIndicator size="small" color="#FFFFFF" />}
        </TouchableOpacity>

        {/* AI分析结果面板 */}
        {showAiPanel && aiAnalysis && (
          <View style={styles.aiPanel}>
            <View style={styles.aiPanelHeader}>
              <View style={styles.aiPanelTitle}>
                <Ionicons name="sparkles" size={20} color="#8B5CF6" />
                <Text style={styles.aiPanelTitleText}>AI 分析建议</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAiPanel(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.aiPanelContent}>
              <Text style={styles.aiPanelText}>{aiAnalysis}</Text>
            </ScrollView>
          </View>
        )}

        {/* 成本结构 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>成本结构</Text>

          <CostCard
            title="原材料成本"
            amount={costBreakdown.rawMaterialCost}
            percentage={costBreakdown.rawMaterialPercentage}
            icon="cube"
            color="#8B5CF6"
          />

          <CostCard
            title="人工成本"
            amount={costBreakdown.laborCost}
            percentage={costBreakdown.laborPercentage}
            icon="people"
            color="#10B981"
          />

          <CostCard
            title="设备成本"
            amount={costBreakdown.equipmentCost}
            percentage={costBreakdown.equipmentPercentage}
            icon="cog"
            color="#F59E0B"
          />
        </View>

        {/* 人工明细 */}
        <View style={styles.section}>
          <View style={styles.detailHeader}>
            <Text style={styles.sectionTitle}>人工明细</Text>
            <TouchableOpacity>
              <Text style={styles.detailLink}>查看全部</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statBoxValue}>{laborStats.totalSessions}</Text>
              <Text style={styles.statBoxLabel}>总工作时段</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statBoxValue}>
                {formatDuration(laborStats.totalMinutes).replace('小时', 'h').replace('分钟', 'm')}
              </Text>
              <Text style={styles.statBoxLabel}>总工时</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statBoxValue}>{laborStats.totalQuantityProcessed.toFixed(0)}kg</Text>
              <Text style={styles.statBoxLabel}>总加工量</Text>
            </View>
          </View>

          {laborStats.workerDetails.slice(0, 3).map((worker, index) => (
            <View key={index} style={styles.detailItem}>
              <View style={styles.detailItemLeft}>
                <Ionicons name="person-circle" size={24} color="#3B82F6" />
                <View style={styles.detailItemInfo}>
                  <Text style={styles.detailItemName}>{worker.workerName}</Text>
                  <Text style={styles.detailItemMeta}>
                    {formatDuration(worker.totalMinutes || 0)} · {worker.processedQuantity}kg
                  </Text>
                </View>
              </View>
              <Text style={styles.detailItemValue}>
                {formatCurrency(worker.laborCost)}
              </Text>
            </View>
          ))}
        </View>

        {/* 设备明细 */}
        <View style={styles.section}>
          <View style={styles.detailHeader}>
            <Text style={styles.sectionTitle}>设备使用明细</Text>
            <TouchableOpacity>
              <Text style={styles.detailLink}>查看全部</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statBoxValue}>{equipmentStats.totalUsages}</Text>
              <Text style={styles.statBoxLabel}>使用次数</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statBoxValue}>
                {formatDuration(equipmentStats.totalDuration).replace('小时', 'h').replace('分钟', 'm')}
              </Text>
              <Text style={styles.statBoxLabel}>总时长</Text>
            </View>
          </View>

          {equipmentStats.equipmentDetails.slice(0, 3).map((equipment, index) => (
            <View key={index} style={styles.detailItem}>
              <View style={styles.detailItemLeft}>
                <Ionicons name="cog-outline" size={24} color="#F59E0B" />
                <View style={styles.detailItemInfo}>
                  <Text style={styles.detailItemName}>{equipment.equipmentName}</Text>
                  <Text style={styles.detailItemMeta}>
                    {formatDuration(equipment.usageDuration || 0)}
                  </Text>
                </View>
              </View>
              <Text style={styles.detailItemValue}>
                {formatCurrency(equipment.equipmentCost)}
              </Text>
            </View>
          ))}
        </View>

        {/* 利润分析 */}
        {profitAnalysis.expectedRevenue && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>利润分析</Text>

            <View style={styles.profitCard}>
              <View style={styles.profitRow}>
                <Text style={styles.profitLabel}>预期收入:</Text>
                <Text style={styles.profitValue}>
                  {formatCurrency(profitAnalysis.expectedRevenue)}
                </Text>
              </View>
              <View style={styles.profitRow}>
                <Text style={styles.profitLabel}>总成本:</Text>
                <Text style={styles.profitValue}>
                  {formatCurrency(profitAnalysis.totalCost)}
                </Text>
              </View>
              <View style={styles.profitDivider} />
              <View style={styles.profitRow}>
                <Text style={styles.profitLabel}>利润:</Text>
                <Text style={[
                  styles.profitValue,
                  styles.profitHighlight,
                  {
                    color: profitAnalysis.profitMargin && profitAnalysis.profitMargin > 0
                      ? '#10B981'
                      : '#EF4444'
                  }
                ]}>
                  {formatCurrency(profitAnalysis.profitMargin || 0)}
                </Text>
              </View>
              <View style={styles.profitRow}>
                <Text style={styles.profitLabel}>利润率:</Text>
                <Text style={[
                  styles.profitValue,
                  styles.profitHighlight,
                  {
                    color: profitAnalysis.profitRate && profitAnalysis.profitRate > 0
                      ? '#10B981'
                      : '#EF4444'
                  }
                ]}>
                  {profitAnalysis.profitRate ? `${profitAnalysis.profitRate.toFixed(2)}%` : '--'}
                </Text>
              </View>
              <View style={styles.profitRow}>
                <Text style={styles.profitLabel}>盈亏平衡价:</Text>
                <Text style={styles.profitValue}>
                  ¥{profitAnalysis.breakEvenPrice}/kg
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9CA3AF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  batchInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  batchInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  batchInfoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  batchInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLink: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statBoxValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 4,
  },
  statBoxLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  detailItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailItemInfo: {
    marginLeft: 12,
    flex: 1,
  },
  detailItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  detailItemMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  detailItemValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  profitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  profitLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  profitValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  profitHighlight: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  profitDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  aiAnalysisButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  aiButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  aiPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    maxHeight: 400,
  },
  aiPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  aiPanelTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiPanelTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  aiPanelContent: {
    padding: 16,
    maxHeight: 320,
  },
  aiPanelText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
  },
});
