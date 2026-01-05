/**
 * IoT 电子秤设备详情/编辑页面
 * 显示设备详情，支持编辑和协议绑定
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
  TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import scaleApiClient, {
  ScaleDevice,
  ScaleProtocol,
  UpdateScaleDeviceRequest,
} from '../../../services/api/scaleApiClient';

// 临时类型定义
type IotStackParamList = {
  IotDeviceList: undefined;
  IotDeviceDetail: { deviceId: number };
  IotDeviceCreate: undefined;
};

type NavigationProp = NativeStackNavigationProp<IotStackParamList, 'IotDeviceDetail'>;
type ScreenRouteProp = RouteProp<IotStackParamList, 'IotDeviceDetail'>;

export function IotDeviceDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { deviceId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState<ScaleDevice | null>(null);
  const [protocols, setProtocols] = useState<ScaleProtocol[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // 编辑表单状态
  const [editForm, setEditForm] = useState({
    equipmentName: '',
    location: '',
    status: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const [deviceData, protocolsData] = await Promise.all([
        scaleApiClient.getScaleDevice(deviceId),
        scaleApiClient.getAvailableProtocols(),
      ]);

      setDevice(deviceData);
      setProtocols(protocolsData);
      setEditForm({
        equipmentName: deviceData.equipmentName || '',
        location: deviceData.location || '',
        status: deviceData.status || '',
        notes: '',
      });
    } catch (err) {
      console.error('加载设备详情失败:', err);
      setError('加载设备详情失败');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!device) return;

    try {
      setSaving(true);
      const updateData: UpdateScaleDeviceRequest = {
        equipmentName: editForm.equipmentName,
        location: editForm.location,
        status: editForm.status,
      };

      await scaleApiClient.updateScaleDevice(device.id, updateData);
      Alert.alert('成功', '设备信息已更新');
      setIsEditing(false);
      loadData();
    } catch (err) {
      console.error('保存失败:', err);
      Alert.alert('错误', '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleBindProtocol = async (protocolId: string) => {
    if (!device) return;

    try {
      setSaving(true);
      await scaleApiClient.bindProtocol(device.id, protocolId);
      Alert.alert('成功', '协议绑定成功');
      loadData();
    } catch (err) {
      console.error('绑定协议失败:', err);
      Alert.alert('错误', '绑定协议失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      '确认删除',
      '确定要删除该设备吗？此操作不可撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await scaleApiClient.deleteScaleDevice(deviceId);
              Alert.alert('成功', '设备已删除');
              navigation.goBack();
            } catch (err) {
              console.error('删除失败:', err);
              Alert.alert('错误', '删除失败，请重试');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      idle: '#48bb78',
      active: '#3182ce',
      offline: '#a0aec0',
      error: '#e53e3e',
      maintenance: '#ed8936',
    };
    return colors[status] || '#a0aec0';
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      idle: '空闲',
      active: '运行中',
      offline: '离线',
      error: '故障',
      maintenance: '维护中',
    };
    return labels[status] || status;
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

  if (error || !device) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon source="alert-circle" size={48} color="#e53e3e" />
          <Text style={styles.errorText}>{error || '设备不存在'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 设备基本信息卡片 */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>设备信息</Text>
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
              <Icon source={isEditing ? 'close' : 'pencil'} size={20} color="#3182ce" />
            </TouchableOpacity>
          </View>

          {isEditing ? (
            <View style={styles.editForm}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>设备名称</Text>
                <TextInput
                  style={styles.formInput}
                  value={editForm.equipmentName}
                  onChangeText={(text) => setEditForm({ ...editForm, equipmentName: text })}
                  placeholder="输入设备名称"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>位置</Text>
                <TextInput
                  style={styles.formInput}
                  value={editForm.location}
                  onChangeText={(text) => setEditForm({ ...editForm, location: text })}
                  placeholder="输入设备位置"
                />
              </View>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>保存修改</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.infoList}>
              <InfoRow icon="tag" label="设备编码" value={device.equipmentCode} />
              <InfoRow icon="text" label="设备名称" value={device.equipmentName} />
              <InfoRow icon="map-marker" label="位置" value={device.location || '-'} />
              <InfoRow icon="barcode" label="序列号" value={device.serialNumber || '-'} />
              <InfoRow
                icon="circle"
                label="状态"
                value={getStatusLabel(device.status)}
                valueColor={getStatusColor(device.status)}
              />
            </View>
          )}
        </View>

        {/* IoT 配置卡片 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>IoT 配置</Text>
          <View style={styles.infoList}>
            <InfoRow icon="identifier" label="IoT 设备码" value={device.iotDeviceCode || '-'} />
            <InfoRow icon="antenna" label="MQTT Topic" value={device.mqttTopic || '-'} />
          </View>
        </View>

        {/* 品牌型号卡片 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>品牌型号</Text>
          {device.brandModel ? (
            <View style={styles.infoList}>
              <InfoRow icon="domain" label="品牌" value={device.brandModel.brandName} />
              <InfoRow icon="tag" label="型号" value={device.brandModel.modelCode} />
              {device.brandModel.weightRange && (
                <InfoRow icon="weight" label="量程" value={device.brandModel.weightRange} />
              )}
              {device.brandModel.accuracy && (
                <InfoRow icon="target" label="精度" value={device.brandModel.accuracy} />
              )}
            </View>
          ) : (
            <Text style={styles.emptyText}>未配置品牌型号</Text>
          )}
        </View>

        {/* 协议配置卡片 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>通信协议</Text>
          {device.protocol ? (
            <View style={styles.infoList}>
              <InfoRow icon="connection" label="协议名称" value={device.protocol.protocolName} />
              <InfoRow icon="lan-connect" label="连接类型" value={device.protocol.connectionType} />
              {device.protocol.frameFormat && (
                <InfoRow icon="format-align-left" label="帧格式" value={device.protocol.frameFormat} />
              )}
            </View>
          ) : (
            <View>
              <Text style={styles.emptyText}>未绑定协议</Text>
              {protocols.length > 0 && (
                <View style={styles.protocolList}>
                  <Text style={styles.protocolListTitle}>可用协议：</Text>
                  {protocols.slice(0, 3).map((protocol) => (
                    <TouchableOpacity
                      key={protocol.id}
                      style={styles.protocolItem}
                      onPress={() => handleBindProtocol(protocol.id)}
                    >
                      <Text style={styles.protocolItemName}>{protocol.protocolName}</Text>
                      <Text style={styles.protocolItemType}>{protocol.connectionType}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* 实时数据卡片 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>实时数据</Text>
          <View style={styles.infoList}>
            <InfoRow
              icon="weight"
              label="最后读数"
              value={
                device.lastWeightReading !== undefined && device.lastWeightReading !== null
                  ? `${device.lastWeightReading} kg`
                  : '-'
              }
            />
            <InfoRow
              icon="clock"
              label="最后更新"
              value={device.lastWeightTime || '-'}
            />
          </View>
        </View>

        {/* 危险操作区域 */}
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={[styles.cardTitle, styles.dangerTitle]}>危险操作</Text>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Icon source="delete" size={20} color="#e53e3e" />
            <Text style={styles.deleteButtonText}>删除设备</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// 信息行组件
function InfoRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabel}>
        <Icon source={icon} size={16} color="#718096" />
        <Text style={styles.infoLabelText}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
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
    padding: 32,
  },
  errorText: {
    fontSize: 15,
    color: '#718096',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#3182ce',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  infoList: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabelText: {
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
  emptyText: {
    fontSize: 14,
    color: '#a0aec0',
    textAlign: 'center',
    paddingVertical: 12,
  },
  editForm: {
    gap: 16,
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontSize: 13,
    color: '#4a5568',
    fontWeight: '500',
  },
  formInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#2d3748',
  },
  saveButton: {
    height: 44,
    backgroundColor: '#3182ce',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  protocolList: {
    marginTop: 12,
    gap: 8,
  },
  protocolListTitle: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 4,
  },
  protocolItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f7fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  protocolItemName: {
    fontSize: 14,
    color: '#2d3748',
    fontWeight: '500',
  },
  protocolItemType: {
    fontSize: 12,
    color: '#718096',
  },
  dangerCard: {
    marginBottom: 32,
    borderColor: '#fed7d7',
    borderWidth: 1,
  },
  dangerTitle: {
    color: '#c53030',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#fff5f5',
  },
  deleteButtonText: {
    fontSize: 15,
    color: '#e53e3e',
    fontWeight: '500',
  },
});

export default IotDeviceDetailScreen;
