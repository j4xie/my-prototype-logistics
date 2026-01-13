/**
 * ISAPI 摄像头设备详情页面
 * 设备信息查看、编辑、抓拍、订阅管理
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Icon } from 'react-native-paper';
import isapiApiClient, {
  IsapiDevice,
  IsapiStream,
  IsapiCapture,
  IsapiEvent,
  getDeviceTypeName,
  getDeviceStatusName,
  getDeviceStatusColor,
  getEventSeverityColor,
} from '../../../services/api/isapiApiClient';

// AI分析结果类型
interface AIAnalysisResult {
  threatLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  detectedObjects: string[];
  riskAssessment: string;
  summary?: string;
}

// 扩展IsapiEvent接口以包含AI分析字段
interface IsapiEventWithAI extends IsapiEvent {
  aiAnalyzed?: boolean;
  aiAnalysisResult?: AIAnalysisResult;
  pictureUrl?: string;
}

// 获取威胁等级颜色
function getThreatLevelColor(level: AIAnalysisResult['threatLevel']): string {
  switch (level) {
    case 'HIGH':
      return '#e53e3e'; // 红色
    case 'MEDIUM':
      return '#ed8936'; // 橙色
    case 'LOW':
      return '#ecc94b'; // 黄色
    case 'NONE':
    default:
      return '#a0aec0'; // 灰色
  }
}

// 获取威胁等级文本
function getThreatLevelText(level: AIAnalysisResult['threatLevel']): string {
  switch (level) {
    case 'HIGH':
      return '高危';
    case 'MEDIUM':
      return '中危';
    case 'LOW':
      return '低危';
    case 'NONE':
    default:
      return '无风险';
  }
}

type RouteParams = {
  IsapiDeviceDetail: { deviceId: string };
};

type RouteType = RouteProp<RouteParams, 'IsapiDeviceDetail'>;

export function IsapiDeviceDetailScreen() {
  const route = useRoute<RouteType>();
  const navigation = useNavigation();
  const { deviceId } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [device, setDevice] = useState<IsapiDevice | null>(null);
  const [streams, setStreams] = useState<IsapiStream[]>([]);
  const [recentEvents, setRecentEvents] = useState<IsapiEventWithAI[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [capture, setCapture] = useState<IsapiCapture | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [deviceData, streamsData, eventsData, subStatus] = await Promise.all([
        isapiApiClient.getIsapiDevice(deviceId),
        isapiApiClient.getStreamUrls(deviceId).catch(() => []),
        isapiApiClient.getRecentAlerts(5).catch(() => []),
        isapiApiClient.getSubscriptionStatus(),
      ]);

      setDevice(deviceData);
      setStreams(streamsData);
      setRecentEvents(eventsData.filter(e => e.deviceId === deviceId));
      setSubscribed(subStatus.activeDevices.includes(deviceId));
    } catch (err) {
      console.error('加载设备详情失败:', err);
      Alert.alert('错误', '加载设备详情失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deviceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const result = await isapiApiClient.testConnection(deviceId);
      Alert.alert(
        result.connected ? '连接成功' : '连接失败',
        result.connected ? '设备连接正常' : '无法连接到设备'
      );
      loadData();
    } catch (err) {
      Alert.alert('测试失败', '测试连接时发生错误');
    } finally {
      setTesting(false);
    }
  };

  const handleSyncDevice = async () => {
    setSyncing(true);
    try {
      await isapiApiClient.syncDevice(deviceId);
      Alert.alert('同步成功', '设备信息已更新');
      loadData();
    } catch (err) {
      Alert.alert('同步失败', '同步设备信息时发生错误');
    } finally {
      setSyncing(false);
    }
  };

  const handleCapture = async (channelId: number = 1) => {
    setCapturing(true);
    try {
      const result = await isapiApiClient.capturePicture(deviceId, channelId);
      setCapture(result);
      if (!result.success) {
        Alert.alert('抓拍失败', result.error || '未知错误');
      }
    } catch (err) {
      Alert.alert('抓拍失败', '抓拍图片时发生错误');
    } finally {
      setCapturing(false);
    }
  };

  const handleToggleSubscription = async () => {
    try {
      if (subscribed) {
        await isapiApiClient.unsubscribeDevice(deviceId);
        setSubscribed(false);
        Alert.alert('成功', '已取消订阅告警');
      } else {
        await isapiApiClient.subscribeDevice(deviceId);
        setSubscribed(true);
        Alert.alert('成功', '已订阅告警');
      }
    } catch (err) {
      Alert.alert('操作失败', '订阅操作失败');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      '确认删除',
      `确定要删除设备 "${device?.deviceName}" 吗？此操作不可恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await isapiApiClient.deleteIsapiDevice(deviceId);
              Alert.alert('成功', '设备已删除');
              navigation.goBack();
            } catch (err) {
              Alert.alert('删除失败', '删除设备时发生错误');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182ce" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon source="alert-circle" size={48} color="#e53e3e" />
          <Text style={styles.errorText}>设备不存在</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3182ce']} />
        }
      >
        {/* 设备状态卡片 */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Icon source="cctv" size={32} color="#3182ce" />
            <View style={styles.statusInfo}>
              <Text style={styles.deviceName}>{device.deviceName}</Text>
              <Text style={styles.deviceType}>{getDeviceTypeName(device.deviceType)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getDeviceStatusColor(device.status) }]}>
              <Text style={styles.statusText}>{getDeviceStatusName(device.status)}</Text>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionBtn, testing && styles.actionBtnDisabled]}
              onPress={handleTestConnection}
              disabled={testing}
            >
              {testing ? (
                <ActivityIndicator size="small" color="#3182ce" />
              ) : (
                <Icon source="lan-connect" size={20} color="#3182ce" />
              )}
              <Text style={styles.actionBtnText}>测试连接</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, syncing && styles.actionBtnDisabled]}
              onPress={handleSyncDevice}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#3182ce" />
              ) : (
                <Icon source="sync" size={20} color="#3182ce" />
              )}
              <Text style={styles.actionBtnText}>同步信息</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, subscribed && styles.actionBtnActive]}
              onPress={handleToggleSubscription}
            >
              <Icon source={subscribed ? 'bell-ring' : 'bell-outline'} size={20} color={subscribed ? '#ffffff' : '#3182ce'} />
              <Text style={[styles.actionBtnText, subscribed && styles.actionBtnTextActive]}>
                {subscribed ? '已订阅' : '订阅告警'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 设备信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>设备信息</Text>
          <View style={styles.infoCard}>
            <InfoRow label="IP地址" value={`${device.ipAddress}:${device.port}`} icon="ip-network" />
            <InfoRow label="RTSP端口" value={device.rtspPort?.toString() || '554'} icon="video" />
            <InfoRow label="型号" value={device.deviceModel || '-'} icon="tag" />
            <InfoRow label="序列号" value={device.serialNumber || '-'} icon="barcode" />
            <InfoRow label="固件版本" value={device.firmwareVersion || '-'} icon="update" />
            <InfoRow label="通道数" value={device.channelCount.toString()} icon="view-grid" />
            <InfoRow label="用户名" value={device.username} icon="account" />
            <InfoRow label="位置" value={device.locationDescription || '-'} icon="map-marker" />
          </View>
        </View>

        {/* 设备能力 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>设备能力</Text>
          <View style={styles.capabilityRow}>
            <CapabilityBadge label="云台" enabled={device.supportsPtz} icon="pan" />
            <CapabilityBadge label="音频" enabled={device.supportsAudio} icon="microphone" />
            <CapabilityBadge label="智能分析" enabled={device.supportsSmart} icon="brain" />
          </View>
        </View>

        {/* 抓拍功能 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>实时抓拍</Text>
            <TouchableOpacity
              style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
              onPress={() => handleCapture(1)}
              disabled={capturing}
            >
              {capturing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Icon source="camera" size={18} color="#ffffff" />
              )}
              <Text style={styles.captureBtnText}>抓拍</Text>
            </TouchableOpacity>
          </View>

          {capture && capture.success && capture.pictureBase64 && (
            <View style={styles.capturePreview}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${capture.pictureBase64}` }}
                style={styles.captureImage}
                resizeMode="contain"
              />
              <Text style={styles.captureTime}>
                抓拍时间: {new Date(capture.captureTime).toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* 流媒体地址 */}
        {streams.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>流媒体地址</Text>
            {streams.map((stream) => (
              <View key={stream.channelId} style={styles.streamCard}>
                <Text style={styles.streamChannel}>通道 {stream.channelId}: {stream.channelName}</Text>
                <View style={styles.streamUrls}>
                  <Text style={styles.streamLabel}>主码流:</Text>
                  <Text style={styles.streamUrl} numberOfLines={1}>{stream.mainStreamUrl}</Text>
                  <Text style={styles.streamLabel}>子码流:</Text>
                  <Text style={styles.streamUrl} numberOfLines={1}>{stream.subStreamUrl}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 最近告警 */}
        {recentEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>最近告警</Text>
            {recentEvents.map((event) => (
              <View key={event.id} style={styles.eventCard}>
                {/* 告警头部信息 */}
                <View style={styles.eventHeader}>
                  <View style={[styles.eventSeverity, { backgroundColor: getEventSeverityColor(event.severity) }]} />
                  <View style={styles.eventContent}>
                    <View style={styles.eventTitleRow}>
                      <Text style={styles.eventType}>{event.eventTypeName}</Text>
                      {/* AI威胁等级徽章 */}
                      {event.aiAnalyzed && event.aiAnalysisResult && (
                        <View style={[
                          styles.threatLevelBadge,
                          { backgroundColor: getThreatLevelColor(event.aiAnalysisResult.threatLevel) }
                        ]}>
                          <Text style={styles.threatLevelText}>
                            {getThreatLevelText(event.aiAnalysisResult.threatLevel)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.eventTime}>
                      {new Date(event.eventTime).toLocaleString()}
                    </Text>
                  </View>
                  {event.processed && (
                    <Icon source="check-circle" size={18} color="#48bb78" />
                  )}
                </View>

                {/* 告警图片缩略图 */}
                {event.pictureUrl && (
                  <View style={styles.eventImageContainer}>
                    <Image
                      source={{ uri: event.pictureUrl }}
                      style={styles.eventImage}
                      resizeMode="cover"
                    />
                  </View>
                )}

                {/* AI分析结果区域 */}
                {event.aiAnalyzed && event.aiAnalysisResult && (
                  <View style={styles.aiAnalysisSection}>
                    <View style={styles.aiAnalysisHeader}>
                      <Icon source="brain" size={14} color="#3182ce" />
                      <Text style={styles.aiAnalysisTitle}>AI分析</Text>
                    </View>

                    {/* 检测对象chips */}
                    {event.aiAnalysisResult.detectedObjects.length > 0 && (
                      <View style={styles.detectedObjectsRow}>
                        <Text style={styles.detectedObjectsLabel}>检测对象:</Text>
                        <View style={styles.objectChipsContainer}>
                          {event.aiAnalysisResult.detectedObjects.map((obj, index) => (
                            <View key={index} style={styles.objectChip}>
                              <Text style={styles.objectChipText}>{obj}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* 风险评估描述 */}
                    {event.aiAnalysisResult.riskAssessment && (
                      <View style={styles.riskAssessmentRow}>
                        <Text style={styles.riskAssessmentLabel}>风险评估:</Text>
                        <Text style={styles.riskAssessmentText} numberOfLines={2}>
                          {event.aiAnalysisResult.riskAssessment}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* 危险操作 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>危险操作</Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Icon source="delete" size={20} color="#e53e3e" />
            <Text style={styles.deleteBtnText}>删除设备</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// 信息行组件
function InfoRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabel}>
        <Icon source={icon} size={16} color="#718096" />
        <Text style={styles.infoLabelText}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// 能力徽章组件
function CapabilityBadge({ label, enabled, icon }: { label: string; enabled?: boolean; icon: string }) {
  return (
    <View style={[styles.capabilityBadge, enabled && styles.capabilityBadgeEnabled]}>
      <Icon source={icon} size={18} color={enabled ? '#48bb78' : '#a0aec0'} />
      <Text style={[styles.capabilityText, enabled && styles.capabilityTextEnabled]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#718096',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#e53e3e',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusInfo: {
    flex: 1,
    marginLeft: 12,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
  },
  deviceType: {
    fontSize: 14,
    color: '#718096',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ebf8ff',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnActive: {
    backgroundColor: '#3182ce',
  },
  actionBtnText: {
    fontSize: 13,
    color: '#3182ce',
    fontWeight: '500',
  },
  actionBtnTextActive: {
    color: '#ffffff',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabelText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#718096',
  },
  infoValue: {
    fontSize: 14,
    color: '#2d3748',
    fontWeight: '500',
    maxWidth: '50%',
    textAlign: 'right',
  },
  capabilityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  capabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  capabilityBadgeEnabled: {
    backgroundColor: '#c6f6d5',
  },
  capabilityText: {
    fontSize: 13,
    color: '#a0aec0',
  },
  capabilityTextEnabled: {
    color: '#276749',
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3182ce',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  captureBtnDisabled: {
    opacity: 0.6,
  },
  captureBtnText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  capturePreview: {
    backgroundColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  captureImage: {
    width: '100%',
    height: 200,
  },
  captureTime: {
    fontSize: 12,
    color: '#a0aec0',
    textAlign: 'center',
    padding: 8,
    backgroundColor: '#1a202c',
  },
  streamCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  streamChannel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 8,
  },
  streamUrls: {
    gap: 4,
  },
  streamLabel: {
    fontSize: 12,
    color: '#718096',
  },
  streamUrl: {
    fontSize: 11,
    color: '#4a5568',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventSeverity: {
    width: 4,
    height: 32,
    borderRadius: 2,
    marginRight: 12,
  },
  eventContent: {
    flex: 1,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventType: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2d3748',
  },
  eventTime: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  // AI威胁等级徽章
  threatLevelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  threatLevelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  // 告警图片
  eventImageContainer: {
    marginTop: 10,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#f7fafc',
  },
  eventImage: {
    width: '100%',
    height: 120,
  },
  // AI分析区域
  aiAnalysisSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  aiAnalysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  aiAnalysisTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3182ce',
  },
  detectedObjectsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  detectedObjectsLabel: {
    fontSize: 12,
    color: '#718096',
    marginRight: 8,
    marginTop: 2,
  },
  objectChipsContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  objectChip: {
    backgroundColor: '#ebf8ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  objectChipText: {
    fontSize: 11,
    color: '#2b6cb0',
    fontWeight: '500',
  },
  riskAssessmentRow: {
    marginTop: 4,
  },
  riskAssessmentLabel: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 2,
  },
  riskAssessmentText: {
    fontSize: 12,
    color: '#4a5568',
    lineHeight: 18,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff5f5',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  deleteBtnText: {
    fontSize: 14,
    color: '#e53e3e',
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 40,
  },
});

export default IsapiDeviceDetailScreen;
