import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Appbar, Divider, ActivityIndicator, IconButton, Menu } from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { ProcessingScreenProps } from '../../types/navigation';
import { BatchStatusBadge, BatchStatus } from '../../components/processing';
import { processingAPI, BatchResponse } from '../../services/api/processingApiClient';
import { handleError } from '../../utils/errorHandler';
import { NeoCard, NeoButton, ScreenWrapper, StatusBadge } from '../../components/ui';
import { theme } from '../../theme';

type BatchDetailScreenProps = ProcessingScreenProps<'BatchDetail'>;

interface ErrorState {
  message: string;
  canRetry: boolean;
}

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
      setError(null);
      const result = await processingAPI.getBatchDetail(batchId);
      setBatch(result);
    } catch (error) {
      handleError(error, { showAlert: false, logError: true });
      setError({
        message: error instanceof Error ? error.message : '加载批次详情失败',
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

  if (loading && !batch) {
    return (
      <ScreenWrapper>
        <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="批次详情" />
        </Appbar.Header>
        <View style={styles.centerContainer}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      </ScreenWrapper>
    );
  }

  if (!batch) {
    return (
      <ScreenWrapper>
        <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="批次详情" />
        </Appbar.Header>
        <View style={styles.centerContainer}>
          {error ? (
            <>
              <Text style={styles.errorText}>{error.message}</Text>
              {error.canRetry && <NeoButton onPress={fetchBatchDetail}>重试</NeoButton>}
            </>
          ) : (
            <Text>未找到批次信息</Text>
          )}
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={['top']} backgroundColor={theme.colors.background}>
      <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="批次详情" titleStyle={{ fontWeight: '600' }} />
        {!readonly && <Appbar.Action icon="pencil" onPress={() => navigation.navigate('EditBatch', { batchId })} />}
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header Card */}
        <NeoCard style={styles.card} padding="m">
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.label}>批次号</Text>
              <Text variant="headlineSmall" style={styles.batchNumber}>{batch.batchNumber}</Text>
            </View>
            <BatchStatusBadge status={batch.status as BatchStatus} size="medium" />
          </View>
        </NeoCard>

        {/* Basic Info */}
        <NeoCard style={styles.card} padding="m">
          <Text variant="titleMedium" style={styles.sectionTitle}>基本信息</Text>
          
          <View style={styles.infoGrid}>
             <View style={styles.infoItem}>
                <Text style={styles.label}>产品类型</Text>
                <Text style={styles.value}>{batch.productType}</Text>
             </View>
             <View style={styles.infoItem}>
                <Text style={styles.label}>负责人</Text>
                <Text style={styles.value}>{batch.supervisor?.fullName || batch.supervisor?.username || '未指定'}</Text>
             </View>
             <View style={styles.infoItem}>
                <Text style={styles.label}>目标产量</Text>
                <Text style={styles.value}>{batch.targetQuantity} kg</Text>
             </View>
             <View style={styles.infoItem}>
                <Text style={styles.label}>实际产量</Text>
                <Text style={[styles.value, batch.actualQuantity ? styles.highlight : {}]}>{batch.actualQuantity || '-'} kg</Text>
             </View>
          </View>

          <Divider style={styles.divider} />
          
          <View style={styles.rowBetween}>
             <Text style={styles.label}>创建时间</Text>
             <Text style={styles.valueSmall}>{new Date(batch.createdAt).toLocaleString('zh-CN')}</Text>
          </View>
          {batch.completedAt && (
             <View style={[styles.rowBetween, { marginTop: 8 }]}>
                <Text style={styles.label}>完成时间</Text>
                <Text style={styles.valueSmall}>{new Date(batch.completedAt).toLocaleString('zh-CN')}</Text>
             </View>
          )}
        </NeoCard>

        {/* Materials */}
        {batch.rawMaterials && batch.rawMaterials.length > 0 && (
          <NeoCard style={styles.card} padding="m">
            <Text variant="titleMedium" style={styles.sectionTitle}>原料信息</Text>
            {batch.rawMaterials.map((material: any, index: number) => (
              <View key={index} style={styles.materialRow}>
                <Text style={styles.value}>{material.materialType || material.type}</Text>
                <StatusBadge status={`${material.quantity} ${material.unit || 'kg'}`} variant="info" />
              </View>
            ))}
          </NeoCard>
        )}

        {/* Actions */}
        <NeoCard style={styles.card} padding="m">
          <Text variant="titleMedium" style={styles.sectionTitle}>快捷操作</Text>
          <View style={styles.actionGrid}>
            <Menu
              visible={qualityMenuVisible}
              onDismiss={() => setQualityMenuVisible(false)}
              anchor={
                <NeoButton variant="outline" style={styles.actionButton} onPress={() => setQualityMenuVisible(true)} icon="clipboard-check">
                  质检记录
                </NeoButton>
              }
            >
              <Menu.Item onPress={() => { setQualityMenuVisible(false); navigation.navigate('CreateQualityRecord', { batchId: batch!.id.toString(), inspectionType: 'raw_material' }); }} title="原材料检验" />
              <Menu.Item onPress={() => { setQualityMenuVisible(false); navigation.navigate('CreateQualityRecord', { batchId: batch!.id.toString(), inspectionType: 'process' }); }} title="过程检验" />
              <Menu.Item onPress={() => { setQualityMenuVisible(false); navigation.navigate('CreateQualityRecord', { batchId: batch!.id.toString(), inspectionType: 'final_product' }); }} title="成品检验" />
            </Menu>
            
            <NeoButton 
                variant="outline" 
                style={styles.actionButton} 
                onPress={() => navigation.navigate('CostAnalysisDashboard', { batchId: batch.id.toString() })} 
                icon="cash"
            >
                成本分析
            </NeoButton>
          </View>
        </NeoCard>

      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
  },
  content: {
      padding: 16,
      paddingBottom: 40,
  },
  card: {
      marginBottom: 16,
  },
  headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
  },
  batchNumber: {
      fontWeight: '700',
      color: theme.colors.text,
  },
  sectionTitle: {
      fontWeight: '600',
      marginBottom: 16,
      color: theme.colors.text,
  },
  infoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
  },
  infoItem: {
      width: '50%',
      marginBottom: 16,
  },
  label: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 2,
  },
  value: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '500',
  },
  valueSmall: {
      fontSize: 13,
      color: theme.colors.text,
  },
  highlight: {
      color: theme.colors.primary,
      fontWeight: '700',
  },
  divider: {
      marginVertical: 12,
  },
  rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
  },
  materialRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
  },
  actionGrid: {
      gap: 12,
  },
  actionButton: {
      width: '100%',
  },
  errorText: {
      color: theme.colors.error,
      marginBottom: 16,
  },
});
