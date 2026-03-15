import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Appbar, Card, TextInput, ActivityIndicator } from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { ProcessingScreenProps } from '../../types/navigation';
import { processTaskApiClient, ProcessTaskItem } from '../../services/api/processTaskApiClient';
import { NeoButton, ScreenWrapper } from '../../components/ui';
import { theme } from '../../theme';

type Props = ProcessingScreenProps<'ProcessTaskReport'>;

export default function ProcessTaskReportScreen() {
  const navigation = useNavigation<Props['navigation']>();
  const route = useRoute<Props['route']>();
  const { taskId, processName, unit } = route.params;

  const [task, setTask] = useState<ProcessTaskItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const loadTask = useCallback(async () => {
    try {
      const res = await processTaskApiClient.getTaskById(taskId) as { data?: ProcessTaskItem };
      if (res?.data) setTask(res.data);
    } catch {
      Alert.alert('错误', '加载任务信息失败');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useFocusEffect(
    useCallback(() => {
      loadTask();
    }, [loadTask])
  );

  const isSupplemental = task?.status === 'SUPPLEMENTING' || task?.status === 'COMPLETED' || task?.status === 'CLOSED';

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('提示', '请输入有效的产出数量');
      return;
    }

    const remaining = task ? task.plannedQuantity - task.completedQuantity - task.pendingQuantity : 0;
    if (!isSupplemental && remaining > 0 && qty > remaining * 1.5) {
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
    setSubmitting(true);
    try {
      if (isSupplemental) {
        await processTaskApiClient.submitSupplement({
          processTaskId: taskId,
          outputQuantity: qty,
          notes: notes || undefined,
        });
        Alert.alert('成功', '补报已提交，等待审批', [
          { text: '确定', onPress: () => navigation.goBack() },
        ]);
      } else {
        await processTaskApiClient.submitNormalReport({
          processTaskId: taskId,
          outputQuantity: qty,
          notes: notes || undefined,
        });
        Alert.alert('成功', '报工已提交，等待审批', [
          { text: '确定', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err) {
      Alert.alert('错误', err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ScreenWrapper edges={['top']} backgroundColor={theme.colors.background}>
        <Appbar.Header><Appbar.BackAction onPress={() => navigation.goBack()} /><Appbar.Content title="报工" /></Appbar.Header>
        <ActivityIndicator style={{ flex: 1 }} size="large" />
      </ScreenWrapper>
    );
  }

  const remaining = task ? Math.max(0, task.plannedQuantity - task.completedQuantity - task.pendingQuantity) : 0;

  return (
    <ScreenWrapper testID="process-task-report" edges={['top']} backgroundColor={theme.colors.background}>
      <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction testID="report-back" onPress={() => navigation.goBack()} />
        <Appbar.Content
          title={isSupplemental ? '补报' : '报工'}
          subtitle={processName}
          titleStyle={{ fontWeight: '600' }}
        />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Task Context */}
          {task && (
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  {task.processName} — {task.productTypeName || ''}
                </Text>
                <View style={styles.contextGrid}>
                  <View style={styles.contextItem}>
                    <Text style={styles.contextValue}>{task.plannedQuantity}</Text>
                    <Text style={styles.contextLabel}>计划量</Text>
                  </View>
                  <View style={styles.contextItem}>
                    <Text style={[styles.contextValue, { color: '#67c23a' }]}>{task.completedQuantity}</Text>
                    <Text style={styles.contextLabel}>已完成</Text>
                  </View>
                  <View style={styles.contextItem}>
                    <Text style={[styles.contextValue, { color: '#e6a23c' }]}>{task.pendingQuantity}</Text>
                    <Text style={styles.contextLabel}>待审批</Text>
                  </View>
                  <View style={styles.contextItem}>
                    <Text style={[styles.contextValue, { color: remaining > 0 ? '#1890ff' : '#67c23a' }]}>
                      {remaining}
                    </Text>
                    <Text style={styles.contextLabel}>剩余</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          )}

          {isSupplemental && (
            <Card style={[styles.card, { backgroundColor: '#fef3e6' }]}>
              <Card.Content>
                <Text style={{ color: '#e6a23c', fontWeight: '600' }}>补报模式</Text>
                <Text style={{ color: '#b88230', fontSize: 13, marginTop: 4 }}>
                  当前任务已完成/关闭，提交的报工将标记为补报，需要主管审批后才会计入完成量。
                </Text>
              </Card.Content>
            </Card>
          )}

          {/* Input Form */}
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>填写报工</Text>

              <TextInput
                testID="report-quantity-input"
                label={`产出数量 (${unit || 'kg'})`}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                mode="outlined"
                style={styles.input}
                right={<TextInput.Affix text={unit || 'kg'} />}
              />

              {remaining > 0 && !isSupplemental && (
                <View style={styles.quickButtons}>
                  <Text style={styles.quickLabel}>快捷填入:</Text>
                  {[remaining, Math.round(remaining / 2)].filter(v => v > 0).map(v => (
                    <NeoButton
                      key={v}
                      testID={`report-quick-fill-${v}`}
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
                testID="report-notes-input"
                label="备注 (选填)"
                value={notes}
                onChangeText={setNotes}
                mode="outlined"
                multiline
                numberOfLines={3}
                style={[styles.input, { marginTop: 12 }]}
              />
            </Card.Content>
          </Card>

          <NeoButton
            testID="report-submit-btn"
            variant="primary"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || !quantity}
            style={styles.submitBtn}
          >
            {isSupplemental ? '提交补报' : '提交报工'}
          </NeoButton>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: { marginBottom: 12, borderRadius: 12, backgroundColor: '#fff', elevation: 2 },
  sectionTitle: { fontWeight: '600', marginBottom: 12, color: '#333' },
  contextGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  contextItem: { alignItems: 'center' },
  contextValue: { fontSize: 24, fontWeight: '700', color: '#333' },
  contextLabel: { fontSize: 15, color: '#666', marginTop: 2 },
  input: { backgroundColor: '#fff', fontSize: 20 },
  quickButtons: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  quickLabel: { fontSize: 14, color: '#666' },
  quickBtn: { minWidth: 64, height: 40 },
  submitBtn: { marginTop: 12, height: 52 },
});
