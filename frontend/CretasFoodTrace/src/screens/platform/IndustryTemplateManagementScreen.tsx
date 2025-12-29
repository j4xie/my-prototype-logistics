/**
 * 行业模板管理界面
 *
 * 平台管理员用于管理行业模板包:
 * - 查看所有行业模板列表
 * - 查看模板详情 (包含的表单类型、字段定义)
 * - 创建/编辑/删除模板
 * - 设置默认模板
 * - 查看模板使用情况
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Pressable,
} from 'react-native';
import {
  Appbar,
  Text,
  Card,
  Searchbar,
  Chip,
  Avatar,
  Button,
  IconButton,
  Menu,
  Divider,
  ActivityIndicator,
  FAB,
  Portal,
  Modal,
  List,
  Badge,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlatformStackParamList } from '../../navigation/PlatformStackNavigator';
import {
  templatePackageApiClient,
  IndustryTemplatePackage,
  TemplatePackageDetail,
} from '../../services/api/templatePackageApiClient';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建专用 logger
const templateLogger = logger.createContextLogger('IndustryTemplateManagement');

type NavigationProp = NativeStackNavigationProp<PlatformStackParamList>;

// 行业图标映射
const INDUSTRY_ICONS: Record<string, string> = {
  seafood_processing: 'fish',
  prepared_food: 'food-variant',
  meat_processing: 'food-steak',
  dairy_processing: 'cup',
  beverage: 'bottle-wine',
  bakery: 'bread-slice',
  frozen_food: 'snowflake',
  canned_food: 'food-variant',
  default: 'factory',
};

// 行业颜色映射
const INDUSTRY_COLORS: Record<string, string> = {
  seafood_processing: '#00BCD4',
  prepared_food: '#FF9800',
  meat_processing: '#F44336',
  dairy_processing: '#2196F3',
  beverage: '#9C27B0',
  bakery: '#795548',
  frozen_food: '#03A9F4',
  canned_food: '#4CAF50',
  default: '#607D8B',
};

export function IndustryTemplateManagementScreen() {
  const navigation = useNavigation<NavigationProp>();

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [templates, setTemplates] = useState<IndustryTemplatePackage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'default' | 'custom'>('all');
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplatePackageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 加载模板列表
  const loadTemplates = useCallback(async () => {
    try {
      templateLogger.debug('加载行业模板列表');
      const data = await templatePackageApiClient.getTemplatePackages();

      templateLogger.info('模板列表加载成功', { count: data.length });
      setTemplates(data);
    } catch (error) {
      templateLogger.error('加载模板列表失败', error as Error);
      handleError(error, {
        title: '加载失败',
        customMessage: '无法加载行业模板列表',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTemplates();
  }, [loadTemplates]);

  // 搜索过滤
  const filteredTemplates = templates.filter((template) => {
    const matchSearch =
      !searchQuery ||
      template.industryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.industryCode.toLowerCase().includes(searchQuery.toLowerCase());

    const matchFilter =
      filterStatus === 'all' ||
      (filterStatus === 'default' && template.isDefault) ||
      (filterStatus === 'custom' && !template.isDefault);

    return matchSearch && matchFilter;
  });

  // 获取行业图标
  const getIndustryIcon = (code: string): string => {
    return INDUSTRY_ICONS[code] ?? 'factory';
  };

  // 获取行业颜色
  const getIndustryColor = (code: string): string => {
    return INDUSTRY_COLORS[code] ?? '#607D8B';
  };

  // 查看模板详情
  const handleViewDetail = async (template: IndustryTemplatePackage) => {
    setLoadingDetail(true);
    setDetailModalVisible(true);

    try {
      const detail = await templatePackageApiClient.getTemplatePackageDetail(template.id);
      if (detail) {
        setSelectedTemplate(detail);
      } else {
        Alert.alert('错误', '无法加载模板详情');
        setDetailModalVisible(false);
      }
    } catch (error) {
      templateLogger.error('加载模板详情失败', error as Error);
      Alert.alert('错误', '加载模板详情失败');
      setDetailModalVisible(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  // 设置为默认模板
  const handleSetDefault = async (template: IndustryTemplatePackage) => {
    if (template.isDefault) {
      Alert.alert('提示', '该模板已经是默认模板');
      return;
    }

    Alert.alert(
      '确认设置',
      `确定要将"${template.industryName}"设置为默认模板吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            try {
              await templatePackageApiClient.setDefaultTemplate(template.id);
              templateLogger.info('设置默认模板', { templateId: template.id });
              Alert.alert('成功', '已设置为默认模板');
              loadTemplates();
            } catch (error) {
              templateLogger.error('设置默认模板失败', error as Error);
              Alert.alert('错误', '设置默认模板失败');
            }
          },
        },
      ]
    );
  };

  // 删除模板
  const handleDelete = async (template: IndustryTemplatePackage) => {
    Alert.alert(
      '确认删除',
      `确定要删除"${template.industryName}"模板吗？此操作无法恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await templatePackageApiClient.deleteTemplatePackage(template.id);
              templateLogger.info('删除模板', { templateId: template.id });
              Alert.alert('成功', '模板已删除');
              loadTemplates();
            } catch (error) {
              templateLogger.error('删除模板失败', error as Error);
              Alert.alert('错误', '删除模板失败，可能有工厂正在使用该模板');
            }
          },
        },
      ]
    );
  };

  // 编辑模板
  const handleEdit = (template: IndustryTemplatePackage) => {
    setMenuVisible(null);
    setDetailModalVisible(false);
    navigation.navigate('IndustryTemplateEdit', { templateId: template.id });
  };

  // 创建新模板
  const handleCreate = () => {
    navigation.navigate('IndustryTemplateEdit', {});
  };

  // 解析模板 JSON 获取表单类型数量
  const parseTemplateSchemas = (templatesJson?: string) => {
    if (!templatesJson) return [];
    try {
      const schemas = JSON.parse(templatesJson);
      return Object.keys(schemas);
    } catch {
      return [];
    }
  };

  // 渲染模板卡片
  const renderTemplateCard = (template: IndustryTemplatePackage) => {
    const iconName = getIndustryIcon(template.industryCode);
    const color = getIndustryColor(template.industryCode);

    return (
      <Card key={template.id} style={styles.templateCard} mode="elevated">
        <Pressable onPress={() => handleViewDetail(template)}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={styles.cardLeft}>
                <Avatar.Icon
                  icon={iconName}
                  size={48}
                  color="#fff"
                  style={{ backgroundColor: color }}
                />
                <View style={styles.cardInfo}>
                  <View style={styles.titleRow}>
                    <Text variant="titleMedium" style={styles.industryName}>
                      {template.industryName}
                    </Text>
                    {template.isDefault && (
                      <Chip
                        mode="flat"
                        compact
                        textStyle={styles.defaultChipText}
                        style={styles.defaultChip}
                      >
                        推荐
                      </Chip>
                    )}
                  </View>
                  <Text variant="bodySmall" style={styles.industryCode}>
                    {template.industryCode} · v{template.version}
                  </Text>
                </View>
              </View>

              <Menu
                visible={menuVisible === template.id}
                onDismiss={() => setMenuVisible(null)}
                anchor={
                  <IconButton
                    icon="dots-vertical"
                    onPress={() => setMenuVisible(template.id)}
                  />
                }
              >
                <Menu.Item
                  leadingIcon="pencil"
                  onPress={() => handleEdit(template)}
                  title="编辑"
                />
                <Menu.Item
                  leadingIcon="star"
                  onPress={() => {
                    setMenuVisible(null);
                    handleSetDefault(template);
                  }}
                  title="设为默认"
                  disabled={template.isDefault}
                />
                <Divider />
                <Menu.Item
                  leadingIcon="delete"
                  onPress={() => {
                    setMenuVisible(null);
                    handleDelete(template);
                  }}
                  title="删除"
                  titleStyle={{ color: '#F44336' }}
                />
              </Menu>
            </View>

            <Divider style={styles.cardDivider} />

            <View style={styles.cardMeta}>
              <View style={styles.metaItem}>
                <Avatar.Icon
                  icon="file-document-multiple"
                  size={24}
                  color={color}
                  style={styles.metaIcon}
                />
                <Text variant="bodySmall" style={styles.metaText}>
                  包含 {template.schemaCount || template.entityTypes?.length || 0} 个模板
                </Text>
              </View>
              {template.description && (
                <Text
                  variant="bodySmall"
                  style={styles.description}
                  numberOfLines={2}
                >
                  {template.description}
                </Text>
              )}
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.entityChips}>
                {template.entityTypes?.slice(0, 4).map((type, index) => (
                  <Chip
                    key={index}
                    mode="outlined"
                    compact
                    textStyle={styles.entityChipText}
                    style={styles.entityChip}
                  >
                    {type}
                  </Chip>
                ))}
                {template.entityTypes && template.entityTypes.length > 4 && (
                  <Chip
                    mode="outlined"
                    compact
                    textStyle={styles.entityChipText}
                    style={styles.entityChip}
                  >
                    +{template.entityTypes.length - 4}
                  </Chip>
                )}
              </View>
              <Button
                mode="text"
                compact
                onPress={() => handleViewDetail(template)}
                icon="chevron-right"
                contentStyle={{ flexDirection: 'row-reverse' }}
              >
                详情
              </Button>
            </View>
          </Card.Content>
        </Pressable>
      </Card>
    );
  };

  // 渲染详情模态框
  const renderDetailModal = () => {
    if (!selectedTemplate) return null;

    const schemas = parseTemplateSchemas(selectedTemplate.templatesJson);
    const color = getIndustryColor(selectedTemplate.industryCode);

    return (
      <Portal>
        <Modal
          visible={detailModalVisible}
          onDismiss={() => {
            setDetailModalVisible(false);
            setSelectedTemplate(null);
          }}
          contentContainerStyle={styles.modalContainer}
        >
          <ScrollView>
            {loadingDetail ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text variant="bodyMedium" style={{ marginTop: 16 }}>
                  加载中...
                </Text>
              </View>
            ) : (
              <>
                {/* 模板头部 */}
                <View style={styles.modalHeader}>
                  <Avatar.Icon
                    icon={getIndustryIcon(selectedTemplate.industryCode)}
                    size={64}
                    color="#fff"
                    style={{ backgroundColor: color }}
                  />
                  <View style={styles.modalHeaderInfo}>
                    <Text variant="headlineSmall" style={styles.modalTitle}>
                      {selectedTemplate.industryName}
                    </Text>
                    <Text variant="bodyMedium" style={styles.modalSubtitle}>
                      {selectedTemplate.industryCode} · v{selectedTemplate.version}
                    </Text>
                    {selectedTemplate.isDefault && (
                      <Chip
                        mode="flat"
                        compact
                        textStyle={styles.defaultChipText}
                        style={[styles.defaultChip, { marginTop: 8 }]}
                      >
                        推荐模板
                      </Chip>
                    )}
                  </View>
                </View>

                {selectedTemplate.description && (
                  <Text variant="bodyMedium" style={styles.modalDescription}>
                    {selectedTemplate.description}
                  </Text>
                )}

                <Divider style={styles.modalDivider} />

                {/* 包含的表单类型 */}
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  包含的表单类型
                </Text>
                {schemas.map((entityType, index) => (
                  <List.Item
                    key={index}
                    title={entityType}
                    left={(props) => <List.Icon {...props} icon="file-document" />}
                    style={styles.schemaItem}
                  />
                ))}

                {/* 元信息 */}
                <Divider style={styles.modalDivider} />
                <View style={styles.modalMeta}>
                  <View style={styles.modalMetaItem}>
                    <Text variant="bodySmall" style={styles.modalMetaLabel}>
                      创建时间
                    </Text>
                    <Text variant="bodyMedium">
                      {new Date(selectedTemplate.createdAt).toLocaleDateString('zh-CN')}
                    </Text>
                  </View>
                  {selectedTemplate.updatedAt && (
                    <View style={styles.modalMetaItem}>
                      <Text variant="bodySmall" style={styles.modalMetaLabel}>
                        更新时间
                      </Text>
                      <Text variant="bodyMedium">
                        {new Date(selectedTemplate.updatedAt).toLocaleDateString('zh-CN')}
                      </Text>
                    </View>
                  )}
                </View>

                {/* 操作按钮 */}
                <View style={styles.modalActions}>
                  <Button
                    mode="outlined"
                    onPress={() => {
                      setDetailModalVisible(false);
                      handleEdit(selectedTemplate);
                    }}
                    style={styles.modalButton}
                  >
                    编辑模板
                  </Button>
                  <Button
                    mode="contained"
                    onPress={() => setDetailModalVisible(false)}
                    style={styles.modalButton}
                  >
                    关闭
                  </Button>
                </View>
              </>
            )}
          </ScrollView>
        </Modal>
      </Portal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text variant="bodyMedium" style={{ marginTop: 16 }}>
          加载行业模板...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="行业模板管理" />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>

      <View style={styles.content}>
        {/* 搜索和筛选 */}
        <View style={styles.filterRow}>
          <Searchbar
            placeholder="搜索模板..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchBar}
          />
        </View>

        <View style={styles.chipRow}>
          <Chip
            selected={filterStatus === 'all'}
            onPress={() => setFilterStatus('all')}
            style={styles.filterChip}
            showSelectedCheck={false}
          >
            全部
          </Chip>
          <Chip
            selected={filterStatus === 'default'}
            onPress={() => setFilterStatus('default')}
            style={styles.filterChip}
            showSelectedCheck={false}
          >
            推荐模板
          </Chip>
          <Chip
            selected={filterStatus === 'custom'}
            onPress={() => setFilterStatus('custom')}
            style={styles.filterChip}
            showSelectedCheck={false}
          >
            自定义模板
          </Chip>
        </View>

        {/* 模板列表 */}
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.scrollContent}
        >
          {filteredTemplates.length > 0 ? (
            filteredTemplates.map(renderTemplateCard)
          ) : (
            <View style={styles.emptyState}>
              <Avatar.Icon
                icon="file-document-outline"
                size={64}
                color="#BDBDBD"
                style={{ backgroundColor: 'transparent' }}
              />
              <Text variant="bodyLarge" style={styles.emptyText}>
                {searchQuery ? '未找到匹配的模板' : '暂无行业模板'}
              </Text>
              <Text variant="bodySmall" style={styles.emptySubtext}>
                {searchQuery
                  ? '请尝试其他搜索关键词'
                  : '点击右下角按钮创建新模板'}
              </Text>
            </View>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>

      {/* 创建按钮 */}
      <FAB icon="plus" style={styles.fab} onPress={handleCreate} label="新建模板" />

      {/* 详情模态框 */}
      {renderDetailModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  filterRow: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBar: {
    backgroundColor: '#fff',
  },
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  templateCard: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  cardInfo: {
    marginLeft: 16,
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  industryName: {
    fontWeight: '600',
  },
  industryCode: {
    color: '#757575',
    marginTop: 4,
  },
  defaultChip: {
    backgroundColor: '#FFF3E0',
  },
  defaultChipText: {
    color: '#FF9800',
    fontSize: 12,
  },
  cardDivider: {
    marginVertical: 12,
  },
  cardMeta: {
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaIcon: {
    backgroundColor: 'transparent',
  },
  metaText: {
    color: '#757575',
  },
  description: {
    color: '#616161',
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  entityChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
  },
  entityChip: {
    height: 28,
  },
  entityChipText: {
    fontSize: 11,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#757575',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#9E9E9E',
    marginTop: 8,
  },
  bottomPadding: {
    height: 80,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#673AB7',
  },
  // Modal 样式
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
  },
  modalHeaderInfo: {
    marginLeft: 16,
    flex: 1,
  },
  modalTitle: {
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#757575',
    marginTop: 4,
  },
  modalDescription: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    color: '#616161',
    lineHeight: 22,
  },
  modalDivider: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  schemaItem: {
    paddingVertical: 4,
  },
  modalMeta: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 32,
  },
  modalMetaItem: {},
  modalMetaLabel: {
    color: '#757575',
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    gap: 12,
  },
  modalButton: {
    minWidth: 100,
  },
});

export default IndustryTemplateManagementScreen;
