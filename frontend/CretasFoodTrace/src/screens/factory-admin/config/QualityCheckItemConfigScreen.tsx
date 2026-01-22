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
  TouchableOpacity,
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
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../../store/authStore';
import { FAManagementStackParamList } from '../../../types/navigation';
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

type NavigationProp = NativeStackNavigationProp<FAManagementStackParamList, 'QualityCheckItemConfig'>;

const QualityCheckItemConfigScreen: React.FC = () => {
  const { t } = useTranslation('home');
  const navigation = useNavigation<NavigationProp>();
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
      Alert.alert(t('common.error'), t('qualityCheckItemConfig.loadFailed'));
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
      Alert.alert(t('common.error'), t('qualityCheckItemConfig.fillRequiredFields'));
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
        Alert.alert(t('common.success'), t('qualityCheckItemConfig.updateSuccess'));
      } else {
        await qualityCheckItemApi.create(factoryId, formData);
        Alert.alert(t('common.success'), t('qualityCheckItemConfig.createSuccess'));
      }
      setModalVisible(false);
      loadData();
    } catch (error: unknown) {
      console.error('保存失败:', error);
      const errorMessage = error instanceof Error ? error.message : t('qualityCheckItemConfig.saveFailed');
      Alert.alert(t('common.error'), errorMessage);
    }
  };

  // 删除
  const handleDelete = (item: QualityCheckItem) => {
    Alert.alert(t('qualityCheckItemConfig.confirmDelete'), t('qualityCheckItemConfig.confirmDeleteMessage', { name: item.itemName }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await qualityCheckItemApi.delete(factoryId, item.id);
            Alert.alert(t('common.success'), t('qualityCheckItemConfig.deleteSuccess'));
            loadData();
          } catch (error: unknown) {
            console.error('删除失败:', error);
            const errorMessage = error instanceof Error ? error.message : t('qualityCheckItemConfig.deleteFailed');
            Alert.alert(t('common.error'), errorMessage);
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
      t('qualityCheckItemConfig.copyFromTemplateTitle'),
      t('qualityCheckItemConfig.copyFromTemplateMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            try {
              const copied = await qualityCheckItemApi.copyFromTemplate(factoryId);
              Alert.alert(t('common.success'), t('qualityCheckItemConfig.copiedItems', { count: copied.length }));
              loadData();
            } catch (error) {
              console.error('复制失败:', error);
              Alert.alert(t('common.error'), t('qualityCheckItemConfig.copyFailed'));
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

  // 导航到详情页
  const navigateToDetail = (itemId: string) => {
    navigation.navigate('QualityCheckItemDetail', { itemId });
  };

  // 渲染质检项卡片
  const renderItem = (item: QualityCheckItem) => (
    <Card key={item.id} style={styles.card} onPress={() => navigateToDetail(item.id)}>
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
              onPress={() => {
                setMenuVisible(null);
                navigation.navigate('QualityCheckItemDetail', { itemId: item.id });
              }}
              title={t('qualityCheckItemConfig.viewDetails', '查看详情')}
              leadingIcon="eye"
            />
            <Menu.Item
              onPress={() => openEditModal(item)}
              title={t('common.edit')}
              leadingIcon="pencil"
            />
            <Menu.Item
              onPress={() => toggleEnabled(item)}
              title={item.enabled ? t('qualityCheckItemConfig.disable') : t('qualityCheckItemConfig.enable')}
              leadingIcon={item.enabled ? 'eye-off' : 'eye'}
            />
            <Divider />
            <Menu.Item
              onPress={() => handleDelete(item)}
              title={t('common.delete')}
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
              {t('qualityCheckItemConfig.range')}: {item.minValue ?? '-'} ~ {item.maxValue ?? '-'} {item.unit ?? ''}
            </Text>
          ) : item.standardValue ? (
            <Text style={styles.detailText}>{t('qualityCheckItemConfig.standardValue')}: {item.standardValue}</Text>
          ) : null}
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailText}>
            {t('qualityCheckItemConfig.sampling')}: {item.samplingStrategyDescription} ({item.samplingRatio}%)
          </Text>
        </View>

        <View style={styles.tagsRow}>
          {item.isRequired && (
            <Chip compact style={styles.tagChip} textStyle={styles.tagText}>
              {t('qualityCheckItemConfig.required')}
            </Chip>
          )}
          {item.requirePhotoOnFail && (
            <Chip compact style={styles.tagChip} textStyle={styles.tagText}>
              {t('qualityCheckItemConfig.photoRequired')}
            </Chip>
          )}
          {!item.enabled && (
            <Chip
              compact
              style={[styles.tagChip, { backgroundColor: '#9E9E9E' }]}
              textStyle={styles.tagText}
            >
              {t('qualityCheckItemConfig.disabled')}
            </Chip>
          )}
          {item.bindingCount > 0 && (
            <Chip compact style={styles.tagChip} textStyle={styles.tagText}>
              {t('qualityCheckItemConfig.productCount', { count: item.bindingCount })}
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
          <Text style={styles.statsTitle}>{t('qualityCheckItemConfig.statsOverview')}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{statistics.total}</Text>
              <Text style={styles.statLabel}>{t('qualityCheckItemConfig.stats.total')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#2196F3' }]}>
                {statistics.requiredCount}
              </Text>
              <Text style={styles.statLabel}>{t('qualityCheckItemConfig.stats.required')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#F44336' }]}>
                {statistics.criticalCount}
              </Text>
              <Text style={styles.statLabel}>{t('qualityCheckItemConfig.stats.critical')}</Text>
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
            placeholder={t('qualityCheckItemConfig.searchPlaceholder')}
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
            {t('qualityCheckItemConfig.copyFromTemplate')}
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
            {t('qualityCheckItemConfig.categories.all')}
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
                      ? t('qualityCheckItemConfig.noMatches')
                      : t('qualityCheckItemConfig.noItems')}
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
              {editingItem ? t('qualityCheckItemConfig.editTitle') : t('qualityCheckItemConfig.createTitle')}
            </Text>

            <TextInput
              label={t('qualityCheckItemConfig.itemCode') + ' *'}
              value={formData.itemCode}
              onChangeText={(text) =>
                setFormData({ ...formData, itemCode: text })
              }
              style={styles.input}
              disabled={!!editingItem}
            />

            <TextInput
              label={t('qualityCheckItemConfig.itemName') + ' *'}
              value={formData.itemName}
              onChangeText={(text) =>
                setFormData({ ...formData, itemName: text })
              }
              style={styles.input}
            />

            <Text style={styles.sectionLabel}>{t('qualityCheckItemConfig.itemCategory')}</Text>
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
              label={t('qualityCheckItemConfig.itemDescription')}
              value={formData.description}
              onChangeText={(text) =>
                setFormData({ ...formData, description: text })
              }
              style={styles.input}
              multiline
            />

            <TextInput
              label={t('qualityCheckItemConfig.checkMethod')}
              value={formData.checkMethod}
              onChangeText={(text) =>
                setFormData({ ...formData, checkMethod: text })
              }
              style={styles.input}
              multiline
            />

            <TextInput
              label={t('qualityCheckItemConfig.checkStandard')}
              value={formData.standardReference}
              onChangeText={(text) =>
                setFormData({ ...formData, standardReference: text })
              }
              style={styles.input}
              placeholder={t('qualityCheckItemConfig.checkStandardPlaceholder')}
            />

            <Text style={styles.sectionLabel}>{t('qualityCheckItemConfig.valueType')}</Text>
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
                label={t('qualityCheckItemConfig.minValue')}
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
                label={t('qualityCheckItemConfig.maxValue')}
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
                label={t('qualityCheckItemConfig.unit')}
                value={formData.unit ?? ''}
                onChangeText={(text) =>
                  setFormData({ ...formData, unit: text })
                }
                style={[styles.input, styles.halfInput]}
                placeholder={t('qualityCheckItemConfig.unitPlaceholder')}
              />
              <TextInput
                label={t('qualityCheckItemConfig.samplingRatio')}
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

            <Text style={styles.sectionLabel}>{t('qualityCheckItemConfig.severity')}</Text>
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
                title={t('qualityCheckItemConfig.requiredItem')}
                description={t('qualityCheckItemConfig.requiredItemDesc')}
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
                title={t('qualityCheckItemConfig.photoOnFail')}
                description={t('qualityCheckItemConfig.photoOnFailDesc')}
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
                title={t('qualityCheckItemConfig.noteOnFail')}
                description={t('qualityCheckItemConfig.noteOnFailDesc')}
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
                title={t('qualityCheckItemConfig.enableItem')}
                description={t('qualityCheckItemConfig.enableItemDesc')}
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
                {t('common.cancel')}
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                style={styles.modalButton}
              >
                {t('common.save')}
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
