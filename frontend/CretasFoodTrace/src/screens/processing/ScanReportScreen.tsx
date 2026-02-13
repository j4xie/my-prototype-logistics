import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert, StyleSheet,
  ActivityIndicator, Platform, SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WSBatchesStackParamList } from '../../types/navigation';
import { processingApiClient } from '../../services/api/processingApiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';
import { BarcodeScannerModal } from '../../components/processing/BarcodeScannerModal';
import { OfflineIndicator } from '../../components/common/OfflineIndicator';
import { useDraftReportStore } from '../../store/draftReportStore';
import { useFieldVisibilityStore } from '../../store/fieldVisibilityStore';
import { handleError } from '../../utils/errorHandler';

interface BatchInfo {
  id: number;
  batchNumber: string;
  productName: string;
  status: string;
  plannedQuantity: number;
  actualQuantity: number;
  equipmentName: string;
  supervisorName: string;
}

interface ReportForm {
  outputQuantity: string;
  goodQuantity: string;
  defectQuantity: string;
  notes: string;
}

type NavProp = NativeStackNavigationProp<WSBatchesStackParamList, 'ScanReport'>;

const ScanReportScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const factoryId = getCurrentFactoryId();
  const { addDraft } = useDraftReportStore();
  const { isFieldVisible } = useFieldVisibilityStore();

  const [scannerVisible, setScannerVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null);
  const [form, setForm] = useState<ReportForm>({
    outputQuantity: '', goodQuantity: '', defectQuantity: '', notes: '',
  });

  const handleScan = useCallback(async (code: string) => {
    setScannerVisible(false);
    setLoading(true);
    try {
      const response = await processingApiClient.scanBatchByCode(code);
      if (response.success && response.data) {
        const d = response.data;
        setBatchInfo({
          id: d.id,
          batchNumber: d.batchNumber,
          productName: d.productType,
          status: d.status,
          plannedQuantity: d.targetQuantity,
          actualQuantity: d.actualQuantity ?? 0,
          equipmentName: '',
          supervisorName: typeof d.supervisor === 'object' ? (d.supervisor?.fullName ?? '') : (d.supervisor ?? ''),
        });
      } else {
        Alert.alert('未找到批次', response.message || '请检查条码是否正确');
      }
    } catch (error: unknown) {
      handleError(error, { showAlert: false, logError: true });
      const msg = error instanceof Error ? error.message : '扫码查询失败';
      Alert.alert('查询失败', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!batchInfo) return;
    const output = parseInt(form.outputQuantity, 10);
    const good = parseInt(form.goodQuantity, 10);
    if (isNaN(output) || output <= 0) {
      Alert.alert('请输入有效的产出数量');
      return;
    }

    const reportPayload = {
      actualQuantity: output,
      goodQuantity: isNaN(good) ? output : good,
      defectQuantity: parseInt(form.defectQuantity, 10) || 0,
      notes: form.notes,
    };

    setSubmitting(true);
    try {
      await processingApiClient.submitWorkReport(batchInfo.id, reportPayload);
      navigation.replace('ScanReportSuccess', {
        batchNumber: batchInfo.batchNumber,
        outputQuantity: output,
        goodQuantity: isNaN(good) ? output : good,
        defectQuantity: parseInt(form.defectQuantity, 10) || 0,
      });
    } catch (error: unknown) {
      handleError(error, { showAlert: false, logError: true });
      // Save as offline draft on network failure
      addDraft({
        batchId: batchInfo.id,
        batchNumber: batchInfo.batchNumber,
        productName: batchInfo.productName,
        outputQuantity: output,
        goodQuantity: isNaN(good) ? output : good,
        defectQuantity: parseInt(form.defectQuantity, 10) || 0,
        notes: form.notes,
        factoryId,
      });
      Alert.alert(
        '已保存为离线草稿',
        '网络恢复后将自动同步',
        [{ text: '确定' }]
      );
    } finally {
      setSubmitting(false);
    }
  }, [batchInfo, form, factoryId, navigation, addDraft]);

  return (
    <SafeAreaView style={styles.safe}>
      <OfflineIndicator />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>扫码报工</Text>

        {!batchInfo && !loading && (
          <View style={styles.scanPrompt}>
            <Text style={styles.scanIconText}>SCAN</Text>
            <Text style={styles.scanText}>扫描批次条码开始报工</Text>
            <TouchableOpacity style={styles.scanButton} onPress={() => setScannerVisible(true)}>
              <Text style={styles.scanButtonText}>开始扫码</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>查询批次信息...</Text>
          </View>
        )}

        {batchInfo && (
          <>
            <View style={styles.batchCard}>
              <Text style={styles.cardTitle}>批次信息</Text>
              <View style={styles.infoRow}>
                <Text style={styles.label}>批次号</Text>
                <Text style={styles.value}>{batchInfo.batchNumber}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>产品</Text>
                <Text style={styles.value}>{batchInfo.productName || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>状态</Text>
                <Text style={styles.value}>{batchInfo.status}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>计划产量</Text>
                <Text style={styles.value}>{batchInfo.plannedQuantity != null ? String(batchInfo.plannedQuantity) : '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>设备</Text>
                <Text style={styles.value}>{batchInfo.equipmentName || '-'}</Text>
              </View>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>报工数据</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>产出数量 *</Text>
                <TextInput style={styles.input} keyboardType="numeric" placeholder="输入产出数量"
                  value={form.outputQuantity} onChangeText={v => setForm(p => ({...p, outputQuantity: v}))} />
              </View>
              {isFieldVisible('PROCESSING_BATCH', 'goodQuantity') && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>合格数量</Text>
                <TextInput style={styles.input} keyboardType="numeric" placeholder="默认等于产出数量"
                  value={form.goodQuantity} onChangeText={v => setForm(p => ({...p, goodQuantity: v}))} />
              </View>
              )}
              {isFieldVisible('PROCESSING_BATCH', 'defectQuantity') && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>缺陷数量</Text>
                <TextInput style={styles.input} keyboardType="numeric" placeholder="0"
                  value={form.defectQuantity} onChangeText={v => setForm(p => ({...p, defectQuantity: v}))} />
              </View>
              )}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>备注</Text>
                <TextInput style={[styles.input, styles.textArea]} multiline numberOfLines={3}
                  placeholder="备注信息（可选）"
                  value={form.notes} onChangeText={v => setForm(p => ({...p, notes: v}))} />
              </View>
            </View>

            <TouchableOpacity style={[styles.submitButton, submitting && styles.submitDisabled]}
              onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> :
                <Text style={styles.submitText}>提交报工</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.rescanButton} onPress={() => { setBatchInfo(null); setScannerVisible(true); }}>
              <Text style={styles.rescanText}>重新扫码</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScan}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { flex: 1 },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 20 },
  scanPrompt: { alignItems: 'center', paddingVertical: 60, backgroundColor: '#fff', borderRadius: 12, marginBottom: 16 },
  scanIconText: { fontSize: 32, fontWeight: '700', color: '#4F46E5', marginBottom: 12 },
  scanText: { fontSize: 16, color: '#666', marginBottom: 20 },
  scanButton: { backgroundColor: '#4F46E5', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10 },
  scanButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  loadingContainer: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, fontSize: 15, color: '#666' },
  batchCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  formCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#1a1a1a', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  label: { fontSize: 14, color: '#666' },
  value: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 14, color: '#333', marginBottom: 6, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: '#fafafa' },
  textArea: { height: 80, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#4F46E5', paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  rescanButton: { paddingVertical: 12, alignItems: 'center' },
  rescanText: { color: '#4F46E5', fontSize: 16 },
});

export default ScanReportScreen;
