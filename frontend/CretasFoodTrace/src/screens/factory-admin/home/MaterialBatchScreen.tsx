/**
 * 原料批次页面
 * 显示今日原材料入库批次
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { FAHomeStackParamList } from '../../../types/navigation';
import { materialBatchApiClient } from '../../../services/api/materialBatchApiClient';

type NavigationProp = NativeStackNavigationProp<FAHomeStackParamList, 'MaterialBatch'>;

interface MaterialBatch {
  id: string;
  batchNumber: string;
  materialTypeName?: string;
  materialTypeId: string;
  quantity: number;
  unit: string;
  supplierName?: string;
  status: string;
  receivedAt: string;
}

export function MaterialBatchScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [batches, setBatches] = useState<MaterialBatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const response = await materialBatchApiClient.getMaterialBatches({
        page: 1,
        size: 50,
      }) as { success: boolean; data?: { content?: MaterialBatch[] } };
      if (response.success && response.data) {
        setBatches(response.data.content || []);
      }
    } catch (err) {
      console.error('加载原料批次失败:', err);
      setError('数据加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      available: '#48bb78',
      reserved: '#ed8936',
      depleted: '#a0aec0',
      expired: '#e53e3e',
    };
    return colors[status] || '#a0aec0';
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      available: '可用',
      reserved: '已预留',
      depleted: '已消耗',
      expired: '已过期',
    };
    return labels[status] || status;
  };

  const renderBatchItem = ({ item }: { item: MaterialBatch }) => (
    <TouchableOpacity
      style={styles.batchCard}
      onPress={() => navigation.navigate('MaterialBatchDetail', { batchId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.batchHeader}>
        <Text style={styles.batchNumber}>{item.batchNumber}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.materialType}>{item.materialTypeName || item.materialTypeId}</Text>
      <View style={styles.batchFooter}>
        <View style={styles.infoItem}>
          <Icon source="scale" size={16} color="#666" />
          <Text style={styles.infoText}>{item.quantity} {item.unit || 'kg'}</Text>
        </View>
        {item.supplierName && (
          <View style={styles.infoItem}>
            <Icon source="truck" size={16} color="#666" />
            <Text style={styles.infoText}>{item.supplierName}</Text>
          </View>
        )}
        <Icon source="chevron-right" size={20} color="#ccc" />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>原料批次</Text>
        <View style={styles.headerRight}>
          <Text style={styles.batchCount}>{batches.length} 批</Text>
        </View>
      </View>

      {/* 错误提示 */}
      {error && (
        <View style={styles.errorBanner}>
          <Icon source="alert-circle" size={20} color="#e53e3e" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={batches}
        keyExtractor={(item) => item.id}
        renderItem={renderBatchItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon source="truck-delivery" size={48} color="#ccc" />
            <Text style={styles.emptyText}>暂无原料批次</Text>
          </View>
        }
      />
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
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  headerRight: {
    width: 60,
    alignItems: 'flex-end',
  },
  batchCount: {
    fontSize: 14,
    color: '#ed8936',
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fed7d7',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#c53030',
  },
  listContent: {
    padding: 16,
  },
  batchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  batchNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  materialType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  batchFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
});

export default MaterialBatchScreen;
