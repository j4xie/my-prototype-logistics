import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Appbar, Searchbar, IconButton, SegmentedButtons } from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { ProcessingScreenProps } from '../../types/navigation';
import { BatchStatusBadge, BatchStatus } from '../../components/processing';
import { processingApiClient as processingAPI, BatchResponse } from '../../services/api/processingApiClient';
import { handleError } from '../../utils/errorHandler';
import { NeoCard, NeoButton, ScreenWrapper, StatusBadge } from '../../components/ui';
import { theme } from '../../theme';

type BatchListScreenProps = ProcessingScreenProps<'BatchList'>;

interface ErrorState {
  message: string;
  canRetry: boolean;
}

// Supervisor类型定义：后端返回的supervisor可能是string或对象
interface SupervisorUser {
  fullName?: string;
  username?: string;
  id?: number;
}

type SupervisorData = string | SupervisorUser;

// 辅助函数：获取supervisor显示名称
const getSupervisorName = (supervisor: SupervisorData | undefined): string => {
  if (!supervisor) return '未指定';
  if (typeof supervisor === 'string') return supervisor;
  return supervisor.fullName || supervisor.username || '未指定';
};

export default function BatchListScreen() {
  const navigation = useNavigation<BatchListScreenProps['navigation']>();
  const route = useRoute<BatchListScreenProps['route']>();
  const showCostAnalysis = route.params?.showCostAnalysis ?? false;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [batches, setBatches] = useState<BatchResponse[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorState | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      fetchBatches();
    }, [selectedStatus])
  );

  const fetchBatches = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (searchQuery) params.search = searchQuery;

      const result = await processingAPI.getBatches(params);
      let batchList: BatchResponse[] = [];
      if (result.data?.batches) batchList = result.data.batches;
      else if (result.batches) batchList = result.batches;
      else if (result.data) batchList = result.data;
      else if (Array.isArray(result)) batchList = result;

      setBatches(batchList);
    } catch (error) {
      handleError(error, { showAlert: false, logError: true });
      setError({
        message: error instanceof Error ? error.message : '加载批次列表失败',
        canRetry: true,
      });
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
      onPress={() => {
        if (showCostAnalysis) {
          navigation.navigate('CostAnalysisDashboard', { batchId: item.id.toString() });
        } else {
          navigation.navigate('BatchDetail', { batchId: item.id.toString() });
        }
      }}
      activeOpacity={0.7}
    >
      <NeoCard style={styles.batchCard} padding="m">
        <View style={styles.cardHeader}>
          <View>
            <Text variant="titleMedium" style={styles.batchNumber}>{item.batchNumber}</Text>
            <Text variant="bodySmall" style={styles.timestamp}>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</Text>
          </View>
          <BatchStatusBadge status={item.status as BatchStatus} size="small" />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>产品</Text>
              <Text style={styles.value}>{item.productType || '待定'}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>负责人</Text>
              <Text style={styles.value}>
                {getSupervisorName(item.supervisor as SupervisorData)}
              </Text>
            </View>
          </View>

          <View style={styles.progressRow}>
             <View style={styles.col}>
                <Text style={styles.label}>目标产量</Text>
                <Text style={styles.value}>{item.targetQuantity} kg</Text>
             </View>
             <View style={styles.col}>
                <Text style={styles.label}>实际产量</Text>
                <Text style={[styles.value, item.actualQuantity ? styles.highlight : {}]}>
                    {item.actualQuantity || 0} kg
                </Text>
             </View>
          </View>
        </View>
        
        {showCostAnalysis && (
            <View style={styles.footer}>
                <StatusBadge status="点击分析成本" variant="success" />
            </View>
        )}
      </NeoCard>
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper edges={['top']} backgroundColor={theme.colors.background}>
      <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={showCostAnalysis ? "选择批次" : "批次列表"} titleStyle={{ fontWeight: '600' }} />
      </Appbar.Header>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="搜索批次..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          onSubmitEditing={fetchBatches}
          elevation={0}
        />
      </View>

      <SegmentedButtons
        value={selectedStatus}
        onValueChange={setSelectedStatus}
        buttons={[
          { value: 'all', label: '全部' },
          { value: 'in_progress', label: '进行中' },
          { value: 'completed', label: '已完成' },
        ]}
        style={styles.segmentedButtons}
        density="small"
      />

      <FlatList
        data={filteredBatches}
        renderItem={renderBatchCard}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {error ? (
              <>
                <IconButton icon="alert-circle-outline" size={48} iconColor={theme.colors.error} />
                <Text style={styles.errorText}>{error.message}</Text>
                {error.canRetry && (
                  <NeoButton variant="outline" onPress={fetchBatches} style={styles.retryButton}>重试</NeoButton>
                )}
              </>
            ) : (
              <>
                <Text style={styles.emptyText}>
                  {searchQuery ? '未找到匹配的批次' : loading ? '加载中...' : '暂无批次数据'}
                </Text>
                {!loading && !searchQuery && !showCostAnalysis && (
                  <NeoButton 
                    variant="primary" 
                    onPress={() => navigation.navigate('ProductionPlanManagement')}
                    style={styles.emptyButton}
                  >
                    前往生产计划
                  </NeoButton>
                )}
              </>
            )}
          </View>
        }
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    paddingBottom: 8,
  },
  searchBar: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.custom.borderRadius.m,
    height: 44,
  },
  searchInput: {
    minHeight: 0,
  },
  segmentedButtons: {
    margin: 16,
    marginTop: 0,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  batchCard: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outlineVariant,
    paddingBottom: 12,
  },
  batchNumber: {
    fontWeight: '700',
    color: theme.colors.text,
    fontSize: 16,
  },
  timestamp: {
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  cardBody: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outlineVariant, // Dashed effect simulated by solid line for now
  },
  col: {
    flex: 1,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 2,
  },
  value: {
    color: theme.colors.text,
    fontWeight: '500',
    fontSize: 14,
  },
  highlight: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  footer: {
      marginTop: 12,
      flexDirection: 'row',
      justifyContent: 'flex-end'
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
  errorText: {
    color: theme.colors.error,
    marginTop: 16,
    marginBottom: 16,
  },
  retryButton: {
    minWidth: 120,
  },
  emptyButton: {
    marginTop: 24,
  },
});
