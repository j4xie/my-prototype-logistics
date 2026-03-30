import React, { useState, useCallback, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, Alert, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text, Appbar, Card, TextInput, ActivityIndicator, Chip, Divider } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ProcessingScreenProps } from '../../types/navigation';
import {
  processTaskApiClient,
  ProcessTaskItem,
} from '../../services/api/processTaskApiClient';
import { NeoButton, ScreenWrapper } from '../../components/ui';
import { BarcodeScannerModal } from '../../components/processing/BarcodeScannerModal';
import { TutorialOverlay } from '../../components/common/TutorialOverlay';
import { useTutorialStore, TUTORIAL_THREE_STEP, useTutorialTarget, useTutorial } from '../../store/tutorialStore';
import { theme } from '../../theme';
import { apiClient } from '../../services/api/apiClient';
import { requireFactoryId } from '../../utils/factoryIdHelper';

type Props = ProcessingScreenProps<'ThreeStepReport'>;

interface ScannedWorker {
  id: number;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: '#1890ff',
  PENDING: '#909399',
  SUPPLEMENTING: '#e6a23c',
};

export default function ThreeStepReportScreen() {
  const navigation = useNavigation<Props['navigation']>();

  // Step tracking: 1=scan worker, 2=select task, 3=input quantity
  const [step, setStep] = useState(1);

  // Step 1 state
  const [scannerVisible, setScannerVisible] = useState(false);
  const [worker, setWorker] = useState<ScannedWorker | null>(null);
  const [scanLoading, setScanLoading] = useState(false);

  // Step 2 state
  const [tasks, setTasks] = useState<ProcessTaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProcessTaskItem | null>(null);

  // Step 3 state
  const [quantity, setQuantity] = useState('');
  const [inputQty, setInputQty] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Tutorial
  const tgtStepIndicator = useTutorialTarget('tsr-step-indicator');
  const tgtScanArea = useTutorialTarget('tsr-scan-area');
  const tut = useTutorial(TUTORIAL_THREE_STEP, () => {
    tgtStepIndicator.measure(); tgtScanArea.measure();
  });

  // Load active tasks when entering step 2
  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await processTaskApiClient.getActiveTasks() as {
        data?: ProcessTaskItem[] | { content?: ProcessTaskItem[] };
      };
      const list = Array.isArray(res?.data) ? res.data :
        (res?.data as { content?: ProcessTaskItem[] })?.content || [];
      // Only show tasks that can be reported on
      setTasks(list.filter(t => t.status === 'IN_PROGRESS' || t.status === 'SUPPLEMENTING'));
    } catch {
      Alert.alert('错误', '加载工序任务失败');
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  // Step 1: Handle employee QR scan
  // Parse scanned code: supports "CRETAS:EMP:{id}:{factoryId}" (NFC tag) or plain employee code like "001"
  const parseScannedCode = (code: string): { type: 'nfc'; id: number } | { type: 'employeeCode'; code: string } | null => {
    const nfcMatch = code.match(/^CRETAS:EMP:(\d+):/);
    if (nfcMatch?.[1]) return { type: 'nfc', id: parseInt(nfcMatch[1], 10) };
    if (code.trim()) return { type: 'employeeCode', code: code.trim() };
    return null;
  };

  const handleWorkerScan = useCallback(async (raw: string) => {
    setScannerVisible(false);
    setScanLoading(true);
    try {
      const parsed = parseScannedCode(raw);
      if (!parsed) { Alert.alert('未识别', '无法识别此工牌，请重试'); return; }

      const factoryId = requireFactoryId();

      if (parsed.type === 'nfc') {
        // NFC tag already contains employeeId — use directly
        setWorker({ id: parsed.id, name: `员工#${parsed.id}` });
        setStep(2);
        return;
      }

      // Look up by employee code (e.g. "001") via existing API
      const res = await apiClient.get(`/api/mobile/${factoryId}/users/by-employee-code/${encodeURIComponent(parsed.code)}`) as {
        success?: boolean;
        data?: { id: number; fullName?: string; username?: string; employeeCode?: string };
      };
      if (res?.success && res.data) {
        setWorker({ id: res.data.id, name: res.data.fullName || res.data.username || `员工#${res.data.id}` });
        setStep(2);
      } else {
        // Fallback: treat as numeric employee ID
        const id = parseInt(parsed.code, 10);
        if (!isNaN(id) && id > 0) {
          setWorker({ id, name: `员工#${id}` });
          setStep(2);
        } else {
          Alert.alert('未找到员工', `工号 "${parsed.code}" 未在系统中找到`);
        }
      }
    } catch {
      // Fallback: try as numeric ID
      const id = parseInt(raw, 10);
      if (!isNaN(id) && id > 0) {
        setWorker({ id, name: `员工#${id}` });
        setStep(2);
      } else {
        Alert.alert('查询失败', '请检查工牌二维码是否正确');
      }
    } finally {
      setScanLoading(false);
    }
  }, []);

  // Step 2: Select a task
  const handleSelectTask = (task: ProcessTaskItem) => {
    setSelectedTask(task);
    setStep(3);
  };

  // Step 3: Submit report
  const handleSubmit = async () => {
    if (!selectedTask || !worker) return;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('提示', '请输入有效的产出数量');
      return;
    }

    const remaining = Math.max(0, selectedTask.plannedQuantity - selectedTask.completedQuantity - selectedTask.pendingQuantity);
    if (remaining > 0 && qty > remaining * 1.5) {
      Alert.alert(
        '超量确认',
        `报工量 ${qty} 超过剩余量 ${remaining} 的150%，确定提交吗？`,
        [
          { text: '取消', style: 'cancel' },
          { text: '仍然提交', style: 'destructive', onPress: () => doSubmit(qty) },
        ]
      );
      return;
    }
    await doSubmit(qty);
  };

  const doSubmit = async (qty: number) => {
    if (!selectedTask || !worker) return;
    setSubmitting(true);
    try {
      // 1. Checkin worker to this task
      await processTaskApiClient.processCheckin({
        employeeId: worker.id,
        processName: selectedTask.processName,
        processCategory: selectedTask.processCategory,
        checkinMethod: 'QR_SCAN',
        processTaskId: selectedTask.id,
      });

      // 2. Submit report with targetWorkerId
      const isSupplemental = selectedTask.status === 'SUPPLEMENTING' || selectedTask.status === 'COMPLETED' || selectedTask.status === 'CLOSED';
      const reportData: Record<string, unknown> = {
        processTaskId: selectedTask.id,
        outputQuantity: qty,
        reporterName: worker.name,
        targetWorkerId: worker.id,
        notes: notes || undefined,
      };

      if (isSupplemental) {
        await processTaskApiClient.submitSupplement(reportData as Parameters<typeof processTaskApiClient.submitSupplement>[0]);
      } else {
        await processTaskApiClient.submitNormalReport(reportData as Parameters<typeof processTaskApiClient.submitNormalReport>[0]);
      }

      Alert.alert(
        '报工成功',
        `${worker.name} — ${selectedTask.processName}\n产出: ${qty} ${selectedTask.unit || 'kg'}`,
        [{
          text: '继续报工', onPress: () => {
            // Reset to step 1 for next worker
            setWorker(null);
            setSelectedTask(null);
            setQuantity('');
            setInputQty('');
            setNotes('');
            setStep(1);
            loadTasks();
          },
        }, {
          text: '返回', onPress: () => navigation.goBack(),
        }]
      );
    } catch (err) {
      Alert.alert('提交失败', err instanceof Error ? err.message : '请重试');
    } finally {
      setSubmitting(false);
    }
  };

  // Skip step 1 (supervisor reports for themselves)
  const handleSkipScan = () => {
    setWorker(null);
    setStep(2);
  };

  const remaining = selectedTask
    ? Math.max(0, selectedTask.plannedQuantity - selectedTask.completedQuantity - selectedTask.pendingQuantity)
    : 0;

  return (
    <ScreenWrapper edges={['top']} backgroundColor={theme.colors.background}>
      <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction testID="three-step-back" onPress={() => {
          if (step > 1) setStep(step - 1);
          else navigation.goBack();
        }} />
        <Appbar.Content
          title="报工"
          subtitle={`第 ${step} 步 / 共 3 步`}
          titleStyle={{ fontWeight: '600' }}
        />
      </Appbar.Header>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent}>

          {/* Step Indicator */}
          <View ref={tgtStepIndicator.ref} onLayout={tgtStepIndicator.onLayout} style={styles.stepIndicator}>
            {[1, 2, 3].map(s => (
              <React.Fragment key={s}>
                <TouchableOpacity
                  onPress={() => { if (s < step) setStep(s); }}
                  disabled={s >= step}
                  style={[styles.stepDot, s <= step && styles.stepDotActive, s === step && styles.stepDotCurrent]}
                >
                  <Text style={[styles.stepDotText, s <= step && styles.stepDotTextActive]}>
                    {s === 1 ? '扫人' : s === 2 ? '工序' : '报量'}
                  </Text>
                </TouchableOpacity>
                {s < 3 && <View style={[styles.stepLine, s < step && styles.stepLineActive]} />}
              </React.Fragment>
            ))}
          </View>

          {/* ==================== STEP 1: Scan Worker ==================== */}
          {step === 1 && (
            <Card ref={tgtScanArea.ref} onLayout={tgtScanArea.onLayout} style={styles.card}>
              <Card.Content>
                <Text variant="titleLarge" style={styles.stepTitle}>扫描员工工牌</Text>
                <Text style={styles.stepDesc}>请扫描报工员工的二维码工牌</Text>

                {scanLoading ? (
                  <ActivityIndicator size="large" style={{ marginVertical: 40 }} />
                ) : (
                  <View style={styles.scanArea}>
                    <NeoButton
                      testID="scan-worker-btn"
                      variant="primary"
                      onPress={() => setScannerVisible(true)}
                      style={styles.scanBtn}
                    >
                      扫描工牌
                    </NeoButton>
                    <TouchableOpacity onPress={handleSkipScan} style={styles.skipLink}>
                      <Text style={styles.skipText}>主管自己报工 (跳过)</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card.Content>
            </Card>
          )}

          {/* ==================== STEP 2: Select Task ==================== */}
          {step === 2 && (
            <>
              {/* Worker badge (collapsible) */}
              {worker && (
                <Card style={[styles.card, { backgroundColor: '#f0f9ff' }]}>
                  <Card.Content style={styles.workerBadge}>
                    <Text style={styles.workerBadgeLabel}>报工员工</Text>
                    <Text style={styles.workerBadgeName}>{worker.name}</Text>
                    <TouchableOpacity onPress={() => setStep(1)}>
                      <Text style={styles.changeLink}>更换</Text>
                    </TouchableOpacity>
                  </Card.Content>
                </Card>
              )}

              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleLarge" style={styles.stepTitle}>选择工序</Text>
                  <Text style={styles.stepDesc}>选择今天要报工的工序任务</Text>

                  {tasksLoading ? (
                    <ActivityIndicator size="large" style={{ marginVertical: 40 }} />
                  ) : tasks.length === 0 ? (
                    <Text style={styles.emptyText}>今天没有进行中的工序任务</Text>
                  ) : (
                    tasks.map(task => {
                      const prog = task.plannedQuantity > 0
                        ? Math.min((task.completedQuantity / task.plannedQuantity) * 100, 100)
                        : 0;
                      return (
                        <TouchableOpacity
                          key={task.id}
                          testID={`task-card-${task.id}`}
                          style={styles.taskCard}
                          onPress={() => handleSelectTask(task)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.taskCardHeader}>
                            <Text style={styles.taskName}>{task.processName || '未命名工序'}</Text>
                            <Chip
                              compact
                              style={{ backgroundColor: (STATUS_COLORS[task.status] || '#909399') + '20' }}
                              textStyle={{ color: STATUS_COLORS[task.status] || '#909399', fontSize: 11 }}
                            >
                              {task.status === 'IN_PROGRESS' ? '进行中' : task.status === 'SUPPLEMENTING' ? '补报中' : task.status}
                            </Chip>
                          </View>
                          {task.productTypeName && (
                            <Text style={styles.taskProduct}>{task.productTypeName}</Text>
                          )}
                          <View style={styles.taskStats}>
                            <Text style={styles.taskStat}>计划: {task.plannedQuantity} {task.unit}</Text>
                            <Text style={[styles.taskStat, { color: '#67c23a' }]}>完成: {task.completedQuantity}</Text>
                            {task.pendingQuantity > 0 && (
                              <Text style={[styles.taskStat, { color: '#e6a23c' }]}>待审: {task.pendingQuantity}</Text>
                            )}
                          </View>
                          <View style={styles.taskProgress}>
                            <View style={styles.taskProgressTrack}>
                              <View style={[styles.taskProgressFill, { width: `${prog}%` }]} />
                            </View>
                            <Text style={styles.taskProgressText}>{prog.toFixed(0)}%</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </Card.Content>
              </Card>
            </>
          )}

          {/* ==================== STEP 3: Input Quantity ==================== */}
          {step === 3 && selectedTask && (
            <>
              {/* Collapsed summary of step 1 + 2 */}
              <Card style={[styles.card, { backgroundColor: '#f8f9fa' }]}>
                <Card.Content>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>员工</Text>
                    <Text style={styles.summaryValue}>{worker?.name || '主管自己'}</Text>
                  </View>
                  <Divider style={{ marginVertical: 6 }} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>工序</Text>
                    <Text style={styles.summaryValue}>{selectedTask.processName}</Text>
                  </View>
                  {selectedTask.productTypeName && (
                    <>
                      <Divider style={{ marginVertical: 6 }} />
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>产品</Text>
                        <Text style={styles.summaryValue}>{selectedTask.productTypeName}</Text>
                      </View>
                    </>
                  )}
                  <Divider style={{ marginVertical: 6 }} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>剩余</Text>
                    <Text style={[styles.summaryValue, { color: remaining > 0 ? '#1890ff' : '#67c23a' }]}>
                      {remaining} {selectedTask.unit || 'kg'}
                    </Text>
                  </View>
                </Card.Content>
              </Card>

              {/* Quantity Input */}
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleLarge" style={styles.stepTitle}>报产量</Text>

                  <TextInput
                    testID="three-step-output-qty"
                    label={`产出数量 (${selectedTask.unit || 'kg'})`}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                    mode="outlined"
                    style={styles.input}
                    right={<TextInput.Affix text={selectedTask.unit || 'kg'} />}
                  />

                  {remaining > 0 && (
                    <View style={styles.quickButtons}>
                      <Text style={styles.quickLabel}>快捷:</Text>
                      {[remaining, Math.round(remaining / 2)].filter(v => v > 0).map(v => (
                        <NeoButton
                          key={v}
                          variant="outline"
                          size="small"
                          onPress={() => setQuantity(String(v))}
                          style={styles.quickBtn}
                        >
                          {v}
                        </NeoButton>
                      ))}
                    </View>
                  )}

                  <TextInput
                    testID="three-step-input-qty"
                    label="投入量 (kg, 选填)"
                    value={inputQty}
                    onChangeText={setInputQty}
                    keyboardType="decimal-pad"
                    mode="outlined"
                    style={[styles.input, { marginTop: 12 }]}
                  />

                  <TextInput
                    testID="three-step-notes"
                    label="备注 (选填)"
                    value={notes}
                    onChangeText={setNotes}
                    mode="outlined"
                    multiline
                    numberOfLines={2}
                    style={[styles.input, { marginTop: 12 }]}
                  />
                </Card.Content>
              </Card>

              <NeoButton
                testID="three-step-submit"
                variant="primary"
                onPress={handleSubmit}
                loading={submitting}
                disabled={submitting || !quantity}
                style={styles.submitBtn}
              >
                提交报工
              </NeoButton>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleWorkerScan}
      />
      <TutorialOverlay
        visible={tut.visible}
        steps={TUTORIAL_THREE_STEP.steps}
        currentStep={tut.step}
        onNext={tut.onNext}
        onSkip={tut.onSkip}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 32 },

  // Step indicator
  stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, paddingHorizontal: 20 },
  stepDot: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#e8e8e8', minWidth: 64, alignItems: 'center',
  },
  stepDotActive: { backgroundColor: theme.colors.primary + '20' },
  stepDotCurrent: { backgroundColor: theme.colors.primary, elevation: 2 },
  stepDotText: { fontSize: 13, fontWeight: '600', color: '#999' },
  stepDotTextActive: { color: theme.colors.primary },
  stepLine: { flex: 1, height: 2, backgroundColor: '#e8e8e8', marginHorizontal: 4 },
  stepLineActive: { backgroundColor: theme.colors.primary },

  // Cards
  card: { marginBottom: 12, borderRadius: 12, backgroundColor: '#fff', elevation: 2 },
  stepTitle: { fontWeight: '700', color: '#333', marginBottom: 4, fontSize: 22 },
  stepDesc: { fontSize: 16, color: '#888', marginBottom: 16 },

  // Step 1
  scanArea: { alignItems: 'center', paddingVertical: 24 },
  scanBtn: { width: '80%', height: 64 },
  skipLink: { marginTop: 16 },
  skipText: { color: '#888', fontSize: 14, textDecorationLine: 'underline' },

  // Worker badge
  workerBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  workerBadgeLabel: { fontSize: 13, color: '#666' },
  workerBadgeName: { fontSize: 16, fontWeight: '700', color: '#1890ff', flex: 1 },
  changeLink: { color: '#1890ff', fontSize: 13 },

  // Step 2 — task cards
  taskCard: {
    backgroundColor: '#fafafa', borderRadius: 10, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#eee',
  },
  taskCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskName: { fontSize: 20, fontWeight: '700', color: '#333', flex: 1 },
  taskProduct: { fontSize: 15, color: '#666', marginTop: 2 },
  taskStats: { flexDirection: 'row', gap: 12, marginTop: 8 },
  taskStat: { fontSize: 15, color: '#666' },
  taskProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  taskProgressTrack: { flex: 1, height: 6, backgroundColor: '#e8e8e8', borderRadius: 3, overflow: 'hidden' },
  taskProgressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 3 },
  taskProgressText: { fontSize: 12, color: '#999', width: 32, textAlign: 'right' },
  emptyText: { color: '#999', textAlign: 'center', paddingVertical: 40, fontSize: 15 },

  // Step 3 — summary + form
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  summaryLabel: { fontSize: 13, color: '#888' },
  summaryValue: { fontSize: 15, fontWeight: '600', color: '#333' },
  input: { backgroundColor: '#fff', fontSize: 18 },
  quickButtons: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  quickLabel: { fontSize: 13, color: '#666' },
  quickBtn: { minWidth: 64, minHeight: 44 },
  submitBtn: { marginTop: 12, height: 56 },
});
