import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Chip,
  ActivityIndicator,
  List,
  Searchbar,
  SegmentedButtons,
  ProgressBar,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { materialBatchApiClient, MaterialBatch } from '../../services/api/materialBatchApiClient';
import { useAuthStore } from '../../store/authStore';

/**
 * 原材料批次管理页面
 * 权限：所有登录用户可查看
 * 功能：批次列表、FIFO查询、过期预警、低库存预警
 */
export default function MaterialBatchManagementScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [batches, setBatches] = useState<MaterialBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');

  useEffect(() => {
    loadBatches();
  }, [filterTab]);

  const loadBatches = async () => {
    try {
      setLoading(true);
      let response;

      switch (filterTab) {
        case 'expiring':
          response = await materialBatchApiClient.getExpiringBatches(7, user?.factoryId);
          setBatches(Array.isArray(response.data) ? response.data : response.data?.content || []);
          break;
        case 'low_stock':
          response = await materialBatchApiClient.getLowStockBatches(user?.factoryId);
          setBatches(Array.isArray(response.data) ? response.data : response.data?.content || []);
          break;
        default:
          response = await materialBatchApiClient.getMaterialBatches({
            factoryId: user?.factoryId,
            page: 1, // 后端要求 page >= 1
            size: 100,
          });
          setBatches(Array.isArray(response.data) ? response.data : response.data?.content || []);
      }
    } catch (error: any) {
      console.error('加载批次列表失败:', error);
      Alert.alert('错误', error.response?.data?.message || '加载批次列表失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return '#4CAF50';
      case 'reserved': return '#FF9800';
      case 'depleted': return '#9E9E9E';
      case 'expired': return '#F44336';
      default: return '#999';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return '可用';
      case 'reserved': return '预留';
      case 'depleted': return '耗尽';
      case 'expired': return '过期';
      default: return status;
    }
  };

  const getQualityColor = (grade?: string) => {
    switch (grade) {
      case 'A': return '#4CAF50';
      case 'B': return '#FF9800';
      case 'C': return '#F44336';
      default: return '#2196F3';
    }
  };

  const calculateDaysUntilExpiry = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryWarning = (days: number | null) => {
    if (days === null) return null;
    if (days < 0) return { text: '已过期', color: '#F44336' };
    if (days <= 3) return { text: `${days}天后过期`, color: '#F44336' };
    if (days <= 7) return { text: `${days}天后过期`, color: '#FF9800' };
    return { text: `${days}天后过期`, color: '#666' };
  };

  const calculateUsagePercentage = (batch: MaterialBatch) => {
    if (batch.inboundQuantity === 0) return 0;
    return (batch.usedQuantity / batch.inboundQuantity) * 100;
  };

  const calculateRemainingPercentage = (batch: MaterialBatch) => {
    if (batch.inboundQuantity === 0) return 0;
    return (batch.remainingQuantity / batch.inboundQuantity) * 100;
  };

  // 筛选批次
  const filteredBatches = batches.filter(batch => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      batch.batchNumber.toLowerCase().includes(query) ||
      batch.materialTypeId?.toLowerCase().includes(query) ||
      batch.storageLocation?.toLowerCase().includes(query)
    );
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="原材料批次管理" />
        <Appbar.Action icon="refresh" onPress={loadBatches} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* Search */}
        <Searchbar
          placeholder="搜索批次号、原料类型、储存位置"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />

        {/* Tab Filter */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <SegmentedButtons
              value={filterTab}
              onValueChange={setFilterTab}
              buttons={[
                { value: 'all', label: '全部' },
                { value: 'expiring', label: '即将过期' },
                { value: 'low_stock', label: '低库存' },
              ]}
            />
          </Card.Content>
        </Card>

        {/* Stats */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{batches.length}</Text>
                <Text style={styles.statLabel}>批次总数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {batches.filter(b => b.status === 'available').length}
                </Text>
                <Text style={styles.statLabel}>可用</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {batches.filter(b => {
                    const days = calculateDaysUntilExpiry(b.expiryDate);
                    return days !== null && days <= 7 && days >= 0;
                  }).length}
                </Text>
                <Text style={styles.statLabel}>预警</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Batches List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : filteredBatches.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <List.Icon icon="package-variant" color="#999" />
              <Text style={styles.emptyText}>暂无批次数据</Text>
              <Text style={styles.emptyHint}>
                {filterTab === 'expiring' ? '没有即将过期的批次' :
                 filterTab === 'low_stock' ? '没有低库存批次' :
                 '暂无原材料批次'}
              </Text>
            </Card.Content>
          </Card>
        ) : (
          filteredBatches.map((batch) => {
            const daysUntilExpiry = calculateDaysUntilExpiry(batch.expiryDate);
            const expiryWarning = getExpiryWarning(daysUntilExpiry);
            const usagePercent = calculateUsagePercentage(batch);
            const remainingPercent = calculateRemainingPercentage(batch);

            return (
              <Card key={batch.id} style={styles.batchCard}>
                <Card.Content>
                  {/* Header */}
                  <View style={styles.batchHeader}>
                    <View style={styles.batchTitleRow}>
                      <View style={styles.batchTitleLeft}>
                        <Text style={styles.batchNumber}>{batch.batchNumber}</Text>
                        <Text style={styles.materialType}>
                          {batch.materialTypeId || '未知原料'}
                        </Text>
                      </View>
                      <View style={styles.chips}>
                        <Chip
                          mode="flat"
                          compact
                          style={[
                            styles.statusChip,
                            { backgroundColor: `${getStatusColor(batch.status)}20` }
                          ]}
                          textStyle={{ color: getStatusColor(batch.status), fontSize: 11 }}
                        >
                          {getStatusText(batch.status)}
                        </Chip>
                        {batch.qualityGrade && (
                          <Chip
                            mode="flat"
                            compact
                            style={[
                              styles.qualityChip,
                              { backgroundColor: `${getQualityColor(batch.qualityGrade)}20` }
                            ]}
                            textStyle={{ color: getQualityColor(batch.qualityGrade), fontSize: 11 }}
                          >
                            {batch.qualityGrade}级
                          </Chip>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Quantity Info */}
                  <View style={styles.quantitySection}>
                    <View style={styles.quantityRow}>
                      <Text style={styles.quantityLabel}>剩余/总量：</Text>
                      <Text style={styles.quantityValue}>
                        {batch.remainingQuantity.toFixed(2)} / {batch.inboundQuantity.toFixed(2)} kg
                      </Text>
                    </View>
                    <ProgressBar
                      progress={remainingPercent / 100}
                      color={remainingPercent > 20 ? '#4CAF50' : '#F44336'}
                      style={styles.progressBar}
                    />
                    <View style={styles.quantityDetails}>
                      <Text style={styles.quantityDetailText}>
                        已用: {batch.usedQuantity.toFixed(2)} kg ({usagePercent.toFixed(1)}%)
                      </Text>
                      {batch.reservedQuantity > 0 && (
                        <Text style={styles.quantityDetailText}>
                          预留: {batch.reservedQuantity.toFixed(2)} kg
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Info */}
                  <View style={styles.batchInfo}>
                    <View style={styles.infoRow}>
                      <List.Icon icon="calendar-import" style={styles.infoIcon} />
                      <Text style={styles.infoText}>
                        入库: {new Date(batch.inboundDate).toLocaleDateString()}
                      </Text>
                    </View>
                    {batch.expiryDate && (
                      <View style={styles.infoRow}>
                        <List.Icon icon="calendar-alert" style={styles.infoIcon} />
                        <Text style={styles.infoText}>
                          到期: {new Date(batch.expiryDate).toLocaleDateString()}
                        </Text>
                        {expiryWarning && (
                          <Chip
                            mode="flat"
                            compact
                            style={[
                              styles.expiryWarningChip,
                              { backgroundColor: `${expiryWarning.color}20` }
                            ]}
                            textStyle={{ color: expiryWarning.color, fontSize: 10 }}
                          >
                            {expiryWarning.text}
                          </Chip>
                        )}
                      </View>
                    )}
                    {batch.storageLocation && (
                      <View style={styles.infoRow}>
                        <List.Icon icon="map-marker" style={styles.infoIcon} />
                        <Text style={styles.infoText}>{batch.storageLocation}</Text>
                      </View>
                    )}
                    <View style={styles.infoRow}>
                      <List.Icon icon="currency-cny" style={styles.infoIcon} />
                      <Text style={styles.infoText}>
                        单价: ¥{batch.unitPrice.toFixed(2)}/kg |
                        总价: ¥{batch.totalCost.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            );
          })
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  searchbar: {
    margin: 16,
    marginBottom: 8,
  },
  filterCard: {
    margin: 16,
    marginBottom: 8,
  },
  statsCard: {
    margin: 16,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  emptyCard: {
    margin: 16,
  },
  emptyContent: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
  },
  batchCard: {
    margin: 16,
    marginBottom: 8,
  },
  batchHeader: {
    marginBottom: 12,
  },
  batchTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  batchTitleLeft: {
    flex: 1,
  },
  batchNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  materialType: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  chips: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  statusChip: {
    height: 24,
  },
  qualityChip: {
    height: 24,
  },
  quantitySection: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quantityLabel: {
    fontSize: 13,
    color: '#666',
  },
  quantityValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  quantityDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quantityDetailText: {
    fontSize: 11,
    color: '#999',
  },
  batchInfo: {
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoIcon: {
    margin: 0,
    marginRight: 4,
    width: 28,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  expiryWarningChip: {
    height: 20,
    marginLeft: 8,
  },
  bottomPadding: {
    height: 80,
  },
});
