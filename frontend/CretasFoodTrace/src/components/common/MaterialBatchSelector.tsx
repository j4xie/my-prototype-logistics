import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, List, Divider, Checkbox, Button, ActivityIndicator, Chip } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

export interface SelectedBatch {
  id: string;
  batchNumber: string;
  allocatedQuantity: number;
  unitPrice: number;
  totalCost: number;
  supplier: {
    name: string;
    code: string;
  };
  inboundDate: string;
  expiryDate?: string;
}

export interface AvailableBatch {
  id: string;
  batchNumber: string;
  materialType: {
    name: string;
    unit: string;
  };
  supplier: {
    id: string;
    name: string;
    code: string;
  };
  remainingQuantity: number;
  reservedQuantity: number;
  unitPrice: number;
  inboundDate: string;
  expiryDate?: string;
  qualityGrade?: string;
}

interface MaterialBatchSelectorProps {
  availableBatches: AvailableBatch[];
  requiredQuantity: number;
  selectedBatches: SelectedBatch[];
  onSelect: (batches: SelectedBatch[]) => void;
  mode?: 'fifo' | 'manual';
}

/**
 * Material Batch Selector Component
 * Used for selecting material batches when creating production plans
 */
export const MaterialBatchSelector: React.FC<MaterialBatchSelectorProps> = ({
  availableBatches,
  requiredQuantity,
  selectedBatches,
  onSelect,
  mode = 'fifo',
}) => {
  const { t } = useTranslation('common');
  const [localSelections, setLocalSelections] = useState<Map<string, number>>(new Map());

  // 初始化：如果是FIFO模式，自动推荐批次
  useEffect(() => {
    if (mode === 'fifo' && requiredQuantity > 0 && availableBatches.length > 0 && localSelections.size === 0) {
      autoSelectFIFO();
    }
  }, [requiredQuantity, availableBatches]);

  // FIFO自动选择逻辑
  const autoSelectFIFO = () => {
    let remaining = requiredQuantity;
    const selections = new Map<string, number>();

    // 按入库日期排序（FIFO）
    const sortedBatches = [...availableBatches].sort((a, b) =>
      new Date(a.inboundDate).getTime() - new Date(b.inboundDate).getTime()
    );

    for (const batch of sortedBatches) {
      if (remaining <= 0) break;

      const availableQty = parseFloat(batch.remainingQuantity.toString());
      const allocateQty = Math.min(remaining, availableQty);

      selections.set(batch.id, allocateQty);
      remaining -= allocateQty;
    }

    setLocalSelections(selections);
    notifyParent(selections);
  };

  // 手动切换批次选择
  const toggleBatchSelection = (batchId: string, batchQty: number) => {
    const newSelections = new Map(localSelections);

    if (newSelections.has(batchId)) {
      // 取消选择
      newSelections.delete(batchId);
    } else {
      // 选择该批次 - 默认分配剩余需求量或批次全部库存（取较小值）
      const totalSelected = Array.from(newSelections.values()).reduce((sum, qty) => sum + qty, 0);
      const remaining = requiredQuantity - totalSelected;
      const allocateQty = Math.min(remaining, batchQty);

      if (allocateQty > 0) {
        newSelections.set(batchId, allocateQty);
      } else {
        Alert.alert(t('materialBatchSelector.demandSatisfied'), t('materialBatchSelector.noNeedMore'));
        return;
      }
    }

    setLocalSelections(newSelections);
    notifyParent(newSelections);
  };

  // 调整批次分配量
  const adjustAllocation = (batchId: string, newQty: number, maxQty: number) => {
    const newSelections = new Map(localSelections);

    if (newQty <= 0) {
      newSelections.delete(batchId);
    } else if (newQty <= maxQty) {
      newSelections.set(batchId, newQty);
    } else {
      Alert.alert(t('error.general'), t('materialBatchSelector.exceedsAvailable', { max: maxQty }));
      return;
    }

    setLocalSelections(newSelections);
    notifyParent(newSelections);
  };

  // 通知父组件
  const notifyParent = (selections: Map<string, number>) => {
    const selectedBatchArray: SelectedBatch[] = [];

    selections.forEach((quantity, batchId) => {
      const batch = availableBatches.find(b => b.id === batchId);
      if (batch) {
        selectedBatchArray.push({
          id: batch.id,
          batchNumber: batch.batchNumber,
          allocatedQuantity: quantity,
          unitPrice: parseFloat(batch.unitPrice.toString()),
          totalCost: parseFloat((quantity * parseFloat(batch.unitPrice.toString())).toFixed(2)),
          supplier: batch.supplier,
          inboundDate: batch.inboundDate,
          expiryDate: batch.expiryDate,
        });
      }
    });

    onSelect(selectedBatchArray);
  };

  // 计算选中总量
  const totalSelected = Array.from(localSelections.values()).reduce((sum, qty) => sum + qty, 0);
  const isSufficient = totalSelected >= requiredQuantity;
  const shortage = requiredQuantity - totalSelected;

  return (
    <View style={styles.container}>
      {/* Header and Stats */}
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.title}>{t('materialBatchSelector.title')}</Text>
        {mode === 'fifo' && (
          <Chip icon="auto-fix" compact>{t('materialBatchSelector.fifoRecommended')}</Chip>
        )}
      </View>

      {/* Required and Selected Quantity Stats */}
      <Card style={styles.statsCard} mode="outlined">
        <Card.Content>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text variant="labelSmall" style={styles.statLabel}>{t('materialBatchSelector.requiredQuantity')}</Text>
              <Text variant="titleMedium" style={styles.statValue}>
                {requiredQuantity.toFixed(1)}kg
              </Text>
            </View>

            <List.Icon icon="arrow-right" />

            <View style={styles.statItem}>
              <Text variant="labelSmall" style={styles.statLabel}>{t('materialBatchSelector.selectedQuantity')}</Text>
              <Text
                variant="titleMedium"
                style={[
                  styles.statValue,
                  isSufficient ? styles.statSufficient : styles.statInsufficient
                ]}
              >
                {totalSelected.toFixed(1)}kg
              </Text>
            </View>

            {!isSufficient && shortage > 0 && (
              <>
                <List.Icon icon="alert" color="#F44336" />
                <View style={styles.statItem}>
                  <Text variant="labelSmall" style={styles.statLabel}>{t('materialBatchSelector.stillNeed')}</Text>
                  <Text variant="titleMedium" style={[styles.statValue, styles.statInsufficient]}>
                    {shortage.toFixed(1)}kg
                  </Text>
                </View>
              </>
            )}

            {isSufficient && (
              <Chip icon="check-circle" textStyle={{ color: '#4CAF50' }} compact>
                {t('materialBatchSelector.satisfied')}
              </Chip>
            )}
          </View>
        </Card.Content>
      </Card>

      {/* Batch List */}
      {availableBatches.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Card.Content>
            <View style={styles.emptyContainer}>
              <List.Icon icon="package-variant-closed" color="#9E9E9E" />
              <Text variant="bodyMedium" style={styles.emptyText}>
                {t('materialBatchSelector.noBatchesAvailable')}
              </Text>
              <Text variant="bodySmall" style={styles.emptyHint}>
                {t('materialBatchSelector.pleaseInboundFirst')}
              </Text>
            </View>
          </Card.Content>
        </Card>
      ) : (
        <FlatList
          data={availableBatches}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = localSelections.has(item.id);
            const allocatedQty = localSelections.get(item.id) || 0;
            const remainingQty = parseFloat(item.remainingQuantity.toString());

            // 计算保质期剩余天数
            const daysToExpiry = item.expiryDate
              ? Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;
            const isExpiringSoon = daysToExpiry !== null && daysToExpiry <= 7;

            return (
              <Card
                style={[
                  styles.batchCard,
                  isSelected && styles.batchCardSelected
                ]}
                mode={isSelected ? "elevated" : "outlined"}
              >
                <Card.Content>
                  <TouchableOpacity
                    onPress={() => toggleBatchSelection(item.id, remainingQty)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.batchHeader}>
                      <View style={styles.batchTitleRow}>
                        <Checkbox
                          status={isSelected ? 'checked' : 'unchecked'}
                          onPress={() => toggleBatchSelection(item.id, remainingQty)}
                        />
                        <View style={styles.batchInfo}>
                          <Text variant="titleSmall" style={styles.batchNumber}>
                            {item.batchNumber}
                          </Text>
                          {item.qualityGrade && (
                            <Chip compact style={styles.gradeChip}>{item.qualityGrade}{t('materialBatchSelector.grade')}</Chip>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Batch Details */}
                    <View style={styles.batchDetails}>
                      <View style={styles.detailRow}>
                        <List.Icon icon="package-variant" style={styles.detailIcon} />
                        <Text variant="bodySmall" style={styles.detailText}>
                          {t('materialBatchSelector.available')}: <Text style={styles.detailValue}>{remainingQty}kg</Text>
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <List.Icon icon="currency-cny" style={styles.detailIcon} />
                        <Text variant="bodySmall" style={styles.detailText}>
                          {t('materialBatchSelector.unitPrice')}: <Text style={styles.detailValue}>¥{item.unitPrice}/kg</Text>
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <List.Icon icon="store" style={styles.detailIcon} />
                        <Text variant="bodySmall" style={styles.detailText}>
                          {t('materialBatchSelector.supplier')}: <Text style={styles.detailValue}>{item.supplier.name}</Text>
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <List.Icon icon="calendar" style={styles.detailIcon} />
                        <Text variant="bodySmall" style={styles.detailText}>
                          {t('materialBatchSelector.inboundDate')}: <Text style={styles.detailValue}>
                            {new Date(item.inboundDate).toLocaleDateString('zh-CN')}
                          </Text>
                        </Text>
                      </View>

                      {item.expiryDate && (
                        <View style={styles.detailRow}>
                          <List.Icon icon="clock-alert-outline" style={styles.detailIcon} />
                          <Text variant="bodySmall" style={styles.detailText}>
                            {t('materialBatchSelector.expiryDate')}: <Text style={[
                              styles.detailValue,
                              isExpiringSoon && styles.expiryWarning
                            ]}>
                              {new Date(item.expiryDate).toLocaleDateString('zh-CN')}
                              {daysToExpiry !== null && ` (${daysToExpiry}${t('materialBatchSelector.days')})`}
                            </Text>
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Selected Status */}
                    {isSelected && (
                      <View style={styles.selectedInfo}>
                        <Text variant="bodySmall" style={styles.selectedLabel}>
                          {t('materialBatchSelector.allocated')}:
                        </Text>
                        <Text variant="titleSmall" style={styles.selectedQuantity}>
                          {allocatedQty.toFixed(1)}kg
                        </Text>
                        <Text variant="bodySmall" style={styles.selectedCost}>
                          {t('materialBatchSelector.cost')}: ¥{(allocatedQty * parseFloat(item.unitPrice.toString())).toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </Card.Content>
              </Card>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListFooterComponent={
            selectedBatches.length > 0 ? (
              <Card style={styles.summaryCard} mode="elevated">
                <Card.Content>
                  <Text variant="titleSmall" style={styles.summaryTitle}>
                    {t('materialBatchSelector.summary')}
                  </Text>
                  <Divider style={styles.summaryDivider} />

                  {selectedBatches.map((batch, index) => (
                    <View key={batch.id} style={styles.summaryRow}>
                      <Text variant="bodySmall" style={styles.summaryBatch}>
                        {index + 1}. {batch.batchNumber}
                      </Text>
                      <Text variant="bodySmall" style={styles.summaryQuantity}>
                        {batch.allocatedQuantity.toFixed(1)}kg
                      </Text>
                      <Text variant="bodySmall" style={styles.summaryCost}>
                        ¥{batch.totalCost.toFixed(2)}
                      </Text>
                    </View>
                  ))}

                  <Divider style={styles.summaryDivider} />

                  <View style={styles.summaryTotal}>
                    <Text variant="titleSmall">{t('materialBatchSelector.total')}</Text>
                    <Text variant="titleSmall" style={styles.summaryTotalQuantity}>
                      {totalSelected.toFixed(1)}kg
                    </Text>
                    <Text variant="titleSmall" style={styles.summaryTotalCost}>
                      ¥{selectedBatches.reduce((sum, b) => sum + b.totalCost, 0).toFixed(2)}
                    </Text>
                  </View>

                  {!isSufficient && (
                    <View style={styles.warningBox}>
                      <List.Icon icon="alert" color="#F44336" />
                      <Text variant="bodySmall" style={styles.warningText}>
                        {t('materialBatchSelector.insufficientWarning', { shortage: shortage.toFixed(1) })}
                      </Text>
                    </View>
                  )}
                </Card.Content>
              </Card>
            ) : null
          }
        />
      )}

      {/* Operation Hints */}
      {availableBatches.length > 0 && (
        <View style={styles.hintBox}>
          <List.Icon icon="information-outline" color="#757575" />
          <Text variant="bodySmall" style={styles.hintText}>
            {mode === 'fifo'
              ? t('materialBatchSelector.fifoHint')
              : t('materialBatchSelector.manualHint')}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontWeight: '600',
  },
  statsCard: {
    marginBottom: 16,
    backgroundColor: '#F5F5F5',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#757575',
    marginBottom: 4,
  },
  statValue: {
    fontWeight: '600',
    color: '#212121',
  },
  statSufficient: {
    color: '#4CAF50',
  },
  statInsufficient: {
    color: '#F44336',
  },
  batchCard: {
    marginHorizontal: 2,
  },
  batchCardSelected: {
    borderColor: '#2196F3',
    borderWidth: 2,
    backgroundColor: '#E3F2FD',
  },
  batchHeader: {
    marginBottom: 8,
  },
  batchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batchInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  batchNumber: {
    fontWeight: '600',
    color: '#212121',
  },
  gradeChip: {
    height: 24,
    backgroundColor: '#4CAF50',
  },
  batchDetails: {
    marginLeft: 40,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    margin: 0,
    marginRight: 4,
  },
  detailText: {
    color: '#616161',
  },
  detailValue: {
    color: '#212121',
    fontWeight: '500',
  },
  expiryWarning: {
    color: '#F44336',
    fontWeight: '600',
  },
  selectedInfo: {
    marginTop: 12,
    marginLeft: 40,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedLabel: {
    color: '#1976D2',
  },
  selectedQuantity: {
    color: '#1976D2',
    fontWeight: '600',
  },
  selectedCost: {
    color: '#1976D2',
  },
  summaryCard: {
    marginTop: 16,
    backgroundColor: '#FFFDE7',
  },
  summaryTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  summaryDivider: {
    marginVertical: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryBatch: {
    flex: 2,
    color: '#616161',
  },
  summaryQuantity: {
    flex: 1,
    textAlign: 'right',
    color: '#212121',
    fontWeight: '500',
  },
  summaryCost: {
    flex: 1,
    textAlign: 'right',
    color: '#FF6F00',
    fontWeight: '500',
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  summaryTotalQuantity: {
    flex: 1,
    textAlign: 'right',
    color: '#1976D2',
    fontWeight: '600',
  },
  summaryTotalCost: {
    flex: 1,
    textAlign: 'right',
    color: '#F57C00',
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 4,
  },
  warningText: {
    color: '#D32F2F',
    marginLeft: 8,
  },
  emptyCard: {
    marginTop: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#9E9E9E',
    marginTop: 12,
  },
  emptyHint: {
    color: '#BDBDBD',
    marginTop: 4,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  hintText: {
    flex: 1,
    color: '#757575',
    marginLeft: 8,
  },
});

export default MaterialBatchSelector;
