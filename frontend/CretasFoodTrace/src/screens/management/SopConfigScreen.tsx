import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal as RNModal,
} from 'react-native';
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
import {
  sopConfigApiClient,
  SopConfig,
  SopStep,
  PhotoConfig,
  ValidationRulesConfig,
} from '../../services/api/sopConfigApiClient';
import { productTypeApiClient } from '../../services/api/productTypeApiClient';
import { useAuthStore } from '../../store/authStore';
import { getFactoryId } from '../../types/auth';
import { logger } from '../../utils/logger';
import { canManageBasicData } from '../../utils/permissionHelper';
import { SopStepsEditor } from '../../components/sop';

// 创建专用logger
const sopLogger = logger.createContextLogger('SopConfig');

// 实体类型选项
const ENTITY_TYPE_OPTIONS = [
  { value: 'PRODUCTION_BATCH', label: '生产批次' },
  { value: 'MATERIAL_BATCH', label: '原料批次' },
  { value: 'QUALITY_CHECK', label: '质检' },
  { value: 'PACKAGING', label: '包装' },
] as const;

/**
 * SOP 配置管理界面
 * Sprint 4 任务: S4-2
 */
export default function SopConfigScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const factoryId = getFactoryId(user);
  const [sopConfigs, setSopConfigs] = useState<SopConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<SopConfig | null>(null);

  // 步骤配置 Modal
  const [stepsModalVisible, setStepsModalVisible] = useState(false);
  const [configItem, setConfigItem] = useState<SopConfig | null>(null);
  const [savingSteps, setSavingSteps] = useState(false);

  // 产品类型列表
  const [productTypes, setProductTypes] = useState<
    Array<{ id: string; name: string; code: string }>
  >([]);
  const [loadingProductTypes, setLoadingProductTypes] = useState(false);

  // 下拉菜单状态
  const [entityTypeMenuVisible, setEntityTypeMenuVisible] = useState(false);
  const [productTypeMenuVisible, setProductTypeMenuVisible] = useState(false);

  // 权限检查
  const canManage = canManageBasicData(user);

  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    entityType: 'PRODUCTION_BATCH',
    productTypeId: '',
  });

  // 步骤配置状态
  const [stepsConfig, setStepsConfig] = useState<{
    steps: SopStep[];
    photoConfig: PhotoConfig;
  }>({
    steps: [],
    photoConfig: {
      required: false,
      stages: [],
      minPhotosPerStage: 1,
      maxPhotosPerStage: 5,
    },
  });

  useEffect(() => {
    loadSopConfigs();
    loadProductTypes();
  }, []);

  const loadSopConfigs = async () => {
    try {
      setLoading(true);

      if (!factoryId) {
        sopLogger.warn('工厂ID不存在', { userType: user?.userType });
        Alert.alert('错误', '无法获取工厂信息，请重新登录');
        return;
      }

      sopLogger.debug('获取SOP配置列表', { factoryId });
      const response = await sopConfigApiClient.getSopConfigs({ factoryId });

      if (response?.content) {
        sopLogger.info('SOP配置列表加载成功', {
          sopConfigCount: response.content.length,
          factoryId,
        });
        setSopConfigs(response.content);
      } else {
        sopLogger.warn('API返回数据为空', { factoryId });
        setSopConfigs([]);
      }
    } catch (error: unknown) {
      sopLogger.error('加载SOP配置失败', error as Error, { factoryId });
      const errorMessage =
        error instanceof Error ? error.message : '加载SOP配置失败';
      Alert.alert('错误', errorMessage);
      setSopConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProductTypes = async () => {
    if (!factoryId) return;

    setLoadingProductTypes(true);
    try {
      const response = await productTypeApiClient.getProductTypes({
        factoryId,
        isActive: true,
      });

      if (response?.data) {
        const mappedTypes = response.data.map((item: any) => ({
          id: item.id,
          name: item.name,
          code: item.productCode || item.code || '',
        }));
        setProductTypes(mappedTypes);
      }
    } catch (error) {
      sopLogger.error('加载产品类型失败', error as Error);
    } finally {
      setLoadingProductTypes(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      entityType: 'PRODUCTION_BATCH',
      productTypeId: '',
    });
    setModalVisible(true);
  };

  const handleEdit = (item: SopConfig) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      code: item.code,
      description: item.description || '',
      entityType: item.entityType,
      productTypeId: item.productTypeId || '',
    });
    setModalVisible(true);
  };

  const handleConfigSteps = (item: SopConfig) => {
    setConfigItem(item);
    setStepsConfig({
      steps: item.steps || [],
      photoConfig: item.photoConfig || {
        required: false,
        stages: [],
        minPhotosPerStage: 1,
        maxPhotosPerStage: 5,
      },
    });
    setStepsModalVisible(true);
  };

  const handleSaveSteps = async () => {
    if (!configItem) return;

    setSavingSteps(true);
    try {
      const config = {
        steps: stepsConfig.steps,
        photoConfig: stepsConfig.photoConfig,
      };

      await sopConfigApiClient.updateSopConfig(configItem.id, config, factoryId);
      Alert.alert('成功', 'SOP步骤配置已保存');
      sopLogger.info('SOP步骤配置保存成功', {
        id: configItem.id,
        name: configItem.name,
      });
      setStepsModalVisible(false);
      loadSopConfigs();
    } catch (error) {
      sopLogger.error('保存SOP步骤配置失败', error as Error, {
        id: configItem.id,
      });
      const errorMessage = error instanceof Error ? error.message : '保存失败';
      Alert.alert('错误', errorMessage);
    } finally {
      setSavingSteps(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('提示', 'SOP名称不能为空');
      return;
    }

    if (!formData.entityType) {
      Alert.alert('提示', '请选择关联实体类型');
      return;
    }

    try {
      const requestData = {
        name: formData.name.trim(),
        code: formData.code.trim() || undefined,
        description: formData.description.trim() || undefined,
        entityType: formData.entityType,
        productTypeId: formData.productTypeId || undefined,
      };

      if (editingItem) {
        // 更新
        await sopConfigApiClient.updateSopConfig(
          editingItem.id,
          requestData,
          factoryId
        );
        Alert.alert('成功', 'SOP配置更新成功');
        sopLogger.info('SOP配置更新成功', {
          id: editingItem.id,
          name: formData.name,
        });
      } else {
        // 创建
        await sopConfigApiClient.createSopConfig(requestData, factoryId);
        Alert.alert('成功', 'SOP配置创建成功');
        sopLogger.info('SOP配置创建成功', { name: formData.name });
      }
      setModalVisible(false);
      loadSopConfigs();
    } catch (error) {
      sopLogger.error(
        editingItem ? '更新SOP配置失败' : '创建SOP配置失败',
        error as Error
      );
      const errorMessage = error instanceof Error ? error.message : '操作失败';
      Alert.alert(
        '错误',
        editingItem ? `更新失败: ${errorMessage}` : `创建失败: ${errorMessage}`
      );
    }
  };

  const handleDelete = (item: SopConfig) => {
    Alert.alert('确认删除', `确定要删除SOP配置"${item.name}"吗?`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await sopConfigApiClient.deleteSopConfig(item.id, factoryId);
            Alert.alert('成功', 'SOP配置删除成功');
            sopLogger.info('SOP配置删除成功', { id: item.id, name: item.name });
            loadSopConfigs();
          } catch (error) {
            sopLogger.error('删除SOP配置失败', error as Error, { id: item.id });
            const errorMessage =
              error instanceof Error ? error.message : '删除失败';
            Alert.alert('错误', errorMessage);
          }
        },
      },
    ]);
  };

  const handleToggleStatus = async (item: SopConfig) => {
    try {
      await sopConfigApiClient.toggleSopConfigStatus(
        item.id,
        !item.isActive,
        factoryId
      );
      Alert.alert('成功', item.isActive ? '已禁用' : '已启用');
      sopLogger.info('SOP配置状态切换成功', {
        id: item.id,
        name: item.name,
        newStatus: !item.isActive,
      });
      loadSopConfigs();
    } catch (error) {
      sopLogger.error('切换SOP配置状态失败', error as Error, { id: item.id });
      const errorMessage = error instanceof Error ? error.message : '操作失败';
      Alert.alert('错误', errorMessage);
    }
  };

  const getEntityTypeLabel = (entityType: string) => {
    const option = ENTITY_TYPE_OPTIONS.find((o) => o.value === entityType);
    return option?.label || entityType;
  };

  const getProductTypeName = (productTypeId?: string) => {
    if (!productTypeId) return '通用';
    const product = productTypes.find((p) => p.id === productTypeId);
    return product?.name || productTypeId;
  };

  // 按产品类型分组
  const groupedConfigs = sopConfigs.reduce((acc, config) => {
    const key = config.productTypeId || 'general';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(config);
    return acc;
  }, {} as Record<string, SopConfig[]>);

  // 无权限界面
  if (!canManage) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="SOP 配置管理" />
        </Appbar.Header>
        <View style={styles.noPermission}>
          <List.Icon icon="lock" color="#999" />
          <Text style={styles.noPermissionText}>您没有权限访问此页面</Text>
          <Text style={styles.noPermissionHint}>
            仅限工厂超管、权限管理员和部门管理员
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="SOP 配置管理" />
        <Appbar.Action icon="refresh" onPress={loadSopConfigs} />
      </Appbar.Header>

      {/* Content */}
      <ScrollView style={styles.content}>
        {/* Stats Card */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{sopConfigs.length}</Text>
                <Text style={styles.statLabel}>总数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {sopConfigs.filter((s) => s.isActive).length}
                </Text>
                <Text style={styles.statLabel}>启用中</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {sopConfigs.filter((s) => (s.steps?.length ?? 0) > 0).length}
                </Text>
                <Text style={styles.statLabel}>已配置步骤</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* SOP List - Grouped by Product Type */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : sopConfigs.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <List.Icon icon="information-outline" color="#999" />
              <Text style={styles.emptyText}>暂无SOP配置</Text>
              <Text style={styles.emptyHint}>
                点击右下角"+"按钮添加SOP配置
              </Text>
            </Card.Content>
          </Card>
        ) : (
          Object.entries(groupedConfigs).map(([key, configs]) => (
            <View key={key} style={styles.groupSection}>
              <Text style={styles.groupTitle}>
                {key === 'general'
                  ? '通用SOP配置'
                  : `${getProductTypeName(key)} - SOP配置`}
              </Text>
              {configs.map((item) => (
                <Card key={item.id} style={styles.itemCard}>
                  <Card.Content>
                    <View style={styles.itemHeader}>
                      <View style={styles.itemTitleRow}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Chip mode="outlined" compact style={styles.codeChip}>
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

                    {item.description && (
                      <Text style={styles.itemDescription}>
                        {item.description}
                      </Text>
                    )}

                    <View style={styles.chipRow}>
                      <Chip mode="outlined" compact style={styles.entityChip}>
                        {getEntityTypeLabel(item.entityType)}
                      </Chip>
                      {item.productTypeId && (
                        <Chip mode="outlined" compact style={styles.productChip}>
                          {getProductTypeName(item.productTypeId)}
                        </Chip>
                      )}
                      <Chip mode="outlined" compact style={styles.versionChip}>
                        v{item.version}
                      </Chip>
                    </View>

                    {/* SOP 步骤摘要 */}
                    {(item.steps?.length ?? 0) > 0 && (
                      <View style={styles.stepsSummary}>
                        <View style={styles.stepsChipRow}>
                          <Chip icon="cog" compact style={styles.stepsChip}>
                            {item.steps?.length || 0}个步骤
                          </Chip>
                          {item.photoConfig?.required && (
                            <Chip icon="camera" compact style={styles.stepsChip}>
                              需拍照
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
                          {
                            backgroundColor: item.isActive
                              ? '#E8F5E9'
                              : '#FFEBEE',
                          },
                        ]}
                        textStyle={{
                          color: item.isActive ? '#4CAF50' : '#F44336',
                        }}
                      >
                        {item.isActive ? '启用中' : '已禁用'}
                      </Chip>
                      <Button
                        mode="outlined"
                        compact
                        icon="cog"
                        onPress={() => handleConfigSteps(item)}
                        style={styles.configButton}
                      >
                        配置步骤
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              ))}
            </View>
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
            {editingItem ? '编辑SOP配置' : '添加SOP配置'}
          </Text>

          <ScrollView style={styles.modalForm}>
            {/* SOP 名称 */}
            <TextInput
              label="SOP 名称 *"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              mode="outlined"
              style={styles.input}
              placeholder="例如: 带鱼加工标准流程"
            />

            {/* SOP 编码 */}
            <TextInput
              label="SOP 编码"
              value={formData.code}
              onChangeText={(text) => setFormData({ ...formData, code: text })}
              mode="outlined"
              style={styles.input}
              placeholder="例如: SOP-FISH-001 (留空自动生成)"
            />

            {/* SOP 描述 */}
            <TextInput
              label="描述"
              value={formData.description}
              onChangeText={(text) =>
                setFormData({ ...formData, description: text })
              }
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={3}
              placeholder="描述SOP的用途和适用范围"
            />

            {/* 实体类型下拉菜单 */}
            <View style={styles.dropdownContainer}>
              <Text style={styles.dropdownLabel}>关联实体类型 *</Text>
              <Menu
                visible={entityTypeMenuVisible}
                onDismiss={() => setEntityTypeMenuVisible(false)}
                anchor={
                  <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => setEntityTypeMenuVisible(true)}
                  >
                    <Text style={styles.dropdownButtonText}>
                      {getEntityTypeLabel(formData.entityType)}
                    </Text>
                    <List.Icon icon="chevron-down" />
                  </TouchableOpacity>
                }
              >
                {ENTITY_TYPE_OPTIONS.map((option) => (
                  <Menu.Item
                    key={option.value}
                    onPress={() => {
                      setFormData({ ...formData, entityType: option.value });
                      setEntityTypeMenuVisible(false);
                    }}
                    title={option.label}
                  />
                ))}
              </Menu>
            </View>

            {/* 产品类型下拉菜单 */}
            <View style={styles.dropdownContainer}>
              <Text style={styles.dropdownLabel}>
                关联产品类型 (可选，留空则适用于所有产品)
              </Text>
              <Menu
                visible={productTypeMenuVisible}
                onDismiss={() => setProductTypeMenuVisible(false)}
                anchor={
                  <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => setProductTypeMenuVisible(true)}
                    disabled={loadingProductTypes}
                  >
                    <Text style={styles.dropdownButtonText}>
                      {loadingProductTypes
                        ? '加载中...'
                        : getProductTypeName(formData.productTypeId)}
                    </Text>
                    <List.Icon icon="chevron-down" />
                  </TouchableOpacity>
                }
              >
                <Menu.Item
                  onPress={() => {
                    setFormData({ ...formData, productTypeId: '' });
                    setProductTypeMenuVisible(false);
                  }}
                  title="通用 (适用所有产品)"
                />
                <Divider />
                {productTypes.map((product) => (
                  <Menu.Item
                    key={product.id}
                    onPress={() => {
                      setFormData({ ...formData, productTypeId: product.id });
                      setProductTypeMenuVisible(false);
                    }}
                    title={`${product.name} (${product.code})`}
                  />
                ))}
              </Menu>
            </View>
          </ScrollView>

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

        {/* Steps Config Modal */}
        <Modal
          visible={stepsModalVisible}
          onDismiss={() => setStepsModalVisible(false)}
          contentContainerStyle={styles.stepsModalContent}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>
              配置 SOP 步骤: {configItem?.name}
            </Text>

            {/* 加工步骤配置 */}
            <View style={styles.configSection}>
              <SopStepsEditor
                value={stepsConfig.steps}
                onChange={(steps) =>
                  setStepsConfig({
                    ...stepsConfig,
                    steps,
                  })
                }
                label="SOP 加工步骤"
              />
            </View>

            <Divider style={styles.divider} />

            {/* 拍照配置 */}
            <View style={styles.configSection}>
              <Text style={styles.sectionTitle}>拍照证据配置</Text>
              <SegmentedButtons
                value={stepsConfig.photoConfig.required ? 'required' : 'optional'}
                onValueChange={(value) =>
                  setStepsConfig({
                    ...stepsConfig,
                    photoConfig: {
                      ...stepsConfig.photoConfig,
                      required: value === 'required',
                    },
                  })
                }
                buttons={[
                  { value: 'optional', label: '可选' },
                  { value: 'required', label: '必需' },
                ]}
                style={styles.segmentedButtons}
              />

              {stepsConfig.photoConfig.required && (
                <>
                  <View style={styles.photoConfigRow}>
                    <View style={styles.photoConfigInput}>
                      <TextInput
                        label="最少照片数"
                        value={
                          stepsConfig.photoConfig.minPhotosPerStage?.toString() ||
                          '1'
                        }
                        onChangeText={(text) => {
                          const val = parseInt(text) || 1;
                          setStepsConfig({
                            ...stepsConfig,
                            photoConfig: {
                              ...stepsConfig.photoConfig,
                              minPhotosPerStage: Math.max(1, val),
                            },
                          });
                        }}
                        mode="outlined"
                        keyboardType="number-pad"
                        style={styles.halfInput}
                      />
                    </View>
                    <View style={styles.photoConfigInput}>
                      <TextInput
                        label="最多照片数"
                        value={
                          stepsConfig.photoConfig.maxPhotosPerStage?.toString() ||
                          '5'
                        }
                        onChangeText={(text) => {
                          const val = parseInt(text) || 5;
                          setStepsConfig({
                            ...stepsConfig,
                            photoConfig: {
                              ...stepsConfig.photoConfig,
                              maxPhotosPerStage: Math.max(1, val),
                            },
                          });
                        }}
                        mode="outlined"
                        keyboardType="number-pad"
                        style={styles.halfInput}
                      />
                    </View>
                  </View>
                  <Text style={styles.hintText}>
                    每个加工步骤需要拍摄{' '}
                    {stepsConfig.photoConfig.minPhotosPerStage}-
                    {stepsConfig.photoConfig.maxPhotosPerStage} 张照片作为证据
                  </Text>
                </>
              )}
            </View>

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setStepsModalVisible(false)}
                style={styles.modalButton}
                disabled={savingSteps}
              >
                取消
              </Button>
              <Button
                mode="contained"
                onPress={handleSaveSteps}
                style={styles.modalButton}
                loading={savingSteps}
                disabled={savingSteps}
              >
                保存配置
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAdd}
        label="添加SOP配置"
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
  groupSection: {
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  itemCard: {
    margin: 16,
    marginTop: 8,
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
    height: 28,
  },
  itemActions: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  entityChip: {
    height: 28,
    backgroundColor: '#E3F2FD',
  },
  productChip: {
    height: 28,
    backgroundColor: '#FFF3E0',
  },
  versionChip: {
    height: 28,
  },
  stepsSummary: {
    marginBottom: 8,
  },
  stepsChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stepsChip: {
    height: 26,
    backgroundColor: '#E8F5E9',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusChip: {
    height: 28,
  },
  configButton: {
    borderColor: '#FF9800',
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
    maxHeight: '85%',
  },
  stepsModalContent: {
    backgroundColor: 'white',
    padding: 20,
    margin: 16,
    marginVertical: 40,
    borderRadius: 8,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  modalForm: {
    maxHeight: 400,
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
  segmentedButtons: {
    marginBottom: 12,
  },
  photoConfigRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  photoConfigInput: {
    flex: 1,
  },
  hintText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 8,
  },
});
