/**
 * M-BOM-1 工厂端 BOM 配方列表 (Track D1).
 *
 * 客户原话 May10 line 207-216:
 *   "BOOM 成本管理, 原辅料配方... 我点添加, 添加然后物料名称, 应该是选择的"
 *
 * 列表: 按状态分组 (DRAFT / ACTIVE / ARCHIVED), FAB → 跳新建.
 * MaterialSelectModal (Day 6) 集成在 BomEditorScreen 而非本页.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Surface, Chip, Searchbar, FAB, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { bomApiClient } from '../../../services/api/bomApiClient';
import type { BomRecipe, BomRecipeStatus } from '../../../types/bom';
import type { ManagementStackParamList } from '../../../types/navigation';
import { handleError } from '../../../utils/errorHandler';

type Nav = NativeStackNavigationProp<ManagementStackParamList>;
type StatusFilter = 'all' | BomRecipeStatus;

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: '全部',
  DRAFT: '草稿',
  ACTIVE: '生效',
  ARCHIVED: '归档',
};

const STATUS_COLORS: Record<BomRecipeStatus, { bg: string; fg: string }> = {
  DRAFT: { bg: '#FFF3E0', fg: '#E65100' },
  ACTIVE: { bg: '#E8F5E9', fg: '#2E7D32' },
  ARCHIVED: { bg: '#ECEFF1', fg: '#546E7A' },
};

export function BomConfigScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [recipes, setRecipes] = useState<BomRecipe[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const status = filter === 'all' ? undefined : filter;
      const page = await bomApiClient.listRecipes({ status, page: 0, size: 100 });
      setRecipes(page.content ?? []);
    } catch (err) {
      handleError(err, { title: '加载 BOM 列表失败' });
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const filtered = recipes.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.productName.toLowerCase().includes(q)
        || r.productTypeId.toLowerCase().includes(q)
        || r.recipeCode.toLowerCase().includes(q);
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BOM 配方管理</Text>
        <Text style={styles.headerSub}>{recipes.length} 个配方</Text>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
          />
        }
      >
        <View style={styles.searchRow}>
          <Searchbar
            placeholder="搜索产品名 / SKU / 配方编码"
            value={search}
            onChangeText={setSearch}
            style={styles.searchbar}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {(Object.keys(STATUS_LABELS) as StatusFilter[]).map(f => (
            <Chip
              key={f}
              selected={filter === f}
              onPress={() => setFilter(f)}
              style={styles.chip}
            >
              {STATUS_LABELS[f]}
            </Chip>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.center}><Text>加载中...</Text></View>
        ) : error ? (
          <View style={styles.center}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text style={styles.emptyText}>加载失败</Text>
            <TouchableOpacity onPress={() => { setLoading(true); load(); }} style={styles.retryBtn}>
              <Text style={styles.retryText}>重试</Text>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <MaterialCommunityIcons name="food-variant-off" size={48} color="#C0C4CC" />
            <Text style={styles.emptyText}>暂无 BOM 配方</Text>
            <Text style={[styles.emptyText, { fontSize: 12 }]}>点击右下角 + 新建</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map(r => (
              <TouchableOpacity
                key={r.id}
                onPress={() => navigation.navigate('BomConfigEdit', { recipeId: r.id })}
              >
                <Surface style={styles.card} elevation={1}>
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="clipboard-list-outline" size={20} color={theme.colors.primary} />
                    <Text style={styles.productName} numberOfLines={1}>{r.productName}</Text>
                    {r.isCurrent && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>当前</Text>
                      </View>
                    )}
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[r.status].bg }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLORS[r.status].fg }]}>
                        {STATUS_LABELS[r.status]}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.metaText}>编码: {r.recipeCode} · v{r.version}</Text>
                    <Text style={styles.metaText}>
                      出成率: {r.overallYieldRate}% · 单份: {r.outputQuantityPerUnit}{r.outputUnit}
                    </Text>
                    {r.totalCost != null && (
                      <Text style={styles.costText}>总成本: ¥{r.totalCost.toFixed(2)}</Text>
                    )}
                    {r.totalCost == null && (
                      <Text style={[styles.metaText, { color: '#999' }]}>成本: 无权限查看</Text>
                    )}
                  </View>
                </Surface>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('BomConfigEdit', {})}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#FF6B35', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  searchRow: { paddingHorizontal: 16, paddingTop: 12 },
  searchbar: { backgroundColor: '#fff', borderRadius: 8 },
  chips: { paddingHorizontal: 16, paddingVertical: 8, flexGrow: 0 },
  chip: { marginRight: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 80 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  productName: { fontSize: 16, fontWeight: '600', marginLeft: 8, flex: 1 },
  currentBadge: { backgroundColor: '#1976D2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 6 },
  currentBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  cardBody: {},
  metaText: { fontSize: 13, color: '#666', marginBottom: 4 },
  costText: { fontSize: 14, color: '#FF6B35', fontWeight: '600', marginTop: 4 },
  center: { alignItems: 'center', paddingTop: 60 },
  emptyText: { marginTop: 12, fontSize: 14, color: '#999' },
  retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#FF6B35', borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: '#FF6B35' },
});

export default BomConfigScreen;
