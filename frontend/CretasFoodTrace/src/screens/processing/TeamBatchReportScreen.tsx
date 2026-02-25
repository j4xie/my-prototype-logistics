import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert, SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { processingApiClient } from '../../services/api/processingApiClient';
import { apiClient } from '../../services/api/apiClient';
import { useFieldVisibilityStore } from '../../store/fieldVisibilityStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface TeamMember {
  userId: number;
  userName: string;
  output: string;
  goodQty: string;
  defectQty: string;
  notes: string;
  expanded: boolean;
}

// Wrapper for field visibility in team batch context
const useTeamFieldVisibility = () => {
  const { isFieldVisible } = useFieldVisibilityStore();
  return {
    showNotes: isFieldVisible('WORK_SESSION', 'notes'),
  };
};

interface BatchOption {
  id: number;
  batchNumber: string;
  productName: string;
  status: string;
}

const TeamBatchReportScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { showNotes } = useTeamFieldVisibility();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchOption | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    loadActiveBatches();
  }, []);

  const loadActiveBatches = async () => {
    try {
      const res = await processingApiClient.getBatches({
        factoryId: factoryId ?? undefined,
        status: 'IN_PROGRESS',
        supervisorId: user?.id,
        page: 1,
        size: 50,
      });
      if (res?.success) {
        const content = res.data?.content || (res.data as unknown as BatchOption[]) || [];
        const batchList = content.map((b: { id: number; batchNumber: string; productType?: string; status: string }) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          productName: (b as Record<string, unknown>).productType as string || '',
          status: b.status,
        }));
        setBatches(batchList);
        // Auto-select if only one batch
        if (batchList.length === 1) {
          selectBatch(batchList[0]);
        }
      }
    } catch (error) {
      console.error('Load batches failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectBatch = async (batch: BatchOption) => {
    setSelectedBatch(batch);
    // Load team members for this batch's supervisor/workshop
    try {
      const res: any = await apiClient.get(`/api/mobile/${factoryId}/employees`, {
        params: { role: 'WORKER', page: 1, size: 50 },
      });
      if (res?.success) {
        const users = res.data?.content || res.data || [];
        setTeamMembers(users.map((u: any) => ({
          userId: u.id, userName: u.name || u.username,
          output: '', goodQty: '', defectQty: '', notes: '', expanded: false,
        })));
      }
    } catch (error) {
      // Fallback: allow manual entry
      setTeamMembers([{
        userId: 0, userName: '工人1',
        output: '', goodQty: '', defectQty: '', notes: '', expanded: false,
      }]);
    }
  };

  const updateMember = (idx: number, field: keyof TeamMember, value: string | boolean) => {
    setTeamMembers(prev => {
      const updated = [...prev];
      const existing = updated[idx];
      if (existing) {
        updated[idx] = { ...existing, [field]: value };
      }
      return updated;
    });
  };

  const toggleExpand = (idx: number) => {
    setTeamMembers(prev => {
      const updated = [...prev];
      const existing = updated[idx];
      if (existing) {
        updated[idx] = { ...existing, expanded: !existing.expanded };
      }
      return updated;
    });
  };

  const addMember = () => {
    setTeamMembers(prev => [...prev, {
      userId: 0, userName: `工人${prev.length + 1}`,
      output: '', goodQty: '', defectQty: '', notes: '', expanded: false,
    }]);
  };

  const handleSubmit = async () => {
    if (!selectedBatch) return;
    const validMembers = teamMembers.filter(m => m.output && parseInt(m.output, 10) > 0);
    if (validMembers.length === 0) {
      Alert.alert('请至少填写一人的产出数据');
      return;
    }

    setSubmitting(true);
    try {
      const result = await processingApiClient.submitTeamBatchReport({
        batchId: selectedBatch.id,
        members: validMembers.map(m => {
          const output = parseInt(m.output, 10);
          const good = m.goodQty ? parseInt(m.goodQty, 10) : undefined;
          const defect = m.defectQty ? parseInt(m.defectQty, 10) : undefined;
          return {
            userId: m.userId,
            outputQuantity: output,
            goodQuantity: good,
            defectQuantity: defect,
            notes: m.notes || undefined,
          };
        }),
      });

      const data = result.data;
      Alert.alert(
        '提交成功',
        `${data?.recordedMembers ?? validMembers.length}人报工已提交\n总产出: ${data?.totalOutput ?? '—'}`,
        [{ text: '确定', onPress: () => navigation.goBack() }],
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '提交失败';
      Alert.alert('提交失败', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#4F46E5" /></View>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>班组批量报工</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {!selectedBatch ? (
          <>
            <Text style={styles.subtitle}>选择生产批次:</Text>
            {batches.map(b => (
              <TouchableOpacity key={b.id} style={styles.batchItem} onPress={() => selectBatch(b)}>
                <Text style={styles.batchNumber}>{b.batchNumber}</Text>
                <Text style={styles.batchProduct}>{b.productName || '未知产品'}</Text>
              </TouchableOpacity>
            ))}
            {batches.length === 0 && <Text style={styles.emptyText}>暂无分配给您的进行中批次</Text>}
          </>
        ) : (
          <>
            <View style={styles.selectedBatch}>
              <Text style={styles.selectedLabel}>已选批次:</Text>
              <Text style={styles.selectedValue}>{selectedBatch.batchNumber} - {selectedBatch.productName}</Text>
              <TouchableOpacity onPress={() => { setSelectedBatch(null); setTeamMembers([]); }}>
                <Text style={styles.changeText}>更换</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>班组成员报工:</Text>
            {teamMembers.map((member, idx) => (
              <View key={idx} style={styles.memberCard}>
                <TouchableOpacity style={styles.memberHeader} onPress={() => toggleExpand(idx)}>
                  <Text style={styles.memberName}>{member.userName}</Text>
                  <MaterialCommunityIcons
                    name={member.expanded ? 'chevron-up' : 'chevron-down'}
                    size={20} color="#6B7280"
                  />
                </TouchableOpacity>
                <View style={styles.memberInputs}>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>产出</Text>
                    <TextInput style={styles.input} keyboardType="numeric" placeholder="0"
                      value={member.output} onChangeText={v => updateMember(idx, 'output', v)} />
                  </View>
                  {member.expanded && (
                    <>
                      <View style={styles.inputWrapper}>
                        <Text style={styles.inputLabel}>良品</Text>
                        <TextInput style={styles.input} keyboardType="numeric" placeholder="同产出"
                          value={member.goodQty} onChangeText={v => updateMember(idx, 'goodQty', v)} />
                      </View>
                      <View style={styles.inputWrapper}>
                        <Text style={styles.inputLabel}>不良品</Text>
                        <TextInput style={styles.input} keyboardType="numeric" placeholder="0"
                          value={member.defectQty} onChangeText={v => updateMember(idx, 'defectQty', v)} />
                      </View>
                    </>
                  )}
                </View>
                {member.expanded && showNotes && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.inputLabel}>备注</Text>
                    <TextInput style={styles.input} placeholder="备注"
                      value={member.notes} onChangeText={v => updateMember(idx, 'notes', v)} />
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.addButton} onPress={addMember}>
              <Text style={styles.addButtonText}>+ 添加成员</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.submitButton, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> :
                <Text style={styles.submitText}>一键提交 ({teamMembers.filter(m => m.output && parseInt(m.output, 10) > 0).length}人)</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
  batchItem: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' },
  batchNumber: { fontSize: 15, fontWeight: '600', color: '#4F46E5' },
  batchProduct: { fontSize: 14, color: '#666' },
  emptyText: { textAlign: 'center', color: '#999', paddingVertical: 20 },
  selectedBatch: { backgroundColor: '#EEF2FF', borderRadius: 10, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center' },
  selectedLabel: { fontSize: 14, color: '#666', marginRight: 8 },
  selectedValue: { flex: 1, fontSize: 14, fontWeight: '600', color: '#4F46E5' },
  changeText: { color: '#EF4444', fontSize: 14 },
  memberCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  memberHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  memberName: { fontSize: 15, fontWeight: '600', color: '#333' },
  memberInputs: { flexDirection: 'row', gap: 8 },
  inputWrapper: { flex: 1 },
  inputLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  addButton: { paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
  addButtonText: { color: '#4F46E5', fontSize: 15, fontWeight: '500' },
  submitButton: { backgroundColor: '#4F46E5', paddingVertical: 15, borderRadius: 10, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});

export default TeamBatchReportScreen;
