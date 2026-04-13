import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { getFactoryId } from '../../types/auth';
import { employeeProcessSegmentApi, ActiveSegment } from '../../services/api/employeeProcessSegmentApiClient';
import { BarcodeScannerModal } from '../../components/processing/BarcodeScannerModal';

export default function EmployeeProcessSegmentScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const factoryId = getFactoryId(user);

  const [segments, setSegments] = useState<ActiveSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchActive = useCallback(async () => {
    if (!factoryId) return;
    try {
      const res = await employeeProcessSegmentApi.getActive(factoryId);
      setSegments(res.data ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载失败';
      Alert.alert('错误', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [factoryId]);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchActive();
  }, [fetchActive]);

  const handleScan = useCallback(async (data: string) => {
    setScannerVisible(false);
    if (!factoryId) return;
    try {
      const employeeId = parseInt(data, 10);
      if (isNaN(employeeId)) {
        Alert.alert('扫码失败', '无法识别工牌信息');
        return;
      }
      setActionLoading('start');
      await employeeProcessSegmentApi.start(factoryId, { employeeId });
      Alert.alert('成功', '已开始工序段');
      fetchActive();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '开工失败';
      Alert.alert('开工失败', msg);
    } finally {
      setActionLoading(null);
    }
  }, [factoryId, fetchActive]);

  const handleCheckout = useCallback((segment: ActiveSegment, reason?: string) => {
    if (!factoryId) return;
    const doCheckout = async () => {
      try {
        setActionLoading(segment.id);
        await employeeProcessSegmentApi.checkout(factoryId, {
          employeeId: segment.employeeId,
          reason,
        });
        Alert.alert('成功', '已签退');
        fetchActive();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '签退失败';
        Alert.alert('签退失败', msg);
      } finally {
        setActionLoading(null);
      }
    };
    doCheckout();
  }, [factoryId, fetchActive]);

  const confirmCheckout = useCallback((segment: ActiveSegment) => {
    Alert.alert('选择签退类型', `${segment.employeeName}`, [
      { text: '取消', style: 'cancel' },
      { text: '正常下班', onPress: () => handleCheckout(segment, 'NORMAL') },
      { text: '提前离开', style: 'destructive', onPress: () => handleCheckout(segment, 'EARLY_LEAVE') },
    ]);
  }, [handleCheckout]);

  const handleSwitch = useCallback((segment: ActiveSegment) => {
    if (!factoryId) return;
    Alert.prompt(
      '换工种',
      `请输入 ${segment.employeeName} 的新工种 ID`,
      async (input) => {
        const newWorkTypeId = parseInt(input, 10);
        if (isNaN(newWorkTypeId)) {
          Alert.alert('错误', '请输入有效的工种 ID');
          return;
        }
        try {
          setActionLoading(segment.id);
          await employeeProcessSegmentApi.switchRole(factoryId, {
            employeeId: segment.employeeId,
            newWorkTypeId,
          });
          Alert.alert('成功', '已切换工种');
          fetchActive();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '切换失败';
          Alert.alert('切换失败', msg);
        } finally {
          setActionLoading(null);
        }
      },
      'plain-text',
      '',
      'number-pad',
    );
  }, [factoryId, fetchActive]);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch {
      return iso;
    }
  };

  const renderSegment = ({ item }: { item: ActiveSegment }) => {
    const isItemLoading = actionLoading === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.employeeName}>{item.employeeName}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{item.status === 'ACTIVE' ? '在岗' : item.status}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          {item.workTypeName ? (
            <Text style={styles.detailText}>工种: {item.workTypeName}</Text>
          ) : null}
          {item.processName ? (
            <Text style={styles.detailText}>工序: {item.processName}</Text>
          ) : null}
          <Text style={styles.detailText}>开始: {formatTime(item.startTime)}</Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.checkoutBtn]}
            onPress={() => confirmCheckout(item)}
            disabled={isItemLoading}
          >
            {isItemLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>签退</Text>
            )}
          </TouchableOpacity>
          {Platform.OS === 'ios' ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.switchBtn]}
              onPress={() => handleSwitch(item)}
              disabled={isItemLoading}
            >
              <Text style={styles.switchBtnText}>换工种</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.switchBtn]}
              onPress={() => {
                Alert.alert('换工种', `请输入 ${item.employeeName} 的新工种 ID (数字)`, [
                  { text: '取消', style: 'cancel' },
                  { text: '确定', onPress: () => handleSwitch(item) },
                ]);
              }}
              disabled={isItemLoading}
            >
              <Text style={styles.switchBtnText}>换工种</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>工序段管理</Text>
        <View style={styles.headerRight} />
      </View>

      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => setScannerVisible(true)}
        disabled={actionLoading === 'start'}
      >
        {actionLoading === 'start' ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.scanButtonText}>扫码开工</Text>
        )}
      </TouchableOpacity>

      <FlatList
        data={segments}
        keyExtractor={(item) => item.id}
        renderItem={renderSegment}
        contentContainerStyle={segments.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👷</Text>
            <Text style={styles.emptyText}>暂无在岗人员</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />
        }
      />

      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScan}
        title="扫描工牌"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12,
    paddingHorizontal: 16, backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5E5',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backText: { fontSize: 24, color: '#4F46E5', fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  headerRight: { width: 40 },
  scanButton: {
    marginHorizontal: 16, marginVertical: 12, backgroundColor: '#4F46E5',
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05,
    shadowRadius: 3, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  employeeName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  statusBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 12, color: '#16A34A', fontWeight: '500' },
  cardBody: { marginTop: 8 },
  detailText: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  cardActions: { flexDirection: 'row', marginTop: 12, gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  checkoutBtn: { backgroundColor: '#EF4444' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  switchBtn: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB' },
  switchBtnText: { color: '#374151', fontSize: 14, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 12 },
});
