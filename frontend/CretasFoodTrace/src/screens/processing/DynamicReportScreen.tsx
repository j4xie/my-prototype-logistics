import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useReportWorkflow } from '../../hooks/useReportWorkflow';
import { processingApiClient, type ProcessingBatch } from '../../services/api/processingApiClient';
import { workReportingApiClient } from '../../services/api/workReportingApiClient';
import { useAuthStore } from '../../store/authStore';
import { useDraftReportStore } from '../../store/draftReportStore';
import type { WSHomeStackParamList } from '../../types/navigation';
import type { WorkReportSubmitRequest, HourEntry } from '../../types/workReporting';
import { formatDate } from '../../utils/formatters';

type DynamicReportRoute = RouteProp<WSHomeStackParamList, 'DynamicReport'>;

interface ActiveBatch {
  id: number;
  batchNumber: string;
  productName: string;
  status: string;
}

export default function DynamicReportScreen() {
  const navigation = useNavigation();
  const route = useRoute<DynamicReportRoute>();
  const insets = useSafeAreaInsets();
  const { reportType } = route.params;
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;

  const { schema, loading, submitting, submitReport, isFieldVisible } = useReportWorkflow(reportType);

  // Batch context state
  const [activeBatches, setActiveBatches] = useState<ActiveBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<ActiveBatch | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // Form state
  const [processCategory, setProcessCategory] = useState('');
  const [productName, setProductName] = useState('');
  const [outputQuantity, setOutputQuantity] = useState('');
  const [goodQuantity, setGoodQuantity] = useState('');
  const [defectQuantity, setDefectQuantity] = useState('');
  const [operationVolume, setOperationVolume] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [hourEntry, setHourEntry] = useState<HourEntry>({});

  const isProgress = reportType === 'PROGRESS';
  const title = isProgress ? '实时生产进度上报' : '生产工时上报';
  const today = new Date().toISOString().split('T')[0] ?? '';

  // Load active batches on mount
  useEffect(() => {
    loadActiveBatches();
  }, []);

  const loadActiveBatches = async () => {
    setBatchLoading(true);
    try {
      const res = await processingApiClient.getBatches({
        factoryId: factoryId ?? undefined,
        status: 'IN_PROGRESS',
        page: 1, size: 50,
      });
      if (res?.success) {
        const content: ProcessingBatch[] = res.data?.content || [];
        const batchList: ActiveBatch[] = content.map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          productName: b.productType || '',
          status: b.status,
        }));
        setActiveBatches(batchList);
        // Auto-select if only one batch
        const first = batchList[0];
        if (batchList.length === 1 && first) {
          handleSelectBatch(first);
        }
      }
    } catch (error) {
      console.warn('Failed to load batches for context:', error);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleSelectBatch = async (batch: ActiveBatch) => {
    setSelectedBatch(batch);
    // Auto-fill product name
    if (batch.productName) {
      setProductName(batch.productName);
      setProcessCategory(batch.productName);
    }
    // Auto-fill worker count from checkin list
    try {
      const checkinRes = await workReportingApiClient.getCheckinList(batch.id);
      if (checkinRes?.success && Array.isArray(checkinRes.data)) {
        const workingCount = checkinRes.data.filter(
          (c: { status?: string }) => c.status === 'working'
        ).length;
        if (workingCount > 0) {
          setHourEntry(prev => ({ ...prev, fullTimeWorkers: workingCount }));
        }
        // Auto-set start time from earliest checkin
        const checkinTimes = checkinRes.data
          .map((c: { checkInTime?: string }) => c.checkInTime)
          .filter(Boolean)
          .sort();
        if (checkinTimes.length > 0) {
          const earliest = checkinTimes[0]!;
          const timeStr = earliest.includes('T') ? earliest.split('T')[1]?.substring(0, 5) : earliest.substring(11, 16);
          if (timeStr) setStartTime(timeStr);
        }
        // Default end time to current time
        const now = new Date();
        setEndTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      }
    } catch {
      // Checkin data is optional, don't block the flow
    }
  };

  const clearBatchSelection = () => {
    setSelectedBatch(null);
    setProductName('');
    setProcessCategory('');
    setStartTime('');
    setEndTime('');
    setHourEntry({});
  };

  const handleSubmit = useCallback(async () => {
    if (isProgress && !processCategory) {
      Alert.alert('提示', '请填写生产类目/工序');
      return;
    }
    if (!isProgress && !productName) {
      Alert.alert('提示', '请填写商品名称');
      return;
    }

    const data: WorkReportSubmitRequest = {
      reportType,
      reportDate: today,
      processCategory: isProgress ? processCategory : undefined,
      productName: !isProgress ? productName : undefined,
      outputQuantity: outputQuantity ? parseFloat(outputQuantity) : undefined,
      goodQuantity: goodQuantity ? parseFloat(goodQuantity) : undefined,
      defectQuantity: defectQuantity ? parseFloat(defectQuantity) : undefined,
      operationVolume: operationVolume ? parseFloat(operationVolume) : undefined,
      productionStartTime: startTime || undefined,
      productionEndTime: endTime || undefined,
      hourEntries: !isProgress ? [hourEntry] : undefined,
      totalWorkers: !isProgress
        ? (hourEntry.fullTimeWorkers || 0) + (hourEntry.hourlyWorkers || 0) + (hourEntry.dailyWorkers || 0)
        : undefined,
    };

    const result = await submitReport(data);
    if (result) {
      Alert.alert('成功', '报工提交成功', [
        { text: '确定', onPress: () => navigation.goBack() },
      ]);
    }
  }, [reportType, processCategory, productName, outputQuantity, goodQuantity,
      defectQuantity, operationVolume, startTime, endTime, hourEntry, notes, submitReport, navigation]);

  const handleSaveDraft = useCallback(() => {
    const { addDraft } = useDraftReportStore.getState();
    addDraft({
      batchId: selectedBatch?.id,
      batchNumber: selectedBatch?.batchNumber || '',
      productName: productName || processCategory || '',
      outputQuantity: outputQuantity ? parseFloat(outputQuantity) : 0,
      goodQuantity: goodQuantity ? parseFloat(goodQuantity) : 0,
      defectQuantity: defectQuantity ? parseFloat(defectQuantity) : 0,
      notes: notes || '',
      factoryId: factoryId || '',
      draftType: isProgress ? 'PROGRESS' : 'HOURS',
      processCategory: processCategory || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      hourEntries: !isProgress ? (hourEntry as Record<string, unknown>) : undefined,
      operationVolume: operationVolume ? parseFloat(operationVolume) : undefined,
    });
    Alert.alert('已保存', '草稿已保存，可在草稿管理中查看', [
      { text: '确定', onPress: () => navigation.goBack() },
    ]);
  }, [selectedBatch, productName, processCategory, outputQuantity, goodQuantity,
      defectQuantity, notes, factoryId, isProgress, startTime, endTime, hourEntry, operationVolume, navigation]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
          {/* Batch selector */}
          {activeBatches.length > 0 ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>关联批次</Text>
              {selectedBatch ? (
                <View style={styles.selectedBatchChip}>
                  <MaterialCommunityIcons name="package-variant" size={16} color="#4F46E5" />
                  <Text style={styles.selectedBatchText}>
                    {selectedBatch.batchNumber} - {selectedBatch.productName || '未知产品'}
                  </Text>
                  <TouchableOpacity onPress={clearBatchSelection} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialCommunityIcons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.batchChipScroll}>
                  {activeBatches.map(batch => (
                    <TouchableOpacity
                      key={batch.id}
                      style={styles.batchChip}
                      onPress={() => handleSelectBatch(batch)}
                    >
                      <Text style={styles.batchChipText}>{batch.batchNumber}</Text>
                      <Text style={styles.batchChipSub}>{batch.productName || '—'}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : !batchLoading ? (
            <View style={styles.noBatchBanner}>
              <MaterialCommunityIcons name="information-outline" size={16} color="#92400E" />
              <Text style={styles.noBatchText}>无进行中批次，使用手动模式</Text>
            </View>
          ) : null}

          {/* Date */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>报工日期</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{formatDate(today)}</Text>
            </View>
          </View>

          {/* Progress: Process Category */}
          {isProgress && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>生产类目/工序 <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="输入生产类目或工序"
                value={processCategory}
                onChangeText={setProcessCategory}
              />
            </View>
          )}

          {/* Hours: Product Name */}
          {!isProgress && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>商品名称 <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="输入商品名称"
                value={productName}
                onChangeText={setProductName}
              />
            </View>
          )}

          {/* Output Quantity (Progress) */}
          {isProgress && isFieldVisible('quantity') && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>产品数量</Text>
              <TextInput
                style={styles.input}
                placeholder="输入数量"
                value={outputQuantity}
                onChangeText={setOutputQuantity}
                keyboardType="numeric"
              />
            </View>
          )}

          {/* Good/Defect (Progress) */}
          {isProgress && (
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>良品数</Text>
                <TextInput
                  style={styles.input}
                  placeholder="良品"
                  value={goodQuantity}
                  onChangeText={setGoodQuantity}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>不良品数</Text>
                <TextInput
                  style={styles.input}
                  placeholder="不良"
                  value={defectQuantity}
                  onChangeText={setDefectQuantity}
                  keyboardType="numeric"
                />
              </View>
            </View>
          )}

          {/* Hours: Work Hours Table */}
          {!isProgress && (
            <>
              <Text style={[styles.label, { marginBottom: 8 }]}>工时明细</Text>
              <View style={styles.hoursCard}>
                <View style={styles.hoursRow}>
                  <Text style={styles.hoursLabel}>正式工</Text>
                  <TextInput
                    style={styles.hoursInput}
                    placeholder="人数"
                    keyboardType="numeric"
                    value={hourEntry.fullTimeWorkers?.toString() || ''}
                    onChangeText={(v) => setHourEntry({ ...hourEntry, fullTimeWorkers: v ? parseInt(v) : undefined })}
                  />
                  <TextInput
                    style={styles.hoursInput}
                    placeholder="工时(h)"
                    keyboardType="numeric"
                    value={hourEntry.fullTimeHours?.toString() || ''}
                    onChangeText={(v) => setHourEntry({ ...hourEntry, fullTimeHours: v ? parseFloat(v) : undefined })}
                  />
                </View>
                <View style={styles.hoursRow}>
                  <Text style={styles.hoursLabel}>小时工</Text>
                  <TextInput
                    style={styles.hoursInput}
                    placeholder="人数"
                    keyboardType="numeric"
                    value={hourEntry.hourlyWorkers?.toString() || ''}
                    onChangeText={(v) => setHourEntry({ ...hourEntry, hourlyWorkers: v ? parseInt(v) : undefined })}
                  />
                  <TextInput
                    style={styles.hoursInput}
                    placeholder="工时(h)"
                    keyboardType="numeric"
                    value={hourEntry.hourlyHours?.toString() || ''}
                    onChangeText={(v) => setHourEntry({ ...hourEntry, hourlyHours: v ? parseFloat(v) : undefined })}
                  />
                </View>
                <View style={styles.hoursRow}>
                  <Text style={styles.hoursLabel}>日结工</Text>
                  <TextInput
                    style={styles.hoursInput}
                    placeholder="人数"
                    keyboardType="numeric"
                    value={hourEntry.dailyWorkers?.toString() || ''}
                    onChangeText={(v) => setHourEntry({ ...hourEntry, dailyWorkers: v ? parseInt(v) : undefined })}
                  />
                  <TextInput
                    style={styles.hoursInput}
                    placeholder="工时(h)"
                    keyboardType="numeric"
                    value={hourEntry.dailyHours?.toString() || ''}
                    onChangeText={(v) => setHourEntry({ ...hourEntry, dailyHours: v ? parseFloat(v) : undefined })}
                  />
                </View>
              </View>
            </>
          )}

          {/* Hours: Time Range */}
          {!isProgress && (
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>开始时间</Text>
                <TextInput
                  style={styles.input}
                  placeholder="HH:mm"
                  value={startTime}
                  onChangeText={setStartTime}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>结束时间</Text>
                <TextInput
                  style={styles.input}
                  placeholder="HH:mm"
                  value={endTime}
                  onChangeText={setEndTime}
                />
              </View>
            </View>
          )}

          {/* Hours: Operation Volume */}
          {!isProgress && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>操作量</Text>
              <TextInput
                style={styles.input}
                placeholder="输入操作量"
                value={operationVolume}
                onChangeText={setOperationVolume}
                keyboardType="numeric"
              />
            </View>
          )}

          {/* Notes */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>备注</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="备注信息（选填）"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>提交报工</Text>
            )}
          </TouchableOpacity>

          {/* Save Draft */}
          <TouchableOpacity
            style={styles.saveDraftBtn}
            onPress={handleSaveDraft}
          >
            <MaterialCommunityIcons name="content-save-outline" size={18} color="#4F46E5" />
            <Text style={styles.saveDraftBtnText}>保存草稿</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1F2937' },
  form: { flex: 1 },
  formContent: { padding: 16, paddingBottom: 40 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  required: { color: '#EF4444' },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1F2937',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  readOnlyField: {
    backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  readOnlyText: { fontSize: 15, color: '#6B7280' },
  row: { flexDirection: 'row', marginBottom: 16 },
  hoursCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16,
  },
  hoursRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  hoursLabel: { width: 60, fontSize: 13, fontWeight: '500', color: '#4B5563' },
  hoursInput: {
    flex: 1, marginLeft: 8, backgroundColor: '#F9FAFB', borderWidth: 1,
    borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 14, textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  saveDraftBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, paddingVertical: 12, marginTop: 10,
    borderWidth: 1, borderColor: '#C7D2FE', backgroundColor: '#EEF2FF', gap: 6,
  },
  saveDraftBtnText: { color: '#4F46E5', fontSize: 15, fontWeight: '500' },
  // Batch selector
  batchChipScroll: { flexDirection: 'row' },
  batchChip: {
    backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB', minWidth: 100,
  },
  batchChipText: { fontSize: 14, fontWeight: '600', color: '#4F46E5' },
  batchChipSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  selectedBatchChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#C7D2FE', gap: 8,
  },
  selectedBatchText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#4F46E5' },
  noBatchBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7',
    borderRadius: 8, padding: 10, marginBottom: 16, gap: 6,
  },
  noBatchText: { fontSize: 13, color: '#92400E', flex: 1 },
});
