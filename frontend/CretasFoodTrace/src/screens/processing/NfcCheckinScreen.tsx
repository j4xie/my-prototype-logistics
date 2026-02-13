import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { workReportingApiClient } from '../../services/api/workReportingApiClient';
import { processingApiClient } from '../../services/api/processingApiClient';
import BarcodeScannerModal from '../../components/processing/BarcodeScannerModal';
import NfcCheckinModal from '../../components/processing/NfcCheckinModal';
import { useAuthStore } from '../../store/authStore';
import { isNfcModuleInstalled, isNfcAvailable } from '../../utils/nfcUtils';
import type { BatchWorkSessionResponse } from '../../types/workReporting';

type CheckinTab = 'nfc' | 'qr';

interface BatchItem {
  id: number;
  batchNumber: string;
  productName?: string;
  status?: string;
}

export default function NfcCheckinScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const getFactoryId = useAuthStore((s) => s.getFactoryId);
  const factoryId = getFactoryId();

  if (!factoryId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#999" />
          <Text style={styles.emptyText}>请使用工厂账户登录后使用签到功能</Text>
        </View>
      </SafeAreaView>
    );
  }

  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [checkins, setCheckins] = useState<BatchWorkSessionResponse[]>([]);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [nfcModalVisible, setNfcModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkinLoading, setCheckinLoading] = useState(false);

  // NFC availability
  const [nfcSupported, setNfcSupported] = useState(false);
  const [activeTab, setActiveTab] = useState<CheckinTab>('nfc');

  // Check NFC availability on mount
  useEffect(() => {
    const checkNfc = async () => {
      if (!isNfcModuleInstalled()) {
        setNfcSupported(false);
        setActiveTab('qr');
        return;
      }
      const available = await isNfcAvailable();
      setNfcSupported(available);
      setActiveTab(available ? 'nfc' : 'qr');
    };
    checkNfc();
  }, []);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const response = await processingApiClient.getBatches({ status: 'IN_PROGRESS' });
      if (response.success && response.data?.content) {
        setBatches(response.data.content.map((b: Record<string, unknown>) => ({
          id: b.id as number,
          batchNumber: b.batchNumber as string,
          productName: b.productName as string | undefined,
          status: b.status as string | undefined,
        })));
      }
    } catch (error) {
      console.warn('Failed to load batches:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCheckins = useCallback(async (batchId: number) => {
    try {
      const response = await workReportingApiClient.getCheckinList(batchId);
      if (response.success && response.data) {
        setCheckins(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.warn('Failed to load checkins:', error);
    }
  }, []);

  const selectBatch = useCallback((batch: BatchItem) => {
    setSelectedBatch(batch);
    loadCheckins(batch.id);
  }, [loadCheckins]);

  // --- Checkin handlers ---

  const performCheckin = useCallback(async (employeeId: number, method: 'NFC' | 'QR') => {
    if (!selectedBatch || !user?.id) return;

    setCheckinLoading(true);
    try {
      const response = await workReportingApiClient.checkin({
        batchId: selectedBatch.id,
        employeeId,
        checkinMethod: method,
        assignedBy: user.id,
      });

      if (response.success) {
        Alert.alert('签到成功', `员工 #${employeeId} 已通过 ${method === 'NFC' ? 'NFC' : 'QR扫码'} 签到`);
        loadCheckins(selectedBatch.id);
      } else {
        Alert.alert('签到失败', response.message);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '签到失败';
      Alert.alert('签到失败', msg);
    } finally {
      setCheckinLoading(false);
    }
  }, [selectedBatch, user, loadCheckins]);

  // NFC tag read handler
  const handleNfcTagRead = useCallback((employeeId: string) => {
    setNfcModalVisible(false);
    const empId = parseInt(employeeId, 10);
    if (isNaN(empId)) {
      Alert.alert('NFC 错误', '无法解析员工编号');
      return;
    }
    performCheckin(empId, 'NFC');
  }, [performCheckin]);

  // QR scan handler
  const handleQrScan = useCallback((code: string) => {
    setScannerVisible(false);
    const employeeId = parseInt(code, 10);
    if (isNaN(employeeId)) {
      Alert.alert('扫码错误', '无法识别员工编号: ' + code);
      return;
    }
    performCheckin(employeeId, 'QR');
  }, [performCheckin]);

  // Checkout handler
  const handleCheckout = useCallback(async (employeeId: number) => {
    if (!selectedBatch) return;

    try {
      const response = await workReportingApiClient.checkout({
        batchId: selectedBatch.id,
        employeeId,
      });
      if (response.success) {
        Alert.alert('签退成功');
        loadCheckins(selectedBatch.id);
      } else {
        Alert.alert('签退失败', response.message);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '签退失败';
      Alert.alert('签退失败', msg);
    }
  }, [selectedBatch, loadCheckins]);

  // Fallback from NFC modal to QR
  const handleNfcFallbackToQR = useCallback(() => {
    setActiveTab('qr');
    setScannerVisible(true);
  }, []);

  // --- Render: Batch selection (Phase 1) ---

  if (!selectedBatch) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>选择批次签到</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 100 }} />
        ) : batches.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="clipboard-off-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>暂无进行中的批次</Text>
          </View>
        ) : (
          <FlatList
            data={batches}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.batchCard}
                onPress={() => selectBatch(item)}
              >
                <View style={styles.batchInfo}>
                  <Text style={styles.batchNumber}>{item.batchNumber}</Text>
                  {item.productName && (
                    <Text style={styles.batchProduct}>{item.productName}</Text>
                  )}
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // --- Render: Checkin management (Phase 2) ---

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSelectedBatch(null)} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{selectedBatch.batchNumber}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{checkins.length}</Text>
          <Text style={styles.statLabel}>已签到</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {checkins.filter((c) => c.status === 'working').length}
          </Text>
          <Text style={styles.statLabel}>工作中</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {checkins.filter((c) => c.status === 'completed').length}
          </Text>
          <Text style={styles.statLabel}>已签退</Text>
        </View>
      </View>

      {/* Checkin method tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'nfc' && styles.activeTab]}
          onPress={() => setActiveTab('nfc')}
        >
          <MaterialCommunityIcons
            name="nfc"
            size={18}
            color={activeTab === 'nfc' ? '#4F46E5' : '#6B7280'}
          />
          <Text style={[styles.tabText, activeTab === 'nfc' && styles.activeTabText]}>
            NFC 签到
          </Text>
          {!nfcSupported && (
            <View style={styles.tabBadgeUnavailable}>
              <Text style={styles.tabBadgeText}>不可用</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'qr' && styles.activeTab]}
          onPress={() => setActiveTab('qr')}
        >
          <MaterialCommunityIcons
            name="qrcode-scan"
            size={18}
            color={activeTab === 'qr' ? '#4F46E5' : '#6B7280'}
          />
          <Text style={[styles.tabText, activeTab === 'qr' && styles.activeTabText]}>
            QR 扫码
          </Text>
        </TouchableOpacity>
      </View>

      {/* Scan button (based on active tab) */}
      {activeTab === 'nfc' ? (
        <TouchableOpacity
          style={[styles.scanBtn, styles.nfcScanBtn]}
          onPress={() => setNfcModalVisible(true)}
          disabled={checkinLoading}
        >
          {checkinLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="nfc-tap" size={24} color="#fff" />
              <Text style={styles.scanBtnText}>NFC 签到</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => setScannerVisible(true)}
          disabled={checkinLoading}
        >
          {checkinLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="qrcode-scan" size={24} color="#fff" />
              <Text style={styles.scanBtnText}>扫码签到</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Checkin list */}
      <ScrollView style={styles.checkinList}>
        {checkins.length === 0 ? (
          <Text style={styles.noCheckins}>
            暂无签到记录，请{activeTab === 'nfc' ? '使用 NFC' : '扫码'}签到
          </Text>
        ) : (
          checkins.map((session) => (
            <View key={session.id} style={styles.checkinCard}>
              <View style={styles.checkinInfo}>
                <Text style={styles.checkinName}>员工 #{session.employeeId}</Text>
                <Text style={styles.checkinTime}>
                  {session.checkInTime ? session.checkInTime.substring(11, 16) : '--:--'}
                </Text>
                {/* Show checkin method badge */}
                {session.checkinMethod && (
                  <View style={[
                    styles.methodBadge,
                    session.checkinMethod === 'NFC' ? styles.nfcMethodBadge : styles.qrMethodBadge,
                  ]}>
                    <MaterialCommunityIcons
                      name={session.checkinMethod === 'NFC' ? 'nfc' : 'qrcode'}
                      size={10}
                      color={session.checkinMethod === 'NFC' ? '#4F46E5' : '#059669'}
                    />
                    <Text style={[
                      styles.methodBadgeText,
                      session.checkinMethod === 'NFC' ? styles.nfcMethodText : styles.qrMethodText,
                    ]}>
                      {session.checkinMethod}
                    </Text>
                  </View>
                )}
                <View style={[
                  styles.statusBadge,
                  session.status === 'working' ? styles.workingBadge : styles.completedBadge,
                ]}>
                  <Text style={styles.statusText}>
                    {session.status === 'working' ? '工作中' : '已签退'}
                  </Text>
                </View>
              </View>
              {session.status === 'working' && (
                <TouchableOpacity
                  style={styles.checkoutBtn}
                  onPress={() => handleCheckout(session.employeeId)}
                >
                  <Text style={styles.checkoutBtnText}>签退</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* NFC Checkin Modal */}
      <NfcCheckinModal
        visible={nfcModalVisible}
        onClose={() => setNfcModalVisible(false)}
        onTagRead={handleNfcTagRead}
        onFallbackToQR={handleNfcFallbackToQR}
        factoryId={factoryId}
      />

      {/* Barcode Scanner Modal (QR) */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleQrScan}
      />
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
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { marginTop: 12, fontSize: 15, color: '#9CA3AF' },
  batchCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  batchInfo: { flex: 1 },
  batchNumber: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  batchProduct: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  statsBar: {
    flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 16,
    paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#4F46E5' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  // Checkin method tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  tabBadgeUnavailable: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tabBadgeText: {
    fontSize: 9,
    color: '#92400E',
    fontWeight: '600',
  },

  // Scan buttons
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#4F46E5', margin: 16, borderRadius: 12, paddingVertical: 14, gap: 8,
  },
  nfcScanBtn: {
    backgroundColor: '#4338CA',
  },
  scanBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  checkinList: { flex: 1, paddingHorizontal: 16 },
  noCheckins: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 14 },
  checkinCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  checkinInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' },
  checkinName: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
  checkinTime: { fontSize: 13, color: '#6B7280' },

  // Method badge (NFC / QR)
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  nfcMethodBadge: { backgroundColor: '#EEF2FF' },
  qrMethodBadge: { backgroundColor: '#ECFDF5' },
  methodBadgeText: { fontSize: 10, fontWeight: '600' },
  nfcMethodText: { color: '#4F46E5' },
  qrMethodText: { color: '#059669' },

  // Status badge
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  workingBadge: { backgroundColor: '#DBEAFE' },
  completedBadge: { backgroundColor: '#D1FAE5' },
  statusText: { fontSize: 11, fontWeight: '500', color: '#374151' },
  checkoutBtn: {
    backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  checkoutBtnText: { color: '#DC2626', fontSize: 13, fontWeight: '500' },
});
