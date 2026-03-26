/**
 * 工序操作 — 统一入口
 *
 * 合并签到/签退 + 报产量:
 * 1. 选工序任务
 * 2. 显示操作面板: 签到 / 签退 / 报产量
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Appbar, TextInput, Chip } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TutorialOverlay } from '../../components/common/TutorialOverlay';
import { useTutorialStore, TUTORIAL_PROCESS_OPERATION } from '../../store/tutorialStore';
import { processTaskApiClient, ProcessTaskItem } from '../../services/api/processTaskApiClient';
import { BarcodeScannerModal } from '../../components/processing/BarcodeScannerModal';
import { ScreenWrapper } from '../../components/ui';
import { theme } from '../../theme';
import { apiClient } from '../../services/api/apiClient';
import { requireFactoryId } from '../../utils/factoryIdHelper';

interface ScannedWorker { id: number; name: string; }

export default function ProcessOperationScreen() {
  const navigation = useNavigation<any>();

  const [tasks, setTasks] = useState<ProcessTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<ProcessTaskItem | null>(null);

  // Tutorial
  const activeTutorial = useTutorialStore(s => s.activeTutorial);
  const activeStep = useTutorialStore(s => s.activeStep);
  const completedOp = useTutorialStore(s => s.completedTutorials[TUTORIAL_PROCESS_OPERATION.id]);
  const showTutorial = activeTutorial === TUTORIAL_PROCESS_OPERATION.id;

  useEffect(() => {
    if (!loading && !completedOp && activeTutorial === null) {
      const timer = setTimeout(() => {
        useTutorialStore.getState().startTutorial(TUTORIAL_PROCESS_OPERATION.id);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [loading, completedOp]);

  // Scanner
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanMode, setScanMode] = useState<'checkin' | 'checkout' | 'report'>('checkin');
  const [worker, setWorker] = useState<ScannedWorker | null>(null);

  // Report form
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await processTaskApiClient.getActiveTasks() as any;
      const list = Array.isArray(res?.data) ? res.data : res?.data?.content || [];
      setTasks(list.filter((t: ProcessTaskItem) => t.status === 'IN_PROGRESS' || t.status === 'SUPPLEMENTING' || t.status === 'PENDING'));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadTasks(); }, [loadTasks]));

  // Parse scanned code
  const handleScan = useCallback(async (raw: string) => {
    setScannerVisible(false);
    try {
      const factoryId = requireFactoryId();
      const nfcMatch = raw.match(/^CRETAS:EMP:(\d+):/);
      let empId: number;
      let empName: string;

      if (nfcMatch?.[1]) {
        empId = parseInt(nfcMatch[1], 10);
        empName = `员工#${empId}`;
      } else {
        const res = await apiClient.get(`/api/mobile/${factoryId}/users/by-employee-code/${encodeURIComponent(raw.trim())}`) as any;
        if (res?.success && res.data) {
          empId = res.data.id;
          empName = res.data.fullName || res.data.username || `员工#${res.data.id}`;
        } else {
          const id = parseInt(raw, 10);
          if (!isNaN(id) && id > 0) { empId = id; empName = `员工#${id}`; }
          else { Alert.alert('未识别', '无法识别此工牌'); return; }
        }
      }

      if (scanMode === 'checkin') {
        await processTaskApiClient.processCheckin({
          employeeId: empId,
          processName: selectedTask?.processName,
          processCategory: selectedTask?.processCategory,
          checkinMethod: 'QR_SCAN',
          processTaskId: selectedTask?.id,
        });
        Alert.alert('签到成功', `${empName} 已签到「${selectedTask?.processName || '工序'}」`);
      } else if (scanMode === 'checkout') {
        // Get active checkins, find this employee, checkout
        const checkinsRes = await processTaskApiClient.getActiveCheckins() as any;
        const checkins = Array.isArray(checkinsRes?.data) ? checkinsRes.data : [];
        const match = checkins.find((c: any) => c.employeeId === empId && c.processTaskId === selectedTask?.id);
        if (match) {
          await processTaskApiClient.processCheckout(match.id);
          Alert.alert('签退成功', `${empName} 已签退「${selectedTask?.processName || '工序'}」`);
        } else {
          Alert.alert('未找到签到记录', `${empName} 未签到此工序`);
        }
      } else if (scanMode === 'report') {
        setWorker({ id: empId, name: empName });
      }
    } catch (e) {
      Alert.alert('操作失败', e instanceof Error ? e.message : '请重试');
    }
  }, [scanMode, selectedTask]);

  // Submit report
  const handleSubmitReport = async () => {
    if (!selectedTask) return;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) { Alert.alert('提示', '请输入有效的产出数量'); return; }

    setSubmitting(true);
    try {
      const data: any = {
        processTaskId: selectedTask.id,
        outputQuantity: qty,
        notes: notes || undefined,
      };
      if (worker) {
        data.reporterName = worker.name;
        data.targetWorkerId = worker.id;
      }
      await processTaskApiClient.submitNormalReport(data);
      Alert.alert('报工成功', `${selectedTask.processName} — ${qty} ${selectedTask.unit || 'kg'}`, [
        { text: '继续', onPress: () => { setQuantity(''); setNotes(''); setWorker(null); } },
        { text: '返回', onPress: () => setSelectedTask(null) },
      ]);
    } catch (e) {
      Alert.alert('提交失败', e instanceof Error ? e.message : '请重试');
    } finally { setSubmitting(false); }
  };

  const remaining = selectedTask
    ? Math.max(0, selectedTask.plannedQuantity - selectedTask.completedQuantity - selectedTask.pendingQuantity)
    : 0;

  // ==================== STEP 1: Select Task ====================
  if (!selectedTask) {
    return (
      <ScreenWrapper edges={['top']} backgroundColor={theme.colors.background}>
        <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="工序操作" titleStyle={{ fontWeight: '600' }} />
        </Appbar.Header>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.hint}>选择要操作的工序</Text>
          {loading ? <ActivityIndicator size="large" style={{ marginTop: 40 }} /> :
            tasks.length === 0 ? <Text style={styles.empty}>暂无进行中的工序任务</Text> :
            tasks.map(task => {
              const prog = task.plannedQuantity > 0 ? Math.min((task.completedQuantity / task.plannedQuantity) * 100, 100) : 0;
              return (
                <TouchableOpacity key={task.id} style={styles.taskCard} onPress={() => setSelectedTask(task)} activeOpacity={0.7}>
                  <View style={styles.taskHeader}>
                    <Text style={styles.taskName}>{task.processName || '工序'}</Text>
                    <Chip compact style={{ backgroundColor: '#1890ff20' }} textStyle={{ color: '#1890ff', fontSize: 11 }}>
                      {task.status === 'IN_PROGRESS' ? '进行中' : task.status === 'PENDING' ? '待开始' : task.status}
                    </Chip>
                  </View>
                  {task.productTypeName && <Text style={styles.taskProduct}>{task.productTypeName}</Text>}
                  <View style={styles.taskStats}>
                    <Text style={styles.taskStat}>计划: {task.plannedQuantity} {task.unit}</Text>
                    <Text style={[styles.taskStat, { color: '#67c23a' }]}>完成: {task.completedQuantity}</Text>
                  </View>
                  <View style={styles.progressRow}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${prog}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{prog.toFixed(0)}%</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          }
        </ScrollView>
      </ScreenWrapper>
    );
  }

  // ==================== STEP 2: Operation Panel ====================
  return (
    <ScreenWrapper edges={['top']} backgroundColor={theme.colors.background}>
      <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => setSelectedTask(null)} />
        <Appbar.Content title={selectedTask.processName || '工序操作'} titleStyle={{ fontWeight: '600' }} />
      </Appbar.Header>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Task Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{selectedTask.processName}</Text>
            {selectedTask.productTypeName && <Text style={styles.summaryProduct}>{selectedTask.productTypeName}</Text>}
            <View style={styles.summaryStats}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNum}>{selectedTask.plannedQuantity}</Text>
                <Text style={styles.summaryLabel}>计划 ({selectedTask.unit})</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum, { color: '#67c23a' }]}>{selectedTask.completedQuantity}</Text>
                <Text style={styles.summaryLabel}>已完成</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum, { color: '#1890ff' }]}>{remaining}</Text>
                <Text style={styles.summaryLabel}>剩余</Text>
              </View>
            </View>
          </View>

          {/* Attendance Buttons */}
          <View style={styles.attendanceSection}>
            <Text style={styles.sectionTitle}>员工签到/签退</Text>
            <View style={styles.attendanceRow}>
              <TouchableOpacity
                style={[styles.attendanceBtn, { backgroundColor: '#059669' }]}
                onPress={() => { setScanMode('checkin'); setScannerVisible(true); }}
              >
                <MaterialCommunityIcons name="login" size={22} color="#fff" />
                <Text style={styles.attendanceBtnText}>扫码签到</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.attendanceBtn, { backgroundColor: '#DC2626' }]}
                onPress={() => { setScanMode('checkout'); setScannerVisible(true); }}
              >
                <MaterialCommunityIcons name="logout" size={22} color="#fff" />
                <Text style={styles.attendanceBtnText}>扫码签退</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Report Form */}
          <View style={styles.reportSection}>
            <Text style={styles.sectionTitle}>报产量</Text>

            {worker ? (
              <View style={styles.workerBadge}>
                <Text style={styles.workerLabel}>报工员工:</Text>
                <Text style={styles.workerName}>{worker.name}</Text>
                <TouchableOpacity onPress={() => setWorker(null)}>
                  <Text style={{ color: '#999', fontSize: 12 }}>清除</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.scanWorkerBtn}
                onPress={() => { setScanMode('report'); setScannerVisible(true); }}
              >
                <MaterialCommunityIcons name="qrcode-scan" size={18} color={theme.colors.primary} />
                <Text style={styles.scanWorkerText}>扫描员工工牌 (选填，不扫=主管自己)</Text>
              </TouchableOpacity>
            )}

            <TextInput
              label={`产出数量 (${selectedTask.unit || 'kg'})`}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="decimal-pad"
              mode="outlined"
              style={styles.input}
              right={<TextInput.Affix text={selectedTask.unit || 'kg'} />}
            />

            {remaining > 0 && (
              <View style={styles.quickBtns}>
                <Text style={{ fontSize: 13, color: '#666' }}>快捷:</Text>
                {[remaining, Math.round(remaining / 2)].filter(v => v > 0).map(v => (
                  <TouchableOpacity key={v} style={styles.quickBtn} onPress={() => setQuantity(String(v))}>
                    <Text style={styles.quickBtnText}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TextInput
              label="备注 (选填)"
              value={notes}
              onChangeText={setNotes}
              mode="outlined"
              multiline
              numberOfLines={2}
              style={[styles.input, { marginTop: 10 }]}
            />

            <TouchableOpacity
              style={[styles.submitBtn, (!quantity || submitting) && { opacity: 0.5 }]}
              onPress={handleSubmitReport}
              disabled={!quantity || submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> :
                <Text style={styles.submitBtnText}>提交报工</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScan}
      />

      <TutorialOverlay
        visible={showTutorial}
        steps={TUTORIAL_PROCESS_OPERATION.steps}
        currentStep={activeStep}
        onNext={() => useTutorialStore.getState().nextStep(TUTORIAL_PROCESS_OPERATION.steps.length)}
        onSkip={() => useTutorialStore.getState().skipTutorial()}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 32 },
  hint: { fontSize: 15, color: '#888', marginBottom: 12 },
  empty: { fontSize: 15, color: '#999', textAlign: 'center', marginTop: 40 },

  // Task card (step 1)
  taskCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskName: { fontSize: 18, fontWeight: '700', color: '#333', flex: 1 },
  taskProduct: { fontSize: 14, color: '#666', marginTop: 2 },
  taskStats: { flexDirection: 'row', gap: 12, marginTop: 8 },
  taskStat: { fontSize: 14, color: '#666' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  progressTrack: { flex: 1, height: 6, backgroundColor: '#e8e8e8', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 3 },
  progressText: { fontSize: 12, color: '#999', width: 32, textAlign: 'right' },

  // Summary (step 2)
  summaryCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  summaryTitle: { fontSize: 20, fontWeight: '700', color: '#333' },
  summaryProduct: { fontSize: 14, color: '#666', marginTop: 2 },
  summaryStats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14 },
  summaryItem: { alignItems: 'center' },
  summaryNum: { fontSize: 24, fontWeight: '700', color: '#333' },
  summaryLabel: { fontSize: 13, color: '#999', marginTop: 2 },

  // Attendance
  attendanceSection: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  attendanceRow: { flexDirection: 'row', gap: 12 },
  attendanceBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10 },
  attendanceBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Report
  reportSection: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 2 },
  workerBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0f9ff', padding: 10, borderRadius: 8, marginBottom: 12 },
  workerLabel: { fontSize: 13, color: '#666' },
  workerName: { fontSize: 15, fontWeight: '600', color: '#1890ff', flex: 1 },
  scanWorkerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e8e8e8', marginBottom: 12 },
  scanWorkerText: { fontSize: 13, color: '#888' },
  input: { backgroundColor: '#fff', fontSize: 18 },
  quickBtns: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  quickBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.primary },
  quickBtnText: { color: theme.colors.primary, fontSize: 14, fontWeight: '600' },
  submitBtn: { backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
