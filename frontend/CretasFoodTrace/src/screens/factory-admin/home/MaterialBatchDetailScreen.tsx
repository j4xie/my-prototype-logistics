/**
 * 原材料批次详情页面
 * 显示单个原材料批次的详细信息
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { FAHomeStackParamList } from '../../../types/navigation';
import { materialBatchApiClient, MaterialBatch } from '../../../services/api/materialBatchApiClient';

type NavigationProp = NativeStackNavigationProp<FAHomeStackParamList, 'MaterialBatchDetail'>;
type RoutePropType = RouteProp<FAHomeStackParamList, 'MaterialBatchDetail'>;

export function MaterialBatchDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { batchId } = route.params;
  const { t } = useTranslation('home');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [batch, setBatch] = useState<MaterialBatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const response = await materialBatchApiClient.getBatchById(batchId) as { success: boolean; data?: MaterialBatch };
      if (response.success && response.data) {
        setBatch(response.data);
      }
    } catch (err) {
      console.error('加载原材料批次详情失败:', err);
      setError(t('materialBatchDetail.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [batchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      available: '#48bb78',
      fresh: '#48bb78',
      reserved: '#ed8936',
      depleted: '#a0aec0',
      expired: '#e53e3e',
      frozen: '#4299e1',
    };
    return colors[status] || '#a0aec0';
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      available: t('materialBatchDetail.status.available'),
      fresh: t('materialBatchDetail.status.fresh'),
      reserved: t('materialBatchDetail.status.reserved'),
      depleted: t('materialBatchDetail.status.depleted'),
      expired: t('materialBatchDetail.status.expired'),
      frozen: t('materialBatchDetail.status.frozen'),
    };
    return labels[status] || status;
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount?: number): string => {
    if (amount === undefined || amount === null) return '-';
    return `¥${amount.toFixed(2)}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !batch) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon source="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('materialBatchDetail.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Icon source="alert-circle" size={48} color="#e53e3e" />
          <Text style={styles.errorText}>{error || t('materialBatchDetail.notFound')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
            <Text style={styles.retryText}>{t('materialBatchDetail.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('materialBatchDetail.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
        }
      >
        {/* 状态头部 */}
        <View style={styles.statusHeader}>
          <Text style={styles.batchNumber}>{batch.batchNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(batch.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(batch.status) }]}>
              {getStatusLabel(batch.status)}
            </Text>
          </View>
        </View>

        {/* 基本信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('materialBatchDetail.basicInfo')}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('materialBatchDetail.materialName')}</Text>
            <Text style={styles.infoValue}>{batch.materialName || batch.materialTypeId}</Text>
          </View>
          {batch.materialCode && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('materialBatchDetail.materialCode')}</Text>
              <Text style={styles.infoValue}>{batch.materialCode}</Text>
            </View>
          )}
          {batch.materialCategory && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('materialBatchDetail.materialCategory')}</Text>
              <Text style={styles.infoValue}>{batch.materialCategory}</Text>
            </View>
          )}
          {batch.storageType && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('materialBatchDetail.storageType')}</Text>
              <Text style={styles.infoValue}>
                {batch.storageType === 'fresh' ? t('materialBatchDetail.storageTypes.fresh') :
                 batch.storageType === 'frozen' ? t('materialBatchDetail.storageTypes.frozen') : t('materialBatchDetail.storageTypes.dry')}
              </Text>
            </View>
          )}
        </View>

        {/* 库存信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('materialBatchDetail.inventoryInfo')}</Text>
          <View style={styles.quantityGrid}>
            <View style={styles.quantityItem}>
              <Text style={styles.quantityValue}>{batch.inboundQuantity}</Text>
              <Text style={styles.quantityLabel}>{t('materialBatchDetail.inboundQuantity')}</Text>
            </View>
            <View style={styles.quantityItem}>
              <Text style={[styles.quantityValue, { color: '#48bb78' }]}>{batch.remainingQuantity}</Text>
              <Text style={styles.quantityLabel}>{t('materialBatchDetail.remainingQuantity')}</Text>
            </View>
            <View style={styles.quantityItem}>
              <Text style={[styles.quantityValue, { color: '#ed8936' }]}>{batch.reservedQuantity}</Text>
              <Text style={styles.quantityLabel}>{t('materialBatchDetail.reservedQuantity')}</Text>
            </View>
            <View style={styles.quantityItem}>
              <Text style={[styles.quantityValue, { color: '#667eea' }]}>{batch.usedQuantity}</Text>
              <Text style={styles.quantityLabel}>{t('materialBatchDetail.usedQuantity')}</Text>
            </View>
          </View>
        </View>

        {/* 供应商与成本 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('materialBatchDetail.supplierAndCost')}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('materialBatchDetail.supplier')}</Text>
            <Text style={styles.infoValue}>{batch.supplierName || batch.supplierId || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('materialBatchDetail.unitPrice')}</Text>
            <Text style={styles.infoValue}>{formatCurrency(batch.unitPrice)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('materialBatchDetail.totalCost')}</Text>
            <Text style={[styles.infoValue, { color: '#667eea', fontWeight: '600' }]}>
              {formatCurrency(batch.totalCost)}
            </Text>
          </View>
        </View>

        {/* 时间信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('materialBatchDetail.timeInfo')}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('materialBatchDetail.inboundDate')}</Text>
            <Text style={styles.infoValue}>{formatDate(batch.inboundDate)}</Text>
          </View>
          {batch.productionDate && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('materialBatchDetail.productionDate')}</Text>
              <Text style={styles.infoValue}>{formatDate(batch.productionDate)}</Text>
            </View>
          )}
          {batch.expiryDate && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('materialBatchDetail.expiryDate')}</Text>
              <Text style={[styles.infoValue,
                new Date(batch.expiryDate) < new Date() && { color: '#e53e3e' }
              ]}>
                {formatDate(batch.expiryDate)}
              </Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('materialBatchDetail.createdAt')}</Text>
            <Text style={styles.infoValue}>{formatDate(batch.createdAt)}</Text>
          </View>
        </View>

        {/* 其他信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('materialBatchDetail.otherInfo')}</Text>
          {batch.qualityGrade && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('materialBatchDetail.qualityGrade')}</Text>
              <Text style={styles.infoValue}>{batch.qualityGrade}</Text>
            </View>
          )}
          {batch.storageLocation && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('materialBatchDetail.storageLocation')}</Text>
              <Text style={styles.infoValue}>{batch.storageLocation}</Text>
            </View>
          )}
          {batch.createdByName && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('materialBatchDetail.createdBy')}</Text>
              <Text style={styles.infoValue}>{batch.createdByName}</Text>
            </View>
          )}
          {batch.notes && (
            <View style={styles.notesRow}>
              <Text style={styles.infoLabel}>{t('materialBatchDetail.notes')}</Text>
              <Text style={styles.notesText}>{batch.notes}</Text>
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  scrollView: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#667eea',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  batchNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  section: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#1a202c',
  },
  quantityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quantityItem: {
    width: '50%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  quantityValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a202c',
  },
  quantityLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  notesRow: {
    paddingVertical: 10,
  },
  notesText: {
    marginTop: 8,
    fontSize: 14,
    color: '#1a202c',
    lineHeight: 20,
  },
});

export default MaterialBatchDetailScreen;
