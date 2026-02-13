import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useReportWorkflow } from '../../hooks/useReportWorkflow';
import type { WSHomeStackParamList } from '../../types/navigation';
import type { WorkReportSubmitRequest, HourEntry } from '../../types/workReporting';
import { formatDate } from '../../utils/formatters';

type DynamicReportRoute = RouteProp<WSHomeStackParamList, 'DynamicReport'>;

export default function DynamicReportScreen() {
  const navigation = useNavigation();
  const route = useRoute<DynamicReportRoute>();
  const { reportType } = route.params;

  const { schema, loading, submitting, submitReport, isFieldVisible } = useReportWorkflow(reportType);

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
  const today = new Date().toISOString().split('T')[0];

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
});
