/**
 * 质检项配置界面
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  FAB,
  Portal,
  Modal,
  TextInput,
  Chip,
  IconButton,
  Searchbar,
  SegmentedButtons,
  Switch,
  Menu,
  Divider,
  List,
  ProgressBar,
} from 'react-native-paper';
import { useAuthStore } from '../../../store/authStore';
import qualityCheckItemApi, {
  QualityCheckItem,
  QualityCheckCategory,
  QualitySeverity,
  SamplingStrategy,
  CreateQualityCheckItemRequest,
  UpdateQualityCheckItemRequest,
  QUALITY_CHECK_CATEGORIES,
  SAMPLING_STRATEGIES,
  QUALITY_SEVERITIES,
  VALUE_TYPES,
} from '../../../services/api/qualityCheckItemApiClient';

const QualityCheckItemConfigScreen: React.FC = () => {
  const { user } = useAuthStore();
  const factoryId = user?.factoryId ?? '';

  // 状态
  const [items, setItems] = useState<QualityCheckItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<QualityCheckItem | null>(null);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);

  // 表单状态
  const [formData, setFormData] = useState<CreateQualityCheckItemRequest>({
    itemCode: '',
    itemName: '',
    category: 'SENSORY',
    description: '',
    checkMethod: '',
    standardReference: '',
    valueType: 'NUMERIC',
    standardValue: '',
    minValue: undefined,
    maxValue: undefined,
    unit: '',
    tolerance: undefined,
    samplingStrategy: 'RANDOM',
    samplingRatio: 10,
    minSampleSize: 1,
    severity: 'MAJOR',
    isRequired: true,
    requirePhotoOnFail: false,
    requireNoteOnFail: true,
    sortOrder: 0,
    enabled: true,
  });

  // 统计数据
  const [statistics, setStatistics] = useState<{
    total: number;
    requiredCount: number;
    criticalCount: number;
    byCategory: Record<string, number>;
  } | null>(null);

  // 加载数据
  const loadData = useCallback(async () => {
    if (!factoryId) return;

    try {
      setLoading(true);
      const [itemsData, statsData] = await Promise.all([
        qualityCheckItemApi.list(factoryId, 1, 100),
        qualityCheckItemApi.getStatistics(factoryId),
      ]);
      setItems(itemsData.content);
      setStatistics(statsData);
    } catch (error) {
      console.error('加载质检项失败:', error);
      Alert.alert('错误', '加载质检项失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [factoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // 筛选数据
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.itemCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // 打开创建模态框
  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      itemCode: '',
      itemName: '',
      category: 'SENSORY',
      description: '',
      checkMethod: '',
      standardReference: '',
      valueType: 'NUMERIC',
      standardValue: '',
      minValue: undefined,
      maxValue: undefined,
      unit: '',
      tolerance: undefined,
      samplingStrategy: 'RANDOM',
      samplingRatio: 10,
      minSampleSize: 1,
      severity: 'MAJOR',
      isRequired: true,
      requirePhotoOnFail: false,
      requireNoteOnFail: true,
      sortOrder: 0,
      enabled: true,
    });
    setModalVisible(true);
  };

  // 打开编辑模态框
  const openEditModal = (item: QualityCheckItem) => {
    setEditingItem(item);
    setFormData({
      itemCode: item.itemCode,
      itemName: item.itemName,
      category: item.category,
      description: item.description ?? '',
      checkMethod: item.checkMethod ?? '',
      standardReference: item.standardReference ?? '',
      valueType: item.valueType,
      standardValue: item.standardValue ?? '',
      minValue: item.minValue,
      maxValue: item.maxValue,
      unit: item.unit ?? '',
      tolerance: item.tolerance,
      samplingStrategy: item.samplingStrategy,
      samplingRatio: item.samplingRatio,
      minSampleSize: item.minSampleSize,
      severity: item.severity,
      isRequired: item.isRequired,
      requirePhotoOnFail: item.requirePhotoOnFail,
      requireNoteOnFail: item.requireNoteOnFail,
      sortOrder: item.sortOrder,
      enabled: item.enabled,
    });
    setMenuVisible(null);
    setModalVisible(true);
  };

  // 保存
  const handleSave = async () => {
    if (!formData.itemCode || !formData.itemName) {
      Alert.alert('错误', '请填写必填字段');
      return;
    }

    try {
      if (editingItem) {
        const updateRequest: UpdateQualityCheckItemRequest = {
          itemName: formData.itemName,
          category: formData.category,
          description: formData.description,
          checkMethod: formData.checkMethod,
          standardReference: formData.standardReference,
          valueType: formData.valueType,
          standardValue: formData.standardValue,
          minValue: formData.minValue,
          maxValue: formData.maxValue,
          unit: formData.unit,
          tolerance: formData.tolerance,
          samplingStrategy: formData.samplingStrategy,
          samplingRatio: formData.samplingRatio,
          minSampleSize: formData.minSampleSize,
          severity: formData.severity,
          isRequired: formData.isRequired,
          requirePhotoOnFail: formData.requirePhotoOnFail,
          requireNoteOnFail: formData.requireNoteOnFail,
          sortOrder: formData.sortOrder,
          enabled: formData.enabled,
        };
        await qualityCheckItemApi.update(factoryId, editingItem.id, updateRequest);
        Alert.alert('成功', '更新成功');
      } else {
        await qualityCheckItemApi.create(factoryId, formData);
        Alert.alert('成功', '创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error: unknown) {
      console.error('保存失败:', error);
      const errorMessage = error instanceof Error ? error.message : '保存失败';
      Alert.alert('错误', errorMessage);
    }
  };

  // 删除
  const handleDelete = (item: QualityCheckItem) => {
    Alert.alert('确认删除', `确定要删除质检项「${item.itemName}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await qualityCheckItemApi.delete(factoryId, item.id);
            Alert.alert('成功', '删除成功');
            loadData();
          } catch (error: unknown) {
            console.error('删除失败:', error);
            const errorMessage = error instanceof Error ? error.message : '删除失败';
            Alert.alert('错误', errorMessage);
          }
        },
      },
    ]);
    setMenuVisible(null);
  };

  // 切换启用状态
  const toggleEnabled = async (item: QualityCheckItem) => {
    try {
      await qualityCheckItemApi.update(factoryId, item.id, {
        enabled: !item.enabled,
      });
      loadData();
    } catch (error) {
      console.error('切换状态失败:', error);
    }
    setMenuVisible(null);
  };

  // 从模板复制
  const copyFromTemplate = async () => {
    Alert.alert(
      '从模板复制',
      '这将从系统默认模板复制质检项到您的工厂，已存在的项目将被跳过。确定继续吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            try {
              const copied = await qualityCheckItemApi.copyFromTemplate(factoryId);
              Alert.alert('成功', `已复制 ${copied.length} 个质检项`);
              loadData();
            } catch (error) {
              console.error('复制失败:', error);
              Alert.alert('错误', '复制失败');
            }
          },
        },
      ]
    );
  };

  // 获取类别颜色
  const getCategoryColor = (category: QualityCheckCategory): string => {
    return (
      QUALITY_CHECK_CATEGORIES.find((c) => c.value === category)?.color ?? '#666'
    );
  };

  // 获取严重程度颜色
  const getSeverityColor = (severity: QualitySeverity): string => {
    return QUALITY_SEVERITIES.find((s) => s.value === severity)?.color ?? '#666';
  };

  // 渲染质检项卡片
  const renderItem = (item: QualityCheckItem) => (
    <Card key={item.id} style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitle}>
            <Chip
              compact
              style={[
                styles.categoryChip,
                { backgroundColor: getCategoryColor(item.category) },
              ]}
              textStyle={styles.categoryChipText}
            >
              {item.categoryDescription}
            </Chip>
            <Chip
              compact
              style={[
                styles.severityChip,
                { backgroundColor: getSeverityColor(item.severity) },
              ]}
              textStyle={styles.severityChipText}
            >
              {item.severityDescription}
            </Chip>
          </View>
          <Menu
            visible={menuVisible === item.id}
            onDismiss={() => setMenuVisible(null)}
            anchor={
              <IconButton
                icon="dots-vertical"
                size={20}
                onPress={() => setMenuVisible(item.id)}
              />
            }
          >
            <Menu.Item
              onPress={() => openEditModal(item)}
              title="编辑"
              leadingIcon="pencil"
            />
            <Menu.Item
              onPress={() => toggleEnabled(item)}
              title={item.enabled ? '禁用' : '启用'}
              leadingIcon={item.enabled ? 'eye-off' : 'eye'}
            />
            <Divider />
            <Menu.Item
              onPress={() => handleDelete(item)}
              title="删除"
              leadingIcon="delete"
              titleStyle={{ color: '#F44336' }}
            />
          </Menu>
        </View>

        <Text style={styles.itemCode}>{item.itemCode}</Text>
        <Text style={styles.itemName}>{item.itemName}</Text>

        {item.description && (
          <Text style={styles.description}>{item.description}</Text>
        )}

        <View style={styles.detailRow}>
          {item.minValue !== undefined || item.maxValue !== undefined ? (
            <Text style={styles.detailText}>
              范围: {item.minValue ?? '-'} ~ {item.maxValue ?? '-'} {item.unit ?? ''}
            </Text>
          ) : item.standardValue ? (
            <Text style={styles.detailText}>标准值: {item.standardValue}</Text>
          ) : null}
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailText}>
            抽样: {item.samplingStrategyDescription} ({item.samplingRatio}%)
          </Text>
        </View>

        <View style={styles.tagsRow}>
          {item.isRequired && (
            <Chip compact style={styles.tagChip} textStyle={styles.tagText}>
              必检
            </Chip>
          )}
          {item.requirePhotoOnFail && (
            <Chip compact style={styles.tagChip} textStyle={styles.tagText}>
              需拍照
            </Chip>
          )}
          {!item.enabled && (
            <Chip
              compact
              style={[styles.tagChip, { backgroundColor: '#9E9E9E' }]}
              textStyle={styles.tagText}
            >
              已禁用
            </Chip>
          )}
          {item.bindingCount > 0 && (
            <Chip compact style={styles.tagChip} textStyle={styles.tagText}>
              {item.bindingCount} 个产品
            </Chip>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  // 渲染统计卡片
  const renderStatistics = () => {
    if (!statistics) return null;

    return (
      <Card style={styles.statsCard}>
        <Card.Content>
          <Text style={styles.statsTitle}>统计概览</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{statistics.total}</Text>
              <Text style={styles.statLabel}>总数</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#2196F3' }]}>
                {statistics.requiredCount}
              </Text>
              <Text style={styles.statLabel}>必检项</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#F44336' }]}>
                {statistics.criticalCount}
              </Text>
              <Text style={styles.statLabel}>关键项</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderStatistics()}

        <View style={styles.toolbar}>
          <Searchbar
            placeholder="搜索质检项..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchbar}
          />
          <Button
            mode="outlined"
            onPress={copyFromTemplate}
            style={styles.templateButton}
            icon="content-copy"
            compact
          >
            从模板复制
          </Button>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryFilter}
        >
          <Chip
            selected={selectedCategory === 'all'}
            onPress={() => setSelectedCategory('all')}
            style={styles.filterChip}
          >
            全部
          </Chip>
          {QUALITY_CHECK_CATEGORIES.map((cat) => (
            <Chip
              key={cat.value}
              selected={selectedCategory === cat.value}
              onPress={() => setSelectedCategory(cat.value)}
              style={styles.filterChip}
            >
              {cat.label}
            </Chip>
          ))}
        </ScrollView>

        {loading ? (
          <ProgressBar indeterminate style={styles.progress} />
        ) : (
          <View style={styles.itemList}>
            {filteredItems.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Card.Content>
                  <Text style={styles.emptyText}>
                    {searchQuery || selectedCategory !== 'all'
                      ? '没有找到匹配的质检项'
                      : '暂无质检项，点击右下角按钮添加'}
                  </Text>
                </Card.Content>
              </Card>
            ) : (
              filteredItems.map(renderItem)
            )}
          </View>
        )}
      </ScrollView>

      <FAB icon="plus" style={styles.fab} onPress={openCreateModal} />

      {/* 创建/编辑模态框 */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>
              {editingItem ? '编辑质检项' : '新建质检项'}
            </Text>

            <TextInput
              label="项目编号 *"
              value={formData.itemCode}
              onChangeText={(text) =>
                setFormData({ ...formData, itemCode: text })
              }
              style={styles.input}
              disabled={!!editingItem}
            />

            <TextInput
              label="项目名称 *"
              value={formData.itemName}
              onChangeText={(text) =>
                setFormData({ ...formData, itemName: text })
              }
              style={styles.input}
            />

            <Text style={styles.sectionLabel}>项目类别</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipRow}
            >
              {QUALITY_CHECK_CATEGORIES.map((cat) => (
                <Chip
                  key={cat.value}
                  selected={formData.category === cat.value}
                  onPress={() =>
                    setFormData({ ...formData, category: cat.value })
                  }
                  style={styles.selectionChip}
                >
                  {cat.label}
                </Chip>
              ))}
            </ScrollView>

            <TextInput
              label="项目描述"
              value={formData.description}
              onChangeText={(text) =>
                setFormData({ ...formData, description: text })
              }
              style={styles.input}
              multiline
            />

            <TextInput
              label="检测方法"
              value={formData.checkMethod}
              onChangeText={(text) =>
                setFormData({ ...formData, checkMethod: text })
              }
              style={styles.input}
              multiline
            />

            <TextInput
              label="检测标准"
              value={formData.standardReference}
              onChangeText={(text) =>
                setFormData({ ...formData, standardReference: text })
              }
              style={styles.input}
              placeholder="如: GB 2733-2015"
            />

            <Text style={styles.sectionLabel}>检测类型</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipRow}
            >
              {VALUE_TYPES.map((type) => (
                <Chip
                  key={type.value}
                  selected={formData.valueType === type.value}
                  onPress={() =>
                    setFormData({ ...formData, valueType: type.value })
                  }
                  style={styles.selectionChip}
                >
                  {type.label}
                </Chip>
              ))}
            </ScrollView>

            <View style={styles.row}>
              <TextInput
                label="最小值"
                value={formData.minValue?.toString() ?? ''}
                onChangeText={(text) =>
                  setFormData({
                    ...formData,
                    minValue: text ? parseFloat(text) : undefined,
                  })
                }
                style={[styles.input, styles.halfInput]}
                keyboardType="numeric"
              />
              <TextInput
                label="最大值"
                value={formData.maxValue?.toString() ?? ''}
                onChangeText={(text) =>
                  setFormData({
                    ...formData,
                    maxValue: text ? parseFloat(text) : undefined,
                  })
                }
                style={[styles.input, styles.halfInput]}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.row}>
              <TextInput
                label="单位"
                value={formData.unit ?? ''}
                onChangeText={(text) =>
                  setFormData({ ...formData, unit: text })
                }
                style={[styles.input, styles.halfInput]}
                placeholder="如: °C, %, g"
              />
              <TextInput
                label="抽样比例(%)"
                value={formData.samplingRatio?.toString() ?? '10'}
                onChangeText={(text) =>
                  setFormData({
                    ...formData,
                    samplingRatio: text ? parseFloat(text) : 10,
                  })
                }
                style={[styles.input, styles.halfInput]}
                keyboardType="numeric"
              />
            </View>

            <Text style={styles.sectionLabel}>严重程度</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipRow}
            >
              {QUALITY_SEVERITIES.map((sev) => (
                <Chip
                  key={sev.value}
                  selected={formData.severity === sev.value}
                  onPress={() =>
                    setFormData({ ...formData, severity: sev.value })
                  }
                  style={[
                    styles.selectionChip,
                    formData.severity === sev.value && {
                      backgroundColor: sev.color,
                    },
                  ]}
                  textStyle={
                    formData.severity === sev.value
                      ? { color: '#fff' }
                      : undefined
                  }
                >
                  {sev.label}
                </Chip>
              ))}
            </ScrollView>

            <List.Section>
              <List.Item
                title="必检项"
                description="是否为必须检测的项目"
                right={() => (
                  <Switch
                    value={formData.isRequired}
                    onValueChange={(value) =>
                      setFormData({ ...formData, isRequired: value })
                    }
                  />
                )}
              />
              <List.Item
                title="不合格需拍照"
                description="检测不合格时是否需要拍照记录"
                right={() => (
                  <Switch
                    value={formData.requirePhotoOnFail}
                    onValueChange={(value) =>
                      setFormData({ ...formData, requirePhotoOnFail: value })
                    }
                  />
                )}
              />
              <List.Item
                title="不合格需备注"
                description="检测不合格时是否需要填写备注"
                right={() => (
                  <Switch
                    value={formData.requireNoteOnFail}
                    onValueChange={(value) =>
                      setFormData({ ...formData, requireNoteOnFail: value })
                    }
                  />
                )}
              />
              <List.Item
                title="启用"
                description="是否启用此质检项"
                right={() => (
                  <Switch
                    value={formData.enabled}
                    onValueChange={(value) =>
                      setFormData({ ...formData, enabled: value })
                    }
                  />
                )}
              />
            </List.Section>

            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => setModalVisible(false)}
                style={styles.modalButton}
              >
                取消
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                style={styles.modalButton}
              >
                保存
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statsCard: {
    margin: 16,
    marginBottom: 8,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    color: '#666',
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
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchbar: {
    flex: 1,
    marginRight: 8,
    height: 40,
  },
  templateButton: {
    height: 40,
  },
  categoryFilter: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterChip: {
    marginRight: 8,
  },
  itemList: {
    padding: 16,
    paddingTop: 8,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryChip: {
    height: 24,
  },
  categoryChipText: {
    color: '#fff',
    fontSize: 11,
  },
  severityChip: {
    height: 24,
  },
  severityChipText: {
    color: '#fff',
    fontSize: 11,
  },
  itemCode: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
  },
  detailRow: {
    marginTop: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  tagChip: {
    height: 24,
    backgroundColor: '#E3F2FD',
  },
  tagText: {
    fontSize: 11,
    color: '#1976D2',
  },
  emptyCard: {
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
  },
  progress: {
    margin: 16,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#1976D2',
  },
  modal: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 8,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginTop: 8,
    marginBottom: 8,
  },
  chipRow: {
    marginBottom: 12,
  },
  selectionChip: {
    marginRight: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  modalButton: {
    minWidth: 80,
  },
});

export default QualityCheckItemConfigScreen;
