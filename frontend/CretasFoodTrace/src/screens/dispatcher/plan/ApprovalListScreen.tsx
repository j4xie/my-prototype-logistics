/**
 * 强制插单审批列表页面
 *
 * 功能：
 * - 显示所有待审批的强制插单
 * - 审批/拒绝操作
 * - 查看影响分析详情
 *
 * @version 1.0.0
 * @since 2025-12-31
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { DISPATCHER_THEME, ProductionPlanDTO } from '../../../types/dispatcher';
import { schedulingApiClient } from '../../../services/api/schedulingApiClient';
import ApprovalConfirmDialog from '../../../components/approval/ApprovalConfirmDialog';

export default function ApprovalListScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState<ProductionPlanDTO[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ProductionPlanDTO | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  const loadPendingApprovals = async () => {
    setLoading(true);
    try {
      const response = await schedulingApiClient.getPendingApprovals();
      if (response.success && response.data) {
        setPendingApprovals(response.data);
      } else {
        Alert.alert('错误', response.message ?? '加载失败');
      }
    } catch (error) {
      console.error('Failed to load pending approvals:', error);
      Alert.alert('错误', '加载失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPendingApprovals();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleApprove = async (comment?: string) => {
    if (!selectedPlan) return;

    try {
      const response = await schedulingApiClient.approveForceInsert(
        selectedPlan.id,
        comment
      );

      if (response.success) {
        Alert.alert('成功', `计划 ${selectedPlan.planNumber} 已批准`, [
          {
            text: '确定',
            onPress: () => {
              setShowApprovalDialog(false);
              setSelectedPlan(null);
              loadPendingApprovals();
            },
          },
        ]);
      } else {
        Alert.alert('错误', response.message ?? '审批失败');
      }
    } catch (error) {
      console.error('Failed to approve:', error);
      Alert.alert('错误', '审批失败，请重试');
      throw error;
    }
  };

  const handleReject = async (reason: string) => {
    if (!selectedPlan) return;

    try {
      const response = await schedulingApiClient.rejectForceInsert(
        selectedPlan.id,
        reason
      );

      if (response.success) {
        Alert.alert('成功', `计划 ${selectedPlan.planNumber} 已拒绝`, [
          {
            text: '确定',
            onPress: () => {
              setShowApprovalDialog(false);
              setSelectedPlan(null);
              loadPendingApprovals();
            },
          },
        ]);
      } else {
        Alert.alert('错误', response.message ?? '拒绝失败');
      }
    } catch (error) {
      console.error('Failed to reject:', error);
      Alert.alert('错误', '拒绝失败，请重试');
      throw error;
    }
  };

  const openApprovalDialog = (plan: ProductionPlanDTO) => {
    setSelectedPlan(plan);
    setShowApprovalDialog(true);
  };

  const getUrgencyColor = (priority?: number) => {
    if (!priority) return '#999';
    if (priority >= 10) return '#ff4d4f';
    if (priority >= 8) return '#fa8c16';
    return '#52c41a';
  };

  const getUrgencyLabel = (priority?: number) => {
    if (!priority) return '普通';
    if (priority >= 10) return '加急';
    if (priority >= 8) return '紧急';
    return '普通';
  };

  const formatDateTime = (dateTime?: string) => {
    if (!dateTime) return '-';
    const date = new Date(dateTime);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderApprovalCard = (plan: ProductionPlanDTO) => {
    const urgencyColor = getUrgencyColor(plan.priority);
    const urgencyLabel = getUrgencyLabel(plan.priority);

    return (
      <TouchableOpacity
        key={plan.id}
        style={styles.approvalCard}
        onPress={() => openApprovalDialog(plan)}
      >
        {/* 头部 */}
        <View style={styles.cardHeader}>
          <View style={styles.planInfo}>
            <Text style={styles.planNumber}>{plan.planNumber}</Text>
            <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor + '20' }]}>
              <Text style={[styles.urgencyText, { color: urgencyColor }]}>
                {urgencyLabel}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#999" />
        </View>

        {/* 产品信息 */}
        <View style={styles.cardSection}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="package-variant" size={16} color="#666" />
            <Text style={styles.infoText}>
              {plan.productTypeName || '未知产品'} × {plan.plannedQuantity} kg
            </Text>
          </View>
          {plan.sourceCustomerName && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="account" size={16} color="#666" />
              <Text style={styles.infoText}>{plan.sourceCustomerName}</Text>
            </View>
          )}
        </View>

        {/* 强制插单原因 */}
        {plan.forceInsertReason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>强制插单原因:</Text>
            <Text style={styles.reasonText} numberOfLines={2}>
              {plan.forceInsertReason}
            </Text>
          </View>
        )}

        {/* 时间信息 */}
        <View style={styles.cardFooter}>
          <View style={styles.timeInfo}>
            <MaterialCommunityIcons name="clock-outline" size={14} color="#999" />
            <Text style={styles.timeText}>
              提交时间: {formatDateTime(plan.forceInsertedAt)}
            </Text>
          </View>
          {plan.expectedCompletionDate && (
            <View style={styles.timeInfo}>
              <MaterialCommunityIcons name="calendar-clock" size={14} color="#999" />
              <Text style={styles.timeText}>
                交期: {plan.expectedCompletionDate}
              </Text>
            </View>
          )}
        </View>

        {/* 待审批标签 */}
        <View style={styles.pendingBadge}>
          <MaterialCommunityIcons name="clock-alert" size={14} color="#fa8c16" />
          <Text style={styles.pendingText}>待审批</Text>
        </View>
      </TouchableOpacity>
    );
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

        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="file-document-edit" size={24} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>审批管理</Text>
          {pendingApprovals.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingApprovals.length}</Text>
            </View>
          )}
        </View>

        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : pendingApprovals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>暂无待审批项目</Text>
            <Text style={styles.emptyHint}>所有强制插单申请都已处理</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsBar}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{pendingApprovals.length}</Text>
                <Text style={styles.statLabel}>待审批</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {pendingApprovals.filter(p => (p.priority ?? 0) >= 10).length}
                </Text>
                <Text style={styles.statLabel}>加急</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {pendingApprovals.filter(p => (p.priority ?? 0) >= 8 && (p.priority ?? 0) < 10).length}
                </Text>
                <Text style={styles.statLabel}>紧急</Text>
              </View>
            </View>

            {pendingApprovals.map(renderApprovalCard)}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 审批对话框 */}
      {selectedPlan && (
        <ApprovalConfirmDialog
          visible={showApprovalDialog}
          onClose={() => {
            setShowApprovalDialog(false);
            setSelectedPlan(null);
          }}
          onApprove={handleApprove}
          onReject={handleReject}
          planData={{
            planNumber: selectedPlan.planNumber,
            productName: selectedPlan.productTypeName,
            quantity: selectedPlan.plannedQuantity,
            impactLevel: selectedPlan.priority && selectedPlan.priority >= 10 ? 'critical' : 'high',
            impactedPlanCount: 0, // TODO: 从影响分析获取
            forceInsertReason: selectedPlan.forceInsertReason,
            customerName: selectedPlan.sourceCustomerName,
          }}
        />
      )}
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
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  badge: {
    backgroundColor: '#ff4d4f',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  emptyHint: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 16,
  },
  approvalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  planNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardSection: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  reasonBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  reasonLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  pendingBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff7e6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pendingText: {
    fontSize: 11,
    color: '#fa8c16',
    fontWeight: '500',
  },
});
