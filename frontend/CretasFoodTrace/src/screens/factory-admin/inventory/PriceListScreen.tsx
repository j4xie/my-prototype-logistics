import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Chip,
  ActivityIndicator,
  DataTable,
  Divider,
  Badge,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FAManagementStackParamList } from '../../../types/navigation';
import { purchaseApiClient, PriceList, PriceType } from '../../../services/api/purchaseApiClient';
import { formatNumberWithCommas } from '../../../utils/formatters';

type Nav = NativeStackNavigationProp<FAManagementStackParamList>;

const PRICE_TYPE_MAP: Record<PriceType, { label: string; color: string }> = {
  PURCHASE_PRICE: { label: '采购价', color: '#409eff' },
  SELLING_PRICE: { label: '销售价', color: '#67c23a' },
  TRANSFER_PRICE: { label: '调拨价', color: '#e6a23c' },
};

function getPriceListStatus(pl: PriceList): { label: string; color: string } {
  if (!pl.isActive) {
    return { label: '已停用', color: '#909399' };
  }
  const now = new Date();
  const from = new Date(pl.effectiveFrom);
  const to = pl.effectiveTo ? new Date(pl.effectiveTo) : null;

  if (now < from) {
    return { label: '未生效', color: '#e6a23c' };
  }
  if (to !== null && now > to) {
    return { label: '已过期', color: '#f56c6c' };
  }
  return { label: '生效中', color: '#67c23a' };
}

function formatPrice(val: number | null | undefined): string {
  if (val == null) return '-';
  return `¥${formatNumberWithCommas(val)}`;
}

// ==================== Detail Modal ====================

interface DetailViewProps {
  priceList: PriceList;
  onClose: () => void;
}

function PriceListDetailView({ priceList, onClose }: DetailViewProps) {
  const status = getPriceListStatus(priceList);
  const typeInfo = PRICE_TYPE_MAP[priceList.priceType] ?? {
    label: priceList.priceType,
    color: '#909399',
  };

  return (
    <View style={styles.detailContainer}>
      <Appbar.Header>
        <Appbar.BackAction onPress={onClose} />
        <Appbar.Content title="价格表详情" />
      </Appbar.Header>

      <ScrollView style={styles.detailScroll}>
        {/* 基本信息 */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.detailHeader}>
              <Text variant="titleMedium" style={styles.bold}>{priceList.name}</Text>
              <Chip
                style={{ backgroundColor: status.color + '20' }}
                textStyle={{ color: status.color, fontSize: 12 }}
              >
                {status.label}
              </Chip>
            </View>
            <Divider style={styles.divider} />
            <InfoRow label="价格类型" value={typeInfo.label} />
            <InfoRow label="生效日期" value={priceList.effectiveFrom} />
            <InfoRow label="失效日期" value={priceList.effectiveTo ?? '长期有效'} />
            {priceList.remark ? <InfoRow label="备注" value={priceList.remark} /> : null}
          </Card.Content>
        </Card>

        {/* 价格明细 */}
        <Card style={styles.card}>
          <Card.Title
            title={`价格明细 (${priceList.items.length} 项)`}
            titleVariant="titleSmall"
          />
          <Card.Content>
            {priceList.items.length === 0 ? (
              <Text style={styles.empty}>暂无价格明细</Text>
            ) : (
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title style={styles.colName}>物料名称</DataTable.Title>
                  <DataTable.Title numeric>标准价</DataTable.Title>
                  <DataTable.Title numeric>最低价</DataTable.Title>
                  <DataTable.Title numeric>最高价</DataTable.Title>
                </DataTable.Header>
                {priceList.items.map((item) => (
                  <DataTable.Row key={item.id}>
                    <DataTable.Cell style={styles.colName}>
                      <Text style={styles.itemName}>
                        {item.itemName ?? '-'}{item.unit ? ` (${item.unit})` : ''}
                      </Text>
                    </DataTable.Cell>
                    <DataTable.Cell numeric>
                      <Text style={styles.stdPrice}>{formatPrice(item.standardPrice)}</Text>
                    </DataTable.Cell>
                    <DataTable.Cell numeric>{formatPrice(item.minPrice)}</DataTable.Cell>
                    <DataTable.Cell numeric>{formatPrice(item.maxPrice)}</DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            )}
          </Card.Content>
        </Card>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

// ==================== List Item Card ====================

interface ListCardProps {
  item: PriceList;
  isEffective: boolean;
  onPress: (pl: PriceList) => void;
}

function PriceListCard({ item, isEffective, onPress }: ListCardProps) {
  const status = getPriceListStatus(item);
  const typeInfo = PRICE_TYPE_MAP[item.priceType] ?? {
    label: item.priceType,
    color: '#909399',
  };

  return (
    <Card style={styles.card} onPress={() => onPress(item)}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text variant="titleSmall" style={styles.bold}>{item.name}</Text>
            {isEffective && (
              <Badge style={styles.effectiveBadge} size={8} />
            )}
          </View>
          <Chip
            style={{ backgroundColor: status.color + '20', height: 26 }}
            textStyle={{ color: status.color, fontSize: 11 }}
          >
            {status.label}
          </Chip>
        </View>

        <View style={styles.cardRow}>
          <Text style={styles.label}>类型</Text>
          <Text style={[styles.value, { color: typeInfo.color, fontWeight: '500' }]}>
            {typeInfo.label}
          </Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.label}>生效日期</Text>
          <Text style={styles.value}>{item.effectiveFrom}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.label}>失效日期</Text>
          <Text style={styles.value}>{item.effectiveTo ?? '长期有效'}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.label}>明细条数</Text>
          <Text style={styles.value}>{item.items.length} 项</Text>
        </View>
      </Card.Content>
    </Card>
  );
}

// ==================== Main Screen ====================

export default function PriceListScreen() {
  const navigation = useNavigation<Nav>();

  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [effectiveIds, setEffectiveIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPriceList, setSelectedPriceList] = useState<PriceList | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [listRes, effectiveRes] = await Promise.all([
        purchaseApiClient.getPriceLists({ page: 1, size: 50 }),
        purchaseApiClient.getEffectivePriceLists(),
      ]);

      if (listRes.success && listRes.data) {
        setPriceLists(listRes.data.content ?? []);
      }
      if (effectiveRes.success && Array.isArray(effectiveRes.data)) {
        setEffectiveIds(new Set(effectiveRes.data.map((pl) => pl.id)));
      }
    } catch {
      Alert.alert('错误', '加载价格表失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // If a price list is selected, show the detail view inline
  if (selectedPriceList !== null) {
    return (
      <PriceListDetailView
        priceList={selectedPriceList}
        onClose={() => setSelectedPriceList(null)}
      />
    );
  }

  const effectiveCount = effectiveIds.size;

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="价格表管理" />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>

      {/* Current effective banner */}
      {effectiveCount > 0 && (
        <View style={styles.effectiveBanner}>
          <Text style={styles.effectiveBannerText}>
            当前生效: {effectiveCount} 张价格表
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <FlatList
          data={priceLists}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PriceListCard
              item={item}
              isEffective={effectiveIds.has(item.id)}
              onPress={setSelectedPriceList}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>暂无价格表</Text>}
        />
      )}
    </View>
  );
}

// ==================== Shared Sub-components ====================

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

// ==================== Styles ====================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { flex: 1, justifyContent: 'center' },
  list: { padding: 12, paddingBottom: 80 },
  empty: { textAlign: 'center', marginTop: 60, color: '#999' },

  // Banner
  effectiveBanner: {
    backgroundColor: '#67c23a',
    paddingVertical: 6,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  effectiveBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  effectiveBadge: {
    backgroundColor: '#67c23a',
    marginLeft: 4,
    alignSelf: 'center',
  },

  // Cards
  card: { marginBottom: 10, borderRadius: 10 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  bold: { fontWeight: '700' },
  label: { color: '#909399', fontSize: 13 },
  value: { fontSize: 13, color: '#333' },

  // Detail view
  detailContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  detailScroll: { flex: 1 },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  divider: { marginVertical: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },

  // DataTable
  colName: { flex: 2 },
  itemName: { fontSize: 12, color: '#333' },
  stdPrice: { fontWeight: '600', color: '#e6a23c', fontSize: 13 },
});
