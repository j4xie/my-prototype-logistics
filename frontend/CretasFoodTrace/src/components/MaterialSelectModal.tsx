/**
 * MaterialSelectModal — 原料字典选择器 (Track D1, Bug-2 Fix).
 *
 * 客户原话 (六扇门第四次 May10 line 217-222):
 *   "物料名称是要手写吗?" — "应该是选择的, 选择我的那个那个那个资料库啊"
 *
 * 复用组件: BOM 编辑器 + 库存出库 + 采购入库 + 工序物料消耗 都可用.
 *
 * 数据源: GET /api/mobile/{factoryId}/raw-material-types/active (or /search)
 * 选中返回: { materialTypeId, materialName, defaultUnit, code, category }
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Modal, Portal, Text, Searchbar, Surface, ActivityIndicator, Chip,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  materialTypeApiClient,
  MaterialType,
} from '../services/api/materialTypeApiClient';
import { handleError } from '../utils/errorHandler';

/** Resolved-on-select payload — minimum subset to fill BomRecipeItemDTO. */
export interface MaterialSelectResult {
  materialTypeId: string;
  materialName: string;
  /** raw_material_types.unit (default 'kg'); BOM 端可覆盖. */
  defaultUnit: string;
  code: string;
  category?: string;
}

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (m: MaterialSelectResult) => void;
  /** Optional filter: only show materials in these categories. */
  categories?: string[];
  /** Optional filter: exclude IDs already in BOM (avoid duplicates). */
  excludeIds?: string[];
  title?: string;
}

export function MaterialSelectModal({
  visible,
  onDismiss,
  onSelect,
  categories,
  excludeIds,
  title = '选择原料',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<MaterialType[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await materialTypeApiClient.getActiveMaterialTypes();
      // ApiClient interceptor returns envelope.data directly, but materialType
      // client's getActiveMaterialTypes returns { data: MaterialType[] }
      // shape — extract correctly per existing call sites.
      const list = (res as any)?.data ?? [];
      setMaterials(Array.isArray(list) ? list : []);
    } catch (err) {
      handleError(err, { title: '加载原料字典失败' });
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materials.filter(m => {
      if (excludeIds?.includes(m.id)) return false;
      if (categories && categories.length > 0 && m.category && !categories.includes(m.category)) return false;
      if (!q) return true;
      return (
        (m.name?.toLowerCase().includes(q)) ||
        (m.code?.toLowerCase().includes(q)) ||
        (m.category?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [materials, search, categories, excludeIds]);

  const handleSelect = (m: MaterialType) => {
    onSelect({
      materialTypeId: m.id,
      materialName: m.name,
      defaultUnit: m.unit || 'kg',
      code: m.code,
      category: m.category,
    });
    onDismiss();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialCommunityIcons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <Searchbar
          placeholder="搜索 名称 / 编码 / 类别"
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
          autoFocus
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text style={styles.hint}>加载原料字典中...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text style={styles.hint}>加载失败</Text>
            <TouchableOpacity onPress={load} style={styles.retryBtn}>
              <Text style={styles.retryText}>重试</Text>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <MaterialCommunityIcons name="package-variant-closed" size={48} color="#C0C4CC" />
            <Text style={styles.hint}>
              {search ? '未找到匹配的原料' : '暂无原料, 请先在原料管理中创建'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleSelect(item)}>
                <Surface style={styles.row} elevation={0}>
                  <View style={styles.rowMain}>
                    <View style={styles.rowName}>
                      <Text style={styles.code}>{item.code}</Text>
                      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    </View>
                    <View style={styles.rowMeta}>
                      {item.category && (
                        <Chip compact mode="outlined" style={styles.chip} textStyle={styles.chipText}>
                          {item.category}
                        </Chip>
                      )}
                      <Text style={styles.unit}>{item.unit || 'kg'}</Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
                </Surface>
              </TouchableOpacity>
            )}
            style={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}

        <View style={styles.footer}>
          <Text style={styles.footerHint}>
            共 {filtered.length} 种原料{search ? ` (筛选自 ${materials.length})` : ''}
          </Text>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 18, fontWeight: '600', color: '#333' },
  searchbar: { margin: 12, backgroundColor: '#f5f5f5' },
  list: { paddingHorizontal: 12, maxHeight: 500 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  rowMain: { flex: 1 },
  rowName: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  code: {
    fontSize: 12,
    color: '#FF6B35',
    backgroundColor: '#FFF3EE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 8,
    fontWeight: '600',
    overflow: 'hidden',
  },
  name: { flex: 1, fontSize: 15, color: '#333', fontWeight: '500' },
  rowMeta: { flexDirection: 'row', alignItems: 'center' },
  chip: { marginRight: 8, height: 22 },
  chipText: { fontSize: 11, marginVertical: 0 },
  unit: { fontSize: 13, color: '#666' },
  separator: { height: 1, backgroundColor: '#f0f0f0', marginLeft: 12 },
  center: { alignItems: 'center', paddingVertical: 40 },
  hint: { marginTop: 12, fontSize: 14, color: '#999' },
  retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#FF6B35', borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fafafa',
  },
  footerHint: { fontSize: 12, color: '#999', textAlign: 'center' },
});

export default MaterialSelectModal;
