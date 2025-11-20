import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Appbar, Card, ActivityIndicator, Button, Divider, Menu, IconButton } from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { ProcessingScreenProps } from '../../types/navigation';
import { BatchStatusBadge, BatchStatus } from '../../components/processing';
import { processingAPI, BatchResponse } from '../../services/api/processingApiClient';
import { handleError } from '../../utils/errorHandler';

type BatchDetailScreenProps = ProcessingScreenProps<'BatchDetail'>;

interface ErrorState {
  message: string;
  canRetry: boolean;
}

/**
 * 批次详情页面 - 完整版
 */
export default function BatchDetailScreen() {
  const navigation = useNavigation<BatchDetailScreenProps['navigation']>();
  const route = useRoute<BatchDetailScreenProps['route']>();
  const { batchId, readonly } = route.params;

  const [batch, setBatch] = useState<BatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [qualityMenuVisible, setQualityMenuVisible] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      fetchBatchDetail();
    }, [batchId])
  );

  const fetchBatchDetail = async () => {
    try {
      setLoading(true);
      setError(null); // 清除之前的错误

      const result = await processingAPI.getBatchDetail(batchId);
      setBatch(result);
    } catch (error) {
      console.error('Failed to fetch batch detail:', error);

      // ✅ GOOD: 设置错误状态，不静默失败
      handleError(error, {
        showAlert: false, // 使用内联错误UI
        logError: true,
      });

      setError({
        message: error instanceof Error ? error.message : '加载批次详情失败，请稍后重试',
        canRetry: true,
      });
      setBatch(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBatchDetail();
    setRefreshing(false);
  };

  // ✅ 加载中状态
  if (loading && !batch) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="批次详情" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </View>
    );
  }

  // ✅ 错误状态或数据为空
  if (!batch) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="批次详情" />
        </Appbar.Header>
        <View style={styles.errorContainer}>
          {/* ✅ 优先显示错误UI */}
          {error ? (
            <>
              <IconButton icon="alert-circle-outline" size={48} iconColor="#F44336" />
              <Text style={styles.errorText}>{error.message}</Text>
              {error.canRetry && (
                <Button
                  mode="outlined"
                  icon="refresh"
                  onPress={fetchBatchDetail}
                  style={styles.retryButton}
                >
                  重试
                </Button>
              )}
            </>
          ) : (
            <>
              <IconButton icon="package-variant-closed" size={48} iconColor="#9E9E9E" />
              <Text style={styles.emptyText}>未找到批次信息</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="批次详情" />
        {!readonly && <Appbar.Action icon="pencil" onPress={() => navigation.navigate('EditBatch', { batchId })} />}
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* 批次号和状态 */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Text variant="titleSmall" style={styles.label}>批次号</Text>
                <Text variant="headlineSmall" style={styles.batchNumber}>
                  {batch.batchNumber}
                </Text>
              </View>
              <BatchStatusBadge status={batch.status as BatchStatus} size="medium" />
            </View>
          </Card.Content>
        </Card>

        {/* 基本信息 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="基本信息" />
          <Card.Content>
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>产品类型:</Text>
              <Text variant="bodyMedium" style={styles.value}>{batch.productType}</Text>
            </View>
            <Divider style={styles.divider} />

            {batch.supervisor && (
              <>
                <View style={styles.infoRow}>
                  <Text variant="bodyMedium" style={styles.label}>负责人:</Text>
                  <Text variant="bodyMedium" style={styles.value}>{batch.supervisor.fullName || batch.supervisor.username || '未指定'}</Text>
                </View>
                <Divider style={styles.divider} />
              </>
            )}

            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>目标产量:</Text>
              <Text variant="bodyMedium" style={styles.value}>{batch.targetQuantity} kg</Text>
            </View>

            {batch.actualQuantity !== undefined && batch.actualQuantity > 0 && (
              <>
                <Divider style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text variant="bodyMedium" style={styles.label}>实际产量:</Text>
                  <Text variant="bodyMedium" style={[styles.value, styles.highlight]}>
                    {batch.actualQuantity} kg
                  </Text>
                </View>
              </>
            )}

            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>创建时间:</Text>
              <Text variant="bodySmall" style={styles.value}>
                {new Date(batch.createdAt).toLocaleString('zh-CN')}
              </Text>
            </View>

            {batch.completedAt && (
              <>
                <Divider style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text variant="bodyMedium" style={styles.label}>完成时间:</Text>
                  <Text variant="bodySmall" style={styles.value}>
                    {new Date(batch.completedAt).toLocaleString('zh-CN')}
                  </Text>
                </View>
              </>
            )}
          </Card.Content>
        </Card>

        {/* 原料信息 */}
        {batch.rawMaterials && batch.rawMaterials.length > 0 && (
          <Card style={styles.card} mode="elevated">
            <Card.Title title="原料信息" />
            <Card.Content>
              {batch.rawMaterials.map((material: any, index: number) => (
                <View key={index} style={styles.materialRow}>
                  <Text variant="bodyMedium">{material.materialType || material.type}</Text>
                  <Text variant="bodyMedium" style={styles.materialQuantity}>
                    {material.quantity} {material.unit || 'kg'}
                  </Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* 快捷操作 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="快捷操作" />
          <Card.Content>
            <Menu
              visible={qualityMenuVisible}
              onDismiss={() => setQualityMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  icon="clipboard-check"
                  onPress={() => setQualityMenuVisible(true)}
                  style={styles.actionButton}
                >
                  质检记录
                </Button>
              }
            >
              <Menu.Item
                leadingIcon="package-variant"
                onPress={() => {
                  setQualityMenuVisible(false);
                  navigation.navigate('CreateQualityRecord', {
                    batchId: batch!.id.toString(),
                    inspectionType: 'raw_material',
                  });
                }}
                title="原材料检验"
              />
              <Menu.Item
                leadingIcon="cogs"
                onPress={() => {
                  setQualityMenuVisible(false);
                  navigation.navigate('CreateQualityRecord', {
                    batchId: batch!.id.toString(),
                    inspectionType: 'process',
                  });
                }}
                title="过程检验"
              />
              <Menu.Item
                leadingIcon="check-circle"
                onPress={() => {
                  setQualityMenuVisible(false);
                  navigation.navigate('CreateQualityRecord', {
                    batchId: batch!.id.toString(),
                    inspectionType: 'final_product',
                  });
                }}
                title="成品检验"
              />
            </Menu>
            <Button
              mode="outlined"
              icon="cash"
              onPress={() => navigation.navigate('CostAnalysisDashboard', { batchId: batch.id.toString() })}
              style={styles.actionButton}
            >
              成本分析
            </Button>
            <Button
              mode="outlined"
              icon="timeline"
              onPress={() => {}}
              style={styles.actionButton}
            >
              批次时间线
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#757575',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#F44336',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  emptyText: {
    color: '#9E9E9E',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    borderColor: '#F44336',
    marginTop: 8,
  },
  content: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  batchNumber: {
    fontWeight: '700',
    color: '#212121',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    color: '#757575',
    width: 90,
  },
  value: {
    color: '#212121',
    flex: 1,
  },
  highlight: {
    color: '#2196F3',
    fontWeight: '600',
  },
  divider: {
    marginVertical: 4,
  },
  materialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  materialQuantity: {
    color: '#2196F3',
    fontWeight: '600',
  },
  actionButton: {
    marginBottom: 8,
  },
  placeholder: {
    color: '#9E9E9E',
    paddingVertical: 8,
  },
});
