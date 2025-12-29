/**
 * 生产计划详情屏幕
 *
 * 功能:
 * - 计划基本信息展示
 * - 生产进度显示
 * - 原料匹配状态
 * - 已分配员工列表
 * - 关联生产批次
 * - 暂停/完成计划操作
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
import { useNavigation, useRoute } from '@react-navigation/native';
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

// 计划详情类型
interface PlanDetail {
  id: string;
  planNumber: string;
  product: string;
  quantity: string;
  workshop: string;
  supervisor: string;
  planDate: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'paused';
  progress: number;
  completedQuantity: string;
  remainingQuantity: string;
  estimatedCompletion: string;
}

// 原料匹配类型
interface MaterialMatch {
  id: string;
  name: string;
  batchNumber: string;
  required: string;
  available: string;
  matched: boolean;
}

// 员工类型
interface AssignedWorker {
  id: string;
  name: string;
  avatar: string;
}

// 生产批次类型
interface ProductionBatch {
  id: string;
  batchNumber: string;
  status: 'pending' | 'in_progress' | 'completed';
  progress: number;
}

// Mock 数据
const mockPlanDetail: PlanDetail = {
  id: '1',
  planNumber: 'PP20241227001',
  product: '冷冻带鱼段',
  quantity: '500kg',
  workshop: '切片车间',
  supervisor: '张主任',
  planDate: '2025-12-27',
  priority: 'high',
  status: 'in_progress',
  progress: 65,
  completedQuantity: '325kg',
  remainingQuantity: '175kg',
  estimatedCompletion: '今日 16:30',
};

const mockMaterials: MaterialMatch[] = [
  {
    id: '1',
    name: '带鱼原料',
    batchNumber: 'MB20241225001',
    required: '550kg',
    available: '600kg',
    matched: true,
  },
  {
    id: '2',
    name: '包装袋',
    batchNumber: 'PKG20241220001',
    required: '500个',
    available: '800个',
    matched: true,
  },
];

const mockWorkers: AssignedWorker[] = [
  { id: '1', name: '张', avatar: '张' },
  { id: '2', name: '李', avatar: '李' },
  { id: '3', name: '王', avatar: '王' },
  { id: '4', name: '赵', avatar: '赵' },
  { id: '5', name: '陈', avatar: '陈' },
];

const mockBatches: ProductionBatch[] = [
  { id: '1', batchNumber: 'PB20241227001', status: 'in_progress', progress: 65 },
  { id: '2', batchNumber: 'PB20241227002', status: 'pending', progress: 0 },
];

export default function PlanDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [refreshing, setRefreshing] = useState(false);
  const [plan] = useState<PlanDetail>(mockPlanDetail);
  const [materials] = useState<MaterialMatch[]>(mockMaterials);
  const [workers] = useState<AssignedWorker[]>(mockWorkers);
  const [batches] = useState<ProductionBatch[]>(mockBatches);

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: 调用API刷新数据
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // 获取状态标签样式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'in_progress':
        return { backgroundColor: '#e6f7ff', color: '#1890ff' };
      case 'completed':
        return { backgroundColor: '#f6ffed', color: '#52c41a' };
      case 'pending':
        return { backgroundColor: '#fff7e6', color: '#fa8c16' };
      case 'paused':
        return { backgroundColor: '#fff1f0', color: '#ff4d4f' };
      default:
        return { backgroundColor: '#f5f5f5', color: '#666' };
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'in_progress':
        return '进行中';
      case 'completed':
        return '已完成';
      case 'pending':
        return '待开始';
      case 'paused':
        return '已暂停';
      default:
        return status;
    }
  };

  // 获取优先级样式
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'high':
        return { backgroundColor: '#fff1f0', color: '#ff4d4f' };
      case 'medium':
        return { backgroundColor: '#fff7e6', color: '#fa8c16' };
      case 'low':
        return { backgroundColor: '#e6f7ff', color: '#1890ff' };
      default:
        return { backgroundColor: '#f5f5f5', color: '#666' };
    }
  };

  // 暂停计划
  const handlePausePlan = () => {
    Alert.alert(
      '暂停计划',
      '确定要暂停该生产计划吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: () => {
            // TODO: 调用暂停API
            Alert.alert('成功', '计划已暂停');
          },
        },
      ]
    );
  };

  // 完成计划
  const handleCompletePlan = () => {
    Alert.alert(
      '完成计划',
      '确定要将该计划标记为已完成吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'default',
          onPress: () => {
            // TODO: 调用完成API
            Alert.alert('成功', '计划已完成');
          },
        },
      ]
    );
  };

  // 渲染原料匹配卡片
  const renderMaterialCard = (material: MaterialMatch) => (
    <View
      key={material.id}
      style={[
        styles.materialCard,
        material.matched ? styles.materialMatched : styles.materialUnmatched,
      ]}
    >
      <View style={styles.materialHeader}>
        <View style={styles.materialNameRow}>
          <View
            style={[
              styles.materialIndicator,
              { backgroundColor: material.matched ? DISPATCHER_THEME.success : DISPATCHER_THEME.danger },
            ]}
          />
          <Text style={styles.materialName}>{material.name}</Text>
        </View>
        <Text
          style={[
            styles.materialStatus,
            { color: material.matched ? DISPATCHER_THEME.success : DISPATCHER_THEME.danger },
          ]}
        >
          {material.matched ? '已匹配' : '未匹配'}
        </Text>
      </View>
      <Text style={styles.materialBatch}>批次: {material.batchNumber}</Text>
      <Text style={styles.materialQuantity}>
        需求: {material.required} | 可用: {material.available}
      </Text>
    </View>
  );

  // 渲染生产批次卡片
  const renderBatchCard = (batch: ProductionBatch) => (
    <TouchableOpacity key={batch.id} style={styles.batchCard} activeOpacity={0.7}>
      <View style={styles.batchHeader}>
        <Text style={styles.batchNumber}>{batch.batchNumber}</Text>
        <View
          style={[
            styles.batchStatus,
            getStatusStyle(batch.status),
          ]}
        >
          <Text style={[styles.batchStatusText, { color: getStatusStyle(batch.status).color }]}>
            {batch.status === 'in_progress' ? '生产中' : '待开始'}
          </Text>
        </View>
      </View>
      <Text style={styles.batchProgress}>进度 {batch.progress}%</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>计划详情</Text>
        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>编辑</Text>
        </TouchableOpacity>
      </View>

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
        {/* 计划信息 */}
        <View style={styles.section}>
          <View style={styles.planHeader}>
            <Text style={styles.planNumber}>{plan.planNumber}</Text>
            <View style={[styles.statusBadge, getStatusStyle(plan.status)]}>
              <Text style={[styles.statusText, { color: getStatusStyle(plan.status).color }]}>
                {getStatusText(plan.status)}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>产品</Text>
            <Text style={styles.detailValue}>{plan.product}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>数量</Text>
            <Text style={styles.detailValue}>{plan.quantity}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>车间</Text>
            <Text style={styles.detailValue}>{plan.workshop}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>负责人</Text>
            <Text style={styles.detailValue}>{plan.supervisor}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>计划日期</Text>
            <Text style={styles.detailValue}>{plan.planDate}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>优先级</Text>
            <View style={[styles.priorityBadge, getPriorityStyle(plan.priority)]}>
              <Text style={[styles.priorityText, { color: getPriorityStyle(plan.priority).color }]}>
                高
              </Text>
            </View>
          </View>
        </View>

        {/* 生产进度 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>生产进度</Text>
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>完成进度</Text>
            <Text style={styles.progressValue}>{plan.progress}%</Text>
          </View>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={[DISPATCHER_THEME.secondary, DISPATCHER_THEME.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${plan.progress}%` }]}
            />
          </View>
          <View style={styles.quantityRow}>
            <Text style={styles.quantityText}>
              已完成: <Text style={styles.quantityValue}>{plan.completedQuantity}</Text>
            </Text>
            <Text style={styles.quantityText}>
              剩余: <Text style={styles.quantityValue}>{plan.remainingQuantity}</Text>
            </Text>
          </View>
          <Text style={styles.estimatedCompletion}>
            预计完成: {plan.estimatedCompletion}
          </Text>
        </View>

        {/* 原料匹配 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>原料匹配</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>重新匹配</Text>
            </TouchableOpacity>
          </View>
          {materials.map(renderMaterialCard)}
        </View>

        {/* 已分配员工 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>已分配员工 ({workers.length}人)</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>+ 分配</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.workersContainer}>
            <View style={styles.avatarGroup}>
              {workers.map((worker) => (
                <View key={worker.id} style={styles.avatar}>
                  <Text style={styles.avatarText}>{worker.avatar}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.workerStats}>
            <Text style={styles.workerStatText}>
              总工时: <Text style={styles.workerStatValue}>480min</Text>
            </Text>
            <Text style={styles.workerStatText}>
              人工成本: <Text style={[styles.workerStatValue, { color: DISPATCHER_THEME.warning }]}>¥400</Text>
            </Text>
          </View>
        </View>

        {/* 关联生产批次 */}
        <View style={[styles.section, { marginBottom: 120 }]}>
          <Text style={styles.sectionTitle}>关联生产批次</Text>
          {batches.map(renderBatchCard)}
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handlePausePlan}
        >
          <Text style={styles.secondaryButtonText}>暂停计划</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleCompletePlan}
        >
          <LinearGradient
            colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryButtonGradient}
          >
            <Text style={styles.primaryButtonText}>完成计划</Text>
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
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  editButton: {
    padding: 4,
  },
  editButtonText: {
    fontSize: 14,
    color: DISPATCHER_THEME.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#999',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLink: {
    fontSize: 12,
    color: DISPATCHER_THEME.secondary,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#666',
  },
  progressValue: {
    fontSize: 16,
    fontWeight: '600',
    color: DISPATCHER_THEME.secondary,
  },
  progressBar: {
    height: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quantityText: {
    fontSize: 14,
    color: '#999',
  },
  quantityValue: {
    color: '#333',
    fontWeight: '500',
  },
  estimatedCompletion: {
    fontSize: 13,
    color: DISPATCHER_THEME.success,
  },
  materialCard: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  materialMatched: {
    backgroundColor: '#f6ffed',
    borderColor: '#b7eb8f',
  },
  materialUnmatched: {
    backgroundColor: '#fff1f0',
    borderColor: '#ffccc7',
  },
  materialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  materialNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  materialIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  materialName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  materialStatus: {
    fontSize: 12,
  },
  materialBatch: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  materialQuantity: {
    fontSize: 13,
    color: '#666',
  },
  workersContainer: {
    marginBottom: 12,
  },
  avatarGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DISPATCHER_THEME.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  workerStats: {
    flexDirection: 'row',
    gap: 24,
  },
  workerStatText: {
    fontSize: 13,
    color: '#999',
  },
  workerStatValue: {
    color: '#333',
    fontWeight: '500',
  },
  batchCard: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  batchNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  batchStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  batchStatusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  batchProgress: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  bottomActions: {
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
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },
});
