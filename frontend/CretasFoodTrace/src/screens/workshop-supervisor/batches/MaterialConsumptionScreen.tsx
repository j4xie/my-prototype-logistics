/**
 * 原料消耗记录页面
 * 查看和记录批次生产的原料消耗情况
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { WSBatchesStackParamList } from '../../../types/navigation';

type RouteProps = RouteProp<WSBatchesStackParamList, 'MaterialConsumption'>;

interface ConsumptionRecord {
  id: string;
  materialName: string;
  materialBatchId: string;
  plannedQuantity: number;
  actualQuantity: number;
  unit: string;
  consumedAt: string;
  operator: string;
  status: 'completed' | 'pending';
}

export function MaterialConsumptionScreen() {
  const { t } = useTranslation('workshop');
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const batchId = route.params?.batchId || 'PB-001';

  // 模拟批次信息
  const batchInfo = {
    batchNumber: 'PB-20251227-001',
    productName: '带鱼段（冷冻）',
    plannedQuantity: 500,
    currentStage: '切片',
  };

  // 模拟消耗记录
  const [records] = useState<ConsumptionRecord[]>([
    {
      id: '1',
      materialName: '带鱼',
      materialBatchId: 'MB-20251225-001',
      plannedQuantity: 100,
      actualQuantity: 98.5,
      unit: 'kg',
      consumedAt: '2025-12-27 08:30',
      operator: '王建国',
      status: 'completed',
    },
    {
      id: '2',
      materialName: '带鱼',
      materialBatchId: 'MB-20251226-002',
      plannedQuantity: 100,
      actualQuantity: 99.2,
      unit: 'kg',
      consumedAt: '2025-12-27 09:15',
      operator: '王建国',
      status: 'completed',
    },
    {
      id: '3',
      materialName: '带鱼',
      materialBatchId: 'MB-20251226-003',
      plannedQuantity: 100,
      actualQuantity: 0,
      unit: 'kg',
      consumedAt: '-',
      operator: '-',
      status: 'pending',
    },
  ]);

  // 统计数据
  const totalPlanned = records.reduce((sum, r) => sum + r.plannedQuantity, 0);
  const totalActual = records.reduce((sum, r) => sum + r.actualQuantity, 0);
  const completedCount = records.filter(r => r.status === 'completed').length;

  const handleAddConsumption = () => {
    Alert.alert(t('materialConsumption.alerts.addConsumption'), t('materialConsumption.alerts.selectFromInventory'));
  };

  const renderRecord = ({ item }: { item: ConsumptionRecord }) => {
    const isCompleted = item.status === 'completed';
    const variance = item.actualQuantity - item.plannedQuantity;
    const variancePercent = item.plannedQuantity > 0
      ? ((variance / item.plannedQuantity) * 100).toFixed(1)
      : '0';

    return (
      <View style={styles.recordCard}>
        <View style={styles.recordHeader}>
          <View style={styles.materialInfo}>
            <Text style={styles.materialName}>{item.materialName}</Text>
            <Text style={styles.materialBatch}>{item.materialBatchId}</Text>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: isCompleted ? '#f6ffed' : '#fff7e6' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: isCompleted ? '#52c41a' : '#faad14' }
            ]}>
              {isCompleted ? t('materialConsumption.record.status.consumed') : t('materialConsumption.record.status.pending')}
            </Text>
          </View>
        </View>

        <View style={styles.quantityRow}>
          <View style={styles.quantityItem}>
            <Text style={styles.quantityLabel}>{t('materialConsumption.record.plannedQuantity')}</Text>
            <Text style={styles.quantityValue}>
              {item.plannedQuantity} {item.unit}
            </Text>
          </View>
          <View style={styles.quantityDivider} />
          <View style={styles.quantityItem}>
            <Text style={styles.quantityLabel}>{t('materialConsumption.record.actualQuantity')}</Text>
            <Text style={[
              styles.quantityValue,
              !isCompleted && { color: '#999' }
            ]}>
              {isCompleted ? `${item.actualQuantity} ${item.unit}` : '-'}
            </Text>
          </View>
          <View style={styles.quantityDivider} />
          <View style={styles.quantityItem}>
            <Text style={styles.quantityLabel}>{t('materialConsumption.record.variance')}</Text>
            {isCompleted ? (
              <Text style={[
                styles.quantityValue,
                { color: variance > 0 ? '#ff4d4f' : variance < 0 ? '#52c41a' : '#333' }
              ]}>
                {variance > 0 ? '+' : ''}{variancePercent}%
              </Text>
            ) : (
              <Text style={[styles.quantityValue, { color: '#999' }]}>-</Text>
            )}
          </View>
        </View>

        {isCompleted && (
          <View style={styles.recordMeta}>
            <View style={styles.metaItem}>
              <Icon source="clock-outline" size={12} color="#999" />
              <Text style={styles.metaText}>{item.consumedAt}</Text>
            </View>
            <View style={styles.metaItem}>
              <Icon source="account" size={12} color="#999" />
              <Text style={styles.metaText}>{item.operator}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('materialConsumption.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* 批次信息 */}
      <View style={styles.batchCard}>
        <View style={styles.batchHeader}>
          <View>
            <Text style={styles.batchNumber}>{batchInfo.batchNumber}</Text>
            <Text style={styles.batchProduct}>{batchInfo.productName}</Text>
          </View>
          <View style={styles.stageBadge}>
            <Text style={styles.stageText}>{t('materialConsumption.batchInfo.currentStage', { stage: batchInfo.currentStage })}</Text>
          </View>
        </View>
      </View>

      {/* 统计卡片 */}
      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{completedCount}/{records.length}</Text>
            <Text style={styles.statLabel}>{t('materialConsumption.stats.batches')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalPlanned} kg</Text>
            <Text style={styles.statLabel}>{t('materialConsumption.stats.plannedTotal')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#52c41a' }]}>
              {totalActual} kg
            </Text>
            <Text style={styles.statLabel}>{t('materialConsumption.stats.actualUsage')}</Text>
          </View>
        </View>
      </View>

      {/* 消耗记录列表 */}
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>{t('materialConsumption.list.title')}</Text>
        </View>
        <FlatList
          data={records}
          renderItem={renderRecord}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </View>

      {/* 底部按钮 */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.addBtn} onPress={handleAddConsumption}>
          <Icon source="plus-circle" size={20} color="#fff" />
          <Text style={styles.addBtnText}>{t('materialConsumption.actions.add')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#667eea',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },

  // 批次信息
  batchCard: {
    backgroundColor: '#667eea',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  batchNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  batchProduct: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  stageBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stageText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },

  // 统计
  statsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#f0f0f0',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },

  // 列表
  listContainer: {
    flex: 1,
    marginTop: 12,
  },
  listHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },

  // 记录卡片
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  materialBatch: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
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
  quantityRow: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  quantityItem: {
    flex: 1,
    alignItems: 'center',
  },
  quantityDivider: {
    width: 1,
    backgroundColor: '#e8e8e8',
  },
  quantityLabel: {
    fontSize: 11,
    color: '#999',
  },
  quantityValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  recordMeta: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },

  // 底部
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    borderRadius: 8,
    padding: 16,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});

export default MaterialConsumptionScreen;
