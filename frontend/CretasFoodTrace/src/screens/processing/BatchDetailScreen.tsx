import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Appbar, Card, ActivityIndicator, Button, Divider } from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { ProcessingScreenProps } from '../../types/navigation';
import { BatchStatusBadge, BatchStatus } from '../../components/processing';
import { processingAPI, BatchResponse } from '../../services/api/processingApiClient';

type BatchDetailScreenProps = ProcessingScreenProps<'BatchDetail'>;

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

  useFocusEffect(
    React.useCallback(() => {
      fetchBatchDetail();
    }, [batchId])
  );

  const fetchBatchDetail = async () => {
    try {
      setLoading(true);
      const result = await processingAPI.getBatchDetail(batchId);
      setBatch(result);
    } catch (error: any) {
      console.error('Failed to fetch batch detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBatchDetail();
    setRefreshing(false);
  };

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

  if (!batch) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="批次详情" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>未找到批次信息</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="批次详情" />
        {!readonly && <Appbar.Action icon="pencil" onPress={() => {}} />}
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
            <Button
              mode="outlined"
              icon="clipboard-check"
              onPress={() => {}}
              style={styles.actionButton}
            >
              质检记录
            </Button>
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
  errorText: {
    color: '#F44336',
    fontSize: 16,
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
