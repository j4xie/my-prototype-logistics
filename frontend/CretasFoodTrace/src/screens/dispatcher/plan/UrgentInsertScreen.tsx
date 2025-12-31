/**
 * 紧急插单屏幕
 *
 * 功能：
 * - 输入紧急订单信息
 * - AI 分析可用时段
 * - 显示影响分析
 * - 确认并创建紧急计划
 *
 * @version 1.0.0
 * @since 2025-12-29
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
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  DISPATCHER_THEME,
  InsertSlot,
  ImpactedPlan,
  ConfirmUrgentInsertRequest,
  UrgentInsertImpactAnalysis,
} from '../../../types/dispatcher';
import { schedulingApiClient } from '../../../services/api/schedulingApiClient';
import { productTypeApiClient } from '../../../services/api/productTypeApiClient';

/** 产品类型 */
interface ProductType {
  id: string;
  name: string;
  unit?: string;
}

export default function UrgentInsertScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showImpactModal, setShowImpactModal] = useState(false);

  // 产品类型列表
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // 表单状态
  const [productTypeId, setProductTypeId] = useState('');
  const [productTypeName, setProductTypeName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [deadline, setDeadline] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState<'normal' | 'urgent' | 'critical'>('urgent');
  const [customerName, setCustomerName] = useState('');
  const [urgentReason, setUrgentReason] = useState('');
  const [notes, setNotes] = useState('');

  // 分析结果
  const [insertSlots, setInsertSlots] = useState<InsertSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<InsertSlot | null>(null);
  const [selectedImpact, setSelectedImpact] = useState<UrgentInsertImpactAnalysis | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const [showProductPicker, setShowProductPicker] = useState(false);

  // 加载产品类型
  useEffect(() => {
    loadProductTypes();
  }, []);

  const loadProductTypes = async () => {
    setLoadingProducts(true);
    try {
      const response = await productTypeApiClient.getProductTypes({ page: 1, limit: 50 });
      if (response.data && Array.isArray(response.data)) {
        setProductTypes(response.data.map((pt: { id: string; name: string; unit?: string }) => ({
          id: pt.id,
          name: pt.name,
          unit: pt.unit ?? 'kg',
        })));
      }
    } catch (error) {
      console.error('Failed to load product types:', error);
      // 使用备用数据
      setProductTypes([
        { id: 'PT001', name: '带鱼片', unit: 'kg' },
        { id: 'PT002', name: '黄鱼片', unit: 'kg' },
        { id: 'PT003', name: '鱿鱼圈', unit: 'kg' },
      ]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadProductTypes();
      if (hasAnalyzed) {
        await analyzeSlots();
      }
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [hasAnalyzed]);

  const selectProduct = (product: ProductType) => {
    setProductTypeId(product.id);
    setProductTypeName(product.name);
    setShowProductPicker(false);
  };

  const analyzeSlots = async () => {
    if (!productTypeId || !quantity) {
      Alert.alert('提示', '请填写产品类型和数量');
      return;
    }

    setAnalyzing(true);
    try {
      // 调用真实 API 获取可用时段
      const response = await schedulingApiClient.getAvailableSlots(3);

      if (response.success && response.data) {
        // 后端返回的 recommendScore 是 0-100，需要转换为 0-1
        const slots = response.data.map(slot => ({
          ...slot,
          recommendScore: slot.recommendScore > 1 ? slot.recommendScore / 100 : slot.recommendScore,
          productionLineName: slot.productionLineName ?? `时段 ${slot.id.slice(0, 8)}`,
        }));
        setInsertSlots(slots);
        setHasAnalyzed(true);
      } else {
        Alert.alert('错误', response.message ?? '获取可用时段失败');
      }
    } catch (error) {
      console.error('Failed to analyze:', error);
      Alert.alert('错误', '分析失败，请检查网络连接');
    } finally {
      setAnalyzing(false);
    }
  };

  const selectSlot = async (slot: InsertSlot) => {
    setSelectedSlot(slot);

    // 获取详细影响分析
    if (productTypeId && quantity) {
      try {
        const response = await schedulingApiClient.analyzeSlotImpact(
          slot.id,
          productTypeId,
          parseFloat(quantity)
        );
        if (response.success && response.data) {
          setSelectedImpact(response.data);
        }
      } catch (error) {
        console.error('Failed to analyze impact:', error);
      }
    }
  };

  const confirmInsert = async () => {
    if (!selectedSlot) {
      Alert.alert('提示', '请选择一个时段');
      return;
    }

    if (!urgentReason) {
      Alert.alert('提示', '请填写紧急原因');
      return;
    }

    // 如果影响等级高，显示额外确认
    if (selectedSlot.impactLevel === 'high' || selectedSlot.impactLevel === 'critical') {
      Alert.alert(
        '高影响警告',
        `此时段影响等级为"${selectedSlot.impactLevel === 'high' ? '高' : '严重'}"，是否确认插单？可能需要管理员审批。`,
        [
          { text: '取消', style: 'cancel' },
          { text: '继续', onPress: () => setShowConfirm(true) },
        ]
      );
    } else {
      setShowConfirm(true);
    }
  };

  const executeInsert = async () => {
    if (!selectedSlot) return;

    setLoading(true);
    try {
      const request: ConfirmUrgentInsertRequest = {
        slotId: selectedSlot.id,
        productTypeId,
        plannedQuantity: parseFloat(quantity),
        urgentReason: urgentReason || `${urgencyLevel === 'critical' ? '加急' : '紧急'}订单`,
        priority: urgencyLevel === 'critical' ? 10 : urgencyLevel === 'urgent' ? 8 : 5,
        requestedDeadline: deadline || undefined,
        customerName: customerName || undefined,
        notes: notes || undefined,
        forceInsert: selectedSlot.impactLevel === 'high' || selectedSlot.impactLevel === 'critical',
      };

      let response;
      if (request.forceInsert) {
        // 高影响使用强制插单 (需要审批)
        response = await schedulingApiClient.forceUrgentInsert(request);
      } else {
        // 正常插单
        response = await schedulingApiClient.confirmUrgentInsert(request);
      }

      if (response.success && response.data) {
        const plan = response.data;
        // 检查是否需要审批（修复：使用 approvalStatus 而非 requiresApproval）
        const needsApproval = plan.approvalStatus === 'PENDING';

        Alert.alert(
          needsApproval ? '提交审批成功' : '插单成功',
          needsApproval
            ? `紧急计划 ${plan.planNumber} 已创建，等待工厂经理审批。\n\n影响等级: ${selectedSlot.impactLevel === 'high' ? '高' : '严重'}\n受影响计划: ${selectedSlot.impactedPlans?.length ?? 0} 个`
            : `紧急计划 ${plan.planNumber} 已创建，可立即执行。`,
          [{ text: '确定', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('错误', response.message ?? '插单失败');
      }
    } catch (error) {
      console.error('Failed to insert:', error);
      Alert.alert('错误', '插单失败，请重试');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  const getImpactColor = (level: string) => {
    switch (level) {
      case 'none': return { bg: '#f6ffed', text: '#52c41a', label: '无影响' };
      case 'low': return { bg: '#e6f7ff', text: '#1890ff', label: '低影响' };
      case 'medium': return { bg: '#fff7e6', text: '#fa8c16', label: '中影响' };
      case 'high': return { bg: '#fff1f0', text: '#ff4d4f', label: '高影响' };
      default: return { bg: '#f5f5f5', text: '#999', label: '未知' };
    }
  };

  const renderSlotCard = (slot: InsertSlot) => {
    const impactColor = getImpactColor(slot.impactLevel);
    const isSelected = selectedSlot?.id === slot.id;

    return (
      <TouchableOpacity
        key={slot.id}
        style={[
          styles.slotCard,
          isSelected && styles.slotCardSelected,
        ]}
        onPress={() => selectSlot(slot)}
      >
        <View style={styles.slotHeader}>
          <View style={styles.slotLineInfo}>
            <Text style={styles.slotLineName}>{slot.productionLineName}</Text>
            <Text style={styles.slotTime}>{slot.startTime} - {slot.endTime}</Text>
          </View>
          <View style={[styles.impactBadge, { backgroundColor: impactColor.bg }]}>
            <Text style={[styles.impactBadgeText, { color: impactColor.text }]}>
              {impactColor.label}
            </Text>
          </View>
        </View>

        <View style={styles.slotStats}>
          <View style={styles.slotStatItem}>
            <MaterialCommunityIcons name="gauge" size={16} color="#666" />
            <Text style={styles.slotStatText}>产能: {slot.availableCapacity}kg/h</Text>
          </View>
          <View style={styles.slotStatItem}>
            <MaterialCommunityIcons name="account-group" size={16} color="#666" />
            <Text style={styles.slotStatText}>
              人员: {slot.availableWorkers}/{slot.requiredWorkers}
            </Text>
          </View>
          <View style={styles.slotStatItem}>
            <MaterialCommunityIcons name="swap-horizontal" size={16} color="#666" />
            <Text style={styles.slotStatText}>换产: {slot.switchCostMinutes}分钟</Text>
          </View>
        </View>

        {/* AI 推荐分数 */}
        <View style={styles.scoreRow}>
          <View style={styles.scoreBar}>
            <View
              style={[
                styles.scoreBarFill,
                {
                  width: `${slot.recommendScore * 100}%`,
                  backgroundColor: slot.recommendScore > 0.7 ? '#52c41a' : slot.recommendScore > 0.5 ? '#fa8c16' : '#ff4d4f',
                },
              ]}
            />
          </View>
          <Text style={styles.scoreText}>AI推荐 {Math.round(slot.recommendScore * 100)}%</Text>
        </View>

        {/* 评分分解 (多维度评分) */}
        {slot.scoreBreakdown && (
          <View style={styles.scoreBreakdown}>
            <View style={styles.scoreFactorRow}>
              <View style={styles.scoreFactor}>
                <Text style={styles.scoreFactorLabel}>产能</Text>
                <View style={styles.miniScoreBar}>
                  <View style={[styles.miniScoreBarFill, { width: `${slot.scoreBreakdown.capacityFactor * 100}%` }]} />
                </View>
              </View>
              <View style={styles.scoreFactor}>
                <Text style={styles.scoreFactorLabel}>人员</Text>
                <View style={styles.miniScoreBar}>
                  <View style={[styles.miniScoreBarFill, { width: `${slot.scoreBreakdown.workerFactor * 100}%` }]} />
                </View>
              </View>
              <View style={styles.scoreFactor}>
                <Text style={styles.scoreFactorLabel}>交期</Text>
                <View style={styles.miniScoreBar}>
                  <View style={[styles.miniScoreBarFill, { width: `${slot.scoreBreakdown.deadlineFactor * 100}%` }]} />
                </View>
              </View>
            </View>
            <View style={styles.scoreFactorRow}>
              <View style={styles.scoreFactor}>
                <Text style={styles.scoreFactorLabel}>影响</Text>
                <View style={styles.miniScoreBar}>
                  <View style={[styles.miniScoreBarFill, { width: `${slot.scoreBreakdown.impactFactor * 100}%`, backgroundColor: '#1890ff' }]} />
                </View>
              </View>
              <View style={styles.scoreFactor}>
                <Text style={styles.scoreFactorLabel}>换产</Text>
                <View style={styles.miniScoreBar}>
                  <View style={[styles.miniScoreBarFill, { width: `${slot.scoreBreakdown.switchCostFactor * 100}%`, backgroundColor: '#722ed1' }]} />
                </View>
              </View>
              <View style={styles.scoreFactor} />
            </View>
          </View>
        )}

        {/* 推荐说明 */}
        {slot.recommendation && (
          <View style={styles.recommendationRow}>
            <MaterialCommunityIcons name="lightbulb-on" size={14} color="#52c41a" />
            <Text style={styles.recommendationText}>{slot.recommendation}</Text>
          </View>
        )}

        {/* 影响的计划 */}
        {slot.impactedPlans && slot.impactedPlans.length > 0 && (
          <View style={styles.impactedPlans}>
            <Text style={styles.impactedPlansTitle}>受影响的计划：</Text>
            {slot.impactedPlans.map(plan => (
              <View key={plan.planId} style={styles.impactedPlan}>
                <Text style={styles.impactedPlanNumber}>{plan.planNumber}</Text>
                <Text style={styles.impactedPlanDelay}>延迟 {plan.delayMinutes} 分钟</Text>
              </View>
            ))}
          </View>
        )}

        {/* 查看详细影响分析按钮 */}
        {isSelected && selectedImpact && (
          <TouchableOpacity
            style={styles.viewImpactButton}
            onPress={() => setShowImpactModal(true)}
          >
            <MaterialCommunityIcons name="chart-timeline-variant" size={16} color={DISPATCHER_THEME.primary} />
            <Text style={styles.viewImpactText}>查看详细影响分析</Text>
          </TouchableOpacity>
        )}

        {isSelected && (
          <View style={styles.selectedIndicator}>
            <MaterialCommunityIcons name="check-circle" size={24} color={DISPATCHER_THEME.primary} />
          </View>
        )}
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
            <MaterialCommunityIcons name="lightning-bolt" size={24} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>紧急插单</Text>
        </View>

        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* 订单信息表单 */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="clipboard-text" size={20} color="#333" />
            <Text style={styles.cardTitle}>订单信息</Text>
          </View>

          {/* 产品类型 */}
          <View style={styles.formRow}>
            <Text style={styles.label}>产品类型 <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity
              style={styles.selectInput}
              onPress={() => setShowProductPicker(true)}
            >
              <Text style={productTypeName ? styles.selectText : styles.selectPlaceholder}>
                {productTypeName || '请选择产品类型'}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {/* 数量 */}
          <View style={styles.formRow}>
            <Text style={styles.label}>数量 (kg) <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.textInput}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              placeholder="请输入数量"
              placeholderTextColor="#999"
            />
          </View>

          {/* 交期 */}
          <View style={styles.formRow}>
            <Text style={styles.label}>交期 <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.textInput}
              value={deadline}
              onChangeText={setDeadline}
              placeholder="例：2025-12-29 18:00"
              placeholderTextColor="#999"
            />
          </View>

          {/* 紧急程度 */}
          <View style={styles.formRow}>
            <Text style={styles.label}>紧急程度</Text>
            <View style={styles.urgencySelector}>
              {(['normal', 'urgent', 'critical'] as const).map(level => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.urgencyOption,
                    urgencyLevel === level && styles.urgencyOptionActive,
                    level === 'critical' && urgencyLevel === level && { backgroundColor: '#ff4d4f' },
                  ]}
                  onPress={() => setUrgencyLevel(level)}
                >
                  <Text
                    style={[
                      styles.urgencyOptionText,
                      urgencyLevel === level && styles.urgencyOptionTextActive,
                    ]}
                  >
                    {level === 'normal' ? '普通' : level === 'urgent' ? '紧急' : '加急'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 客户名称 */}
          <View style={styles.formRow}>
            <Text style={styles.label}>客户名称</Text>
            <TextInput
              style={styles.textInput}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="请输入客户名称"
              placeholderTextColor="#999"
            />
          </View>

          {/* 紧急原因 */}
          <View style={styles.formRow}>
            <Text style={styles.label}>紧急原因 <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={urgentReason}
              onChangeText={setUrgentReason}
              placeholder="请说明紧急插单的原因（如：客户紧急订单、生产设备故障补产等）"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* 备注 */}
          <View style={styles.formRow}>
            <Text style={styles.label}>备注</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="请输入备注信息"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* 分析按钮 */}
        {!hasAnalyzed && (
          <TouchableOpacity onPress={analyzeSlots} disabled={analyzing}>
            <LinearGradient
              colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.analyzeButton}
            >
              {analyzing ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.analyzeButtonText}>AI 分析中...</Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="robot" size={20} color="#fff" />
                  <Text style={styles.analyzeButtonText}>AI 分析可用时段</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* 可用时段列表 */}
        {hasAnalyzed && (
          <View style={styles.slotsSection}>
            <View style={styles.slotsHeader}>
              <Text style={styles.slotsTitle}>可用时段</Text>
              <TouchableOpacity onPress={analyzeSlots}>
                <Text style={styles.reanalyzeText}>重新分析</Text>
              </TouchableOpacity>
            </View>

            {insertSlots.length > 0 ? (
              insertSlots.map(renderSlotCard)
            ) : (
              <View style={styles.noSlots}>
                <MaterialCommunityIcons name="calendar-remove" size={48} color="#ccc" />
                <Text style={styles.noSlotsText}>暂无可用时段</Text>
              </View>
            )}
          </View>
        )}

        {/* 确认按钮 */}
        {hasAnalyzed && selectedSlot && (
          <TouchableOpacity onPress={confirmInsert}>
            <LinearGradient
              colors={['#52c41a', '#73d13d']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmButton}
            >
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>确认插单</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 产品选择器 Modal */}
      <Modal
        visible={showProductPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProductPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProductPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择产品类型</Text>
              <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {productTypes.map(product => (
                <TouchableOpacity
                  key={product.id}
                  style={styles.productOption}
                  onPress={() => selectProduct(product)}
                >
                  <Text style={styles.productOptionText}>{product.name}</Text>
                  <Text style={styles.productOptionUnit}>{product.unit}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 确认对话框 */}
      <Modal
        visible={showConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirm(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmContent}>
            <MaterialCommunityIcons name="alert-circle" size={48} color="#fa8c16" />
            <Text style={styles.confirmTitle}>确认插单？</Text>
            <Text style={styles.confirmDesc}>
              将在 {selectedSlot?.productionLineName} 创建紧急生产计划，
              可能影响 {selectedSlot?.impactedPlans?.length || 0} 个现有计划。
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowConfirm(false)}
              >
                <Text style={styles.confirmCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmOkBtn}
                onPress={executeInsert}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmOkText}>确认</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 影响分析详情 Modal */}
      <Modal
        visible={showImpactModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowImpactModal(false)}
      >
        <View style={styles.impactModalOverlay}>
          <View style={styles.impactModalContent}>
            <View style={styles.impactModalHeader}>
              <Text style={styles.impactModalTitle}>影响分析详情</Text>
              <TouchableOpacity onPress={() => setShowImpactModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.impactModalBody}>
              {selectedImpact && (
                <>
                  {/* 影响等级 */}
                  <View style={styles.impactSection}>
                    <Text style={styles.impactSectionTitle}>影响等级</Text>
                    <View style={[
                      styles.impactLevelBadge,
                      { backgroundColor: getImpactColor(selectedImpact.impactLevel).bg }
                    ]}>
                      <Text style={[
                        styles.impactLevelText,
                        { color: getImpactColor(selectedImpact.impactLevel).text }
                      ]}>
                        {getImpactColor(selectedImpact.impactLevel).label}
                      </Text>
                    </View>
                    {selectedImpact.requiresApproval && (
                      <View style={styles.approvalWarning}>
                        <MaterialCommunityIcons name="alert" size={16} color="#fa8c16" />
                        <Text style={styles.approvalWarningText}>
                          需要 {selectedImpact.approverRole === 'FACTORY_MANAGER' ? '工厂经理' : '生产主管'} 审批
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* 链式影响统计 */}
                  {selectedImpact.chainImpact && (
                    <View style={styles.impactSection}>
                      <Text style={styles.impactSectionTitle}>链式影响统计</Text>
                      <View style={styles.chainStatsGrid}>
                        <View style={styles.chainStatItem}>
                          <Text style={styles.chainStatValue}>{selectedImpact.chainImpact.directConflicts}</Text>
                          <Text style={styles.chainStatLabel}>直接冲突</Text>
                        </View>
                        <View style={styles.chainStatItem}>
                          <Text style={styles.chainStatValue}>{selectedImpact.chainImpact.cascadeDelays}</Text>
                          <Text style={styles.chainStatLabel}>级联延误</Text>
                        </View>
                        <View style={styles.chainStatItem}>
                          <Text style={styles.chainStatValue}>{selectedImpact.chainImpact.maxDelayMinutes}</Text>
                          <Text style={styles.chainStatLabel}>最大延误(分钟)</Text>
                        </View>
                        {selectedImpact.chainImpact.criticalCrPlans !== undefined && (
                          <View style={styles.chainStatItem}>
                            <Text style={[styles.chainStatValue, { color: '#ff4d4f' }]}>
                              {selectedImpact.chainImpact.criticalCrPlans}
                            </Text>
                            <Text style={styles.chainStatLabel}>紧急CR计划</Text>
                          </View>
                        )}
                      </View>
                      {selectedImpact.chainImpact.affectsVipCustomer && (
                        <View style={styles.vipWarning}>
                          <MaterialCommunityIcons name="star" size={16} color="#faad14" />
                          <Text style={styles.vipWarningText}>影响VIP客户订单</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* 资源影响 */}
                  {selectedImpact.resourceImpact && (
                    <View style={styles.impactSection}>
                      <Text style={styles.impactSectionTitle}>资源影响</Text>
                      {selectedImpact.resourceImpact.workerOvertime !== undefined && selectedImpact.resourceImpact.workerOvertime > 0 && (
                        <View style={styles.resourceItem}>
                          <MaterialCommunityIcons name="account-clock" size={16} color="#fa8c16" />
                          <Text style={styles.resourceItemText}>
                            需要加班 {selectedImpact.resourceImpact.workerOvertime} 分钟
                          </Text>
                        </View>
                      )}
                      {selectedImpact.resourceImpact.equipmentConflicts && selectedImpact.resourceImpact.equipmentConflicts.length > 0 && (
                        <View style={styles.resourceItem}>
                          <MaterialCommunityIcons name="cog-off" size={16} color="#ff4d4f" />
                          <Text style={styles.resourceItemText}>
                            设备冲突: {selectedImpact.resourceImpact.equipmentConflicts.join(', ')}
                          </Text>
                        </View>
                      )}
                      {selectedImpact.resourceImpact.materialShortage && (
                        <View style={styles.resourceItem}>
                          <MaterialCommunityIcons name="package-variant-closed" size={16} color="#ff4d4f" />
                          <Text style={styles.resourceItemText}>原料库存不足</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* 受影响计划列表 */}
                  {selectedImpact.affectedPlans && selectedImpact.affectedPlans.length > 0 && (
                    <View style={styles.impactSection}>
                      <Text style={styles.impactSectionTitle}>
                        受影响计划 ({selectedImpact.affectedPlans.length})
                      </Text>
                      {selectedImpact.affectedPlans.map((plan, index) => (
                        <View key={plan.planId || index} style={styles.affectedPlanCard}>
                          <View style={styles.affectedPlanHeader}>
                            <Text style={styles.affectedPlanNumber}>{plan.planNumber}</Text>
                            {plan.isVip && (
                              <View style={styles.vipBadge}>
                                <MaterialCommunityIcons name="star" size={12} color="#faad14" />
                              </View>
                            )}
                          </View>
                          <Text style={styles.affectedPlanProduct}>{plan.productName}</Text>
                          <View style={styles.affectedPlanTime}>
                            <Text style={styles.affectedPlanTimeLabel}>原定结束:</Text>
                            <Text style={styles.affectedPlanTimeValue}>{plan.originalEndTime}</Text>
                          </View>
                          <View style={styles.affectedPlanTime}>
                            <Text style={styles.affectedPlanTimeLabel}>预计延迟:</Text>
                            <Text style={[styles.affectedPlanTimeValue, { color: '#ff4d4f' }]}>
                              {plan.delayMinutes} 分钟
                            </Text>
                          </View>
                          {plan.crValue !== undefined && (
                            <View style={styles.affectedPlanCr}>
                              <Text style={styles.affectedPlanCrLabel}>CR值:</Text>
                              <Text style={[
                                styles.affectedPlanCrValue,
                                { color: plan.crValue < 0.5 ? '#ff4d4f' : '#52c41a' }
                              ]}>
                                {plan.crValue.toFixed(2)}
                              </Text>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* AI 建议 */}
                  {selectedImpact.recommendation && (
                    <View style={styles.impactSection}>
                      <Text style={styles.impactSectionTitle}>AI 建议</Text>
                      <View style={styles.recommendationCard}>
                        <MaterialCommunityIcons name="robot" size={20} color={DISPATCHER_THEME.primary} />
                        <Text style={styles.recommendationCardText}>{selectedImpact.recommendation}</Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.impactModalCloseBtn}
              onPress={() => setShowImpactModal(false)}
            >
              <Text style={styles.impactModalCloseBtnText}>关闭</Text>
            </TouchableOpacity>
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
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  formRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  required: {
    color: '#ff4d4f',
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  selectText: {
    fontSize: 14,
    color: '#333',
  },
  selectPlaceholder: {
    fontSize: 14,
    color: '#999',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  urgencySelector: {
    flexDirection: 'row',
    gap: 8,
  },
  urgencyOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  urgencyOptionActive: {
    backgroundColor: DISPATCHER_THEME.primary,
  },
  urgencyOptionText: {
    fontSize: 14,
    color: '#666',
  },
  urgencyOptionTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  analyzeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  slotsSection: {
    marginTop: 8,
  },
  slotsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  slotsTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  reanalyzeText: {
    fontSize: 14,
    color: DISPATCHER_THEME.primary,
  },
  slotCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  slotCardSelected: {
    borderColor: DISPATCHER_THEME.primary,
    backgroundColor: '#f9f5ff',
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  slotLineInfo: {
    flex: 1,
  },
  slotLineName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  slotTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  impactBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  impactBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  slotStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  slotStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slotStatText: {
    fontSize: 12,
    color: '#666',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  scoreBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreText: {
    fontSize: 12,
    color: '#666',
    width: 70,
    textAlign: 'right',
  },
  scoreBreakdown: {
    backgroundColor: '#fafafa',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  scoreFactorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  scoreFactor: {
    flex: 1,
    marginHorizontal: 4,
  },
  scoreFactorLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },
  miniScoreBar: {
    height: 4,
    backgroundColor: '#e8e8e8',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniScoreBarFill: {
    height: '100%',
    backgroundColor: '#52c41a',
    borderRadius: 2,
  },
  recommendationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 12,
    color: '#52c41a',
    flex: 1,
  },
  impactedPlans: {
    backgroundColor: '#fff7e6',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  impactedPlansTitle: {
    fontSize: 12,
    color: '#fa8c16',
    marginBottom: 4,
  },
  impactedPlan: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  impactedPlanNumber: {
    fontSize: 12,
    color: '#666',
  },
  impactedPlanDelay: {
    fontSize: 12,
    color: '#ff4d4f',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  noSlots: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noSlotsText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  productOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  productOptionText: {
    fontSize: 16,
    color: '#333',
  },
  productOptionUnit: {
    fontSize: 14,
    color: '#999',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  confirmContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  confirmDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 14,
    color: '#666',
  },
  confirmOkBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: DISPATCHER_THEME.primary,
    alignItems: 'center',
  },
  confirmOkText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  // View Impact Button styles
  viewImpactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  viewImpactText: {
    fontSize: 13,
    color: DISPATCHER_THEME.primary,
  },
  // Impact Modal styles
  impactModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  impactModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  impactModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  impactModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  impactModalBody: {
    padding: 16,
  },
  impactSection: {
    marginBottom: 20,
  },
  impactSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  impactLevelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 8,
  },
  impactLevelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  approvalWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff7e6',
    padding: 8,
    borderRadius: 6,
  },
  approvalWarningText: {
    fontSize: 13,
    color: '#fa8c16',
  },
  chainStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chainStatItem: {
    width: '45%',
    backgroundColor: '#fafafa',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  chainStatValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  chainStatLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  vipWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbe6',
    padding: 8,
    borderRadius: 6,
    marginTop: 12,
  },
  vipWarningText: {
    fontSize: 13,
    color: '#ad8b00',
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resourceItemText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  affectedPlanCard: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  affectedPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  affectedPlanNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  vipBadge: {
    backgroundColor: '#fffbe6',
    padding: 2,
    borderRadius: 4,
  },
  affectedPlanProduct: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  affectedPlanTime: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  affectedPlanTimeLabel: {
    fontSize: 12,
    color: '#999',
  },
  affectedPlanTimeValue: {
    fontSize: 12,
    color: '#666',
  },
  affectedPlanCr: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  affectedPlanCrLabel: {
    fontSize: 12,
    color: '#999',
  },
  affectedPlanCrValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f9f5ff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: DISPATCHER_THEME.primary,
  },
  recommendationCardText: {
    fontSize: 13,
    color: '#333',
    flex: 1,
    lineHeight: 20,
  },
  impactModalCloseBtn: {
    margin: 16,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  impactModalCloseBtnText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});
