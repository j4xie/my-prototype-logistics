import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Card,
  Surface,
  Divider,
  Chip,
  ActivityIndicator,
  useTheme,
  List,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  traceabilityApiClient,
  FullTraceResponse,
  MaterialInfo,
  QualityInfo,
  ShipmentInfo,
} from '../../services/api/traceabilityApiClient';

/**
 * 完整溯源链路详情屏幕
 * 展示从原材料到出货的完整追溯信息
 */
const TraceabilityDetailScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<any>();
  const { batchNumber } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [traceData, setTraceData] = useState<FullTraceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTraceData = useCallback(async () => {
    if (!batchNumber) {
      setError('缺少批次号参数');
      setLoading(false);
      return;
    }

    try {
      const result = await traceabilityApiClient.getFullTrace(batchNumber);
      if (result) {
        setTraceData(result);
        setError(null);
      } else {
        setError('未找到该批次的溯源信息');
      }
    } catch (err: any) {
      console.error('加载溯源详情失败:', err);
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [batchNumber]);

  useEffect(() => {
    loadTraceData();
  }, [loadTraceData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTraceData();
    setRefreshing(false);
  }, [loadTraceData]);

  const getQualityStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PASSED':
      case 'PASS':
        return '#4CAF50';
      case 'FAILED':
      case 'FAIL':
        return '#f44336';
      case 'CONDITIONAL':
        return '#FF9800';
      default:
        return '#9e9e9e';
    }
  };

  const getShipmentStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return '#4CAF50';
      case 'shipped':
        return '#2196F3';
      case 'pending':
        return '#FF9800';
      case 'returned':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };

  const getShipmentStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return '已送达';
      case 'shipped':
        return '已发货';
      case 'pending':
        return '待发货';
      case 'returned':
        return '已退货';
      default:
        return status || '未知';
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>正在加载溯源数据...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color={theme.colors.error} />
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
      </View>
    );
  }

  if (!traceData) {
    return (
      <View style={styles.centerContainer}>
        <Text>无数据</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 溯源码 */}
        <Surface style={styles.traceCodeCard} elevation={2}>
          <MaterialCommunityIcons name="qrcode" size={24} color={theme.colors.primary} />
          <Text style={styles.traceCodeLabel}>溯源码</Text>
          <Text style={styles.traceCode}>{traceData.traceCode}</Text>
        </Surface>

        {/* === 1. 生产信息 === */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconContainer}>
                <MaterialCommunityIcons name="factory" size={24} color="#fff" />
              </View>
              <Text variant="titleMedium" style={styles.sectionTitle}>生产信息</Text>
            </View>
            <Divider style={styles.divider} />

            <View style={styles.infoGrid}>
              <InfoItem label="批次号" value={traceData.production.batchNumber} />
              <InfoItem label="产品名称" value={traceData.production.productName} />
              <InfoItem label="生产工厂" value={traceData.production.factoryName} />
              <InfoItem label="生产日期" value={traceData.production.productionDate} />
              <InfoItem label="负责人" value={traceData.production.supervisorName} />
              <InfoItem label="设备" value={traceData.production.equipmentName} />
              {traceData.production.quantity && (
                <InfoItem
                  label="产量"
                  value={`${traceData.production.quantity} ${traceData.production.unit || ''}`}
                />
              )}
              <InfoItem
                label="质量状态"
                value={traceData.production.qualityStatus}
                chipColor={getQualityStatusColor(traceData.production.qualityStatus)}
              />
            </View>
          </Card.Content>
        </Card>

        {/* === 2. 原材料溯源 === */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: '#FF9800' }]}>
                <MaterialCommunityIcons name="package-variant" size={24} color="#fff" />
              </View>
              <Text variant="titleMedium" style={styles.sectionTitle}>原材料溯源</Text>
              <Chip mode="flat">{traceData.materials.length} 批次</Chip>
            </View>
            <Divider style={styles.divider} />

            {traceData.materials.length === 0 ? (
              <Text style={styles.emptyText}>暂无原材料消耗记录</Text>
            ) : (
              traceData.materials.map((material, index) => (
                <MaterialCard key={index} material={material} isLast={index === traceData.materials.length - 1} />
              ))
            )}
          </Card.Content>
        </Card>

        {/* === 3. 质检记录 === */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: '#9C27B0' }]}>
                <MaterialCommunityIcons name="clipboard-check-outline" size={24} color="#fff" />
              </View>
              <Text variant="titleMedium" style={styles.sectionTitle}>质检记录</Text>
              <Chip mode="flat">{traceData.qualityInspections.length} 次</Chip>
            </View>
            <Divider style={styles.divider} />

            {traceData.qualityInspections.length === 0 ? (
              <Text style={styles.emptyText}>暂无质检记录</Text>
            ) : (
              traceData.qualityInspections.map((inspection, index) => (
                <QualityCard
                  key={index}
                  inspection={inspection}
                  getStatusColor={getQualityStatusColor}
                  isLast={index === traceData.qualityInspections.length - 1}
                />
              ))
            )}
          </Card.Content>
        </Card>

        {/* === 4. 出货记录 === */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: '#4CAF50' }]}>
                <MaterialCommunityIcons name="truck-delivery" size={24} color="#fff" />
              </View>
              <Text variant="titleMedium" style={styles.sectionTitle}>出货记录</Text>
              <Chip mode="flat">{traceData.shipments.length} 单</Chip>
            </View>
            <Divider style={styles.divider} />

            {traceData.shipments.length === 0 ? (
              <Text style={styles.emptyText}>暂无出货记录</Text>
            ) : (
              traceData.shipments.map((shipment, index) => (
                <ShipmentCard
                  key={index}
                  shipment={shipment}
                  getStatusColor={getShipmentStatusColor}
                  getStatusText={getShipmentStatusText}
                  isLast={index === traceData.shipments.length - 1}
                />
              ))
            )}
          </Card.Content>
        </Card>

        {/* 查询时间 */}
        <Text style={styles.queryTime}>
          查询时间: {traceData.queryTime ? new Date(traceData.queryTime).toLocaleString() : '-'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

// 信息项组件
const InfoItem: React.FC<{
  label: string;
  value?: string | null;
  chipColor?: string;
}> = ({ label, value, chipColor }) => (
  <View style={styles.infoItem}>
    <Text style={styles.infoLabel}>{label}</Text>
    {chipColor ? (
      <Chip
        mode="flat"
        style={[styles.statusChip, { backgroundColor: chipColor + '20' }]}
        textStyle={{ color: chipColor, fontSize: 12 }}
      >
        {value || '-'}
      </Chip>
    ) : (
      <Text style={styles.infoValue}>{value || '-'}</Text>
    )}
  </View>
);

// 原材料卡片组件
const MaterialCard: React.FC<{ material: MaterialInfo; isLast: boolean }> = ({ material, isLast }) => (
  <View style={[styles.itemCard, !isLast && styles.itemCardBorder]}>
    <View style={styles.itemHeader}>
      <Text style={styles.itemTitle}>{material.materialName}</Text>
      <Text style={styles.itemSubtitle}>{material.batchNumber}</Text>
    </View>
    <View style={styles.itemDetails}>
      <Text style={styles.itemDetail}>供应商: {material.supplierName}</Text>
      <Text style={styles.itemDetail}>入库日期: {material.receiptDate}</Text>
      {material.expireDate && (
        <Text style={styles.itemDetail}>过期日期: {material.expireDate}</Text>
      )}
      {material.quantity && (
        <Text style={styles.itemDetail}>消耗量: {material.quantity} {material.unit}</Text>
      )}
      {material.storageLocation && (
        <Text style={styles.itemDetail}>存储位置: {material.storageLocation}</Text>
      )}
    </View>
  </View>
);

// 质检卡片组件
const QualityCard: React.FC<{
  inspection: QualityInfo;
  getStatusColor: (status: string) => string;
  isLast: boolean;
}> = ({ inspection, getStatusColor, isLast }) => (
  <View style={[styles.itemCard, !isLast && styles.itemCardBorder]}>
    <View style={styles.itemHeader}>
      <Text style={styles.itemTitle}>质检 #{inspection.inspectionId?.slice(-8) || '-'}</Text>
      <Chip
        mode="flat"
        style={[
          styles.miniChip,
          { backgroundColor: getStatusColor(inspection.result) + '20' },
        ]}
        textStyle={{ color: getStatusColor(inspection.result), fontSize: 11 }}
      >
        {inspection.result || '待定'}
      </Chip>
    </View>
    <View style={styles.itemDetails}>
      <Text style={styles.itemDetail}>检验日期: {inspection.inspectionDate?.split('T')[0]}</Text>
      <Text style={styles.itemDetail}>检验员: {inspection.inspectorName}</Text>
      {inspection.passRate !== undefined && (
        <Text style={styles.itemDetail}>合格率: {inspection.passRate}%</Text>
      )}
      {inspection.remarks && (
        <Text style={styles.itemDetail}>备注: {inspection.remarks}</Text>
      )}
    </View>
  </View>
);

// 出货卡片组件
const ShipmentCard: React.FC<{
  shipment: ShipmentInfo;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
  isLast: boolean;
}> = ({ shipment, getStatusColor, getStatusText, isLast }) => (
  <View style={[styles.itemCard, !isLast && styles.itemCardBorder]}>
    <View style={styles.itemHeader}>
      <Text style={styles.itemTitle}>{shipment.shipmentNumber}</Text>
      <Chip
        mode="flat"
        style={[
          styles.miniChip,
          { backgroundColor: getStatusColor(shipment.status) + '20' },
        ]}
        textStyle={{ color: getStatusColor(shipment.status), fontSize: 11 }}
      >
        {getStatusText(shipment.status)}
      </Chip>
    </View>
    <View style={styles.itemDetails}>
      <Text style={styles.itemDetail}>出货日期: {shipment.shipmentDate}</Text>
      <Text style={styles.itemDetail}>客户: {shipment.customerName}</Text>
      {shipment.quantity && (
        <Text style={styles.itemDetail}>数量: {shipment.quantity} {shipment.unit}</Text>
      )}
      {shipment.logisticsCompany && (
        <Text style={styles.itemDetail}>物流公司: {shipment.logisticsCompany}</Text>
      )}
      {shipment.trackingNumber && (
        <Text style={styles.itemDetail}>物流单号: {shipment.trackingNumber}</Text>
      )}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  traceCodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  traceCodeLabel: {
    marginLeft: 8,
    color: '#666',
  },
  traceCode: {
    flex: 1,
    textAlign: 'right',
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    marginLeft: 12,
    flex: 1,
    fontWeight: '600',
  },
  divider: {
    marginVertical: 12,
  },
  infoGrid: {
    gap: 8,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    color: '#666',
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusChip: {
    height: 26,
  },
  miniChip: {
    height: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 16,
  },
  itemCard: {
    paddingVertical: 12,
  },
  itemCardBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  itemDetails: {
    gap: 4,
  },
  itemDetail: {
    fontSize: 13,
    color: '#555',
  },
  queryTime: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 8,
  },
});

export default TraceabilityDetailScreen;
