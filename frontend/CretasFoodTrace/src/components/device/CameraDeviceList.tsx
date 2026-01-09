/**
 * CameraDeviceList - Reusable camera device list component
 * Extracted from IsapiDeviceListScreen for use in multiple contexts
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
  Alert,
} from 'react-native';
import { Icon } from 'react-native-paper';
import isapiApiClient, {
  IsapiDevice,
  IsapiDeviceStatus,
  getDeviceTypeName,
  getDeviceStatusName,
  getDeviceStatusColor,
} from '../../services/api/isapiApiClient';

export interface CameraDeviceListProps {
  onDevicePress: (deviceId: number) => void;
  onCreatePress?: () => void;
  onSetupWizardPress?: () => void;
}

export function CameraDeviceList({
  onDevicePress,
  onCreatePress,
  onSetupWizardPress,
}: CameraDeviceListProps) {
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

      // Handle both API calls separately to avoid one failure affecting the other
      let devicesResponse: { content: IsapiDevice[] } | null = null;
      let subStatus: { activeCount: number; activeDevices: string[] } | null = null;

      try {
        devicesResponse = await isapiApiClient.getIsapiDevices({
          page: 1,
          size: 50,
          keyword: searchKeyword || undefined,
        });
      } catch (deviceErr) {
        console.error('Failed to fetch device list:', deviceErr);
      }

      try {
        subStatus = await isapiApiClient.getSubscriptionStatus();
      } catch (subErr) {
        console.error('Failed to fetch subscription status:', subErr);
      }

      // Defensive check: ensure devicesResponse and its content exist
      let filteredDevices: IsapiDevice[] = [];
      if (devicesResponse && devicesResponse.content) {
        filteredDevices = devicesResponse.content;
        if (selectedStatus) {
          filteredDevices = filteredDevices.filter(d => d.status === selectedStatus);
        }
      }

      setDevices(filteredDevices);
      setSubscriptionStatus(subStatus || { activeCount: 0, activeDevices: [] });

      // Show error if device list fetch failed
      if (!devicesResponse) {
        setError('Unable to fetch device list');
      }
    } catch (err) {
      console.error('Failed to load device list:', err);
      setError('Failed to load device list');
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
      Alert.alert('Success', 'Subscribed to all online device alerts');
      loadData();
    } catch (err) {
      Alert.alert('Failed', 'Batch subscription failed');
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

  const handleDevicePress = (item: IsapiDevice) => {
    // Convert string id to number for the callback
    const deviceIdNum = parseInt(item.id, 10);
    if (!isNaN(deviceIdNum)) {
      onDevicePress(deviceIdNum);
    }
  };

  const renderDeviceItem = ({ item }: { item: IsapiDevice }) => {
    const isSubscribed = subscriptionStatus?.activeDevices.includes(item.id);

    return (
      <TouchableOpacity
        style={styles.deviceCard}
        onPress={() => handleDevicePress(item)}
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
            <Text style={styles.detailText}>{item.channelCount} channels</Text>
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
                <Text style={styles.subscribedText}>Subscribed</Text>
              </View>
            )}
            {item.lastHeartbeatAt && (
              <Text style={styles.heartbeatText}>
                Heartbeat: {new Date(item.lastHeartbeatAt).toLocaleTimeString()}
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
              {status === 'all' ? 'All' : getDeviceStatusName(status)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182ce" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Box */}
      <View style={styles.searchContainer}>
        <Icon source="magnify" size={20} color="#718096" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search device name or IP address..."
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

      {/* Status Filter */}
      <StatusFilterChips />

      {/* Subscription Status Bar */}
      <View style={styles.subscriptionBar}>
        <View style={styles.subscriptionInfo}>
          <Icon source="bell" size={18} color="#3182ce" />
          <Text style={styles.subscriptionText}>
            Subscribed to {subscriptionStatus?.activeCount || 0} device alerts
          </Text>
        </View>
        <TouchableOpacity style={styles.subscribeAllBtn} onPress={handleSubscribeAll}>
          <Text style={styles.subscribeAllText}>Subscribe All</Text>
        </TouchableOpacity>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Icon source="alert-circle" size={20} color="#e53e3e" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Device List */}
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
            <Text style={styles.emptyText}>No devices</Text>
            <Text style={styles.emptySubText}>Please add camera devices in the management center</Text>
          </View>
        }
      />

      {/* Setup Wizard FAB */}
      {onSetupWizardPress && (
        <TouchableOpacity
          style={styles.fabSecondary}
          onPress={onSetupWizardPress}
          activeOpacity={0.8}
        >
          <Icon source="wizard-hat" size={22} color="#ffffff" />
        </TouchableOpacity>
      )}

      {/* Add Device FAB */}
      {onCreatePress && (
        <TouchableOpacity
          style={styles.fab}
          onPress={onCreatePress}
          activeOpacity={0.8}
        >
          <Icon source="plus" size={28} color="#ffffff" />
        </TouchableOpacity>
      )}
    </View>
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

export default CameraDeviceList;
