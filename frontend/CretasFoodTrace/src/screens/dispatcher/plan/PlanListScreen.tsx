/**
 * 生产计划列表屏幕
 *
 * 功能：
 * - 多维度筛选（状态、车间、日期、来源）
 * - 搜索计划编号/产品名称
 * - 快捷入口（甘特图、紧急插单、混批排产、资源总览）
 * - 计划卡片（客户订单、混批、AI预测、安全库存来源）
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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { DISPATCHER_THEME } from '../../../types/dispatcher';
// import { schedulingApiClient } from '../../../services/api/schedulingApiClient';

// Local extended type for mock data display
type PlanSourceType = 'customer_order' | 'ai_forecast' | 'safety_stock' | 'manual' | 'urgent_insert' | 'mixed_batch';

interface RelatedOrder {
  orderId: string;
  customerName: string;
  quantity: number;
}

interface DisplayPlan {
  id: string;
  planNumber: string;
  productName: string;
  quantity: number;
  unit: string;
  workshopName: string;
  supervisorName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  progress: number;
  sourceType: PlanSourceType;
  customerName?: string;
  crValue?: number;
  crLevel?: 'urgent' | 'tight' | 'sufficient';
  deadline?: string;
  tags?: string[];
  isMixedBatch?: boolean;
  mergedOrderCount?: number;
  relatedOrders?: RelatedOrder[];
  forecastReason?: string;
  aiConfidence?: number;
  season?: string;
  stockLevel?: number;
}

// Mock data
const mockPlans: DisplayPlan[] = [
  {
    id: '1',
    planNumber: 'PP20241227001',
    productName: '冷冻带鱼段',
    quantity: 500,
    unit: 'kg',
    workshopName: '切片车间',
    supervisorName: '张主任',
    status: 'in_progress',
    progress: 65,
    sourceType: 'customer_order',
    customerName: '永辉超市',
    crValue: 0.8,
    crLevel: 'urgent',
    deadline: '12-28 18:00',
    tags: ['已匹配', '高优先级'],
  },
  {
    id: '2',
    planNumber: 'PP20241227002',
    productName: '鱿鱼圈',
    quantity: 800,
    unit: '袋',
    workshopName: '包装车间',
    supervisorName: '李主任',
    status: 'pending',
    progress: 0,
    sourceType: 'mixed_batch',
    isMixedBatch: true,
    mergedOrderCount: 3,
    relatedOrders: [
      { orderId: 'ORD-001', customerName: '盒马', quantity: 300 },
      { orderId: 'ORD-002', customerName: '永辉', quantity: 300 },
      { orderId: 'ORD-003', customerName: '大润发', quantity: 200 },
    ],
    crValue: 1.2,
    crLevel: 'tight',
    deadline: '12-29 12:00',
    tags: ['待匹配', '中优先级'],
  },
  {
    id: '3',
    planNumber: 'PP20241227003',
    productName: '大虾仁',
    quantity: 300,
    unit: 'kg',
    workshopName: '冷冻车间',
    supervisorName: '王主任',
    status: 'completed',
    progress: 100,
    sourceType: 'ai_forecast',
    forecastReason: '冬季火锅需求 +15%',
    aiConfidence: 85,
    season: '冬季',
    tags: ['已消耗', '普通'],
  },
  {
    id: '4',
    planNumber: 'PP20241227004',
    productName: '带鱼段',
    quantity: 400,
    unit: 'kg',
    workshopName: '切片车间',
    supervisorName: '张主任',
    status: 'in_progress',
    progress: 30,
    sourceType: 'safety_stock',
    stockLevel: 28,
    crValue: 2.5,
    crLevel: 'sufficient',
    tags: ['已匹配', '中优先级'],
  },
];

const statusOptions = ['全部状态', '待开始', '进行中', '已完成'];
const workshopOptions = ['全部车间', '切片车间', '包装车间', '冷冻车间'];
const dateOptions = ['日期范围', '今天', '本周', '本月'];
const sourceOptions = ['全部来源', '客户订单', 'AI预测', '安全库存', '混批'];

export default function PlanListScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [plans, setPlans] = useState<DisplayPlan[]>(mockPlans);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState('全部状态');
  const [selectedWorkshop, setSelectedWorkshop] = useState('全部车间');
  const [selectedDate, setSelectedDate] = useState('日期范围');
  const [selectedSource, setSelectedSource] = useState('全部来源');
  const [expandedMixedBatch, setExpandedMixedBatch] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // const data = await schedulingApiClient.getSchedulingPlans(...);
      // setPlans(data);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: '#fff7e6', text: '#fa8c16', label: '待开始' };
      case 'in_progress':
        return { bg: '#e6f7ff', text: '#1890ff', label: '进行中' };
      case 'completed':
        return { bg: '#f6ffed', text: '#52c41a', label: '已完成' };
      default:
        return { bg: '#f5f5f5', text: '#999', label: status };
    }
  };

  const getCrLevelStyle = (level?: string) => {
    switch (level) {
      case 'urgent':
        return { bg: '#fff1f0', text: '#ff4d4f', label: '紧急' };
      case 'tight':
        return { bg: '#fff7e6', text: '#fa8c16', label: '较紧' };
      case 'sufficient':
        return { bg: '#f6ffed', text: '#52c41a', label: '充裕' };
      default:
        return { bg: '#f5f5f5', text: '#999', label: '' };
    }
  };

  const getSourceBadge = (plan: DisplayPlan) => {
    switch (plan.sourceType) {
      case 'customer_order':
        return (
          <View style={[styles.sourceBadge, { backgroundColor: '#e6f7ff' }]}>
            <Text style={[styles.sourceBadgeText, { color: '#1890ff' }]}>客户订单</Text>
          </View>
        );
      case 'mixed_batch':
        return (
          <View style={[styles.sourceBadge, { backgroundColor: '#f9f0ff' }]}>
            <Text style={[styles.sourceBadgeText, { color: DISPATCHER_THEME.primary }]}>混批</Text>
          </View>
        );
      case 'ai_forecast':
        return (
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sourceBadge}
          >
            <Text style={[styles.sourceBadgeText, { color: '#fff' }]}>AI预测</Text>
          </LinearGradient>
        );
      case 'safety_stock':
        return (
          <View style={[styles.sourceBadge, { backgroundColor: '#f6ffed', borderWidth: 1, borderColor: '#b7eb8f' }]}>
            <Text style={[styles.sourceBadgeText, { color: '#52c41a' }]}>安全库存</Text>
          </View>
        );
      default:
        return null;
    }
  };

  const renderPlanCard = (plan: DisplayPlan) => {
    const statusStyle = getStatusStyle(plan.status);
    const crStyle = getCrLevelStyle(plan.crLevel);
    const isExpanded = expandedMixedBatch === plan.id;

    return (
      <TouchableOpacity
        key={plan.id}
        style={styles.planCard}
        onPress={() => navigation.navigate('PlanDetail', { planId: plan.id })}
      >
        {/* Header */}
        <View style={styles.planHeader}>
          <View style={styles.planIdRow}>
            <Text style={styles.planId}>{plan.planNumber}</Text>
            {plan.isMixedBatch && (
              <View style={styles.mixedBadge}>
                <Text style={styles.mixedBadgeText}>混批</Text>
              </View>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
          </View>
        </View>

        {/* Info */}
        <Text style={styles.planInfo}>
          {plan.productName} · {plan.quantity}{plan.unit}
          {plan.mergedOrderCount && (
            <Text style={styles.mergedCount}> (合并{plan.mergedOrderCount}个订单)</Text>
          )}
        </Text>
        <Text style={styles.planWorkshop}>{plan.workshopName} · {plan.supervisorName}</Text>

        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressFill, { width: `${plan.progress}%` }]} />
        </View>

        {/* Source Info */}
        <View style={styles.sourceSection}>
          <View style={styles.sourceRow}>
            <Text style={styles.sourceLabel}>来源:</Text>
            {getSourceBadge(plan)}
            {plan.sourceType === 'customer_order' && (
              <Text style={styles.customerName}>{plan.customerName}</Text>
            )}
            {plan.sourceType === 'mixed_batch' && (
              <Text style={styles.relatedOrdersText}>
                {plan.relatedOrders?.map(o => o.orderId).join(' + ')}
              </Text>
            )}
            {plan.sourceType === 'ai_forecast' && (
              <Text style={styles.forecastReason}>{plan.forecastReason}</Text>
            )}
            {plan.sourceType === 'safety_stock' && (
              <Text style={styles.stockWarning}>库存低于30%触发</Text>
            )}
          </View>

          <View style={styles.sourceMetaRow}>
            {plan.crValue !== undefined && (
              <View style={styles.crValueContainer}>
                <Text style={styles.crLabel}>CR值: </Text>
                <Text style={[styles.crValue, { color: crStyle.text }]}>{plan.crValue}</Text>
                <View style={[styles.crBadge, { backgroundColor: crStyle.bg }]}>
                  <Text style={[styles.crBadgeText, { color: crStyle.text }]}>{crStyle.label}</Text>
                </View>
              </View>
            )}
            {plan.deadline && (
              <Text style={styles.deadlineText}>
                {plan.sourceType === 'mixed_batch' ? '最早交期' : '交期'}: {plan.deadline}
              </Text>
            )}
            {plan.sourceType === 'ai_forecast' && plan.aiConfidence && (
              <View style={styles.confidenceContainer}>
                <Text style={styles.confidenceLabel}>预测置信度:</Text>
                <Text style={styles.confidenceValue}>{plan.aiConfidence}%</Text>
                <MaterialCommunityIcons name="check-circle" size={12} color="#52c41a" />
              </View>
            )}
            {plan.sourceType === 'ai_forecast' && plan.season && (
              <Text style={styles.seasonText}>季节性: <Text style={{ color: '#1890ff' }}>{plan.season}</Text></Text>
            )}
            {plan.sourceType === 'safety_stock' && plan.stockLevel !== undefined && (
              <Text style={styles.stockLevel}>
                当前库存: <Text style={{ color: '#ff4d4f' }}>{plan.stockLevel}%</Text>
              </Text>
            )}
          </View>
        </View>

        {/* Mixed Batch Details */}
        {plan.isMixedBatch && (
          <TouchableOpacity
            style={styles.mixedDetails}
            onPress={() => setExpandedMixedBatch(isExpanded ? null : plan.id)}
          >
            <View style={styles.mixedDetailsHeader}>
              <MaterialCommunityIcons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={DISPATCHER_THEME.primary}
              />
              <Text style={styles.mixedDetailsTitle}>混批详情</Text>
            </View>
            {isExpanded && plan.relatedOrders && (
              <View style={styles.mixedOrdersList}>
                {plan.relatedOrders.map((order, index) => (
                  <Text key={order.orderId} style={styles.mixedOrderItem}>
                    {index === plan.relatedOrders!.length - 1 ? '└─' : '├─'} {order.orderId}:{' '}
                    <Text style={{ color: '#333' }}>{order.customerName}</Text> {order.quantity}袋
                  </Text>
                ))}
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Tags */}
        <View style={styles.tagsRow}>
          {plan.tags?.map((tag, index) => (
            <View
              key={index}
              style={[
                styles.tag,
                tag.includes('已') ? styles.tagMatched : styles.tagPending,
                tag.includes('高') ? styles.tagHighPriority : {},
              ]}
            >
              <Text style={[
                styles.tagText,
                tag.includes('已') ? styles.tagMatchedText : styles.tagPendingText,
                tag.includes('高') ? styles.tagHighPriorityText : {},
              ]}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>生产计划</Text>
        <TouchableOpacity onPress={() => navigation.navigate('PlanCreate')}>
          <Text style={styles.addButton}>+ 新建</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Filters */}
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterSelect}>
            <Text style={styles.filterSelectText}>{selectedStatus}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterSelect}>
            <Text style={styles.filterSelectText}>{selectedWorkshop}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterSelect}>
            <Text style={styles.filterSelectText}>{selectedDate}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Source Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipContainer}
        >
          {sourceOptions.map((source) => (
            <TouchableOpacity
              key={source}
              style={[styles.chip, selectedSource === source && styles.chipActive]}
              onPress={() => setSelectedSource(source)}
            >
              <Text style={[styles.chipText, selectedSource === source && styles.chipTextActive]}>
                {source}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search Box */}
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索计划编号/产品名称..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* Quick Entry */}
        <View style={styles.quickEntryRow}>
          <TouchableOpacity style={styles.quickEntry} onPress={() => navigation.navigate('PlanGantt')}>
            <MaterialCommunityIcons name="chart-gantt" size={24} color={DISPATCHER_THEME.secondary} />
            <Text style={styles.quickEntryText}>甘特图</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickEntry} onPress={() => navigation.navigate('UrgentInsert')}>
            <MaterialCommunityIcons name="lightning-bolt" size={24} color="#ff4d4f" />
            <Text style={styles.quickEntryText}>紧急插单</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickEntry, styles.quickEntryWithBadge]} onPress={() => navigation.navigate('MixedBatch')}>
            <View style={styles.quickEntryBadge}>
              <Text style={styles.quickEntryBadgeText}>3</Text>
            </View>
            <MaterialCommunityIcons name="view-grid" size={24} color={DISPATCHER_THEME.primary} />
            <Text style={styles.quickEntryText}>混批排产</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickEntry} onPress={() => navigation.navigate('ResourceOverview')}>
            <MaterialCommunityIcons name="monitor-dashboard" size={24} color="#52c41a" />
            <Text style={styles.quickEntryText}>资源总览</Text>
          </TouchableOpacity>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>今日计划 ({plans.length}个)</Text>
        </View>

        {/* Plan Cards */}
        {plans.map(renderPlanCard)}

        {/* Load More */}
        <Text style={styles.loadMore}>加载更多...</Text>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    fontSize: 14,
    color: DISPATCHER_THEME.secondary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterSelect: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterSelectText: {
    fontSize: 12,
    color: '#666',
  },
  chipScroll: {
    marginBottom: 12,
  },
  chipContainer: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  chipActive: {
    backgroundColor: DISPATCHER_THEME.primary,
    borderColor: DISPATCHER_THEME.primary,
  },
  chipText: {
    fontSize: 12,
    color: '#666',
  },
  chipTextActive: {
    color: '#fff',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  quickEntryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickEntry: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  quickEntryWithBadge: {
    position: 'relative',
  },
  quickEntryBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ff4d4f',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  quickEntryBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  quickEntryText: {
    fontSize: 11,
    color: '#333',
    marginTop: 4,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  mixedBadge: {
    backgroundColor: DISPATCHER_THEME.primary,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  mixedBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  planInfo: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  mergedCount: {
    fontSize: 11,
    color: '#999',
  },
  planWorkshop: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: DISPATCHER_THEME.primary,
    borderRadius: 2,
  },
  sourceSection: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
    marginTop: 2,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sourceLabel: {
    fontSize: 11,
    color: '#666',
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  customerName: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  relatedOrdersText: {
    fontSize: 11,
    color: DISPATCHER_THEME.primary,
  },
  forecastReason: {
    fontSize: 12,
    color: '#333',
  },
  stockWarning: {
    fontSize: 12,
    color: '#fa8c16',
  },
  sourceMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  crValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  crLabel: {
    fontSize: 11,
    color: '#666',
  },
  crValue: {
    fontSize: 11,
    fontWeight: '600',
  },
  crBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  crBadgeText: {
    fontSize: 10,
  },
  deadlineText: {
    fontSize: 11,
    color: '#666',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  confidenceLabel: {
    fontSize: 11,
    color: '#666',
  },
  confidenceValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#52c41a',
  },
  seasonText: {
    fontSize: 11,
    color: '#666',
  },
  stockLevel: {
    fontSize: 11,
    color: '#666',
  },
  mixedDetails: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fafafa',
    borderRadius: 6,
  },
  mixedDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mixedDetailsTitle: {
    fontSize: 11,
    color: DISPATCHER_THEME.primary,
  },
  mixedOrdersList: {
    paddingLeft: 16,
    marginTop: 6,
  },
  mixedOrderItem: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  tagMatched: {
    backgroundColor: '#f6ffed',
  },
  tagPending: {
    backgroundColor: '#fff7e6',
  },
  tagHighPriority: {
    backgroundColor: '#fff1f0',
  },
  tagText: {
    fontSize: 10,
  },
  tagMatchedText: {
    color: '#52c41a',
  },
  tagPendingText: {
    color: '#fa8c16',
  },
  tagHighPriorityText: {
    color: '#ff4d4f',
  },
  loadMore: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    paddingVertical: 20,
  },
});
