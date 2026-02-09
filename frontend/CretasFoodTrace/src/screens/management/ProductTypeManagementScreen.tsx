import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import {
  Text,
  Appbar,
  FAB,
  Card,
  List,
  Chip,
  IconButton,
  Portal,
  Modal,
  TextInput,
  Button,
  ActivityIndicator,
  Menu,
  Divider,
  SegmentedButtons,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { productTypeApiClient, ProcessingStep, SkillRequirement, ProcessingStageOption, CustomSchemaOverrides } from '../../services/api/productTypeApiClient';
import { ProductTypeSchemaConfigModal } from '../../components/schema';
import { equipmentApiClient, Equipment } from '../../services/api/equipmentApiClient';
import qualityCheckItemApi, { QualityCheckItem } from '../../services/api/qualityCheckItemApiClient';
import { useAuthStore } from '../../store/authStore';
import { getFactoryId } from '../../types/auth';
import { logger } from '../../utils/logger';
import { canManageBasicData, getPermissionDebugInfo } from '../../utils/permissionHelper';
import { ProcessingStepsEditor } from '../../components/processing';
// SKU 配置简化组件
import { SkuTemplateSelector, type AppliedTemplateConfig } from '../../components/sku/SkuTemplateSelector';
import { SkuVoiceFAB } from '../../components/sku/SkuVoiceFAB';
import { SkuVoiceDialog } from '../../components/sku/SkuVoiceDialog';
import type { SkuTemplate } from '../../config/skuTemplates';
import type { ExtractedSkuConfig } from '../../services/ai/SkuConfigAIPrompt';

// 创建ProductTypeManagement专用logger
const productTypeLogger = logger.createContextLogger('ProductTypeManagement');

// 下拉选项常量
const UNIT_OPTIONS = ['kg', '件', '盒', '包', '条', '桶'] as const;
const CATEGORY_OPTIONS = ['海鲜', '冷冻水产', '加工成品', '半成品'] as const;
const COMPLEXITY_OPTIONS = [
  { value: 1, label: '1 - 简单' },
  { value: 2, label: '2 - 较简单' },
  { value: 3, label: '3 - 中等' },
  { value: 4, label: '4 - 较复杂' },
  { value: 5, label: '5 - 复杂' },
];

interface ProductType {
  id: string;
  name: string;
  code: string;
  category?: string;
  unit?: string;
  isActive: boolean;
  createdAt: string;
  // SKU Configuration fields
  workHours?: number;
  processingSteps?: ProcessingStep[];
  skillRequirements?: SkillRequirement;
  equipmentIds?: string[];
  qualityCheckIds?: string[];
  complexityScore?: number;
  productionTimeMinutes?: number;
  // Custom Schema Overrides
  customSchemaOverrides?: CustomSchemaOverrides | null;
}

/**
 * 产品类型管理页面
 * Phase 5: 增强 SKU 配置功能
 */
export default function ProductTypeManagementScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const factoryId = getFactoryId(user);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductType | null>(null);

  // SKU Config Modal
  const [skuConfigModalVisible, setSkuConfigModalVisible] = useState(false);
  const [configItem, setConfigItem] = useState<ProductType | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Available options for SKU config
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [qualityCheckList, setQualityCheckList] = useState<QualityCheckItem[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // 下拉菜单可见状态
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);
  const [complexityMenuVisible, setComplexityMenuVisible] = useState(false);

  // Schema Config Modal
  const [schemaConfigModalVisible, setSchemaConfigModalVisible] = useState(false);
  const [schemaConfigItem, setSchemaConfigItem] = useState<ProductType | null>(null);
  const [schemaConfig, setSchemaConfig] = useState<CustomSchemaOverrides | null>(null);

  // 权限检查
  const canManage = canManageBasicData(user);

  // SKU Config form state
  const [skuConfig, setSkuConfig] = useState<{
    workHours: string;
    processingSteps: ProcessingStep[];
    skillRequirements: SkillRequirement;
    equipmentIds: string[];
    qualityCheckIds: string[];
    complexityScore: number;
  }>({
    workHours: '',
    processingSteps: [],
    skillRequirements: { minLevel: 1, preferredLevel: 3, specialSkills: [] },
    equipmentIds: [],
    qualityCheckIds: [],
    complexityScore: 3,
  });

  // 权限检查日志
  useEffect(() => {
    const debugInfo = getPermissionDebugInfo(user);
    productTypeLogger.debug('权限检查', {
      ...debugInfo,
      canManage,
    });
  }, [user]);

  // 表单状态 (简化: 只需名称、单位、分类)
  const [formData, setFormData] = useState({
    name: '',
    unit: 'kg',      // 默认单位
    category: '海鲜', // 默认分类
  });

  useEffect(() => {
    loadProductTypes();
  }, []);

  const loadProductTypes = async () => {
    try {
      setLoading(true);

      if (!factoryId) {
        productTypeLogger.warn('工厂ID不存在', { userType: user?.userType });
        Alert.alert('错误', '无法获取工厂信息，请重新登录');
        return;
      }

      productTypeLogger.debug('获取产品类型列表', { factoryId });
      const response = await productTypeApiClient.getProductTypes({ factoryId });

      if (response?.data) {
        productTypeLogger.info('产品类型列表加载成功', {
          productTypeCount: response.data.length,
          factoryId,
        });
        // 将后端DTO映射到前端显示格式
        const mappedTypes: ProductType[] = response.data.map((item: any) => {
          // Parse customSchemaOverrides if it's a string
          let parsedSchemaOverrides: CustomSchemaOverrides | null = null;
          if (item.customSchemaOverrides) {
            if (typeof item.customSchemaOverrides === 'string') {
              try {
                parsedSchemaOverrides = JSON.parse(item.customSchemaOverrides);
              } catch {
                parsedSchemaOverrides = null;
              }
            } else {
              parsedSchemaOverrides = item.customSchemaOverrides;
            }
          }

          return {
            id: item.id,
            name: item.name,
            code: item.productCode || item.code || '',
            category: item.category || undefined,
            unit: item.unit || 'kg',
            isActive: item.isActive !== false,
            createdAt: item.createdAt || new Date().toISOString(),
            // SKU Config fields
            workHours: item.workHours,
            processingSteps: item.processingSteps || [],
            skillRequirements: item.skillRequirements || { minLevel: 1, preferredLevel: 3, specialSkills: [] },
            equipmentIds: item.equipmentIds || [],
            qualityCheckIds: item.qualityCheckIds || [],
            complexityScore: item.complexityScore || 3,
            productionTimeMinutes: item.productionTimeMinutes,
            // Custom Schema Overrides
            customSchemaOverrides: parsedSchemaOverrides,
          };
        });
        setProductTypes(mappedTypes);
      } else {
        productTypeLogger.warn('API返回数据为空', { factoryId });
        setProductTypes([]);
      }
    } catch (error: unknown) {
      productTypeLogger.error('加载产品类型失败', error as Error, { factoryId });
      const errorMessage = error instanceof Error ? error.message : '加载产品类型失败';
      Alert.alert('错误', errorMessage);
      setProductTypes([]);
    } finally {
      setLoading(false);
    }
  };

  // Load equipment and quality check items for SKU config
  const loadSkuConfigOptions = useCallback(async () => {
    if (!factoryId) return;

    setLoadingOptions(true);
    try {
      const [equipmentRes, qcRes] = await Promise.allSettled([
        equipmentApiClient.getEquipments({ factoryId, status: 'active' }),
        qualityCheckItemApi.list(factoryId, 1, 100),
      ]);

      if (equipmentRes.status === 'fulfilled') {
        // getEquipments() returns { content, totalElements, totalPages } directly (unwrapped)
        const eqResult = equipmentRes.value as any;
        const eqData = eqResult?.content || eqResult || [];
        setEquipmentList(Array.isArray(eqData) ? eqData : []);
      } else {
        productTypeLogger.warn('加载设备列表失败', { reason: equipmentRes.reason });
      }

      if (qcRes.status === 'fulfilled') {
        // qualityCheckItemApi.list returns PaginatedResponse<QualityCheckItem>
        const qcResult = qcRes.value;
        const qcData = qcResult?.content || [];
        setQualityCheckList(Array.isArray(qcData) ? qcData : []);
      } else {
        productTypeLogger.warn('加载质检项失败', { reason: qcRes.reason });
      }
    } catch (error) {
      productTypeLogger.error('加载SKU配置选项失败', error as Error);
    } finally {
      setLoadingOptions(false);
    }
  }, [factoryId]);

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({ name: '', unit: 'kg', category: '海鲜' });
    setModalVisible(true);
  };

  const handleEdit = (item: ProductType) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      unit: item.unit || 'kg',
      category: item.category || '海鲜',
    });
    setModalVisible(true);
  };

  const handleConfigSku = (item: ProductType) => {
    setConfigItem(item);
    setSkuConfig({
      workHours: item.workHours?.toString() || '',
      processingSteps: item.processingSteps || [],
      skillRequirements: item.skillRequirements || { minLevel: 1, preferredLevel: 3, specialSkills: [] },
      equipmentIds: item.equipmentIds || [],
      qualityCheckIds: item.qualityCheckIds || [],
      complexityScore: item.complexityScore || 3,
    });
    loadSkuConfigOptions();
    setSkuConfigModalVisible(true);
  };

  const handleSaveSkuConfig = async () => {
    if (!configItem) return;

    setSavingConfig(true);
    try {
      const config = {
        workHours: skuConfig.workHours ? parseFloat(skuConfig.workHours) : undefined,
        processingSteps: skuConfig.processingSteps,
        skillRequirements: skuConfig.skillRequirements,
        equipmentIds: skuConfig.equipmentIds,
        qualityCheckIds: skuConfig.qualityCheckIds,
        complexityScore: skuConfig.complexityScore,
      };

      await productTypeApiClient.updateProductTypeConfig(configItem.id, config, factoryId);
      Alert.alert('成功', 'SKU配置已保存');
      productTypeLogger.info('SKU配置保存成功', { id: configItem.id, name: configItem.name });
      setSkuConfigModalVisible(false);
      loadProductTypes();
    } catch (error) {
      productTypeLogger.error('保存SKU配置失败', error as Error, { id: configItem.id });
      const errorMessage = error instanceof Error ? error.message : '保存失败';
      Alert.alert('错误', errorMessage);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('提示', '产品名称不能为空');
      return;
    }

    try {
      // 映射前端字段到后端期望的字段格式
      // 注意: productCode 不传，后端自动生成 SKU
      const requestData = {
        name: formData.name.trim(),
        unit: formData.unit,
        category: formData.category,
      };

      if (editingItem) {
        // 更新
        await productTypeApiClient.updateProductType(editingItem.id, requestData, factoryId);
        Alert.alert('成功', '产品类型更新成功');
        productTypeLogger.info('产品类型更新成功', { id: editingItem.id, name: formData.name });
      } else {
        // 创建 (后端会自动生成 SKU)
        await productTypeApiClient.createProductType(requestData, factoryId);
        Alert.alert('成功', '产品类型创建成功');
        productTypeLogger.info('产品类型创建成功', { name: formData.name });
      }
      setModalVisible(false);
      loadProductTypes();
    } catch (error) {
      productTypeLogger.error(editingItem ? '更新产品类型失败' : '创建产品类型失败', error as Error);
      const errorMessage = error instanceof Error ? error.message : '操作失败';
      Alert.alert('错误', editingItem ? `更新失败: ${errorMessage}` : `创建失败: ${errorMessage}`);
    }
  };

  const handleDelete = (item: ProductType) => {
    Alert.alert(
      '确认删除',
      `确定要删除产品类型"${item.name}"吗?`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await productTypeApiClient.deleteProductType(item.id, factoryId);
              Alert.alert('成功', '产品类型删除成功');
              productTypeLogger.info('产品类型删除成功', { id: item.id, name: item.name });
              loadProductTypes();
            } catch (error) {
              productTypeLogger.error('删除产品类型失败', error as Error, { id: item.id });
              const errorMessage = error instanceof Error ? error.message : '删除失败';
              Alert.alert('错误', errorMessage);
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (item: ProductType) => {
    try {
      await productTypeApiClient.updateProductType(
        item.id,
        { isActive: !item.isActive },
        factoryId
      );
      Alert.alert('成功', item.isActive ? '已停用' : '已启用');
      productTypeLogger.info('产品类型状态切换成功', {
        id: item.id,
        name: item.name,
        newStatus: !item.isActive,
      });
      loadProductTypes();
    } catch (error) {
      productTypeLogger.error('切换产品类型状态失败', error as Error, { id: item.id });
      const errorMessage = error instanceof Error ? error.message : '操作失败';
      Alert.alert('错误', errorMessage);
    }
  };

  const toggleEquipmentSelection = (eqId: string) => {
    setSkuConfig(prev => ({
      ...prev,
      equipmentIds: prev.equipmentIds.includes(eqId)
        ? prev.equipmentIds.filter(id => id !== eqId)
        : [...prev.equipmentIds, eqId],
    }));
  };

  const toggleQualityCheckSelection = (qcId: string) => {
    setSkuConfig(prev => ({
      ...prev,
      qualityCheckIds: prev.qualityCheckIds.includes(qcId)
        ? prev.qualityCheckIds.filter(id => id !== qcId)
        : [...prev.qualityCheckIds, qcId],
    }));
  };

  // 模板选择处理
  const handleTemplateSelect = useCallback((template: SkuTemplate) => {
    setSkuConfig({
      workHours: template.defaultWorkHours.toString(),
      processingSteps: template.processingSteps,
      skillRequirements: template.skillRequirements,
      equipmentIds: skuConfig.equipmentIds, // 保留现有设备选择
      qualityCheckIds: skuConfig.qualityCheckIds, // 保留现有质检项选择
      complexityScore: template.complexityScore,
    });
    productTypeLogger.info('应用SKU模板', { templateId: template.id, templateName: template.name });
  }, [skuConfig.equipmentIds, skuConfig.qualityCheckIds]);

  // 应用模板配置处理 (从 SkuTemplateSelector 的确认按钮)
  const handleApplyTemplate = useCallback((config: AppliedTemplateConfig) => {
    setSkuConfig(prev => ({
      ...prev,
      workHours: config.workHours.toString(),
      processingSteps: config.processingSteps,
      skillRequirements: config.skillRequirements,
      complexityScore: config.complexityScore,
    }));
    productTypeLogger.info('应用模板配置', {
      workHours: config.workHours,
      complexityScore: config.complexityScore,
      stepsCount: config.processingSteps.length,
    });
  }, []);

  // 语音配置确认处理
  const handleVoiceConfigConfirm = useCallback((extractedConfig: ExtractedSkuConfig) => {
    setSkuConfig(prev => ({
      ...prev,
      workHours: extractedConfig.workHours?.toString() || prev.workHours,
      processingSteps: extractedConfig.processingSteps || prev.processingSteps,
      skillRequirements: extractedConfig.skillRequirements
        ? {
            minLevel: extractedConfig.skillRequirements.minLevel || prev.skillRequirements.minLevel,
            preferredLevel: extractedConfig.skillRequirements.preferredLevel || prev.skillRequirements.preferredLevel,
            specialSkills: extractedConfig.skillRequirements.specialSkills || prev.skillRequirements.specialSkills,
          }
        : prev.skillRequirements,
      complexityScore: extractedConfig.complexityScore || prev.complexityScore,
    }));
    productTypeLogger.info('应用语音配置', {
      workHours: extractedConfig.workHours,
      stepsCount: extractedConfig.processingSteps?.length,
    });
  }, []);

  // 表单配置模态框处理
  const handleConfigSchema = (item: ProductType) => {
    setSchemaConfigItem(item);
    setSchemaConfig(item.customSchemaOverrides || null);
    setSchemaConfigModalVisible(true);
  };

  const handleSaveSchemaConfig = async (newConfig: CustomSchemaOverrides) => {
    if (!schemaConfigItem) return;

    await productTypeApiClient.updateCustomSchemaOverrides(
      schemaConfigItem.id,
      newConfig,
      factoryId
    );
    productTypeLogger.info('表单配置保存成功', {
      id: schemaConfigItem.id,
      name: schemaConfigItem.name,
      formTypes: Object.keys(newConfig),
    });
    loadProductTypes();
  };

  // 计算已配置的表单类型数量
  const getSchemaConfigCount = (item: ProductType): number => {
    if (!item.customSchemaOverrides) return 0;
    return Object.keys(item.customSchemaOverrides).filter(
      key => Object.keys(item.customSchemaOverrides?.[key as keyof CustomSchemaOverrides]?.properties || {}).length > 0
    ).length;
  };

  // 无权限界面
  if (!canManage) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="产品类型管理" />
        </Appbar.Header>
        <View style={styles.noPermission}>
          <List.Icon icon="lock" color="#999" />
          <Text style={styles.noPermissionText}>您没有权限访问此页面</Text>
          <Text style={styles.noPermissionHint}>仅限工厂超管、权限管理员和部门管理员</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="产品类型管理" />
        <Appbar.Action icon="refresh" onPress={loadProductTypes} />
      </Appbar.Header>

      {/* Content */}
      <ScrollView style={styles.content}>
        {/* Stats Card */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{productTypes.length}</Text>
                <Text style={styles.statLabel}>总数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {productTypes.filter(p => p.isActive).length}
                </Text>
                <Text style={styles.statLabel}>启用中</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {productTypes.filter(p => (p.processingSteps?.length ?? 0) > 0).length}
                </Text>
                <Text style={styles.statLabel}>已配置SKU</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Product Type List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : productTypes.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <List.Icon icon="information-outline" color="#999" />
              <Text style={styles.emptyText}>暂无产品类型</Text>
              <Text style={styles.emptyHint}>点击右下角"+"按钮添加产品类型</Text>
            </Card.Content>
          </Card>
        ) : (
          productTypes.map((item) => (
            <Card key={item.id} style={styles.itemCard}>
              <Card.Content>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Chip
                      mode="outlined"
                      compact
                      style={styles.codeChip}
                    >
                      {item.code}
                    </Chip>
                  </View>
                  <View style={styles.itemActions}>
                    <IconButton
                      icon={item.isActive ? 'eye' : 'eye-off'}
                      size={20}
                      onPress={() => handleToggleStatus(item)}
                    />
                    <IconButton
                      icon="pencil"
                      size={20}
                      onPress={() => handleEdit(item)}
                    />
                    <IconButton
                      icon="delete"
                      size={20}
                      onPress={() => handleDelete(item)}
                    />
                  </View>
                </View>

                <View style={styles.chipRow}>
                  {item.category && (
                    <Chip mode="outlined" compact style={styles.categoryChip}>
                      {item.category}
                    </Chip>
                  )}
                  {item.unit && (
                    <Chip mode="outlined" compact style={styles.unitChip}>
                      单位: {item.unit}
                    </Chip>
                  )}
                </View>

                {/* SKU Config Summary */}
                {(item.processingSteps?.length ?? 0) > 0 && (
                  <View style={styles.skuSummary}>
                    <View style={styles.skuChipRow}>
                      <Chip icon="cog" compact style={styles.skuChip}>
                        {item.processingSteps?.length || 0}个工序
                      </Chip>
                      {item.complexityScore && (
                        <Chip icon="star" compact style={styles.skuChip}>
                          复杂度 {item.complexityScore}
                        </Chip>
                      )}
                      {item.workHours && (
                        <Chip icon="clock" compact style={styles.skuChip}>
                          {item.workHours}h
                        </Chip>
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.itemFooter}>
                  <Chip
                    icon={item.isActive ? 'check-circle' : 'close-circle'}
                    mode="flat"
                    compact
                    style={[
                      styles.statusChip,
                      { backgroundColor: item.isActive ? '#E8F5E9' : '#FFEBEE' },
                    ]}
                    textStyle={{
                      color: item.isActive ? '#4CAF50' : '#F44336',
                    }}
                  >
                    {item.isActive ? '启用中' : '已停用'}
                  </Chip>
                  <View style={styles.configButtonsRow}>
                    <Button
                      mode="outlined"
                      compact
                      icon="form-select"
                      onPress={() => handleConfigSchema(item)}
                      style={styles.schemaConfigButton}
                    >
                      表单配置{getSchemaConfigCount(item) > 0 ? ` (${getSchemaConfigCount(item)})` : ''}
                    </Button>
                    <Button
                      mode="outlined"
                      compact
                      icon="cog"
                      onPress={() => handleConfigSku(item)}
                      style={styles.configButton}
                    >
                      配置SKU
                    </Button>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Add/Edit Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>
            {editingItem ? '编辑产品类型' : '添加产品类型'}
          </Text>

          {/* 产品名称 */}
          <TextInput
            label="产品名称 *"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            mode="outlined"
            style={styles.input}
            placeholder="例如: 带鱼"
          />

          {/* 编辑时显示产品代码(只读) */}
          {editingItem && (
            <TextInput
              label="产品代码 (自动生成)"
              value={editingItem.code}
              mode="outlined"
              style={styles.input}
              disabled
            />
          )}

          {/* 单位下拉菜单 */}
          <View style={styles.dropdownContainer}>
            <Text style={styles.dropdownLabel}>单位</Text>
            <Menu
              visible={unitMenuVisible}
              onDismiss={() => setUnitMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setUnitMenuVisible(true)}
                >
                  <Text style={styles.dropdownButtonText}>{formData.unit}</Text>
                  <List.Icon icon="chevron-down" />
                </TouchableOpacity>
              }
            >
              {UNIT_OPTIONS.map((unit) => (
                <Menu.Item
                  key={unit}
                  onPress={() => {
                    setFormData({ ...formData, unit });
                    setUnitMenuVisible(false);
                  }}
                  title={unit}
                />
              ))}
            </Menu>
          </View>

          {/* 分类下拉菜单 */}
          <View style={styles.dropdownContainer}>
            <Text style={styles.dropdownLabel}>分类</Text>
            <Menu
              visible={categoryMenuVisible}
              onDismiss={() => setCategoryMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setCategoryMenuVisible(true)}
                >
                  <Text style={styles.dropdownButtonText}>{formData.category}</Text>
                  <List.Icon icon="chevron-down" />
                </TouchableOpacity>
              }
            >
              {CATEGORY_OPTIONS.map((category) => (
                <Menu.Item
                  key={category}
                  onPress={() => {
                    setFormData({ ...formData, category });
                    setCategoryMenuVisible(false);
                  }}
                  title={category}
                />
              ))}
            </Menu>
          </View>

          {/* 提示信息 */}
          {!editingItem && (
            <Text style={styles.hintText}>产品代码将自动生成</Text>
          )}

          <View style={styles.modalActions}>
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
              {editingItem ? '更新' : '创建'}
            </Button>
          </View>
        </Modal>

        {/* SKU Config Modal */}
        <Modal
          visible={skuConfigModalVisible}
          onDismiss={() => setSkuConfigModalVisible(false)}
          contentContainerStyle={styles.skuModalContent}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>
              配置 SKU: {configItem?.name}
            </Text>

            {/* 模板快速选择 */}
            <SkuTemplateSelector
              onSelectTemplate={handleTemplateSelect}
              onApplyTemplate={handleApplyTemplate}
              selectedTemplateId={undefined}
              isEditMode={!!configItem?.workHours}
            />

            {loadingOptions ? (
              <ActivityIndicator style={{ marginVertical: 20 }} />
            ) : (
              <>
                {/* 工时配置 */}
                <View style={styles.configSection}>
                  <Text style={styles.sectionTitle}>工时配置</Text>
                  <TextInput
                    label="标准工时 (小时)"
                    value={skuConfig.workHours}
                    onChangeText={(text) => setSkuConfig({ ...skuConfig, workHours: text })}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    placeholder="例如: 2.5"
                    style={styles.input}
                  />
                </View>

                <Divider style={styles.divider} />

                {/* 复杂度评分 */}
                <View style={styles.configSection}>
                  <Text style={styles.sectionTitle}>复杂度评分 (LinUCB 特征)</Text>
                  <View style={styles.dropdownContainer}>
                    <Menu
                      visible={complexityMenuVisible}
                      onDismiss={() => setComplexityMenuVisible(false)}
                      anchor={
                        <TouchableOpacity
                          style={styles.dropdownButton}
                          onPress={() => setComplexityMenuVisible(true)}
                        >
                          <Text style={styles.dropdownButtonText}>
                            {COMPLEXITY_OPTIONS.find(o => o.value === skuConfig.complexityScore)?.label || `${skuConfig.complexityScore}`}
                          </Text>
                          <List.Icon icon="chevron-down" />
                        </TouchableOpacity>
                      }
                    >
                      {COMPLEXITY_OPTIONS.map((option) => (
                        <Menu.Item
                          key={option.value}
                          onPress={() => {
                            setSkuConfig({ ...skuConfig, complexityScore: option.value });
                            setComplexityMenuVisible(false);
                          }}
                          title={option.label}
                        />
                      ))}
                    </Menu>
                  </View>
                </View>

                <Divider style={styles.divider} />

                {/* 加工步骤 */}
                <View style={styles.configSection}>
                  <Text style={styles.sectionTitle}>加工步骤</Text>
                  <ProcessingStepsEditor
                    value={skuConfig.processingSteps}
                    onChange={(steps) => setSkuConfig({ ...skuConfig, processingSteps: steps })}
                    label=""
                  />
                </View>

                <Divider style={styles.divider} />

                {/* 技能要求 */}
                <View style={styles.configSection}>
                  <Text style={styles.sectionTitle}>技能要求</Text>
                  <View style={styles.skillRow}>
                    <View style={styles.skillInput}>
                      <TextInput
                        label="最低等级"
                        value={skuConfig.skillRequirements.minLevel?.toString() || '1'}
                        onChangeText={(text) => {
                          const val = parseInt(text) || 1;
                          setSkuConfig({
                            ...skuConfig,
                            skillRequirements: { ...skuConfig.skillRequirements, minLevel: Math.min(5, Math.max(1, val)) },
                          });
                        }}
                        mode="outlined"
                        keyboardType="number-pad"
                        style={styles.halfInput}
                      />
                    </View>
                    <View style={styles.skillInput}>
                      <TextInput
                        label="建议等级"
                        value={skuConfig.skillRequirements.preferredLevel?.toString() || '3'}
                        onChangeText={(text) => {
                          const val = parseInt(text) || 3;
                          setSkuConfig({
                            ...skuConfig,
                            skillRequirements: { ...skuConfig.skillRequirements, preferredLevel: Math.min(5, Math.max(1, val)) },
                          });
                        }}
                        mode="outlined"
                        keyboardType="number-pad"
                        style={styles.halfInput}
                      />
                    </View>
                  </View>
                  <Text style={styles.hintText}>等级范围 1-5</Text>
                </View>

                <Divider style={styles.divider} />

                {/* 关联设备 */}
                <View style={styles.configSection}>
                  <Text style={styles.sectionTitle}>关联设备</Text>
                  {equipmentList.length === 0 ? (
                    <Text style={styles.emptyListText}>暂无可用设备</Text>
                  ) : (
                    <View style={styles.selectionList}>
                      {equipmentList.slice(0, 10).map((eq) => {
                        const eqId = eq.id?.toString() || '';
                        const isSelected = skuConfig.equipmentIds.includes(eqId);
                        return (
                          <Chip
                            key={eqId}
                            mode={isSelected ? 'flat' : 'outlined'}
                            selected={isSelected}
                            onPress={() => toggleEquipmentSelection(eqId)}
                            style={styles.selectChip}
                            icon={isSelected ? 'check' : 'plus'}
                          >
                            {eq.equipmentName || eq.name || eq.code}
                          </Chip>
                        );
                      })}
                    </View>
                  )}
                </View>

                <Divider style={styles.divider} />

                {/* 关联质检项 */}
                <View style={styles.configSection}>
                  <Text style={styles.sectionTitle}>关联质检项</Text>
                  {qualityCheckList.length === 0 ? (
                    <Text style={styles.emptyListText}>暂无可用质检项</Text>
                  ) : (
                    <View style={styles.selectionList}>
                      {qualityCheckList.slice(0, 10).map((qc) => {
                        const isSelected = skuConfig.qualityCheckIds.includes(qc.id);
                        return (
                          <Chip
                            key={qc.id}
                            mode={isSelected ? 'flat' : 'outlined'}
                            selected={isSelected}
                            onPress={() => toggleQualityCheckSelection(qc.id)}
                            style={styles.selectChip}
                            icon={isSelected ? 'check' : 'plus'}
                          >
                            {qc.itemName}
                          </Chip>
                        );
                      })}
                    </View>
                  )}
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setSkuConfigModalVisible(false)}
                style={styles.modalButton}
                disabled={savingConfig}
              >
                取消
              </Button>
              <Button
                mode="contained"
                onPress={handleSaveSkuConfig}
                style={styles.modalButton}
                loading={savingConfig}
                disabled={savingConfig}
              >
                保存配置
              </Button>
            </View>
          </ScrollView>

          {/* SKU 语音配置 FAB - 在 Modal 内部显示 */}
          <SkuVoiceFAB
            visible={true}
            isEditMode={!!configItem?.workHours}
            position="left"
          />
        </Modal>
      </Portal>

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAdd}
        label="添加产品类型"
      />

      {/* SKU 语音配置对话框 */}
      <SkuVoiceDialog
        onConfirm={handleVoiceConfigConfirm}
        onCancel={() => {}}
      />

      {/* 表单配置模态框 */}
      <ProductTypeSchemaConfigModal
        visible={schemaConfigModalVisible}
        productTypeId={schemaConfigItem?.id || ''}
        productTypeName={schemaConfigItem?.name || ''}
        initialConfig={schemaConfig}
        onDismiss={() => {
          setSchemaConfigModalVisible(false);
          setSchemaConfigItem(null);
          setSchemaConfig(null);
        }}
        onSave={handleSaveSchemaConfig}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  noPermission: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noPermissionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  noPermissionHint: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  statsCard: {
    margin: 16,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  emptyCard: {
    margin: 16,
  },
  emptyContent: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
  },
  itemCard: {
    margin: 16,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  codeChip: {
    height: 31,
  },
  itemActions: {
    flexDirection: 'row',
    marginLeft: 8,
    marginTop: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  categoryChip: {
    height: 31,
  },
  unitChip: {
    height: 31,
    backgroundColor: '#E3F2FD',
  },
  skuSummary: {
    marginBottom: 8,
  },
  skuChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skuChip: {
    height: 28,
    backgroundColor: '#FFF3E0',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusChip: {
    height: 31,
  },
  configButton: {
    borderColor: '#FF9800',
  },
  configButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  schemaConfigButton: {
    borderColor: '#1976D2',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  skuModalContent: {
    backgroundColor: 'white',
    padding: 20,
    margin: 16,
    marginVertical: 40,
    borderRadius: 8,
    maxHeight: '90%',
    minHeight: 400,
    position: 'relative',
    overflow: 'visible',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
  },
  halfInput: {
    flex: 1,
  },
  dropdownContainer: {
    marginBottom: 16,
  },
  dropdownLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
  },
  hintText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    minWidth: 100,
  },
  bottomPadding: {
    height: 80,
  },
  configSection: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  divider: {
    marginVertical: 16,
  },
  skillRow: {
    flexDirection: 'row',
    gap: 16,
  },
  skillInput: {
    flex: 1,
  },
  selectionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectChip: {
    marginBottom: 4,
  },
  emptyListText: {
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
