/**
 * 质检项详情页面
 * 显示质检项完整信息、绑定的产品/原料、检验标准和历史记录
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  IconButton,
  Portal,
  Modal,
  List,
  Divider,
  Switch,
  Searchbar,
  ProgressBar,
  Icon,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../../store/authStore';
import { FAManagementStackParamList } from '../../../types/navigation';
import qualityCheckItemApi, {
  QualityCheckItem,
  QualityCheckItemBinding,
  QualityCheckCategory,
  QualitySeverity,
  UpdateQualityCheckItemRequest,
  BindQualityCheckItemRequest,
  QUALITY_CHECK_CATEGORIES,
  QUALITY_SEVERITIES,
  SAMPLING_STRATEGIES,
  VALUE_TYPES,
} from '../../../services/api/qualityCheckItemApiClient';
import { productTypeApiClient, ProductType } from '../../../services/api/productTypeApiClient';

type NavigationProp = NativeStackNavigationProp<FAManagementStackParamList, 'QualityCheckItemDetail'>;
type ScreenRouteProp = RouteProp<FAManagementStackParamList, 'QualityCheckItemDetail'>;

// Tab 类型
type TabType = 'info' | 'bindings' | 'standards' | 'history';

const QualityCheckItemDetailScreen: React.FC = () => {
  const { t } = useTranslation('home');
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { itemId } = route.params;
  const { user } = useAuthStore();
  const factoryId = user?.factoryId ?? '';

  // 状态
  const [item, setItem] = useState<QualityCheckItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('info');

  // 绑定相关状态
  const [bindings, setBindings] = useState<QualityCheckItemBinding[]>([]);
  const [bindingsLoading, setBindingsLoading] = useState(false);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [bindModalVisible, setBindModalVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // 编辑模式
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<UpdateQualityCheckItemRequest>({});

  // 统计数据
  const [statistics, setStatistics] = useState<{
    totalInspections: number;
    passCount: number;
    failCount: number;
    passRate: number;
    recentInspections: Array<{
      id: string;
      batchNumber: string;
      result: string;
      value: string;
      inspectedAt: string;
    }>;
  } | null>(null);

  // 加载质检项详情
  const loadItem = useCallback(async () => {
    if (!factoryId || !itemId) return;

    try {
      setError(null);
      const data = await qualityCheckItemApi.getById(factoryId, itemId);
      setItem(data);
      setEditForm({
        itemName: data.itemName,
        category: data.category,
        description: data.description,
        checkMethod: data.checkMethod,
        standardReference: data.standardReference,
        valueType: data.valueType,
        standardValue: data.standardValue,
        minValue: data.minValue,
        maxValue: data.maxValue,
        unit: data.unit,
        tolerance: data.tolerance,
        samplingStrategy: data.samplingStrategy,
        samplingRatio: data.samplingRatio,
        minSampleSize: data.minSampleSize,
        severity: data.severity,
        isRequired: data.isRequired,
        requirePhotoOnFail: data.requirePhotoOnFail,
        requireNoteOnFail: data.requireNoteOnFail,
        sortOrder: data.sortOrder,
        enabled: data.enabled,
      });
    } catch (err) {
      console.error('加载质检项详情失败:', err);
      setError(t('qualityCheckItemDetail.loadFailed', '加载质检项详情失败'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [factoryId, itemId, t]);

  // 加载绑定的产品
  const loadBindings = useCallback(async () => {
    if (!factoryId || !item) return;

    setBindingsLoading(true);
    try {
      // 获取所有产品类型，然后检查哪些绑定了此质检项
      const { data: products } = await productTypeApiClient.getProductTypes({ factoryId });
      const bindingPromises = products.map(async (product) => {
        const productBindings = await qualityCheckItemApi.getProductBindings(factoryId, product.id);
        return productBindings.filter(b => b.qualityCheckItemId === itemId);
      });

      const allBindings = await Promise.all(bindingPromises);
      const flatBindings = allBindings.flat();
      setBindings(flatBindings);
    } catch (err) {
      console.error('加载绑定失败:', err);
    } finally {
      setBindingsLoading(false);
    }
  }, [factoryId, item, itemId]);

  // 加载统计数据
  const loadStatistics = useCallback(async () => {
    if (!factoryId || !itemId) return;

    try {
      const stats = await qualityCheckItemApi.getItemStatistics(factoryId, itemId);
      setStatistics(stats);
    } catch (err) {
      // 统计接口可能不存在，忽略错误
      console.log('统计数据加载失败 (可能接口不存在):', err);
    }
  }, [factoryId, itemId]);

  // 加载产品类型列表（用于绑定）
  const loadProductTypes = useCallback(async () => {
    if (!factoryId) return;

    try {
      const { data } = await productTypeApiClient.getProductTypes({ factoryId, isActive: true });
      setProductTypes(data);
    } catch (err) {
      console.error('加载产品类型失败:', err);
    }
  }, [factoryId]);

  // 初始加载
  useEffect(() => {
    loadItem();
  }, [loadItem]);

  useEffect(() => {
    if (item && activeTab === 'bindings') {
      loadBindings();
    }
  }, [item, activeTab, loadBindings]);

  useEffect(() => {
    if (item && activeTab === 'history') {
      loadStatistics();
    }
  }, [item, activeTab, loadStatistics]);

  // 刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadItem();
    if (activeTab === 'bindings') {
      await loadBindings();
    }
    if (activeTab === 'history') {
      await loadStatistics();
    }
  }, [loadItem, loadBindings, loadStatistics, activeTab]);

  // 保存编辑
  const handleSave = async () => {
    if (!item) return;

    try {
      setSaving(true);
      await qualityCheckItemApi.update(factoryId, item.id, editForm);
      Alert.alert(t('common.success'), t('qualityCheckItemDetail.updateSuccess', '更新成功'));
      setIsEditing(false);
      loadItem();
    } catch (err) {
      console.error('保存失败:', err);
      Alert.alert(t('common.error'), t('qualityCheckItemDetail.updateFailed', '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  // 切换启用状态
  const handleToggleEnabled = async () => {
    if (!item) return;

    try {
      setSaving(true);
      await qualityCheckItemApi.update(factoryId, item.id, { enabled: !item.enabled });
      loadItem();
    } catch (err) {
      console.error('切换状态失败:', err);
      Alert.alert(t('common.error'), t('qualityCheckItemDetail.toggleFailed', '切换状态失败'));
    } finally {
      setSaving(false);
    }
  };

  // 删除质检项
  const handleDelete = () => {
    if (!item) return;

    Alert.alert(
      t('qualityCheckItemDetail.confirmDelete', '确认删除'),
      t('qualityCheckItemDetail.confirmDeleteMessage', '确定要删除此质检项吗？此操作不可撤销。'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await qualityCheckItemApi.delete(factoryId, item.id);
              Alert.alert(t('common.success'), t('qualityCheckItemDetail.deleteSuccess', '删除成功'));
              navigation.goBack();
            } catch (err) {
              console.error('删除失败:', err);
              Alert.alert(t('common.error'), t('qualityCheckItemDetail.deleteFailed', '删除失败'));
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  // 打开绑定模态框
  const openBindModal = async () => {
    await loadProductTypes();
    setBindModalVisible(true);
  };

  // 绑定产品
  const handleBind = async () => {
    if (!selectedProductId || !item) return;

    try {
      setSaving(true);
      const request: BindQualityCheckItemRequest = {
        productTypeId: selectedProductId,
        qualityCheckItemId: item.id,
        enabled: true,
      };
      await qualityCheckItemApi.bind(factoryId, request);
      Alert.alert(t('common.success'), t('qualityCheckItemDetail.bindSuccess', '绑定成功'));
      setBindModalVisible(false);
      setSelectedProductId(null);
      loadBindings();
      loadItem(); // 更新 bindingCount
    } catch (err) {
      console.error('绑定失败:', err);
      Alert.alert(t('common.error'), t('qualityCheckItemDetail.bindFailed', '绑定失败'));
    } finally {
      setSaving(false);
    }
  };

  // 解除绑定
  const handleUnbind = (binding: QualityCheckItemBinding) => {
    Alert.alert(
      t('qualityCheckItemDetail.confirmUnbind', '确认解除绑定'),
      t('qualityCheckItemDetail.confirmUnbindMessage', '确定要解除与此产品的绑定吗？'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            try {
              setSaving(true);
              await qualityCheckItemApi.unbind(factoryId, binding.id);
              Alert.alert(t('common.success'), t('qualityCheckItemDetail.unbindSuccess', '解除绑定成功'));
              loadBindings();
              loadItem();
            } catch (err) {
              console.error('解除绑定失败:', err);
              Alert.alert(t('common.error'), t('qualityCheckItemDetail.unbindFailed', '解除绑定失败'));
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  // 获取类别颜色
  const getCategoryColor = (category: QualityCheckCategory): string => {
    return QUALITY_CHECK_CATEGORIES.find((c) => c.value === category)?.color ?? '#666';
  };

  // 获取严重程度颜色
  const getSeverityColor = (severity: QualitySeverity): string => {
    return QUALITY_SEVERITIES.find((s) => s.value === severity)?.color ?? '#666';
  };

  // 获取抽样策略描述
  const getSamplingDescription = (strategy: string): string => {
    return SAMPLING_STRATEGIES.find((s) => s.value === strategy)?.label ?? strategy;
  };

  // 获取值类型描述
  const getValueTypeDescription = (valueType: string): string => {
    return VALUE_TYPES.find((v) => v.value === valueType)?.label ?? valueType;
  };

  // 过滤产品列表
  const filteredProducts = productTypes.filter(
    (product) =>
      product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
      product.productCode.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  // 格式化日期
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 加载状态
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={styles.loadingText}>{t('common.loading', '加载中...')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 错误状态
  if (error || !item) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon source="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('qualityCheckItemDetail.title', '质检项详情')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Icon source="alert-circle" size={48} color="#e53e3e" />
          <Text style={styles.errorText}>{error || t('qualityCheckItemDetail.notFound', '质检项不存在')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadItem}>
            <Text style={styles.retryText}>{t('common.retry', '重试')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Tab 内容渲染
  const renderTabContent = () => {
    switch (activeTab) {
      case 'info':
        return renderInfoTab();
      case 'bindings':
        return renderBindingsTab();
      case 'standards':
        return renderStandardsTab();
      case 'history':
        return renderHistoryTab();
      default:
        return renderInfoTab();
    }
  };

  // 基本信息 Tab
  const renderInfoTab = () => (
    <View>
      {/* 基本信息卡片 */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t('qualityCheckItemDetail.basicInfo', '基本信息')}</Text>
            <IconButton
              icon={isEditing ? 'close' : 'pencil'}
              size={20}
              onPress={() => setIsEditing(!isEditing)}
            />
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('qualityCheckItemDetail.itemCode', '编码')}</Text>
            <Text style={styles.infoValue}>{item.itemCode}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('qualityCheckItemDetail.itemName', '名称')}</Text>
            <Text style={styles.infoValue}>{item.itemName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('qualityCheckItemDetail.category', '类别')}</Text>
            <Chip
              compact
              style={[styles.chip, { backgroundColor: getCategoryColor(item.category) }]}
              textStyle={styles.chipText}
            >
              {item.categoryDescription}
            </Chip>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('qualityCheckItemDetail.severity', '严重程度')}</Text>
            <Chip
              compact
              style={[styles.chip, { backgroundColor: getSeverityColor(item.severity) }]}
              textStyle={styles.chipText}
            >
              {item.severityDescription}
            </Chip>
          </View>
          {item.description && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('qualityCheckItemDetail.description', '描述')}</Text>
              <Text style={[styles.infoValue, { flex: 1 }]}>{item.description}</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* 检验配置卡片 */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>{t('qualityCheckItemDetail.inspectionConfig', '检验配置')}</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('qualityCheckItemDetail.valueType', '值类型')}</Text>
            <Text style={styles.infoValue}>{getValueTypeDescription(item.valueType)}</Text>
          </View>
          {item.standardValue && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('qualityCheckItemDetail.standardValue', '标准值')}</Text>
              <Text style={styles.infoValue}>{item.standardValue}</Text>
            </View>
          )}
          {(item.minValue !== undefined || item.maxValue !== undefined) && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('qualityCheckItemDetail.range', '范围')}</Text>
              <Text style={styles.infoValue}>
                {item.minValue ?? '-'} ~ {item.maxValue ?? '-'} {item.unit ?? ''}
              </Text>
            </View>
          )}
          {item.tolerance !== undefined && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('qualityCheckItemDetail.tolerance', '允差')}</Text>
              <Text style={styles.infoValue}>{item.tolerance}{item.unit ?? ''}</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* 抽样配置卡片 */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>{t('qualityCheckItemDetail.samplingConfig', '抽样配置')}</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('qualityCheckItemDetail.samplingStrategy', '抽样策略')}</Text>
            <Text style={styles.infoValue}>{getSamplingDescription(item.samplingStrategy)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('qualityCheckItemDetail.samplingRatio', '抽样比例')}</Text>
            <Text style={styles.infoValue}>{item.samplingRatio}%</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('qualityCheckItemDetail.minSampleSize', '最小样本数')}</Text>
            <Text style={styles.infoValue}>{item.minSampleSize}</Text>
          </View>
        </Card.Content>
      </Card>

      {/* 控制选项卡片 */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>{t('qualityCheckItemDetail.controlOptions', '控制选项')}</Text>

          <List.Item
            title={t('qualityCheckItemDetail.isRequired', '必检项')}
            description={t('qualityCheckItemDetail.isRequiredDesc', '此项检验是否为强制性')}
            right={() => (
              <Chip compact style={item.isRequired ? styles.activeChip : styles.inactiveChip}>
                {item.isRequired ? t('common.yes', '是') : t('common.no', '否')}
              </Chip>
            )}
          />
          <Divider />
          <List.Item
            title={t('qualityCheckItemDetail.requirePhotoOnFail', '失败需拍照')}
            description={t('qualityCheckItemDetail.requirePhotoOnFailDesc', '检验不合格时是否需要拍照')}
            right={() => (
              <Chip compact style={item.requirePhotoOnFail ? styles.activeChip : styles.inactiveChip}>
                {item.requirePhotoOnFail ? t('common.yes', '是') : t('common.no', '否')}
              </Chip>
            )}
          />
          <Divider />
          <List.Item
            title={t('qualityCheckItemDetail.requireNoteOnFail', '失败需备注')}
            description={t('qualityCheckItemDetail.requireNoteOnFailDesc', '检验不合格时是否需要填写备注')}
            right={() => (
              <Chip compact style={item.requireNoteOnFail ? styles.activeChip : styles.inactiveChip}>
                {item.requireNoteOnFail ? t('common.yes', '是') : t('common.no', '否')}
              </Chip>
            )}
          />
          <Divider />
          <List.Item
            title={t('qualityCheckItemDetail.enabled', '启用状态')}
            description={t('qualityCheckItemDetail.enabledDesc', '此质检项是否启用')}
            right={() => (
              <Switch value={item.enabled} onValueChange={handleToggleEnabled} disabled={saving} />
            )}
          />
        </Card.Content>
      </Card>

      {/* 元数据卡片 */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>{t('qualityCheckItemDetail.metadata', '元数据')}</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('qualityCheckItemDetail.version', '版本')}</Text>
            <Text style={styles.infoValue}>{item.version}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('qualityCheckItemDetail.bindingCount', '绑定产品数')}</Text>
            <Text style={styles.infoValue}>{item.bindingCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('qualityCheckItemDetail.createdAt', '创建时间')}</Text>
            <Text style={styles.infoValue}>{formatDate(item.createdAt)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('qualityCheckItemDetail.updatedAt', '更新时间')}</Text>
            <Text style={styles.infoValue}>{formatDate(item.updatedAt)}</Text>
          </View>
        </Card.Content>
      </Card>

      {/* 危险操作卡片 */}
      <Card style={[styles.card, styles.dangerCard]}>
        <Card.Content>
          <Text style={[styles.cardTitle, styles.dangerTitle]}>
            {t('qualityCheckItemDetail.dangerZone', '危险操作')}
          </Text>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Icon source="delete" size={20} color="#e53e3e" />
            <Text style={styles.deleteButtonText}>
              {t('qualityCheckItemDetail.deleteItem', '删除质检项')}
            </Text>
          </TouchableOpacity>
        </Card.Content>
      </Card>
    </View>
  );

  // 绑定产品 Tab
  const renderBindingsTab = () => (
    <View>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {t('qualityCheckItemDetail.boundProducts', '绑定的产品')} ({bindings.length})
            </Text>
            <Button mode="contained" compact onPress={openBindModal} icon="plus">
              {t('qualityCheckItemDetail.addBinding', '添加绑定')}
            </Button>
          </View>

          {bindingsLoading ? (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="small" color="#1976D2" />
              <Text style={styles.loadingText}>{t('common.loading', '加载中...')}</Text>
            </View>
          ) : bindings.length === 0 ? (
            <View style={styles.emptySection}>
              <Icon source="package-variant" size={48} color="#999" />
              <Text style={styles.emptyText}>
                {t('qualityCheckItemDetail.noBindings', '暂无绑定的产品')}
              </Text>
              <Text style={styles.emptySubtext}>
                {t('qualityCheckItemDetail.noBindingsHint', '点击上方按钮将此质检项绑定到产品')}
              </Text>
            </View>
          ) : (
            <View style={styles.bindingList}>
              {bindings.map((binding) => (
                <View key={binding.id} style={styles.bindingItem}>
                  <View style={styles.bindingInfo}>
                    <Text style={styles.bindingProductName}>
                      {binding.productTypeName || binding.productTypeId}
                    </Text>
                    <View style={styles.bindingDetails}>
                      {binding.overrideIsRequired !== undefined && (
                        <Chip compact style={styles.overrideChip}>
                          {t('qualityCheckItemDetail.requiredOverride', '必检')}: {binding.overrideIsRequired ? t('common.yes', '是') : t('common.no', '否')}
                        </Chip>
                      )}
                      {binding.overrideSamplingRatio !== undefined && (
                        <Chip compact style={styles.overrideChip}>
                          {t('qualityCheckItemDetail.samplingOverride', '抽样')}: {binding.overrideSamplingRatio}%
                        </Chip>
                      )}
                      {!binding.enabled && (
                        <Chip compact style={styles.disabledChip}>
                          {t('common.disabled', '已禁用')}
                        </Chip>
                      )}
                    </View>
                  </View>
                  <IconButton
                    icon="delete"
                    size={20}
                    iconColor="#e53e3e"
                    onPress={() => handleUnbind(binding)}
                  />
                </View>
              ))}
            </View>
          )}
        </Card.Content>
      </Card>
    </View>
  );

  // 检验标准 Tab
  const renderStandardsTab = () => (
    <View>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>{t('qualityCheckItemDetail.checkMethod', '检验方法')}</Text>
          <Text style={styles.standardText}>
            {item.checkMethod || t('qualityCheckItemDetail.noCheckMethod', '未设置检验方法')}
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>{t('qualityCheckItemDetail.standardReference', '参考标准')}</Text>
          <Text style={styles.standardText}>
            {item.standardReference || t('qualityCheckItemDetail.noStandardReference', '未设置参考标准')}
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>{t('qualityCheckItemDetail.acceptanceCriteria', '合格标准')}</Text>

          <View style={styles.criteriaSection}>
            <Text style={styles.criteriaLabel}>{t('qualityCheckItemDetail.valueType', '值类型')}</Text>
            <Text style={styles.criteriaValue}>{getValueTypeDescription(item.valueType)}</Text>
          </View>

          {item.valueType === 'NUMERIC' && (
            <>
              <View style={styles.criteriaSection}>
                <Text style={styles.criteriaLabel}>{t('qualityCheckItemDetail.acceptableRange', '可接受范围')}</Text>
                <Text style={styles.criteriaValue}>
                  {item.minValue !== undefined && item.maxValue !== undefined
                    ? `${item.minValue} ~ ${item.maxValue} ${item.unit ?? ''}`
                    : item.standardValue
                    ? `${item.standardValue} ${item.tolerance !== undefined ? `(允差: ${item.tolerance}${item.unit ?? ''})` : ''}`
                    : t('qualityCheckItemDetail.notSet', '未设置')}
                </Text>
              </View>
            </>
          )}

          {item.valueType === 'BOOLEAN' && (
            <View style={styles.criteriaSection}>
              <Text style={styles.criteriaLabel}>{t('qualityCheckItemDetail.expectedResult', '期望结果')}</Text>
              <Text style={styles.criteriaValue}>
                {item.standardValue || t('qualityCheckItemDetail.pass', '合格')}
              </Text>
            </View>
          )}

          {item.valueType === 'TEXT' && (
            <View style={styles.criteriaSection}>
              <Text style={styles.criteriaLabel}>{t('qualityCheckItemDetail.expectedValue', '期望值')}</Text>
              <Text style={styles.criteriaValue}>
                {item.standardValue || t('qualityCheckItemDetail.notSet', '未设置')}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </View>
  );

  // 历史记录 Tab
  const renderHistoryTab = () => (
    <View>
      {/* 统计卡片 */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>{t('qualityCheckItemDetail.statistics', '检验统计')}</Text>

          {statistics ? (
            <View style={styles.statisticsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{statistics.totalInspections}</Text>
                <Text style={styles.statLabel}>{t('qualityCheckItemDetail.totalInspections', '总检验次数')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#48bb78' }]}>{statistics.passCount}</Text>
                <Text style={styles.statLabel}>{t('qualityCheckItemDetail.passCount', '合格次数')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#e53e3e' }]}>{statistics.failCount}</Text>
                <Text style={styles.statLabel}>{t('qualityCheckItemDetail.failCount', '不合格次数')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#1976D2' }]}>
                  {(statistics.passRate * 100).toFixed(1)}%
                </Text>
                <Text style={styles.statLabel}>{t('qualityCheckItemDetail.passRate', '合格率')}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptySection}>
              <Icon source="chart-bar" size={48} color="#999" />
              <Text style={styles.emptyText}>
                {t('qualityCheckItemDetail.noStatistics', '暂无统计数据')}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* 最近检验记录 */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>{t('qualityCheckItemDetail.recentInspections', '最近检验记录')}</Text>

          {statistics?.recentInspections && statistics.recentInspections.length > 0 ? (
            <View style={styles.historyList}>
              {statistics.recentInspections.map((inspection) => (
                <View key={inspection.id} style={styles.historyItem}>
                  <View style={styles.historyMain}>
                    <Text style={styles.historyBatch}>{inspection.batchNumber}</Text>
                    <Chip
                      compact
                      style={inspection.result === 'PASS' ? styles.passChip : styles.failChip}
                      textStyle={styles.chipText}
                    >
                      {inspection.result === 'PASS' ? t('common.pass', '合格') : t('common.fail', '不合格')}
                    </Chip>
                  </View>
                  <View style={styles.historySecondary}>
                    <Text style={styles.historyValue}>
                      {t('qualityCheckItemDetail.measuredValue', '检测值')}: {inspection.value}
                    </Text>
                    <Text style={styles.historyTime}>{formatDate(inspection.inspectedAt)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptySection}>
              <Icon source="history" size={48} color="#999" />
              <Text style={styles.emptyText}>
                {t('qualityCheckItemDetail.noHistory', '暂无检验记录')}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {item.itemName}
        </Text>
        <View style={styles.headerActions}>
          <Chip
            compact
            style={[styles.statusChip, { backgroundColor: item.enabled ? '#E8F5E9' : '#FFEBEE' }]}
            textStyle={{ color: item.enabled ? '#2E7D32' : '#C62828', fontSize: 11 }}
          >
            {item.enabled ? t('common.enabled', '启用') : t('common.disabled', '禁用')}
          </Chip>
        </View>
      </View>

      {/* Tab 导航 */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'info' && styles.activeTab]}
          onPress={() => setActiveTab('info')}
        >
          <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>
            {t('qualityCheckItemDetail.tab.info', '基本信息')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bindings' && styles.activeTab]}
          onPress={() => setActiveTab('bindings')}
        >
          <Text style={[styles.tabText, activeTab === 'bindings' && styles.activeTabText]}>
            {t('qualityCheckItemDetail.tab.bindings', '绑定产品')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'standards' && styles.activeTab]}
          onPress={() => setActiveTab('standards')}
        >
          <Text style={[styles.tabText, activeTab === 'standards' && styles.activeTabText]}>
            {t('qualityCheckItemDetail.tab.standards', '检验标准')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            {t('qualityCheckItemDetail.tab.history', '历史记录')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 内容区域 */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {renderTabContent()}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* 绑定产品模态框 */}
      <Portal>
        <Modal
          visible={bindModalVisible}
          onDismiss={() => {
            setBindModalVisible(false);
            setSelectedProductId(null);
            setProductSearchQuery('');
          }}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>
            {t('qualityCheckItemDetail.selectProduct', '选择要绑定的产品')}
          </Text>

          <Searchbar
            placeholder={t('qualityCheckItemDetail.searchProduct', '搜索产品')}
            onChangeText={setProductSearchQuery}
            value={productSearchQuery}
            style={styles.searchbar}
          />

          <ScrollView style={styles.productList}>
            {filteredProducts.length === 0 ? (
              <Text style={styles.noProductsText}>
                {t('qualityCheckItemDetail.noProducts', '没有找到产品')}
              </Text>
            ) : (
              filteredProducts.map((product) => {
                const isAlreadyBound = bindings.some((b) => b.productTypeId === product.id);
                return (
                  <TouchableOpacity
                    key={product.id}
                    style={[
                      styles.productItem,
                      selectedProductId === product.id && styles.selectedProductItem,
                      isAlreadyBound && styles.boundProductItem,
                    ]}
                    onPress={() => !isAlreadyBound && setSelectedProductId(product.id)}
                    disabled={isAlreadyBound}
                  >
                    <View>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productCode}>{product.productCode}</Text>
                    </View>
                    {isAlreadyBound ? (
                      <Chip compact style={styles.boundChip}>{t('common.bound', '已绑定')}</Chip>
                    ) : selectedProductId === product.id ? (
                      <Icon source="check" size={24} color="#1976D2" />
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => {
                setBindModalVisible(false);
                setSelectedProductId(null);
                setProductSearchQuery('');
              }}
              style={styles.modalButton}
            >
              {t('common.cancel', '取消')}
            </Button>
            <Button
              mode="contained"
              onPress={handleBind}
              disabled={!selectedProductId || saving}
              loading={saving}
              style={styles.modalButton}
            >
              {t('common.confirm', '确定')}
            </Button>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
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
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
    textAlign: 'center',
  },
  headerActions: {
    width: 60,
    alignItems: 'flex-end',
  },
  statusChip: {
    height: 24,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1976D2',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#1976D2',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
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
    backgroundColor: '#1976D2',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
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
    fontWeight: '500',
  },
  chip: {
    height: 24,
  },
  chipText: {
    color: '#fff',
    fontSize: 11,
  },
  activeChip: {
    backgroundColor: '#E8F5E9',
  },
  inactiveChip: {
    backgroundColor: '#EEEEEE',
  },
  dangerCard: {
    marginBottom: 32,
    borderColor: '#fed7d7',
    borderWidth: 1,
  },
  dangerTitle: {
    color: '#c53030',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#fff5f5',
  },
  deleteButtonText: {
    fontSize: 15,
    color: '#e53e3e',
    fontWeight: '500',
  },
  loadingSection: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptySection: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 13,
    color: '#999',
  },
  bindingList: {
    gap: 8,
  },
  bindingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f7fafc',
    borderRadius: 8,
  },
  bindingInfo: {
    flex: 1,
  },
  bindingProductName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a202c',
  },
  bindingDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  overrideChip: {
    backgroundColor: '#E3F2FD',
    height: 22,
  },
  disabledChip: {
    backgroundColor: '#FFEBEE',
    height: 22,
  },
  standardText: {
    fontSize: 14,
    color: '#1a202c',
    lineHeight: 22,
  },
  criteriaSection: {
    marginBottom: 16,
  },
  criteriaLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  criteriaValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a202c',
  },
  statisticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    paddingVertical: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a202c',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  historyList: {
    gap: 12,
  },
  historyItem: {
    padding: 12,
    backgroundColor: '#f7fafc',
    borderRadius: 8,
  },
  historyMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyBatch: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a202c',
  },
  historySecondary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  historyValue: {
    fontSize: 13,
    color: '#666',
  },
  historyTime: {
    fontSize: 12,
    color: '#999',
  },
  passChip: {
    backgroundColor: '#E8F5E9',
  },
  failChip: {
    backgroundColor: '#FFEBEE',
  },
  modal: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  searchbar: {
    marginBottom: 12,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  productList: {
    maxHeight: 300,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  selectedProductItem: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  boundProductItem: {
    opacity: 0.5,
  },
  productName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a202c',
  },
  productCode: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  boundChip: {
    backgroundColor: '#EEEEEE',
  },
  noProductsText: {
    textAlign: 'center',
    color: '#666',
    paddingVertical: 24,
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

export default QualityCheckItemDetailScreen;
