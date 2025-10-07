import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Appbar, FAB, Searchbar, Card, SegmentedButtons } from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { ProcessingScreenProps } from '../../types/navigation';
import { BatchStatusBadge, BatchStatus } from '../../components/processing';
import { processingAPI, BatchResponse } from '../../services/api/processingApiClient';

type BatchListScreenProps = ProcessingScreenProps<'BatchList'>;

/**
 * 批次列表页面 - 真实数据展示
 */
export default function BatchListScreen() {
  const navigation = useNavigation<BatchListScreenProps['navigation']>();
  const route = useRoute<BatchListScreenProps['route']>();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [batches, setBatches] = useState<BatchResponse[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // 页面获得焦点时刷新数据
  useFocusEffect(
    React.useCallback(() => {
      fetchBatches();
    }, [selectedStatus])
  );

  const fetchBatches = async () => {
    try {
      setLoading(true);

      const params: any = {};
      if (selectedStatus !== 'all') {
        params.status = selectedStatus;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }

      console.log('📋 Fetching batches with params:', params);

      const result = await processingAPI.getBatches(params);

      console.log('📦 API Response:', JSON.stringify(result, null, 2));

      // 兼容不同的响应格式
      let batchList: BatchResponse[] = [];
      if (result.data?.batches) {
        batchList = result.data.batches;
      } else if (result.batches) {
        batchList = result.batches;
      } else if (result.data) {
        batchList = result.data;
      } else if (Array.isArray(result)) {
        batchList = result;
      }

      console.log('✅ Batches loaded:', batchList.length);

      setBatches(batchList);
    } catch (error: any) {
      console.error('❌ Failed to fetch batches:', error);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBatches();
    setRefreshing(false);
  };

  // 筛选批次
  const filteredBatches = batches.filter(batch => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        batch.batchNumber?.toLowerCase().includes(query) ||
        batch.productType?.toLowerCase().includes(query) ||
        batch.supervisor?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const renderBatchCard = ({ item }: { item: BatchResponse }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('BatchDetail', { batchId: item.id.toString() })}
      activeOpacity={0.7}
    >
      <Card style={styles.batchCard} mode="elevated">
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text variant="titleMedium" style={styles.batchNumber}>
              {item.batchNumber}
            </Text>
            <BatchStatusBadge status={item.status as BatchStatus} size="small" />
          </View>

          <View style={styles.cardBody}>
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>产品:</Text>
              <Text variant="bodyMedium" style={styles.value}>{item.productType || '待定'}</Text>
            </View>

            {item.supervisor && (
              <View style={styles.infoRow}>
                <Text variant="bodyMedium" style={styles.label}>负责人:</Text>
                <Text variant="bodyMedium" style={styles.value}>
                  {(item.supervisor as any).fullName || (item.supervisor as any).username || '未指定'}
                </Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>目标:</Text>
              <Text variant="bodyMedium" style={styles.value}>{item.targetQuantity} kg</Text>
            </View>

            {item.actualQuantity !== undefined && item.actualQuantity > 0 && (
              <View style={styles.infoRow}>
                <Text variant="bodyMedium" style={styles.label}>实际:</Text>
                <Text variant="bodyMedium" style={[styles.value, styles.highlight]}>
                  {item.actualQuantity} kg
                </Text>
              </View>
            )}

            <View style={styles.cardFooter}>
              <Text variant="bodySmall" style={styles.timestamp}>
                {new Date(item.createdAt).toLocaleString('zh-CN')}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="批次列表" />
      </Appbar.Header>

      <Searchbar
        placeholder="搜索批次号、产品类型、负责人..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        onSubmitEditing={fetchBatches}
      />

      <SegmentedButtons
        value={selectedStatus}
        onValueChange={setSelectedStatus}
        buttons={[
          { value: 'all', label: '全部' },
          { value: 'in_progress', label: '进行中' },
          { value: 'quality_check', label: '质检中' },
          { value: 'completed', label: '已完成' },
        ]}
        style={styles.segmentedButtons}
      />

      <FlatList
        data={filteredBatches}
        renderItem={renderBatchCard}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              {searchQuery ? '未找到匹配的批次' : loading ? '加载中...' : '暂无批次数据'}
            </Text>
            {!loading && !searchQuery && (
              <Text variant="bodySmall" style={styles.emptyHint}>
                点击右下角按钮创建第一个批次
              </Text>
            )}
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('CreateBatch')}
        label="创建批次"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  searchBar: {
    margin: 16,
    marginBottom: 8,
  },
  segmentedButtons: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  batchCard: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  batchNumber: {
    fontWeight: '700',
    color: '#212121',
    flex: 1,
  },
  cardBody: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: '#757575',
    width: 70,
  },
  value: {
    color: '#212121',
    flex: 1,
  },
  highlight: {
    color: '#2196F3',
    fontWeight: '600',
  },
  cardFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  timestamp: {
    color: '#9E9E9E',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#9E9E9E',
    textAlign: 'center',
  },
  emptyHint: {
    color: '#BDBDBD',
    textAlign: 'center',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
