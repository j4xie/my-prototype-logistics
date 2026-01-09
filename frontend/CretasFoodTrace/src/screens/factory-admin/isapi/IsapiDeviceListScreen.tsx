/**
 * ISAPI 摄像头设备列表页面
 * 显示工厂内的海康威视 IPC/NVR/DVR 设备
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import isapiApiClient, {
  IsapiDevice,
  IsapiDeviceStatus,
  getDeviceTypeName,
  getDeviceStatusName,
  getDeviceStatusColor,
} from '../../../services/api/isapiApiClient';

// 导航类型
type IsapiStackParamList = {
  IsapiDeviceList: undefined;
  IsapiDeviceDetail: { deviceId: string };
  IsapiDeviceCreate: undefined;
  IsapiDeviceDiscovery: undefined;
  DeviceSetupWizard: undefined;
};

type NavigationProp = NativeStackNavigationProp<IsapiStackParamList, 'IsapiDeviceList'>;

export function IsapiDeviceListScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [devices, setDevices] = useState<IsapiDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<IsapiDeviceStatus | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    activeCount: number;
    activeDevices: string[];
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);

      // 分别处理两个 API 调用，避免一个失败影响另一个
      let devicesResponse: { content: IsapiDevice[] } | null = null;
      let subStatus: { activeCount: number; activeDevices: string[] } | null = null;

      try {
        devicesResponse = await isapiApiClient.getIsapiDevices({
          page: 1,
          size: 50,
          keyword: searchKeyword || undefined,
        });
      } catch (deviceErr) {
        console.error('获取设备列表失败:', deviceErr);
      }

      try {
        subStatus = await isapiApiClient.getSubscriptionStatus();
      } catch (subErr) {
        console.error('获取订阅状态失败:', subErr);
      }

      // 防御性检查：确保 devicesResponse 及其 content 存在
      let filteredDevices: IsapiDevice[] = [];
      if (devicesResponse && devicesResponse.content) {
        filteredDevices = devicesResponse.content;
        if (selectedStatus) {
          filteredDevices = filteredDevices.filter(d => d.status === selectedStatus);
        }
      }

      setDevices(filteredDevices);
      setSubscriptionStatus(subStatus || { activeCount: 0, activeDevices: [] });

      // 如果设备列表获取失败，显示错误
      if (!devicesResponse) {
        setError('无法获取设备列表');
      }
    } catch (err) {
      console.error('加载设备列表失败:', err);
      setError('加载设备列表失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchKeyword, selectedStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleSubscribeAll = async () => {
    try {
      await isapiApiClient.subscribeAllDevices();
      Alert.alert('成功', '已订阅所有在线设备告警');
      loadData();
    } catch (err) {
      Alert.alert('失败', '批量订阅失败');
    }
  };

  const getDeviceIcon = (type: string): string => {
    const icons: Record<string, string> = {
      IPC: 'cctv',
      NVR: 'server',
      DVR: 'harddisk',
      ENCODER: 'video-box',
    };
    return icons[type] || 'camera';
  };

  const renderDeviceItem = ({ item }: { item: IsapiDevice }) => {
    const isSubscribed = subscriptionStatus?.activeDevices.includes(item.id);

    return (
      <TouchableOpacity
        style={styles.deviceCard}
        onPress={() => navigation.navigate('IsapiDeviceDetail', { deviceId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.deviceHeader}>
          <View style={styles.deviceInfo}>
            <Icon source={getDeviceIcon(item.deviceType)} size={28} color="#3182ce" />
            <View style={styles.deviceTextInfo}>
              <Text style={styles.deviceName}>{item.deviceName}</Text>
              <Text style={styles.deviceType}>{getDeviceTypeName(item.deviceType)}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getDeviceStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getDeviceStatusName(item.status)}</Text>
          </View>
        </View>

        <View style={styles.deviceDetails}>
          <View style={styles.detailRow}>
            <Icon source="ip-network" size={16} color="#718096" />
            <Text style={styles.detailText}>{item.ipAddress}:{item.port}</Text>
          </View>

          {item.deviceModel && (
            <View style={styles.detailRow}>
              <Icon source="tag" size={16} color="#718096" />
              <Text style={styles.detailText}>{item.deviceModel}</Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Icon source="video" size={16} color="#718096" />
            <Text style={styles.detailText}>{item.channelCount} 通道</Text>
          </View>

          {item.locationDescription && (
            <View style={styles.detailRow}>
              <Icon source="map-marker" size={16} color="#718096" />
              <Text style={styles.detailText}>{item.locationDescription}</Text>
            </View>
          )}
        </View>

        <View style={styles.deviceFooter}>
          <View style={styles.footerLeft}>
            {isSubscribed && (
              <View style={styles.subscribedBadge}>
                <Icon source="bell-ring" size={14} color="#48bb78" />
                <Text style={styles.subscribedText}>已订阅</Text>
              </View>
            )}
            {item.lastHeartbeatAt && (
              <Text style={styles.heartbeatText}>
                心跳: {new Date(item.lastHeartbeatAt).toLocaleTimeString()}
              </Text>
            )}
          </View>
          <Icon source="chevron-right" size={20} color="#a0aec0" />
        </View>
      </TouchableOpacity>
    );
  };

  const StatusFilterChips = () => {
    const statuses: (IsapiDeviceStatus | 'all')[] = ['all', 'ONLINE', 'OFFLINE', 'ERROR'];

    return (
      <View style={styles.filterContainer}>
        {statuses.map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              (selectedStatus === status || (status === 'all' && !selectedStatus)) && styles.filterChipActive,
            ]}
            onPress={() => setSelectedStatus(status === 'all' ? null : status)}
          >
            <Text
              style={[
                styles.filterChipText,
                (selectedStatus === status || (status === 'all' && !selectedStatus)) && styles.filterChipTextActive,
              ]}
            >
              {status === 'all' ? '全部' : getDeviceStatusName(status)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
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

  return (
    <SafeAreaView style={styles.container}>
      {/* 搜索框 */}
      <View style={styles.searchContainer}>
        <Icon source="magnify" size={20} color="#718096" />
        <TextInput
          style={styles.searchInput}
          placeholder="搜索设备名称或IP地址..."
          value={searchKeyword}
          onChangeText={setSearchKeyword}
          onSubmitEditing={loadData}
          returnKeyType="search"
        />
        {searchKeyword.length > 0 && (
          <TouchableOpacity onPress={() => setSearchKeyword('')}>
            <Icon source="close-circle" size={20} color="#718096" />
          </TouchableOpacity>
        )}
      </View>

      {/* 状态筛选 */}
      <StatusFilterChips />

      {/* 订阅状态栏 */}
      <View style={styles.subscriptionBar}>
        <View style={styles.subscriptionInfo}>
          <Icon source="bell" size={18} color="#3182ce" />
          <Text style={styles.subscriptionText}>
            已订阅 {subscriptionStatus?.activeCount || 0} 台设备告警
          </Text>
        </View>
        <TouchableOpacity style={styles.subscribeAllBtn} onPress={handleSubscribeAll}>
          <Text style={styles.subscribeAllText}>全部订阅</Text>
        </TouchableOpacity>
      </View>

      {/* 错误提示 */}
      {error && (
        <View style={styles.errorContainer}>
          <Icon source="alert-circle" size={20} color="#e53e3e" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadData}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 设备列表 */}
      <FlatList
        data={devices}
        renderItem={renderDeviceItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3182ce']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon source="cctv-off" size={60} color="#a0aec0" />
            <Text style={styles.emptyText}>暂无设备</Text>
            <Text style={styles.emptySubText}>请在管理中心添加摄像头设备</Text>
          </View>
        }
      />

      {/* 配置向导 FAB */}
      <TouchableOpacity
        style={styles.fabSecondary}
        onPress={() => navigation.navigate('DeviceSetupWizard')}
        activeOpacity={0.8}
      >
        <Icon source="wizard-hat" size={22} color="#ffffff" />
      </TouchableOpacity>

      {/* 添加设备 FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('IsapiDeviceCreate')}
        activeOpacity={0.8}
      >
        <Icon source="plus" size={28} color="#ffffff" />
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#2d3748',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#3182ce',
    borderColor: '#3182ce',
  },
  filterChipText: {
    fontSize: 13,
    color: '#718096',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  subscriptionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ebf8ff',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  subscriptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subscriptionText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#2b6cb0',
  },
  subscribeAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#3182ce',
    borderRadius: 4,
  },
  subscribeAllText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fed7d7',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#c53030',
  },
  retryText: {
    fontSize: 14,
    color: '#3182ce',
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  deviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceTextInfo: {
    marginLeft: 12,
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  deviceType: {
    fontSize: 13,
    color: '#718096',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  deviceDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#4a5568',
  },
  deviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subscribedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#c6f6d5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  subscribedText: {
    marginLeft: 4,
    fontSize: 11,
    color: '#276749',
  },
  heartbeatText: {
    fontSize: 11,
    color: '#a0aec0',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#718096',
    fontWeight: '500',
  },
  emptySubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#a0aec0',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3182ce',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3182ce',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabSecondary: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#48bb78',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#48bb78',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default IsapiDeviceListScreen;
