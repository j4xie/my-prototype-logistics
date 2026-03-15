import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { processingApiClient, type ProcessingBatch } from '../../services/api/processingApiClient';
import { workReportingApiClient } from '../../services/api/workReportingApiClient';
import { useFieldVisibilityStore } from '../../store/fieldVisibilityStore';
import { useDraftReportStore } from '../../store/draftReportStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { CheckinWorkerDTO } from '../../types/workReporting';

interface CheckedInWorker extends CheckinWorkerDTO {
  individualOutput: string;
}

const HIRE_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  FULL_TIME:  { bg: '#DBEAFE', text: '#1D4ED8' },
  TEMPORARY:  { bg: '#FEF3C7', text: '#92400E' },
  DISPATCH:   { bg: '#EDE9FE', text: '#6D28D9' },
  INTERN:     { bg: '#D1FAE5', text: '#059669' },
  PART_TIME:  { bg: '#F3F4F6', text: '#374151' },
};

const useTeamFieldVisibility = () => {
  const { isFieldVisible } = useFieldVisibilityStore();
  return { showNotes: isFieldVisible('WORK_SESSION', 'notes') };
};

interface BatchOption {
  id: number;
  batchNumber: string;
  productName: string;
  status: string;
}

const TeamBatchReportScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { showNotes } = useTeamFieldVisibility();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startingBatch, setStartingBatch] = useState(false);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchOption | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  // Team total output (primary)
  const [teamTotalOutput, setTeamTotalOutput] = useState('');
  const [teamGoodQty, setTeamGoodQty] = useState('');
  const [teamDefectQty, setTeamDefectQty] = useState('');
  const [teamNotes, setTeamNotes] = useState('');

  // Checked-in workers from real checkin API
  const [checkedInWorkers, setCheckedInWorkers] = useState<CheckedInWorker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [showIndividual, setShowIndividual] = useState(false);

  useEffect(() => {
    loadActiveBatches();
  }, []);

  const parseBatchList = (res: { success?: boolean; data?: { content?: ProcessingBatch[] } }): BatchOption[] => {
    if (!res?.success) return [];
    const content = res.data?.content || [];
    return content.map((b) => ({
      id: b.id,
      batchNumber: b.batchNumber,
      productName: b.productType || '',
      status: b.status,
    }));
  };

  const loadActiveBatches = async () => {
    try {
      const [inProgressRes, plannedRes] = await Promise.all([
        processingApiClient.getBatches({
          factoryId: factoryId ?? undefined,
          status: 'IN_PROGRESS',
          supervisorId: user?.id,
          page: 1, size: 50,
        }),
        processingApiClient.getBatches({
          factoryId: factoryId ?? undefined,
          status: 'PLANNED',
          supervisorId: user?.id,
          page: 1, size: 50,
        }),
      ]);

      const myBatches = [
        ...parseBatchList(inProgressRes),
        ...parseBatchList(plannedRes),
      ];

      if (myBatches.length > 0) {
        setBatches(myBatches);
        setIsFallback(false);
      } else {
        const fallbackRes = await processingApiClient.getBatches({
          factoryId: factoryId ?? undefined,
          status: 'IN_PROGRESS',
          page: 1, size: 50,
        });
        const fallbackBatches = parseBatchList(fallbackRes);
        setBatches(fallbackBatches);
        setIsFallback(fallbackBatches.length > 0);
      }
    } catch (error) {
      console.error('Load batches failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchPress = (batch: BatchOption) => {
    if (batch.status === 'PLANNED') {
      Alert.alert(
        '开始生产',
        `批次 ${batch.batchNumber} 尚未开始生产，是否立即开始？`,
        [
          { text: '取消', style: 'cancel' },
          { text: '开始生产', onPress: () => startAndSelectBatch(batch) },
        ],
      );
    } else {
      selectBatch(batch);
    }
  };

  const startAndSelectBatch = async (batch: BatchOption) => {
    if (!user?.id) return;
    setStartingBatch(true);
    try {
      const res = await processingApiClient.startProduction(
        batch.id.toString(), user.id, factoryId ?? undefined,
      );
      if (res?.success) {
        const updated = { ...batch, status: 'IN_PROGRESS' };
        setBatches(prev => prev.map(b => b.id === batch.id ? updated : b));
        selectBatch(updated);
      } else {
        Alert.alert('开始失败', res?.message || '无法开始生产');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '开始生产失败';
      Alert.alert('开始失败', msg);
    } finally {
      setStartingBatch(false);
    }
  };

  const selectBatch = async (batch: BatchOption) => {
    setSelectedBatch(batch);
    setLoadingWorkers(true);
    try {
      const res = await workReportingApiClient.getCheckinList(batch.id, factoryId ?? undefined);
      if (res?.success && res.data) {
        const workers: CheckedInWorker[] = (Array.isArray(res.data) ? res.data : []).map(w => ({
          ...w,
          individualOutput: '',
        }));
        setCheckedInWorkers(workers);
      } else {
        setCheckedInWorkers([]);
      }
    } catch (error) {
      console.error('Load checkin list failed:', error);
      setCheckedInWorkers([]);
    } finally {
      setLoadingWorkers(false);
    }
  };

  const updateWorkerOutput = (idx: number, value: string) => {
    setCheckedInWorkers(prev => {
      const updated = [...prev];
      const existing = updated[idx];
      if (existing) {
        updated[idx] = { ...existing, individualOutput: value };
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!selectedBatch) return;
    const total = parseInt(teamTotalOutput, 10);
    if (!total || total <= 0) {
      Alert.alert('请填写团队总产出');
      return;
    }

    setSubmitting(true);
    try {
      const membersWithOutput = checkedInWorkers
        .filter(w => w.individualOutput && parseInt(w.individualOutput, 10) > 0)
        .map(w => ({
          userId: w.employeeId,
          outputQuantity: parseInt(w.individualOutput, 10),
        }));

      const result = await processingApiClient.submitTeamBatchReport({
        batchId: selectedBatch.id,
        totalOutput: total,
        totalGoodQuantity: teamGoodQty ? parseInt(teamGoodQty, 10) : undefined,
        totalDefectQuantity: teamDefectQty ? parseInt(teamDefectQty, 10) : undefined,
        reportTime: new Date().toISOString(),
        notes: teamNotes || undefined,
        members: membersWithOutput.length > 0 ? membersWithOutput : undefined,
      });

      const data = result.data;
      Alert.alert(
        '提交成功',
        `团队总产出: ${data?.totalOutput ?? total}\n${data?.recordedMembers ? `个人明细: ${data.recordedMembers}人` : '纯团队报工'}`,
        [{ text: '确定', onPress: () => navigation.goBack() }],
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '提交失败';
      Alert.alert('提交失败', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    if (!selectedBatch) return;
    const total = parseInt(teamTotalOutput, 10) || 0;
    const { addDraft } = useDraftReportStore.getState();
    addDraft({
      batchId: selectedBatch.id,
      batchNumber: selectedBatch.batchNumber,
      productName: selectedBatch.productName || '',
      outputQuantity: total,
      goodQuantity: teamGoodQty ? parseInt(teamGoodQty, 10) : 0,
      defectQuantity: teamDefectQty ? parseInt(teamDefectQty, 10) : 0,
      notes: teamNotes,
      factoryId: factoryId || '',
      draftType: 'TEAM_BATCH',
      teamMembers: checkedInWorkers.map(w => ({
        userId: w.employeeId,
        userName: w.fullName || `员工${w.employeeId}`,
        output: w.individualOutput,
        goodQty: '',
        defectQty: '',
        notes: '',
        position: w.position ?? undefined,
        hireTypeLabel: w.hireTypeLabel ?? undefined,
      })),
    });
    Alert.alert('已保存', '草稿已保存，可在草稿管理中查看', [
      { text: '确定', onPress: () => navigation.goBack() },
    ]);
  };

  const resetSelection = () => {
    setSelectedBatch(null);
    setCheckedInWorkers([]);
    setTeamTotalOutput('');
    setTeamGoodQty('');
    setTeamDefectQty('');
    setTeamNotes('');
    setShowIndividual(false);
  };

  const getHireTypeStyle = (hireType: string | null) => {
    if (!hireType) return HIRE_TYPE_STYLES.FULL_TIME;
    return HIRE_TYPE_STYLES[hireType] || HIRE_TYPE_STYLES.FULL_TIME;
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#4F46E5" /></View>;

  return (
    <View style={styles.safe}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity testID="header-back-btn" onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>班组批量报工</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {startingBatch && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={{ marginTop: 8, color: '#4F46E5' }}>正在开始生产...</Text>
          </View>
        )}

        {!selectedBatch ? (
          <>
            <Text style={styles.subtitle}>选择生产批次:</Text>
            {isFallback && (
              <View style={styles.fallbackBanner}>
                <MaterialCommunityIcons name="information-outline" size={16} color="#92400E" />
                <Text style={styles.fallbackText}>当前显示全工厂批次（无分配给您的批次）</Text>
              </View>
            )}
            {batches.map(b => (
              <TouchableOpacity key={b.id} style={styles.batchItem} onPress={() => handleBatchPress(b)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.batchNumber}>{b.batchNumber}</Text>
                  <Text style={styles.batchProduct}>{b.productName || '未知产品'}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  b.status === 'IN_PROGRESS' ? styles.statusInProgress : styles.statusPlanned,
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    b.status === 'IN_PROGRESS' ? styles.statusInProgressText : styles.statusPlannedText,
                  ]}>
                    {b.status === 'IN_PROGRESS' ? '进行中' : '待开始'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            {batches.length === 0 && (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="clipboard-text-off-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>暂无可用批次</Text>
                <Text style={styles.emptySubtext}>请联系调度员分配生产批次</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Selected batch header */}
            <View style={styles.selectedBatch}>
              <Text style={styles.selectedLabel}>已选批次:</Text>
              <Text style={styles.selectedValue}>{selectedBatch.batchNumber} - {selectedBatch.productName}</Text>
              <TouchableOpacity onPress={resetSelection}>
                <Text style={styles.changeText}>更换</Text>
              </TouchableOpacity>
            </View>

            {/* Report time */}
            <View style={styles.timeRow}>
              <MaterialCommunityIcons name="clock-outline" size={16} color="#6B7280" />
              <Text style={styles.timeText}>
                报工时间: {new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}（自动）
              </Text>
            </View>

            {/* Team total output (primary) */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>团队总产出 *</Text>
              <View style={styles.totalInputRow}>
                <TextInput
                  style={styles.totalInput}
                  keyboardType="numeric"
                  placeholder="输入团队总产出"
                  placeholderTextColor="#9CA3AF"
                  value={teamTotalOutput}
                  onChangeText={setTeamTotalOutput}
                />
                <Text style={styles.unitText}>kg</Text>
              </View>
              <View style={styles.subInputRow}>
                <View style={styles.subInputWrapper}>
                  <Text style={styles.inputLabel}>良品数</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="同总产出"
                    value={teamGoodQty}
                    onChangeText={setTeamGoodQty}
                  />
                </View>
                <View style={styles.subInputWrapper}>
                  <Text style={styles.inputLabel}>不良品</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="0"
                    value={teamDefectQty}
                    onChangeText={setTeamDefectQty}
                  />
                </View>
              </View>
              {showNotes && (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.inputLabel}>备注</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="备注（可选）"
                    value={teamNotes}
                    onChangeText={setTeamNotes}
                  />
                </View>
              )}
            </View>

            {/* Individual detail (optional) */}
            <TouchableOpacity
              style={styles.individualToggle}
              onPress={() => setShowIndividual(!showIndividual)}
            >
              <MaterialCommunityIcons
                name={showIndividual ? 'chevron-down' : 'chevron-right'}
                size={20} color="#4F46E5"
              />
              <Text style={styles.individualToggleText}>个人产量明细（可选）</Text>
              {loadingWorkers ? (
                <ActivityIndicator size="small" color="#4F46E5" style={{ marginLeft: 8 }} />
              ) : (
                <Text style={styles.workerCount}>已签到 {checkedInWorkers.length}人</Text>
              )}
            </TouchableOpacity>

            {showIndividual && (
              <View style={styles.individualSection}>
                {checkedInWorkers.length === 0 ? (
                  <View style={styles.noWorkersBanner}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#92400E" />
                    <Text style={styles.noWorkersText}>暂无已签到工人，请先在签到管理中签到</Text>
                  </View>
                ) : (
                  checkedInWorkers.map((worker, idx) => {
                    const htStyle = getHireTypeStyle(worker.hireType);
                    return (
                      <View key={worker.sessionId} style={styles.workerCard}>
                        <View style={styles.workerHeader}>
                          <Text style={styles.workerName}>
                            {worker.fullName || `员工${worker.employeeId}`}
                          </Text>
                          {worker.position && (
                            <View style={styles.positionBadge}>
                              <Text style={styles.positionText}>{worker.position}</Text>
                            </View>
                          )}
                          <View style={[styles.hireTypeBadge, { backgroundColor: htStyle?.bg }]}>
                            <Text style={[styles.hireTypeText, { color: htStyle?.text }]}>
                              {worker.hireTypeLabel || '正式工'}
                            </Text>
                          </View>
                          {worker.checkInTime && (
                            <Text style={styles.checkinTime}>
                              {worker.checkInTime.split(' ')[1] || worker.checkInTime}
                            </Text>
                          )}
                        </View>
                        <View style={styles.workerInputRow}>
                          <Text style={styles.inputLabel}>个人产量</Text>
                          <TextInput
                            style={[styles.input, { flex: 1, marginLeft: 8 }]}
                            keyboardType="numeric"
                            placeholder="选填"
                            value={worker.individualOutput}
                            onChangeText={v => updateWorkerOutput(idx, v)}
                          />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitButton, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>提交本时段报工</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveDraftButton} onPress={handleSaveDraft}>
              <MaterialCommunityIcons name="content-save-outline" size={18} color="#4F46E5" />
              <Text style={styles.saveDraftText}>保存草稿</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  content: { padding: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1F2937' },
  subtitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  batchItem: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  batchNumber: { fontSize: 15, fontWeight: '600', color: '#4F46E5' },
  batchProduct: { fontSize: 14, color: '#666', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  statusInProgress: { backgroundColor: '#DBEAFE' },
  statusInProgressText: { color: '#1D4ED8' },
  statusPlanned: { backgroundColor: '#FEF3C7' },
  statusPlannedText: { color: '#92400E' },
  fallbackBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginBottom: 12, gap: 6 },
  fallbackText: { fontSize: 13, color: '#92400E', flex: 1 },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubtext: { textAlign: 'center', color: '#D1D5DB', fontSize: 14, marginTop: 4 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  selectedBatch: { backgroundColor: '#EEF2FF', borderRadius: 10, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  selectedLabel: { fontSize: 14, color: '#666', marginRight: 8 },
  selectedValue: { flex: 1, fontSize: 14, fontWeight: '600', color: '#4F46E5' },
  changeText: { color: '#EF4444', fontSize: 14 },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
  timeText: { fontSize: 13, color: '#6B7280' },
  sectionCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 10 },
  totalInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  totalInput: {
    flex: 1, borderWidth: 1.5, borderColor: '#4F46E5', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '600', color: '#1F2937',
  },
  unitText: { fontSize: 16, color: '#6B7280', marginLeft: 8, fontWeight: '500' },
  subInputRow: { flexDirection: 'row', gap: 10 },
  subInputWrapper: { flex: 1 },
  inputLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  individualToggle: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF',
    borderRadius: 8, padding: 12, marginBottom: 8,
  },
  individualToggleText: { fontSize: 14, fontWeight: '600', color: '#4F46E5', marginLeft: 4, flex: 1 },
  workerCount: { fontSize: 13, color: '#6B7280' },
  individualSection: { marginBottom: 12 },
  noWorkersBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7',
    borderRadius: 8, padding: 12, gap: 8,
  },
  noWorkersText: { fontSize: 13, color: '#92400E', flex: 1 },
  workerCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  workerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 },
  workerName: { fontSize: 15, fontWeight: '600', color: '#333' },
  positionBadge: { backgroundColor: '#F3F4F6', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  positionText: { fontSize: 11, color: '#374151' },
  hireTypeBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  hireTypeText: { fontSize: 11, fontWeight: '500' },
  checkinTime: { fontSize: 12, color: '#9CA3AF' },
  workerInputRow: { flexDirection: 'row', alignItems: 'center' },
  submitButton: { backgroundColor: '#4F46E5', paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  saveDraftButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, paddingVertical: 12, marginTop: 10,
    borderWidth: 1, borderColor: '#C7D2FE', backgroundColor: '#EEF2FF', gap: 6,
  },
  saveDraftText: { color: '#4F46E5', fontSize: 15, fontWeight: '500' },
});

export default TeamBatchReportScreen;
