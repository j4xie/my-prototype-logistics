import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { Text, Appbar, Card, Chip, ActivityIndicator, ProgressBar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { salesApiClient, FinishedGoodsBatch } from '../../../services/api/salesApiClient';
import { formatNumberWithCommas } from '../../../utils/formatters';

export default function FinishedGoodsListScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('warehouse');
  const [batches, setBatches] = useState<FinishedGoodsBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const res = await salesApiClient.getFinishedGoods({ page: 1, size: 100 });
      if (res.success && res.data) {
        setBatches(res.data.content || []);
      }
    } catch { Alert.alert(t('common:error.loadFailed'), t('finishedGoods.loadFailed')); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadData(); }, []);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const getStockStatus = (batch: FinishedGoodsBatch) => {
    const ratio = batch.availableQuantity / batch.totalQuantity;
    if (batch.availableQuantity <= 0) return { label: t('finishedGoods.status.soldOut'), color: '#f56c6c' };
    if (ratio < 0.2) return { label: t('finishedGoods.status.lowStock'), color: '#e6a23c' };
    return { label: t('finishedGoods.status.sufficient'), color: '#67c23a' };
  };

  const renderBatch = ({ item }: { item: FinishedGoodsBatch }) => {
    const status = getStockStatus(item);
    const ratio = item.totalQuantity > 0 ? item.availableQuantity / item.totalQuantity : 0;

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={styles.productName}>{item.productTypeName || item.productTypeId}</Text>
              <Text style={styles.batchNum}>{item.batchNumber}</Text>
            </View>
            <Chip style={{ backgroundColor: status.color + '20' }} textStyle={{ color: status.color, fontSize: 12 }}>{status.label}</Chip>
          </View>

          <ProgressBar progress={ratio} color={status.color} style={styles.progress} />

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t('finishedGoods.stats.total')}</Text>
              <Text style={styles.statValue}>{item.totalQuantity} {item.unit}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t('finishedGoods.stats.available')}</Text>
              <Text style={[styles.statValue, { color: status.color }]}>{item.availableQuantity} {item.unit}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t('finishedGoods.stats.reserved')}</Text>
              <Text style={styles.statValue}>{item.reservedQuantity} {item.unit}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{t('finishedGoods.productionDate')}: {item.productionDate}</Text>
            {item.expiryDate && <Text style={styles.metaText}>{t('finishedGoods.expiryDate')}: {item.expiryDate}</Text>}
          </View>
          {item.unitCost != null && (
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{t('finishedGoods.unitCost')}: ¥{formatNumberWithCommas(item.unitCost)}</Text>
              {item.storageLocation && <Text style={styles.metaText}>{t('finishedGoods.storageLocation')}: {item.storageLocation}</Text>}
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('finishedGoods.title')} />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <FlatList
          data={batches}
          keyExtractor={item => item.id}
          renderItem={renderBatch}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('finishedGoods.empty')}</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { flex: 1, justifyContent: 'center' },
  list: { padding: 12, paddingBottom: 40 },
  card: { marginBottom: 10, borderRadius: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  productName: { fontWeight: '700' },
  batchNum: { fontSize: 12, color: '#909399', marginTop: 2 },
  progress: { height: 6, borderRadius: 3, marginBottom: 10 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#909399' },
  statValue: { fontSize: 15, fontWeight: '600', color: '#333', marginTop: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  metaText: { fontSize: 12, color: '#909399' },
  empty: { textAlign: 'center', marginTop: 60, color: '#999' },
});
