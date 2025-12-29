import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  TextInput,
  Button,
  Chip,
  Divider,
  ActivityIndicator,
  DataTable,
  Menu,
  HelperText,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { materialBatchApiClient, MaterialBatch as MaterialBatchType } from '../../services/api/materialBatchApiClient';
import { getFactoryId } from '../../types/auth';
import { handleError, getErrorMsg } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建InventoryCheck专用logger
const inventoryCheckLogger = logger.createContextLogger('InventoryCheck');

interface MaterialBatch {
  id: string;
  batchNumber: string;
  materialTypeId: string;
  systemQuantity: number;
  unit: string;
  status: 'available' | 'in_use' | 'depleted';
}

interface CheckRecord {
  batchId: string;
  batchNumber: string;
  materialType: string;
  systemQuantity: number;
  actualQuantity: number;
  difference: number;
  differenceRate: number;
  status: 'pending' | 'confirmed';
}

/**
 * 库存盘点功能页面
 * 功能：
 * - 批次选择
 * - 实物数量录入
 * - 系统数量对比
 * - 差异分析和处理
 * - 盘点记录保存
 */
export default function InventoryCheckScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  // 批次数据
  const [batches, setBatches] = useState<MaterialBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<MaterialBatch | null>(null);

  // 盘点记录
  const [checkRecords, setCheckRecords] = useState<CheckRecord[]>([]);

  // 表单状态
  const [actualQuantity, setActualQuantity] = useState('');

  // UI状态
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [batchMenuVisible, setBatchMenuVisible] = useState(false);

  /**
   * 获取当前工厂ID
   */
  const getCurrentFactoryId = (): string => {
    return getFactoryId(user) || '';
  };

  /**
   * 加载可用批次
   */
  const loadBatches = async () => {
    setLoading(true);
    try {
      const factoryId = getCurrentFactoryId();
      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息，请重新登录');
        return;
      }

      // 调用后端API获取可用批次
      const response = await materialBatchApiClient.getBatchesByStatus('available', factoryId);

      if ((response as any).success && (response as any).data) {
        const backendBatches: MaterialBatchType[] = Array.isArray((response as any).data)
          ? (response as any).data
          : [];

        // 转换为前端格式
        const frontendBatches: MaterialBatch[] = backendBatches.map((batch) => ({
          id: String((batch as any).id),
          batchNumber: (batch as any).batchNumber,
          materialTypeId: String((batch as any).materialTypeId),
          systemQuantity: (batch as any).remainingQuantity,
          unit: 'kg', // 默认单位，后端如有单位字段可使用
          status: (batch as any).status === 'available' ? 'available' : 'in_use',
        }));

        setBatches(frontendBatches);

        inventoryCheckLogger.info('可用批次列表加载成功', {
          factoryId,
          batchCount: frontendBatches.length,
        });
      } else {
        inventoryCheckLogger.warn('获取批次失败', {
          message: (response as any).message,
          factoryId,
        });
        setBatches([]);
      }
    } catch (error) {
      inventoryCheckLogger.error('加载批次失败', error as Error, {
        factoryId: getCurrentFactoryId(),
      });
      Alert.alert('加载失败', '无法加载批次数据，请稍后重试');
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadBatches();
    }, [])
  );

  /**
   * 选择批次
   */
  const handleSelectBatch = (batch: MaterialBatch) => {
    setSelectedBatch(batch);
    setBatchMenuVisible(false);
    setActualQuantity('');
  };

  /**
   * 添加盘点记录
   */
  const handleAddRecord = () => {
    if (!selectedBatch) {
      Alert.alert('提示', '请先选择批次');
      return;
    }

    if (!actualQuantity || parseFloat(actualQuantity) < 0) {
      Alert.alert('提示', '请输入有效的实际数量');
      return;
    }

    const actual = parseFloat(actualQuantity);
    const difference = actual - selectedBatch.systemQuantity;
    const differenceRate = (difference / selectedBatch.systemQuantity) * 100;

    const newRecord: CheckRecord = {
      batchId: selectedBatch.id,
      batchNumber: selectedBatch.batchNumber,
      materialType: selectedBatch.materialTypeId,
      systemQuantity: selectedBatch.systemQuantity,
      actualQuantity: actual,
      difference: difference,
      differenceRate: differenceRate,
      status: 'pending',
    };

    setCheckRecords([...checkRecords, newRecord]);
    setSelectedBatch(null);
    setActualQuantity('');

    Alert.alert('成功', '已添加盘点记录');
  };

  /**
   * 删除盘点记录
   */
  const handleDeleteRecord = (index: number) => {
    Alert.alert('确认删除', '确定要删除这条盘点记录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const newRecords = [...checkRecords];
          newRecords.splice(index, 1);
          setCheckRecords(newRecords);
        },
      },
    ]);
  };

  /**
   * 保存盘点结果
   */
  const handleSaveCheck = async () => {
    if (checkRecords.length === 0) {
      Alert.alert('提示', '请至少添加一条盘点记录');
      return;
    }

    setSaving(true);

    try {
      const factoryId = getCurrentFactoryId();
      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息，请重新登录');
        setSaving(false);
        return;
      }

      // 调用后端API逐个调整批次数量
      const adjustPromises = checkRecords.map((record) =>
        materialBatchApiClient.adjustBatch(
          record.batchId,
          record.actualQuantity,
          `库存盘点 - 差异: ${record.difference > 0 ? '+' : ''}${record.difference.toFixed(2)}`,
          factoryId
        )
      );

      const results = await Promise.allSettled(adjustPromises);

      // 检查是否所有调整都成功
      const failedCount = results.filter((r) => r.status === 'rejected').length;

      if (failedCount > 0) {
        Alert.alert(
          '部分失败',
          `已保存 ${results.length - failedCount}/${results.length} 条盘点记录\n\n${failedCount} 条记录保存失败，请检查后重试`,
          [
            {
              text: '确定',
              onPress: () => {
                setCheckRecords([]);
                loadBatches();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          '盘点完成',
          `已保存 ${checkRecords.length} 条盘点记录\n\n差异已同步到库存系统`,
          [
            {
              text: '确定',
              onPress: () => {
                setCheckRecords([]);
                loadBatches();
              },
            },
          ]
        );

        inventoryCheckLogger.info('盘点结果保存成功', {
          factoryId,
          recordCount: checkRecords.length,
          successCount: results.length - failedCount,
          failedCount,
        });
      }
    } catch (error) {
      inventoryCheckLogger.error('保存盘点记录失败', error as Error, {
        factoryId: getCurrentFactoryId(),
        recordCount: checkRecords.length,
      });
      Alert.alert('保存失败', (error as any).message || '保存盘点记录时出现错误');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 获取差异状态
   */
  const getDifferenceChip = (differenceRate: number) => {
    if (Math.abs(differenceRate) < 1) {
      return <Chip mode="flat" compact style={{ backgroundColor: '#4CAF50' }} textStyle={{ color: 'white' }}>正常</Chip>;
    } else if (Math.abs(differenceRate) < 5) {
      return <Chip mode="flat" compact style={{ backgroundColor: '#FF9800' }} textStyle={{ color: 'white' }}>偏差</Chip>;
    } else {
      return <Chip mode="flat" compact style={{ backgroundColor: '#F44336' }} textStyle={{ color: 'white' }}>异常</Chip>;
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="库存盘点" />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* 批次选择 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="选择批次" titleVariant="titleMedium" />
          <Card.Content>
            <Menu
              visible={batchMenuVisible}
              onDismiss={() => setBatchMenuVisible(false)}
              anchor={
                <TextInput
                  label="批次号"
                  value={selectedBatch?.batchNumber || ''}
                  mode="outlined"
                  editable={false}
                  right={<TextInput.Icon icon="menu-down" />}
                  onPressIn={() => setBatchMenuVisible(true)}
                  style={styles.input}
                />
              }
            >
              {batches.map((batch) => (
                <Menu.Item
                  key={(batch as any).id}
                  onPress={() => handleSelectBatch(batch)}
                  title={`${(batch as any).batchNumber} - ${(batch as any).materialTypeId}`}
                  leadingIcon="package-variant"
                />
              ))}
            </Menu>

            {selectedBatch && (
              <>
                <View style={styles.batchInfo}>
                  <View style={styles.infoRow}>
                    <Text variant="bodyMedium" style={styles.infoLabel}>
                      物料类型：
                    </Text>
                    <Text variant="bodyMedium">{selectedBatch.materialTypeId}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text variant="bodyMedium" style={styles.infoLabel}>
                      系统数量：
                    </Text>
                    <Text variant="bodyMedium" style={styles.systemQuantity}>
                      {selectedBatch.systemQuantity} {selectedBatch.unit}
                    </Text>
                  </View>
                </View>

                <Divider style={styles.divider} />

                <TextInput
                  label={`实际数量 (${selectedBatch.unit})`}
                  value={actualQuantity}
                  onChangeText={setActualQuantity}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
                <HelperText type="info">
                  请输入实际盘点的数量
                </HelperText>

                <Button
                  mode="contained"
                  icon="plus"
                  onPress={handleAddRecord}
                  disabled={!actualQuantity}
                  style={styles.addButton}
                >
                  添加盘点记录
                </Button>
              </>
            )}
          </Card.Content>
        </Card>

        {/* 盘点记录列表 */}
        {checkRecords.length > 0 && (
          <Card style={styles.card} mode="elevated">
            <Card.Title title="盘点记录" titleVariant="titleMedium" />
            <Card.Content>
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title>批次</DataTable.Title>
                  <DataTable.Title numeric>系统</DataTable.Title>
                  <DataTable.Title numeric>实际</DataTable.Title>
                  <DataTable.Title numeric>差异</DataTable.Title>
                  <DataTable.Title>状态</DataTable.Title>
                </DataTable.Header>

                {checkRecords.map((record, index) => (
                  <DataTable.Row key={index}>
                    <DataTable.Cell>
                      <Text variant="bodySmall" numberOfLines={1}>
                        {record.batchNumber}
                      </Text>
                    </DataTable.Cell>
                    <DataTable.Cell numeric>
                      {record.systemQuantity.toFixed(1)}
                    </DataTable.Cell>
                    <DataTable.Cell numeric>
                      {record.actualQuantity.toFixed(1)}
                    </DataTable.Cell>
                    <DataTable.Cell numeric>
                      <Text
                        style={{
                          color: record.difference > 0 ? '#4CAF50' : record.difference < 0 ? '#F44336' : '#666',
                          fontWeight: 'bold',
                        }}
                      >
                        {record.difference > 0 ? '+' : ''}
                        {record.difference.toFixed(1)}
                      </Text>
                    </DataTable.Cell>
                    <DataTable.Cell>
                      {getDifferenceChip(record.differenceRate)}
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>

              {/* 删除按钮 */}
              <View style={styles.recordActions}>
                <Button
                  mode="outlined"
                  icon="delete"
                  onPress={() => handleDeleteRecord(checkRecords.length - 1)}
                  textColor="#F44336"
                >
                  删除最后一条
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* 统计汇总 */}
        {checkRecords.length > 0 && (
          <Card style={styles.card} mode="elevated">
            <Card.Title title="统计汇总" titleVariant="titleMedium" />
            <Card.Content>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={styles.statValue}>
                    {checkRecords.length}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    盘点批次
                  </Text>
                </View>

                <View style={styles.statItem}>
                  <Text
                    variant="headlineSmall"
                    style={[
                      styles.statValue,
                      {
                        color: checkRecords.filter(r => r.difference > 0).length > 0
                          ? '#4CAF50'
                          : '#666',
                      },
                    ]}
                  >
                    {checkRecords.filter(r => r.difference > 0).length}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    盘盈批次
                  </Text>
                </View>

                <View style={styles.statItem}>
                  <Text
                    variant="headlineSmall"
                    style={[
                      styles.statValue,
                      {
                        color: checkRecords.filter(r => r.difference < 0).length > 0
                          ? '#F44336'
                          : '#666',
                      },
                    ]}
                  >
                    {checkRecords.filter(r => r.difference < 0).length}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    盘亏批次
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* 保存按钮 */}
        {checkRecords.length > 0 && (
          <Button
            mode="contained"
            icon="content-save"
            onPress={handleSaveCheck}
            loading={saving}
            disabled={saving}
            style={styles.saveButton}
            contentStyle={styles.saveButtonContent}
          >
            {saving ? '保存中...' : '保存盘点结果'}
          </Button>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  card: {
    margin: 16,
    marginBottom: 0,
  },
  input: {
    marginBottom: 8,
  },
  batchInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontWeight: '500',
    marginRight: 8,
    minWidth: 80,
  },
  systemQuantity: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 16,
  },
  addButton: {
    marginTop: 8,
  },
  recordActions: {
    marginTop: 16,
    alignItems: 'flex-end',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  saveButton: {
    margin: 16,
  },
  saveButtonContent: {
    height: 50,
  },
  bottomPadding: {
    height: 40,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
