/**
 * NFC 标签管理 (Admin)
 *
 * 仅 factory_admin 角色可用。
 * 功能:
 *   - 显示已注册 NFC 标签列表
 *   - 写入新标签: 选择员工 -> NFC 写入流程
 *   - 显示标签状态 (正常/已失效)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  Easing,
  Platform,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../../store/authStore';
import {
  isNfcModuleInstalled,
  isNfcAvailable,
  writeNfcTag,
  stopNfcScan,
  formatNfcPayload,
} from '../../utils/nfcUtils';

// --- Types ---

interface NfcTagRecord {
  id: string;
  employeeId: number;
  employeeName: string;
  factoryId: string;
  tagId?: string;
  status: 'active' | 'revoked';
  assignedAt: string;
}

interface EmployeeOption {
  id: number;
  fullName: string;
  username: string;
  department?: string;
}

// --- Component ---

export default function NfcTagManagementScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const getFactoryId = useAuthStore((s) => s.getFactoryId);
  const factoryId = getFactoryId() || 'F001';

  const [tags, setTags] = useState<NfcTagRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [nfcAvailable, setNfcAvailable] = useState(false);
  const [nfcModuleReady, setNfcModuleReady] = useState(false);

  // Write modal state
  const [writeModalVisible, setWriteModalVisible] = useState(false);
  const [writeState, setWriteState] = useState<'select' | 'writing' | 'success' | 'error'>('select');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [manualEmployeeId, setManualEmployeeId] = useState('');
  const [manualEmployeeName, setManualEmployeeName] = useState('');
  const [writeError, setWriteError] = useState('');

  // Pulse animation for write mode
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    checkNfc();
    loadTags();
  }, []);

  const checkNfc = useCallback(async () => {
    const moduleInstalled = isNfcModuleInstalled();
    setNfcModuleReady(moduleInstalled);
    if (moduleInstalled) {
      const available = await isNfcAvailable();
      setNfcAvailable(available);
    }
  }, []);

  const loadTags = useCallback(async () => {
    setLoading(true);
    try {
      // In a real implementation, this would call an API to get tag records
      // For now, we use local state as a placeholder
      // e.g.: const response = await apiClient.get(`/api/mobile/${factoryId}/nfc-tags`);

      // Simulate loading with empty list initially
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Tags would come from backend in production
      setTags([]);
    } catch (_error) {
      console.warn('Failed to load NFC tags');
    } finally {
      setLoading(false);
    }
  }, [factoryId]);

  // --- Write flow ---

  const startPulse = useCallback(() => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.current.start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    if (pulseLoop.current) {
      pulseLoop.current.stop();
      pulseLoop.current = null;
    }
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  const openWriteModal = useCallback(() => {
    if (!nfcModuleReady) {
      Alert.alert(
        'NFC 不可用',
        '请先安装 react-native-nfc-manager 模块并重新构建应用。',
        [{ text: '知道了' }]
      );
      return;
    }
    if (!nfcAvailable) {
      Alert.alert(
        'NFC 未启用',
        '请在系统设置中开启 NFC 功能。',
        [{ text: '知道了' }]
      );
      return;
    }
    setWriteState('select');
    setSelectedEmployee(null);
    setManualEmployeeId('');
    setManualEmployeeName('');
    setWriteError('');
    setWriteModalVisible(true);
  }, [nfcModuleReady, nfcAvailable]);

  const closeWriteModal = useCallback(() => {
    stopNfcScan();
    stopPulse();
    setWriteModalVisible(false);
  }, [stopPulse]);

  const startWrite = useCallback(async () => {
    const empId = manualEmployeeId.trim();
    const empName = manualEmployeeName.trim() || `员工 #${empId}`;

    if (!empId || isNaN(Number(empId))) {
      Alert.alert('输入错误', '请输入有效的员工编号 (数字)');
      return;
    }

    setWriteState('writing');
    startPulse();

    try {
      await writeNfcTag(empId, factoryId);

      stopPulse();
      setWriteState('success');

      // Add to local tag list
      const newTag: NfcTagRecord = {
        id: `tag-${Date.now()}`,
        employeeId: Number(empId),
        employeeName: empName,
        factoryId,
        status: 'active',
        assignedAt: new Date().toISOString(),
      };
      setTags((prev) => [newTag, ...prev]);

      // Auto-close after success
      setTimeout(() => {
        closeWriteModal();
      }, 2000);
    } catch (error: unknown) {
      stopPulse();
      const msg = error instanceof Error ? error.message : '写入失败';
      if (msg.includes('cancelled') || msg.includes('cancel')) {
        setWriteState('select');
        return;
      }
      setWriteState('error');
      setWriteError(msg);
    }
  }, [manualEmployeeId, manualEmployeeName, factoryId, startPulse, stopPulse, closeWriteModal]);

  const revokeTag = useCallback((tagId: string) => {
    Alert.alert(
      '确认失效',
      '确定要将此标签标记为已失效吗？失效后该标签将无法用于签到。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: () => {
            setTags((prev) =>
              prev.map((t) => (t.id === tagId ? { ...t, status: 'revoked' as const } : t))
            );
          },
        },
      ]
    );
  }, []);

  // --- Render helpers ---

  const renderTagItem = useCallback(
    ({ item }: { item: NfcTagRecord }) => {
      const isActive = item.status === 'active';
      const assignedDate = item.assignedAt
        ? `${item.assignedAt.substring(0, 10)} ${item.assignedAt.substring(11, 16)}`
        : '--';

      return (
        <View style={styles.tagCard}>
          <View style={styles.tagCardLeft}>
            <View style={[styles.tagStatusDot, isActive ? styles.dotActive : styles.dotRevoked]} />
            <View style={styles.tagCardInfo}>
              <Text style={styles.tagName}>{item.employeeName}</Text>
              <Text style={styles.tagMeta}>
                员工编号: #{item.employeeId}  |  工厂: {item.factoryId}
              </Text>
              <Text style={styles.tagDate}>分配时间: {assignedDate}</Text>
            </View>
          </View>
          <View style={styles.tagCardRight}>
            <View style={[styles.statusBadge, isActive ? styles.activeBadge : styles.revokedBadge]}>
              <Text style={[styles.statusBadgeText, isActive ? styles.activeText : styles.revokedText]}>
                {isActive ? '正常' : '已失效'}
              </Text>
            </View>
            {isActive && (
              <TouchableOpacity
                style={styles.revokeBtn}
                onPress={() => revokeTag(item.id)}
              >
                <Text style={styles.revokeBtnText}>停用</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    },
    [revokeTag]
  );

  // --- Main render ---

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NFC 标签管理</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* NFC Status Banner */}
      <View style={[styles.statusBanner, nfcAvailable ? styles.bannerOk : styles.bannerWarn]}>
        <MaterialCommunityIcons
          name={nfcAvailable ? 'nfc' : 'nfc-off'}
          size={20}
          color={nfcAvailable ? '#10B981' : '#F59E0B'}
        />
        <Text style={[styles.bannerText, nfcAvailable ? styles.bannerTextOk : styles.bannerTextWarn]}>
          {!nfcModuleReady
            ? 'NFC 模块未安装 - 请先安装 react-native-nfc-manager'
            : nfcAvailable
            ? 'NFC 功能正常，可以写入标签'
            : 'NFC 未启用，请在系统设置中开启'}
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{tags.filter((t) => t.status === 'active').length}</Text>
          <Text style={styles.statLabel}>正常标签</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{tags.filter((t) => t.status === 'revoked').length}</Text>
          <Text style={styles.statLabel}>已失效</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{tags.length}</Text>
          <Text style={styles.statLabel}>总计</Text>
        </View>
      </View>

      {/* Write Button */}
      <TouchableOpacity style={styles.writeBtn} onPress={openWriteModal}>
        <MaterialCommunityIcons name="nfc-tap" size={22} color="#fff" />
        <Text style={styles.writeBtnText}>写入新标签</Text>
      </TouchableOpacity>

      {/* Tag List */}
      {loading ? (
        <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 40 }} />
      ) : tags.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="nfc-variant" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>暂无 NFC 标签</Text>
          <Text style={styles.emptyHint}>点击上方"写入新标签"开始分配员工 NFC 卡</Text>
        </View>
      ) : (
        <FlatList
          data={tags}
          keyExtractor={(item) => item.id}
          renderItem={renderTagItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}

      {/* Write Modal */}
      <Modal
        visible={writeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeWriteModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {writeState === 'select' ? '选择员工' : writeState === 'writing' ? '写入标签' : writeState === 'success' ? '写入成功' : '写入失败'}
              </Text>
              <TouchableOpacity onPress={closeWriteModal} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <View style={styles.modalContent}>
              {writeState === 'select' && (
                <View>
                  <Text style={styles.inputLabel}>员工编号 *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="输入员工编号 (数字)"
                    value={manualEmployeeId}
                    onChangeText={setManualEmployeeId}
                    keyboardType="number-pad"
                    placeholderTextColor="#9CA3AF"
                  />

                  <Text style={[styles.inputLabel, { marginTop: 16 }]}>员工姓名 (可选)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="输入员工姓名"
                    value={manualEmployeeName}
                    onChangeText={setManualEmployeeName}
                    placeholderTextColor="#9CA3AF"
                  />

                  <View style={styles.previewBox}>
                    <Text style={styles.previewLabel}>标签数据预览</Text>
                    <Text style={styles.previewText}>
                      {manualEmployeeId
                        ? formatNfcPayload(manualEmployeeId, factoryId)
                        : 'CRETAS:EMP:?:' + factoryId}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.confirmWriteBtn,
                      !manualEmployeeId && styles.confirmWriteBtnDisabled,
                    ]}
                    onPress={startWrite}
                    disabled={!manualEmployeeId}
                  >
                    <MaterialCommunityIcons name="nfc-tap" size={20} color="#fff" />
                    <Text style={styles.confirmWriteBtnText}>开始写入</Text>
                  </TouchableOpacity>
                </View>
              )}

              {writeState === 'writing' && (
                <View style={styles.writingContainer}>
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <View style={styles.writeIconOuter}>
                      <View style={styles.writeIconInner}>
                        <MaterialCommunityIcons name="nfc" size={48} color="#4F46E5" />
                      </View>
                    </View>
                  </Animated.View>
                  <Text style={styles.writingTitle}>请将 NFC 标签靠近手机背部</Text>
                  <Text style={styles.writingHint}>
                    即将写入: {formatNfcPayload(manualEmployeeId, factoryId)}
                  </Text>
                  <TouchableOpacity
                    style={styles.cancelWriteBtn}
                    onPress={() => {
                      stopNfcScan();
                      stopPulse();
                      setWriteState('select');
                    }}
                  >
                    <Text style={styles.cancelWriteText}>取消</Text>
                  </TouchableOpacity>
                </View>
              )}

              {writeState === 'success' && (
                <View style={styles.writingContainer}>
                  <MaterialCommunityIcons name="check-circle" size={64} color="#10B981" />
                  <Text style={styles.writeSuccessTitle}>写入成功</Text>
                  <Text style={styles.writeSuccessHint}>
                    员工 #{manualEmployeeId} 的 NFC 标签已就绪
                  </Text>
                </View>
              )}

              {writeState === 'error' && (
                <View style={styles.writingContainer}>
                  <MaterialCommunityIcons name="close-circle" size={64} color="#EF4444" />
                  <Text style={styles.writeErrorTitle}>写入失败</Text>
                  <Text style={styles.writeErrorMsg}>{writeError}</Text>
                  <TouchableOpacity style={styles.retryWriteBtn} onPress={startWrite}>
                    <MaterialCommunityIcons name="refresh" size={18} color="#fff" />
                    <Text style={styles.retryWriteText}>重试</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1F2937' },

  // Status Banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  bannerOk: { backgroundColor: '#ECFDF5' },
  bannerWarn: { backgroundColor: '#FFFBEB' },
  bannerText: { fontSize: 13, flex: 1 },
  bannerTextOk: { color: '#065F46' },
  bannerTextWarn: { color: '#92400E' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: { fontSize: 22, fontWeight: '700', color: '#4F46E5' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  // Write Button
  writeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  writeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Tag List
  tagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tagCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tagStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  dotActive: { backgroundColor: '#10B981' },
  dotRevoked: { backgroundColor: '#D1D5DB' },
  tagCardInfo: { flex: 1 },
  tagName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  tagMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  tagDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  tagCardRight: { alignItems: 'flex-end', gap: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  activeBadge: { backgroundColor: '#D1FAE5' },
  revokedBadge: { backgroundColor: '#F3F4F6' },
  statusBadgeText: { fontSize: 11, fontWeight: '500' },
  activeText: { color: '#065F46' },
  revokedText: { color: '#6B7280' },
  revokeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  revokeBtnText: { fontSize: 12, color: '#DC2626', fontWeight: '500' },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#6B7280', marginTop: 12 },
  emptyHint: { fontSize: 13, color: '#9CA3AF', marginTop: 6, textAlign: 'center', paddingHorizontal: 40 },

  // Write Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 420,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  closeBtn: { padding: 4 },
  modalContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },

  // Select employee
  inputLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
  },
  previewBox: {
    marginTop: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 14,
  },
  previewLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  previewText: { fontSize: 14, fontWeight: '600', color: '#4F46E5', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  confirmWriteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
    gap: 8,
  },
  confirmWriteBtnDisabled: { opacity: 0.4 },
  confirmWriteBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Writing state
  writingContainer: { alignItems: 'center', paddingVertical: 24 },
  writeIconOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  writeIconInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  writingTitle: { fontSize: 17, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  writingHint: { fontSize: 13, color: '#6B7280', textAlign: 'center', paddingHorizontal: 20 },
  cancelWriteBtn: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  cancelWriteText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },

  // Success
  writeSuccessTitle: { fontSize: 20, fontWeight: '700', color: '#10B981', marginTop: 16 },
  writeSuccessHint: { fontSize: 14, color: '#6B7280', marginTop: 8 },

  // Error
  writeErrorTitle: { fontSize: 20, fontWeight: '700', color: '#EF4444', marginTop: 16 },
  writeErrorMsg: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center', paddingHorizontal: 16 },
  retryWriteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
    gap: 8,
  },
  retryWriteText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
