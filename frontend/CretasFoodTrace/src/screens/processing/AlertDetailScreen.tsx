import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, SafeAreaView, Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../services/api/apiClient';

interface AlertDetailData {
  id: number;
  factoryId: string;
  alertType: string;
  level: string;
  status: string;
  metricName: string;
  currentValue: number | null;
  baselineValue: number | null;
  thresholdValue: number | null;
  deviationPercent: number | null;
  description: string;
  aiAnalysis: string | null;
  resolutionNotes: string | null;
  productName: string | null;
  equipmentId: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  verifiedAt: string | null;
  autoVerified: boolean;
  createdAt: string;
}

const AlertDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;
  const userId = user?.id;
  const alertId = route.params?.alertId;

  const [loading, setLoading] = useState(true);
  const [alertData, setAlertData] = useState<AlertDetailData | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAlert();
  }, [alertId]);

  const loadAlert = async () => {
    try {
      const res: any = await apiClient.get(`/api/mobile/${factoryId}/alerts/${alertId}`);
      if (res?.success) setAlertData(res.data);
    } catch (error) {
      console.error('Load alert detail failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!alertData) return;
    setSubmitting(true);
    try {
      await apiClient.put(`/api/mobile/${factoryId}/alerts/${alertData.id}/acknowledge`, null, {
        params: { userId },
      });
      Alert.alert('成功', '告警已确认');
      loadAlert();
    } catch { Alert.alert('操作失败'); }
    finally { setSubmitting(false); }
  };

  const handleResolve = async () => {
    if (!alertData) return;
    setSubmitting(true);
    try {
      await apiClient.put(`/api/mobile/${factoryId}/alerts/${alertData.id}/resolve`,
        { resolutionNotes: resolveNotes },
        { params: { userId } }
      );
      Alert.alert('成功', '告警已解决');
      loadAlert();
    } catch { Alert.alert('操作失败'); }
    finally { setSubmitting(false); }
  };

  const getLevelColor = (level: string) => {
    if (level === 'CRITICAL') return '#EF4444';
    if (level === 'WARNING') return '#F59E0B';
    return '#3B82F6';
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#4F46E5" /></View>;
  if (!alertData) return <View style={styles.center}><Text>告警不存在</Text></View>;

  const timelineItems = [
    { label: '创建告警', time: alertData.createdAt, color: '#EF4444' },
    ...(alertData.acknowledgedAt ? [{ label: '已确认', time: alertData.acknowledgedAt, color: '#F59E0B' }] : []),
    ...(alertData.resolvedAt ? [{ label: '已解决', time: alertData.resolvedAt, color: '#10B981' }] : []),
    ...(alertData.verifiedAt ? [{ label: alertData.autoVerified ? '自动验证' : '人工验证', time: alertData.verifiedAt, color: '#3B82F6' }] : []),
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={[styles.headerBanner, { backgroundColor: getLevelColor(alertData.level) }]}>
          <Text style={styles.headerLevel}>{alertData.level}</Text>
          <Text style={styles.headerType}>{alertData.alertType}</Text>
          <Text style={styles.headerStatus}>{alertData.status}</Text>
        </View>

        {/* Metrics */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>指标详情</Text>
          <View style={styles.metricRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>指标</Text>
              <Text style={styles.metricValue}>{alertData.metricName}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>当前值</Text>
              <Text style={[styles.metricValue, { color: '#EF4444' }]}>
                {alertData.currentValue != null ? alertData.currentValue.toFixed(1) : '-'}
              </Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>基线值</Text>
              <Text style={styles.metricValue}>
                {alertData.baselineValue != null ? alertData.baselineValue.toFixed(1) : '-'}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>偏差</Text>
              <Text style={[styles.metricValue, { color: '#EF4444' }]}>
                {alertData.deviationPercent != null ? alertData.deviationPercent.toFixed(1) + '%' : '-'}
              </Text>
            </View>
          </View>
          {alertData.productName && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>产品:</Text>
              <Text>{alertData.productName}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>描述:</Text>
            <Text style={styles.descText}>{alertData.description}</Text>
          </View>
        </View>

        {/* AI Analysis */}
        {alertData.aiAnalysis && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>AI 根因分析</Text>
            <Text style={styles.aiText}>{alertData.aiAnalysis}</Text>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>状态时间线</Text>
          {timelineItems.map((item, idx) => (
            <View key={idx} style={styles.timelineItem}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              {idx < timelineItems.length - 1 && <View style={styles.line} />}
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>{item.label}</Text>
                <Text style={styles.timelineTime}>{item.time?.substring(0, 16)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Resolution Notes */}
        {alertData.resolutionNotes && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>解决说明</Text>
            <Text>{alertData.resolutionNotes}</Text>
          </View>
        )}

        {/* Actions */}
        {(alertData.status === 'ACTIVE' || alertData.status === 'ACKNOWLEDGED') && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>操作</Text>
            {alertData.status === 'ACTIVE' && (
              <TouchableOpacity style={styles.ackButton} onPress={handleAcknowledge} disabled={submitting}>
                <Text style={styles.buttonText}>确认告警</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.resolveLabel}>解决说明:</Text>
            <TextInput
              style={styles.resolveInput}
              multiline numberOfLines={3}
              placeholder="输入解决措施..."
              value={resolveNotes}
              onChangeText={setResolveNotes}
            />
            <TouchableOpacity style={styles.resolveButton} onPress={handleResolve} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> :
                <Text style={styles.buttonText}>标记为已解决</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  content: { padding: 16 },
  headerBanner: { borderRadius: 12, padding: 20, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLevel: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerType: { color: '#fff', fontSize: 16, fontWeight: '500' },
  headerStatus: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#1a1a1a' },
  metricRow: { flexDirection: 'row', marginBottom: 12 },
  metricItem: { flex: 1 },
  metricLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  metricValue: { fontSize: 20, fontWeight: '700', color: '#333' },
  infoRow: { flexDirection: 'row', paddingVertical: 6 },
  infoLabel: { color: '#666', width: 60 },
  descText: { flex: 1, color: '#333', lineHeight: 20 },
  aiText: { color: '#333', lineHeight: 22 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, position: 'relative' },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 12, marginTop: 4 },
  line: { position: 'absolute', left: 5, top: 16, bottom: -16, width: 2, backgroundColor: '#E5E7EB' },
  timelineContent: { flex: 1 },
  timelineLabel: { fontSize: 14, fontWeight: '500', color: '#333' },
  timelineTime: { fontSize: 12, color: '#999', marginTop: 2 },
  ackButton: { backgroundColor: '#F59E0B', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  resolveLabel: { fontSize: 14, color: '#333', marginBottom: 6, fontWeight: '500' },
  resolveInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, height: 80, textAlignVertical: 'top', marginBottom: 12 },
  resolveButton: { backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default AlertDetailScreen;
