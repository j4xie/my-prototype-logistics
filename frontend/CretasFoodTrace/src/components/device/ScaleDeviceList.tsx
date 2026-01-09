/**
 * ScaleDeviceList - IoT 电子秤设备列表组件
 * 从 IotDeviceListScreen 抽取的核心逻辑，可复用于多个页面
 * 支持搜索、状态筛选、设备卡片展示
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  TextInput,
} from 'react-native';
import { Icon } from 'react-native-paper';
import scaleApiClient, { ScaleDevice } from '../../services/api/scaleApiClient';

export interface ScaleDeviceListProps {
  /** 点击设备卡片时的回调 */
  onDevicePress: (deviceId: number) => void;
  /** 点击创建按钮时的回调（FAB），不传则不显示 FAB */
  onCreatePress?: () => void;
}

export function ScaleDeviceList({ onDevicePress, onCreatePress }: ScaleDeviceListProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [devices, setDevices] = useState<ScaleDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const response = await scaleApiClient.getScaleDevices({
        page: 1,
        size: 50,
        keyword: searchKeyword || undefined,
        status: selectedStatus || undefined,
      });
      // 防御性检查：确保 response 及其 content 存在
      if (response && response.content) {
        setDevices(response.content);
      } else {
        setDevices([]);
        setError('无法获取设备列表');
      }
    } catch (err) {
      console.error('加载设备列表失败:', err);
      setError('加载设备列表失败');
      setDevices([]);
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

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      idle: '#48bb78',      // 空闲 - 绿色
      active: '#3182ce',    // 运行中 - 蓝色
      offline: '#a0aec0',   // 离线 - 灰色
      error: '#e53e3e',     // 故障 - 红色
      maintenance: '#ed8936', // 维护中 - 橙色
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

  const renderDeviceItem = ({ item }: { item: ScaleDevice }) => (
    <TouchableOpacity
      style={styles.deviceCard}
      onPress={() => onDevicePress(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.deviceHeader}>
        <View style={styles.deviceInfo}>
          <Icon source="scale" size={24} color="#3182ce" />
          <View style={styles.deviceTextInfo}>
            <Text style={styles.deviceName}>{item.equipmentName}</Text>
            <Text style={styles.deviceCode}>{item.equipmentCode}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>

      <View style={styles.deviceDetails}>
        {item.location && (
          <View style={styles.detailRow}>
            <Icon source="map-marker" size={16} color="#718096" />
            <Text style={styles.detailText}>{item.location}</Text>
          </View>
        )}
        {item.brandModel && (
          <View style={styles.detailRow}>
            <Icon source="tag" size={16} color="#718096" />
            <Text style={styles.detailText}>
              {item.brandModel.brandName} {item.brandModel.modelCode}
            </Text>
          </View>
        )}
        {item.lastWeightReading !== undefined && item.lastWeightReading !== null && (
          <View style={styles.detailRow}>
            <Icon source="weight" size={16} color="#718096" />
            <Text style={styles.detailText}>
              最后读数: {item.lastWeightReading} kg
            </Text>
          </View>
        )}
        {item.protocol && (
          <View style={styles.detailRow}>
            <Icon source="connection" size={16} color="#718096" />
            <Text style={styles.detailText}>{item.protocol.protocolName}</Text>
          </View>
        )}
      </View>

      <View style={styles.deviceFooter}>
        <Text style={styles.iotCode}>IoT: {item.iotDeviceCode || '-'}</Text>
        <Icon source="chevron-right" size={20} color="#a0aec0" />
      </View>
    </TouchableOpacity>
  );

  const StatusFilterChips = () => (
    <View style={styles.filterContainer}>
      {['all', 'idle', 'active', 'offline', 'error'].map((status) => (
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
            {status === 'all' ? '全部' : getStatusLabel(status)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182ce" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 搜索框 */}
      <View style={styles.searchContainer}>
        <Icon source="magnify" size={20} color="#718096" />
        <TextInput
          style={styles.searchInput}
          placeholder="搜索设备名称或编码..."
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

      {/* 设备列表 */}
      {error ? (
        <View style={styles.errorContainer}>
          <Icon source="alert-circle" size={48} color="#e53e3e" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : devices.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon source="scale-off" size={64} color="#a0aec0" />
          <Text style={styles.emptyTitle}>暂无设备</Text>
          <Text style={styles.emptySubtitle}>请在管理中心添加新设备</Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          renderItem={renderDeviceItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3182ce']} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB 创建按钮 */}
      {onCreatePress && (
        <TouchableOpacity style={styles.fab} onPress={onCreatePress} activeOpacity={0.8}>
          <Icon source="plus" size={24} color="#fff" />
        </TouchableOpacity>
      )}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    height: 44,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#edf2f7',
  },
  filterChipActive: {
    backgroundColor: '#3182ce',
  },
  filterChipText: {
    fontSize: 13,
    color: '#4a5568',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  deviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  deviceCode: {
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
    color: '#fff',
    fontWeight: '500',
  },
  deviceDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#4a5568',
  },
  deviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#edf2f7',
  },
  iotCode: {
    fontSize: 12,
    color: '#a0aec0',
    fontFamily: 'monospace',
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
    textAlign: 'center',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4a5568',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#718096',
    marginTop: 8,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
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
    elevation: 4,
  },
});

export default ScaleDeviceList;
