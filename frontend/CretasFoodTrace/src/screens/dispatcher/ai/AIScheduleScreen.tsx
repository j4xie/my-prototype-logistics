/**
 * AI智能排产屏幕
 *
 * 功能：
 * - 日期选择
 * - 待排产批次选择
 * - AI一键智能排产
 * - 完成概率预测
 * - 产线分配建议
 * - 人员优化建议
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { DISPATCHER_THEME } from '../../../types/dispatcher';
// import { schedulingApiClient } from '../../../services/api/schedulingApiClient';
// import { linucbApiClient } from '../../../services/api/linucbApiClient';

// Local types for mock data
interface PendingBatch {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  orderId: string;
  deadline: string;
  priority: 'high' | 'normal';
}

interface LineAssignment {
  lineId: string;
  lineName: string;
  load: number;
  loadLevel: 'low' | 'medium' | 'high';
  batches: string[];
}

interface WorkerSuggestion {
  workerId: number;
  workerName: string;
  currentPosition: string;
  skill: string;
  targetLine: string;
  ucbScore: number;
}

// Mock data for demo
const mockPendingBatches: PendingBatch[] = [
  { id: '1', name: '带鱼片', quantity: 100, unit: 'kg', orderId: 'ORD-2025-001', deadline: '12-28 18:00', priority: 'high' },
  { id: '2', name: '黄鱼片', quantity: 80, unit: 'kg', orderId: 'ORD-2025-002', deadline: '12-28 20:00', priority: 'normal' },
  { id: '3', name: '鱿鱼圈', quantity: 60, unit: 'kg', orderId: 'ORD-2025-003', deadline: '12-29 12:00', priority: 'normal' },
  { id: '4', name: '虾仁', quantity: 120, unit: 'kg', orderId: 'ORD-2025-004', deadline: '12-29 18:00', priority: 'normal' },
  { id: '5', name: '墨鱼仔', quantity: 50, unit: 'kg', orderId: 'ORD-2025-005', deadline: '12-30 12:00', priority: 'normal' },
];

const mockLineAssignments: LineAssignment[] = [
  { lineId: 'L1', lineName: '切片车间 - A线', load: 65, loadLevel: 'low', batches: ['带鱼片 100kg', '黄鱼片 80kg'] },
  { lineId: 'L2', lineName: '切片车间 - B线', load: 78, loadLevel: 'medium', batches: ['鱿鱼圈 60kg', '墨鱼仔 50kg'] },
  { lineId: 'L3', lineName: '包装车间 - A线', load: 55, loadLevel: 'low', batches: ['虾仁 120kg'] },
];

const mockWorkerSuggestions: WorkerSuggestion[] = [
  { workerId: 1, workerName: '张小明', currentPosition: '机动人员', skill: '切片技能 Lv.3', targetLine: '切片A线', ucbScore: 0.92 },
  { workerId: 2, workerName: '李小红', currentPosition: '包装车间', skill: '可调动', targetLine: '切片B线', ucbScore: 0.85 },
];

export default function AIScheduleScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showLoadingModal, setShowLoadingModal] = useState(false);

  // Date state
  const [startDate, setStartDate] = useState('2025-12-28');
  const [endDate, setEndDate] = useState('2025-12-28');

  // Batch selection state
  const [pendingBatches, setPendingBatches] = useState<PendingBatch[]>(mockPendingBatches);
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set(['1', '2', '3', '4']));

  // AI result state
  const [completionProbability, setCompletionProbability] = useState(85);
  const [simulationCount, setSimulationCount] = useState(10000);
  const [lineAssignments, setLineAssignments] = useState<LineAssignment[]>(mockLineAssignments);
  const [workerSuggestions, setWorkerSuggestions] = useState<WorkerSuggestion[]>(mockWorkerSuggestions);
  const [efficiencyImprovement, setEfficiencyImprovement] = useState(12);
  const [improvedProbability, setImprovedProbability] = useState(92);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Load pending batches from API
      // const batches = await schedulingApiClient.getPendingBatches(startDate, endDate);
      // setPendingBatches(batches);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [startDate, endDate]);

  const toggleBatchSelection = (batchId: string) => {
    const newSelection = new Set(selectedBatches);
    if (newSelection.has(batchId)) {
      newSelection.delete(batchId);
    } else {
      newSelection.add(batchId);
    }
    setSelectedBatches(newSelection);
  };

  const selectAllBatches = () => {
    if (selectedBatches.size === pendingBatches.length) {
      setSelectedBatches(new Set());
    } else {
      setSelectedBatches(new Set(pendingBatches.map(b => b.id)));
    }
  };

  const startAISchedule = async () => {
    if (selectedBatches.size === 0) {
      Alert.alert('提示', '请至少选择一个批次');
      return;
    }

    setShowLoadingModal(true);

    try {
      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 2500));

      // In real implementation:
      // const result = await schedulingApiClient.generateSchedule({
      //   batchIds: Array.from(selectedBatches),
      //   startDate,
      //   endDate,
      // });
      // setCompletionProbability(result.completionProbability);
      // setLineAssignments(result.lineAssignments);

      // Get LinUCB worker recommendations
      // const recommendations = await linucbApiClient.recommendWorkers(...);
      // setWorkerSuggestions(recommendations);

      setShowResult(true);
    } catch (error) {
      console.error('AI scheduling failed:', error);
      Alert.alert('错误', 'AI排产失败，请稍后重试');
    } finally {
      setShowLoadingModal(false);
    }
  };

  const applySchedule = async () => {
    try {
      setLoading(true);

      // In real implementation:
      // await schedulingApiClient.confirmSchedule(scheduleId);

      await new Promise(resolve => setTimeout(resolve, 1000));

      Alert.alert(
        '排产方案已应用',
        `已创建 ${selectedBatches.size} 个生产计划，人员调动申请已提交审批。`,
        [
          { text: '确定', onPress: () => navigation.navigate('PlanList') }
        ]
      );
    } catch (error) {
      console.error('Apply schedule failed:', error);
      Alert.alert('错误', '应用排产方案失败');
    } finally {
      setLoading(false);
    }
  };

  const getLoadColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low': return { bg: '#f6ffed', text: '#52c41a' };
      case 'medium': return { bg: '#fff7e6', text: '#fa8c16' };
      case 'high': return { bg: '#fff1f0', text: '#ff4d4f' };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary, DISPATCHER_THEME.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="robot" size={32} color="#fff" />
        </View>
        <Text style={styles.headerTitle}>AI 智能排产</Text>
        <Text style={styles.headerSubtitle}>基于 Monte Carlo + OR-Tools + LLM</Text>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Date Selection Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="calendar" size={20} color="#333" />
              <Text style={styles.cardTitle}>排产日期</Text>
            </View>
          </View>

          <View style={styles.dateRow}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>开始日期</Text>
              <TouchableOpacity style={styles.dateInput}>
                <Text style={styles.dateInputText}>{startDate}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>结束日期</Text>
              <TouchableOpacity style={styles.dateInput}>
                <Text style={styles.dateInputText}>{endDate}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Pending Batches Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="package-variant" size={20} color="#333" />
              <Text style={styles.cardTitle}>待排产批次</Text>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>{pendingBatches.length} 个</Text>
              </View>
            </View>
            <TouchableOpacity onPress={selectAllBatches}>
              <Text style={styles.selectAllText}>
                {selectedBatches.size === pendingBatches.length ? '取消全选' : '全选'}
              </Text>
            </TouchableOpacity>
          </View>

          {pendingBatches.map((batch) => (
            <TouchableOpacity
              key={batch.id}
              style={styles.batchItem}
              onPress={() => toggleBatchSelection(batch.id)}
            >
              <View style={[
                styles.batchCheckbox,
                selectedBatches.has(batch.id) && styles.batchCheckboxChecked
              ]}>
                {selectedBatches.has(batch.id) && (
                  <MaterialCommunityIcons name="check" size={14} color="#fff" />
                )}
              </View>
              <View style={styles.batchInfo}>
                <Text style={styles.batchName}>{batch.name} {batch.quantity}{batch.unit}</Text>
                <Text style={styles.batchMeta}>
                  订单号: {batch.orderId} | 交期: {batch.deadline}
                </Text>
              </View>
              <View style={[
                styles.priorityBadge,
                batch.priority === 'high' ? styles.priorityHigh : styles.priorityNormal
              ]}>
                <Text style={[
                  styles.priorityText,
                  batch.priority === 'high' ? styles.priorityHighText : styles.priorityNormalText
                ]}>
                  {batch.priority === 'high' ? '紧急' : '普通'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* AI Schedule Button */}
        {!showResult && (
          <TouchableOpacity onPress={startAISchedule}>
            <LinearGradient
              colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.aiButton}
            >
              <MaterialCommunityIcons name="robot" size={24} color="#fff" />
              <Text style={styles.aiButtonText}>AI 一键智能排产</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* AI Results */}
        {showResult && (
          <>
            {/* Completion Probability */}
            <View style={[styles.card, { marginTop: 16 }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <MaterialCommunityIcons name="chart-line" size={20} color="#333" />
                  <Text style={styles.cardTitle}>完成概率预测</Text>
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>Monte Carlo</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('AICompletionProb')}>
                  <Text style={styles.detailLink}>详情 &gt;</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.probabilityGauge}>
                <View style={styles.gaugeCircle}>
                  <View style={styles.gaugeInner}>
                    <Text style={styles.gaugeValue}>{completionProbability}%</Text>
                    <Text style={styles.gaugeLabel}>按时完成</Text>
                  </View>
                </View>
                <Text style={styles.probabilityDesc}>
                  基于 <Text style={styles.probabilityHighlight}>{simulationCount.toLocaleString()} 次模拟</Text>，
                  预计按时完成概率 <Text style={styles.probabilityHighlight}>{completionProbability}%</Text>
                </Text>
              </View>
            </View>

            {/* Line Assignment Suggestions */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <MaterialCommunityIcons name="factory" size={20} color="#333" />
                  <Text style={styles.cardTitle}>产线分配建议</Text>
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>OR-Tools</Text>
                  </View>
                </View>
              </View>

              {lineAssignments.map((line) => {
                const loadColor = getLoadColor(line.loadLevel);
                return (
                  <View key={line.lineId} style={styles.lineAssignment}>
                    <View style={styles.lineHeader}>
                      <Text style={styles.lineName}>{line.lineName}</Text>
                      <View style={[styles.lineLoad, { backgroundColor: loadColor.bg }]}>
                        <Text style={[styles.lineLoadText, { color: loadColor.text }]}>
                          负荷 {line.load}%
                        </Text>
                      </View>
                    </View>
                    <View style={styles.lineBatches}>
                      {line.batches.map((batch, index) => (
                        <View key={index} style={styles.lineBatchTag}>
                          <Text style={styles.lineBatchTagText}>{batch}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Worker Optimization Suggestions */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <MaterialCommunityIcons name="account-group" size={20} color="#333" />
                  <Text style={styles.cardTitle}>人员优化建议</Text>
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>LinUCB</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('AIWorkerOptimize')}>
                  <Text style={styles.detailLink}>详情 &gt;</Text>
                </TouchableOpacity>
              </View>

              {workerSuggestions.map((worker) => (
                <View key={worker.workerId} style={styles.workerSuggestion}>
                  <View style={styles.workerLeft}>
                    <LinearGradient
                      colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
                      style={styles.workerAvatar}
                    >
                      <Text style={styles.workerAvatarText}>
                        {worker.workerName.charAt(0)}
                      </Text>
                    </LinearGradient>
                    <View style={styles.workerInfo}>
                      <Text style={styles.workerName}>{worker.workerName}</Text>
                      <Text style={styles.workerMeta}>{worker.currentPosition} | {worker.skill}</Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="arrow-right" size={20} color={DISPATCHER_THEME.primary} />
                  <Text style={styles.workerTarget}>{worker.targetLine}</Text>
                </View>
              ))}

              <View style={styles.aiTip}>
                <MaterialCommunityIcons name="lightbulb-on" size={16} color="#52c41a" />
                <Text style={styles.aiTipText}>
                  AI 建议：调整后预计效率提升 {efficiencyImprovement}%，完成概率提升至 {improvedProbability}%
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => navigation.navigate('PlanGantt')}
              >
                <Text style={styles.outlineButtonText}>手动调整</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.solidButton}
                onPress={applySchedule}
                disabled={loading}
              >
                <LinearGradient
                  colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.solidButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.solidButtonText}>应用排产方案</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Loading Modal */}
      <Modal
        visible={showLoadingModal}
        transparent
        animationType="fade"
      >
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
            <Text style={styles.loadingText}>AI 正在分析...</Text>
            <Text style={styles.loadingSubtext}>Monte Carlo 模拟中 (10,000次)</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 12,
    top: 16,
    padding: 4,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: DISPATCHER_THEME.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  aiBadge: {
    backgroundColor: DISPATCHER_THEME.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#fff',
  },
  selectAllText: {
    fontSize: 12,
    color: DISPATCHER_THEME.primary,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 10,
  },
  dateInputText: {
    fontSize: 14,
    color: '#333',
  },
  batchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  batchCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d9d9d9',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batchCheckboxChecked: {
    backgroundColor: DISPATCHER_THEME.primary,
    borderColor: DISPATCHER_THEME.primary,
  },
  batchInfo: {
    flex: 1,
  },
  batchName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  batchMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityHigh: {
    backgroundColor: '#fff1f0',
  },
  priorityNormal: {
    backgroundColor: '#f5f5f5',
  },
  priorityText: {
    fontSize: 11,
  },
  priorityHighText: {
    color: '#ff4d4f',
  },
  priorityNormalText: {
    color: '#999',
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  aiButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  detailLink: {
    fontSize: 12,
    color: DISPATCHER_THEME.primary,
  },
  probabilityGauge: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'linear-gradient(135deg, #f9f5ff 0%, #fff 100%)',
    borderRadius: 12,
  },
  gaugeCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    borderColor: '#52c41a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gaugeInner: {
    alignItems: 'center',
  },
  gaugeValue: {
    fontSize: 28,
    fontWeight: '600',
    color: '#52c41a',
  },
  gaugeLabel: {
    fontSize: 12,
    color: '#999',
  },
  probabilityDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  probabilityHighlight: {
    color: DISPATCHER_THEME.primary,
    fontWeight: '600',
  },
  lineAssignment: {
    backgroundColor: '#f9f5ff',
    borderWidth: 1,
    borderColor: '#d3adf7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lineName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  lineLoad: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lineLoadText: {
    fontSize: 12,
  },
  lineBatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  lineBatchTag: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  lineBatchTagText: {
    fontSize: 12,
    color: '#666',
  },
  workerSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  workerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  workerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  workerMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  workerTarget: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginLeft: 8,
  },
  aiTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6ffed',
    borderRadius: 6,
    padding: 10,
    marginTop: 12,
    gap: 6,
  },
  aiTipText: {
    fontSize: 12,
    color: '#52c41a',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  outlineButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: DISPATCHER_THEME.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  outlineButtonText: {
    fontSize: 14,
    color: DISPATCHER_THEME.primary,
  },
  solidButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  solidButtonGradient: {
    padding: 12,
    alignItems: 'center',
  },
  solidButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 280,
  },
  loadingText: {
    fontSize: 16,
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 12,
    color: '#999',
  },
});
