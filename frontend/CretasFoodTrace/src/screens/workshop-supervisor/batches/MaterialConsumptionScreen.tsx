/**
 * 原料消耗记录页面 — 真实API版
 *
 * 功能:
 * - 查看批次的BOM物料清单 (计划量 vs 实际量 vs 差异)
 * - 录入实际领料用量 (POST /batches/{batchId}/material-consumption)
 * - BOM达成率统计
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, Modal, TextInput as RNTextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Icon } from 'react-native-paper';
import { WSBatchesStackParamList } from '../../../types/navigation';
import { materialConsumptionApiClient, BatchConsumptionSummary, MaterialConsumptionSummaryItem } from '../../../services/api/materialConsumptionApiClient';
import { processingApiClient } from '../../../services/api/processingApiClient';

type RouteProps = RouteProp<WSBatchesStackParamList, 'MaterialConsumption'>;

export function MaterialConsumptionScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const batchId = route.params?.batchId || '';

  // Data state
  const [loading, setLoading] = useState(true);
  const [batchInfo, setBatchInfo] = useState<{ batchNumber: string; productName: string; status: string } | null>(null);
  const [summary, setSummary] = useState<BatchConsumptionSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Input modal state
  const [inputVisible, setInputVisible] = useState(false);
  const [inputMaterial, setInputMaterial] = useState<MaterialConsumptionSummaryItem | null>(null);
  const [inputQty, setInputQty] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // Load batch info
      const batchRes = await processingApiClient.getBatchById(batchId) as any;
      if (batchRes?.success && batchRes.data) {
        setBatchInfo({
          batchNumber: batchRes.data.batchNumber || batchId,
          productName: batchRes.data.productType || batchRes.data.productName || '-',
          status: batchRes.data.status || '-',
        });
      }

      // Load consumption summary (BOM achievement)
      const summaryRes = await materialConsumptionApiClient.getBatchConsumptionSummary(batchId);
      if (summaryRes?.success && summaryRes.data) {
        setSummary(summaryRes.data);
      }
    } catch (e) {
      console.error('加载消耗数据失败:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [batchId]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // Open input modal for a specific material
  const handleRecordUsage = (material: MaterialConsumptionSummaryItem) => {
    setInputMaterial(material);
    setInputQty('');
    setInputVisible(true);
  };

  // Submit consumption record
  const handleSubmit = async () => {
    if (!inputMaterial || !inputQty) return;
    const qty = parseFloat(inputQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('提示', '请输入有效的数量');
      return;
    }

    setSubmitting(true);
    try {
      await processingApiClient.recordMaterialConsumption(batchId, {
        materialId: (inputMaterial as any).materialTypeId || inputMaterial.materialTypeName,
        quantity: qty,
        timestamp: new Date().toISOString(),
      });
      Alert.alert('录入成功', `${inputMaterial.materialTypeName} 实际用量 ${qty}`);
      setInputVisible(false);
      loadData(); // refresh
    } catch (e) {
      Alert.alert('录入失败', e instanceof Error ? e.message : '请重试');
    } finally {
      setSubmitting(false);
    }
  };

  // Achievement rate color
  const getColor = (rate: number) => rate >= 95 ? '#52c41a' : rate >= 85 ? '#faad14' : '#ff4d4f';

  const renderMaterial = ({ item }: { item: MaterialConsumptionSummaryItem }) => {
    const hasActual = item.actualQuantity > 0;
    const rate = item.plannedQuantity > 0 ? (item.actualQuantity / item.plannedQuantity) * 100 : 0;

    return (
      <View style={s.card}>
        <View style={s.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.materialName}>{item.materialTypeName}</Text>
          </View>
          {hasActual ? (
            <View style={[s.badge, { backgroundColor: getColor(rate) + '18' }]}>
              <Text style={[s.badgeText, { color: getColor(rate) }]}>{rate.toFixed(1)}%</Text>
            </View>
          ) : (
            <View style={[s.badge, { backgroundColor: '#fff7e6' }]}>
              <Text style={[s.badgeText, { color: '#faad14' }]}>待领料</Text>
            </View>
          )}
        </View>

        <View style={s.qtyRow}>
          <View style={s.qtyItem}>
            <Text style={s.qtyLabel}>计划量</Text>
            <Text style={s.qtyValue}>{item.plannedQuantity}</Text>
          </View>
          <View style={s.qtyDivider} />
          <View style={s.qtyItem}>
            <Text style={s.qtyLabel}>实际量</Text>
            <Text style={[s.qtyValue, !hasActual && { color: '#ccc' }]}>
              {hasActual ? item.actualQuantity : '-'}
            </Text>
          </View>
          <View style={s.qtyDivider} />
          <View style={s.qtyItem}>
            <Text style={s.qtyLabel}>差异</Text>
            {hasActual ? (
              <Text style={[s.qtyValue, { color: item.variance > 0 ? '#ff4d4f' : item.variance < 0 ? '#52c41a' : '#333' }]}>
                {item.variance > 0 ? '+' : ''}{item.variance.toFixed(1)}
              </Text>
            ) : (
              <Text style={[s.qtyValue, { color: '#ccc' }]}>-</Text>
            )}
          </View>
        </View>

        <TouchableOpacity style={s.recordBtn} onPress={() => handleRecordUsage(item)}>
          <Icon source="pencil-plus-outline" size={16} color="#667eea" />
          <Text style={s.recordBtnText}>{hasActual ? '更新用量' : '录入实际用量'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={s.container}>
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon source="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>原料消耗</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      </View>
    );
  }

  const materials = summary?.materials || [];
  const overallRate = summary?.overallAchievementRate || 0;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>原料消耗</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Icon source="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Batch info card */}
      <View style={s.batchCard}>
        <View>
          <Text style={s.batchNumber}>{batchInfo?.batchNumber || batchId}</Text>
          <Text style={s.batchProduct}>{batchInfo?.productName || '-'}</Text>
        </View>
        {overallRate > 0 && (
          <View style={[s.rateBadge, { backgroundColor: getColor(overallRate) + '30' }]}>
            <Text style={[s.rateText, { color: getColor(overallRate) }]}>
              达成率 {overallRate.toFixed(1)}%
            </Text>
          </View>
        )}
      </View>

      {/* Stats */}
      {summary && (
        <View style={s.statsCard}>
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statValue}>{materials.length}</Text>
              <Text style={s.statLabel}>物料种类</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statValue}>{summary.totalPlannedQuantity.toFixed(0)}</Text>
              <Text style={s.statLabel}>计划总量</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={[s.statValue, { color: '#52c41a' }]}>
                {summary.totalActualQuantity.toFixed(0)}
              </Text>
              <Text style={s.statLabel}>实际总量</Text>
            </View>
          </View>
        </View>
      )}

      {/* Material list */}
      <View style={s.listHeader}>
        <Text style={s.listTitle}>BOM物料清单</Text>
        <Text style={s.listSubtitle}>{materials.filter(m => m.actualQuantity > 0).length}/{materials.length} 已录入</Text>
      </View>

      {materials.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Icon source="package-variant" size={48} color="#ddd" />
          <Text style={{ color: '#999', marginTop: 12, fontSize: 14 }}>暂无BOM物料数据</Text>
          <Text style={{ color: '#bbb', marginTop: 4, fontSize: 12 }}>请先在Web端设置产品的BOM清单</Text>
        </View>
      ) : (
        <FlatList
          data={materials}
          renderItem={renderMaterial}
          keyExtractor={(item, idx) => `${item.materialTypeName}-${idx}`}
          contentContainerStyle={s.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}

      {/* Input Modal */}
      <Modal visible={inputVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>录入实际用量</Text>
            <Text style={s.modalMaterial}>{inputMaterial?.materialTypeName}</Text>

            <View style={s.modalInfoRow}>
              <Text style={s.modalInfoLabel}>计划用量</Text>
              <Text style={s.modalInfoValue}>{inputMaterial?.plannedQuantity ?? 0}</Text>
            </View>
            {(inputMaterial?.actualQuantity ?? 0) > 0 && (
              <View style={s.modalInfoRow}>
                <Text style={s.modalInfoLabel}>已录入</Text>
                <Text style={s.modalInfoValue}>{inputMaterial?.actualQuantity}</Text>
              </View>
            )}

            <RNTextInput
              style={s.modalInput}
              placeholder="输入实际用量"
              keyboardType="decimal-pad"
              value={inputQty}
              onChangeText={setInputQty}
              autoFocus
            />

            {/* Quick fill buttons */}
            {inputMaterial && (
              <View style={s.quickRow}>
                <Text style={{ fontSize: 13, color: '#666' }}>快捷:</Text>
                {[inputMaterial.plannedQuantity, Math.round(inputMaterial.plannedQuantity * 0.95)].filter(v => v > 0).map(v => (
                  <TouchableOpacity key={v} style={s.quickBtn} onPress={() => setInputQty(String(v))}>
                    <Text style={s.quickBtnText}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setInputVisible(false)}>
                <Text style={s.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalSubmitBtn, (!inputQty || submitting) && { opacity: 0.5 }]}
                onPress={handleSubmit}
                disabled={!inputQty || submitting}
              >
                {submitting ? <ActivityIndicator color="#fff" size="small" /> :
                  <Text style={s.modalSubmitText}>确认录入</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#667eea',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },

  // Batch card
  batchCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#667eea', marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, padding: 16,
  },
  batchNumber: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  batchProduct: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  rateBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  rateText: { fontSize: 13, fontWeight: '600' },

  // Stats
  statsCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 30, backgroundColor: '#f0f0f0' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 4 },

  // List
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  listTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
  listSubtitle: { fontSize: 13, color: '#999' },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  // Material card
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  materialName: { fontSize: 16, fontWeight: '600', color: '#333' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '500' },

  qtyRow: { flexDirection: 'row', backgroundColor: '#f8f9fa', borderRadius: 8, padding: 10 },
  qtyItem: { flex: 1, alignItems: 'center' },
  qtyDivider: { width: 1, backgroundColor: '#e8e8e8' },
  qtyLabel: { fontSize: 11, color: '#999' },
  qtyValue: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 4 },

  recordBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 10, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#667eea', borderStyle: 'dashed',
  },
  recordBtnText: { fontSize: 13, color: '#667eea', fontWeight: '500' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 4 },
  modalMaterial: { fontSize: 15, color: '#667eea', fontWeight: '600', marginBottom: 16 },
  modalInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  modalInfoLabel: { fontSize: 14, color: '#999' },
  modalInfoValue: { fontSize: 14, fontWeight: '600', color: '#333' },
  modalInput: {
    fontSize: 20, fontWeight: '600', borderWidth: 1, borderColor: '#e8e8e8',
    borderRadius: 10, padding: 14, marginTop: 12, backgroundColor: '#fafafa',
  },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  quickBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#667eea' },
  quickBtnText: { color: '#667eea', fontSize: 14, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#f5f5f5' },
  modalCancelText: { fontSize: 16, color: '#666' },
  modalSubmitBtn: { flex: 2, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#667eea' },
  modalSubmitText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});

export default MaterialConsumptionScreen;
