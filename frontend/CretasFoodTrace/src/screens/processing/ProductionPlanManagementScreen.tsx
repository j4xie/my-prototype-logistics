import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  FAB,
  Card,
  Chip,
  IconButton,
  Portal,
  Modal,
  TextInput,
  Button,
  ActivityIndicator,
  Divider,
  List,
  SegmentedButtons,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Picker } from '@react-native-picker/picker';
import { productionPlanApiClient, ProductionPlan as ApiProductionPlan } from '../../services/api/productionPlanApiClient';
import { productTypeApiClient } from '../../services/api/productTypeApiClient';
import { customerApiClient } from '../../services/api/customerApiClient';
import { conversionApiClient } from '../../services/api/conversionApiClient';
import { useAuthStore } from '../../store/authStore';
import { ProcessingStackParamList } from '../../types/navigation';
import { ProductTypeSelector } from '../../components/common/ProductTypeSelector';
import { CustomerSelector } from '../../components/common/CustomerSelector';
import { MaterialBatchSelector, SelectedBatch, AvailableBatch } from '../../components/common/MaterialBatchSelector';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建ProductionPlanManagement专用logger
const productionPlanLogger = logger.createContextLogger('ProductionPlanManagement');

type ProductionPlan = ApiProductionPlan;
type NavigationProp = NativeStackNavigationProp<ProcessingStackParamList>;

/**
 * 生产计划管理页面
 */
export default function ProductionPlanManagementScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  // 权限控制
  const userType = user?.userType || 'factory';
  // 修复：优先使用 factoryUser.role，然后是 roleCode
  const roleCode = user?.factoryUser?.role || user?.factoryUser?.roleCode || user?.roleCode || 'viewer';

  // 平台管理员只读权限
  const isReadOnly = userType === 'platform';

  // 可以创建生产计划的角色
  const canCreatePlan = ['factory_super_admin', 'department_admin'].includes(roleCode) && !isReadOnly;

  // 调试日志
  productionPlanLogger.debug('权限检查', {
    userType,
    roleCode,
    isReadOnly,
    canCreatePlan,
    factoryUserRole: user?.factoryUser?.role,
  });

  // 下拉选项
  const [productTypes, setProductTypes] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [availableStock, setAvailableStock] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    productTypeId: '',
    productTypeName: '',
    productTypeCode: '',
    customerId: '',
    customerName: '',
    plannedQuantity: '',
    notes: '',
  });

  // 批次选择相关状态
  const [materialTypeId, setMaterialTypeId] = useState('');
  const [materialTypeName, setMaterialTypeName] = useState('');
  const [availableBatches, setAvailableBatches] = useState<AvailableBatch[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<SelectedBatch[]>([]);
  const [estimatedUsage, setEstimatedUsage] = useState<number | null>(null);
  const [conversionRate, setConversionRate] = useState<number | null>(null);
  const [wastageRate, setWastageRate] = useState<number | null>(null);

  useEffect(() => {
    loadPlans();
    loadOptions();
  }, []);

  useEffect(() => {
    // 当筛选状态变化时重新加载数据
    loadPlans();
  }, [filterStatus]);

  // 当产品类型变化时，加载对应的原料库存
  useEffect(() => {
    if (formData.productTypeId) {
      loadMaterialStock(formData.productTypeId);
    } else {
      // 清空批次相关数据
      setMaterialTypeId('');
      setMaterialTypeName('');
      setAvailableBatches([]);
      setSelectedBatches([]);
      setAvailableStock([]);
    }
  }, [formData.productTypeId]);

  // 当计划产量变化时，计算预估消耗
  useEffect(() => {
    if (formData.productTypeId && formData.plannedQuantity) {
      calculateRealEstimate();
    } else {
      setEstimatedUsage(null);
    }
  }, [formData.productTypeId, formData.plannedQuantity]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await productionPlanApiClient.getProductionPlans({
        page: 1,
        limit: 100,
        ...(filterStatus !== 'all' && { status: filterStatus }),
      });

      if (response.success && response.data) {
        // 安全地访问 plans 数组
        const plansData = response.data.plans || response.data || [];
        setPlans(Array.isArray(plansData) ? plansData : []);
      } else {
        setPlans([]);
      }
    } catch (error) {
      productionPlanLogger.error('加载生产计划失败', error, { filterStatus });
      Alert.alert('错误', error.response?.data?.message || '加载生产计划失败');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const [productsRes, customersRes, stockRes] = await Promise.all([
        productTypeApiClient.getProductTypes({ isActive: true, limit: 100 }),
        customerApiClient.getCustomers({ isActive: true }),
        productionPlanApiClient.getAvailableStock(),
      ]);

      if (productsRes.success && productsRes.data) {
        const productTypesData = productsRes.data.productTypes || productsRes.data || [];
        setProductTypes(Array.isArray(productTypesData) ? productTypesData : []);
      }

      if (customersRes.success && customersRes.data) {
        const customersData = customersRes.data.customers || customersRes.data || [];
        setCustomers(Array.isArray(customersData) ? customersData : []);
      }

      if (stockRes.success && stockRes.data) {
        // 转换库存汇总数据为界面需要的格式
        const summary = stockRes.data.summary || [];
        const summaryData = Array.isArray(summary) 
          ? summary.map(item => ({
              category: item.category,
              available: item.totalAvailable,
              batchCount: item.batchCount,
            }))
          : [];
        setAvailableStock(summaryData);
      }
    } catch (error) {
      productionPlanLogger.error('加载选项失败', error);
    }
  };

  // 加载原料库存（当产品类型变化时）
  const loadMaterialStock = async (productTypeId: string) => {
    try {
      productionPlanLogger.debug('加载产品对应的原料库存', { productTypeId });

      const stockRes = await productionPlanApiClient.getAvailableStock({ productTypeId });

      if (stockRes.success && stockRes.data) {
        const { materialType, batches, totalAvailable, conversionRate, wastageRate } = stockRes.data;

        if (materialType) {
          setMaterialTypeId(materialType.id);
          setMaterialTypeName(materialType.name);
          setConversionRate(conversionRate);
          setWastageRate(wastageRate);

          // 转换为AvailableBatch格式
          const formattedBatches: AvailableBatch[] = batches.map((b: any) => ({
            id: b.id,
            batchNumber: b.batchNumber,
            materialType: b.materialType,
            supplier: b.supplier,
            remainingQuantity: b.remainingQuantity,
            reservedQuantity: b.reservedQuantity,
            unitPrice: b.unitPrice,
            inboundDate: b.inboundDate,
            expiryDate: b.expiryDate,
            qualityGrade: b.qualityGrade,
          }));

          setAvailableBatches(formattedBatches);

          // 更新库存显示
          setAvailableStock([{
            category: materialType.name,
            available: totalAvailable,
            batchCount: batches.length,
          }]);

          productionPlanLogger.info('原料库存加载成功', {
            materialTypeName: materialType.name,
            batchCount: batches.length,
            totalAvailable,
          });
        } else {
          // 未配置转换率
          setMaterialTypeId('');
          setMaterialTypeName('');
          setAvailableBatches([]);
          setAvailableStock([]);
          Alert.alert('提示', '该产品未配置转换率，请先在转换率管理中配置');
        }
      }
    } catch (error) {
      productionPlanLogger.error('加载原料库存失败', error, { productTypeId });
      Alert.alert('错误', error.response?.data?.message || '加载原料库存失败');
    }
  };

  // 计算真实的预估消耗（使用后端API）
  const calculateRealEstimate = async () => {
    if (!formData.productTypeId || !formData.plannedQuantity) {
      return;
    }

    try {
      const result = await conversionApiClient.estimateMaterialUsage({
        productTypeId: formData.productTypeId,
        plannedQuantity: parseFloat(formData.plannedQuantity),
      });

      if (result.success && result.data) {
        setEstimatedUsage(result.data.estimatedUsage);
        setConversionRate(result.data.conversionRate);
        setWastageRate(result.data.wastageRate);

        productionPlanLogger.info('预估计算完成', {
          plannedQuantity: result.data.plannedQuantity,
          conversionRate: `${result.data.conversionRate}%`,
          wastageRate: `${result.data.wastageRate}%`,
          estimatedUsage: `${result.data.estimatedUsage}kg`,
        });
      }
    } catch (error) {
      productionPlanLogger.error('预估计算失败', error, {
        productTypeId: formData.productTypeId,
        plannedQuantity: formData.plannedQuantity,
      });
      // 降级：使用简单估算
      const quantity = parseFloat(formData.plannedQuantity);
      const fallbackRate = 0.57;
      const fallbackWastage = 0.05;
      const estimated = (quantity / fallbackRate) * (1 + fallbackWastage);
      setEstimatedUsage(parseFloat(estimated.toFixed(2)));
    }
  };

  const handleAdd = () => {
    setFormData({
      productTypeId: '',
      productTypeName: '',
      productTypeCode: '',
      customerId: '',
      customerName: '',
      plannedQuantity: '',
      notes: '',
    });
    // 清空批次选择相关数据
    setMaterialTypeId('');
    setMaterialTypeName('');
    setAvailableBatches([]);
    setSelectedBatches([]);
    setEstimatedUsage(null);
    setConversionRate(null);
    setWastageRate(null);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.productTypeId || !formData.customerId || !formData.plannedQuantity) {
      Alert.alert('提示', '产品类型、客户和计划产量不能为空');
      return;
    }

    // 验证批次选择（可选验证）
    if (estimatedUsage && selectedBatches.length > 0) {
      const totalSelected = selectedBatches.reduce((sum, b) => sum + b.allocatedQuantity, 0);
      if (totalSelected < estimatedUsage) {
        const shortage = estimatedUsage - totalSelected;
        const confirmed = await new Promise<boolean>(resolve => {
          Alert.alert(
            '批次不足',
            `选中批次共${totalSelected.toFixed(1)}kg，还需${shortage.toFixed(1)}kg。\n\n是否继续创建？`,
            [
              { text: '取消', onPress: () => resolve(false), style: 'cancel' },
              { text: '继续创建', onPress: () => resolve(true) },
            ]
          );
        });

        if (!confirmed) return;
      }
    }

    try {
      const response = await productionPlanApiClient.createProductionPlan({
        productTypeId: formData.productTypeId,
        customerId: formData.customerId,
        plannedQuantity: parseFloat(formData.plannedQuantity),
        selectedBatches: selectedBatches.length > 0 ? selectedBatches.map(b => ({
          batchId: b.id,
          quantity: b.allocatedQuantity,
          unitPrice: b.unitPrice,
        })) : undefined,
        notes: formData.notes || undefined,
      });

      if (response.success) {
        Alert.alert('成功', `生产计划创建成功${selectedBatches.length > 0 ? `\n已预留${selectedBatches.length}个批次的库存` : ''}`);
        setModalVisible(false);
        loadPlans();
      }
    } catch (error) {
      productionPlanLogger.error('创建生产计划失败', error, {
        productTypeId: formData.productTypeId,
        customerId: formData.customerId,
        plannedQuantity: formData.plannedQuantity,
        selectedBatchCount: selectedBatches.length,
      });
      Alert.alert('错误', error.response?.data?.message || '创建失败');
    }
  };

  const handleStartProduction = async (planId: string) => {
    Alert.alert(
      '确认开始生产',
      '确定要开始生产吗?开始后将无法修改计划信息。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '开始',
          onPress: async () => {
            try {
              const response = await productionPlanApiClient.startProduction(planId);
              if (response.success) {
                Alert.alert('成功', '生产已开始');
                loadPlans();
              }
            } catch (error) {
              productionPlanLogger.error('开始生产失败', error, { planId });
              Alert.alert('错误', error.response?.data?.message || '操作失败');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FFA726';
      case 'in_progress': return '#2196F3';
      case 'completed': return '#66BB6A';
      case 'shipped': return '#9C27B0';
      case 'cancelled': return '#EF5350';
      default: return '#999';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待生产';
      case 'in_progress': return '生产中';
      case 'completed': return '已完成';
      case 'shipped': return '已出货';
      case 'cancelled': return '已取消';
      default: return '未知';
    }
  };

  // 后端已经按filterStatus筛选,不需要前端再次筛选
  const filteredPlans = plans;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="生产计划管理" />
        <Appbar.Action icon="refresh" onPress={loadPlans} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* Filter */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <SegmentedButtons
              value={filterStatus}
              onValueChange={setFilterStatus}
              buttons={[
                { value: 'all', label: '全部' },
                { value: 'pending', label: '待生产' },
                { value: 'in_progress', label: '生产中' },
                { value: 'completed', label: '已完成' },
              ]}
            />
          </Card.Content>
        </Card>

        {/* Stats */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{plans.length}</Text>
                <Text style={styles.statLabel}>总计划数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {plans.filter(p => p.status === 'in_progress').length}
                </Text>
                <Text style={styles.statLabel}>生产中</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {plans.filter(p => p.status === 'completed').length}
                </Text>
                <Text style={styles.statLabel}>已完成</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Plans List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : filteredPlans.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <List.Icon icon="clipboard-text-outline" color="#999" />
              <Text style={styles.emptyText}>暂无生产计划</Text>
              <Text style={styles.emptyHint}>点击右下角"+"按钮创建生产计划</Text>
            </Card.Content>
          </Card>
        ) : (
          filteredPlans.map((plan) => (
            <Card key={plan.id} style={styles.planCard}>
              <Card.Content>
                {/* Header */}
                <View style={styles.planHeader}>
                  <View style={styles.planTitleRow}>
                    <Text style={styles.planNumber}>{plan.planNumber}</Text>
                    <Chip
                      mode="flat"
                      compact
                      style={[
                        styles.statusChip,
                        { backgroundColor: `${getStatusColor(plan.status)}20` },
                      ]}
                      textStyle={{ color: getStatusColor(plan.status) }}
                    >
                      {getStatusText(plan.status)}
                    </Chip>
                  </View>
                </View>

                <Divider style={styles.divider} />

                {/* Product & Merchant */}
                <View style={styles.planInfo}>
                  <View style={styles.infoRow}>
                    <List.Icon icon="package-variant" style={styles.icon} />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>产品</Text>
                      <Text style={styles.infoValue}>{plan.productType.name}</Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <List.Icon icon="store" style={styles.icon} />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>客户</Text>
                      <Text style={styles.infoValue}>{plan.customer?.name || '未指定'}</Text>
                    </View>
                  </View>
                </View>

                <Divider style={styles.divider} />

                {/* Quantities */}
                <View style={styles.quantitiesRow}>
                  <View style={styles.quantityItem}>
                    <Text style={styles.quantityLabel}>计划产量</Text>
                    <Text style={styles.quantityValue}>
                      {plan.plannedQuantity}kg
                    </Text>
                  </View>

                  <View style={styles.quantityItem}>
                    <Text style={styles.quantityLabel}>预估原料</Text>
                    <Text style={styles.quantityValue}>
                      {plan.estimatedMaterialUsage}kg
                    </Text>
                  </View>

                  {plan.actualQuantity && (
                    <View style={styles.quantityItem}>
                      <Text style={styles.quantityLabel}>实际产量</Text>
                      <Text style={[styles.quantityValue, { color: '#4CAF50' }]}>
                        {plan.actualQuantity}kg
                      </Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                {!isReadOnly && plan.status === 'pending' && (
                  <Button
                    mode="contained"
                    icon="play"
                    onPress={() => handleStartProduction(plan.id)}
                    style={styles.actionButton}
                  >
                    开始生产
                  </Button>
                )}

                {!isReadOnly && plan.status === 'in_progress' && (
                  <View style={styles.actionRow}>
                    <Button
                      mode="outlined"
                      icon="package-down"
                      onPress={() => Alert.alert('提示', '记录原料消耗功能')}
                      style={styles.smallActionButton}
                      compact
                    >
                      记录消耗
                    </Button>
                    <Button
                      mode="contained"
                      icon="check"
                      onPress={() => Alert.alert('提示', '完成生产功能')}
                      style={styles.smallActionButton}
                      compact
                    >
                      完成生产
                    </Button>
                  </View>
                )}

                {!isReadOnly && plan.status === 'completed' && (
                  <Button
                    mode="contained"
                    icon="truck-delivery"
                    onPress={() => Alert.alert('提示', '记录出货功能')}
                    style={styles.actionButton}
                  >
                    记录出货
                  </Button>
                )}

                {/* 平台管理员只读提示 */}
                {isReadOnly && (
                  <Card style={styles.readOnlyCard}>
                    <Card.Content>
                      <Text style={styles.readOnlyText}>
                        👁️ 平台管理员只读模式 - 无法修改数据
                      </Text>
                    </Card.Content>
                  </Card>
                )}
              </Card.Content>
            </Card>
          ))
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Create Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>创建生产计划</Text>

            {/* 产品类型选择 */}
            <ProductTypeSelector
              value={formData.productTypeName}
              onSelect={(id, name, code) => {
                setFormData({
                  ...formData,
                  productTypeId: id,
                  productTypeName: name,
                  productTypeCode: code,
                });
              }}
              label="产品类型(SKU)"
              placeholder="选择产品SKU"
            />

            {/* Planned Quantity */}
            <TextInput
              label="计划产量 (kg) *"
              value={formData.plannedQuantity}
              onChangeText={(text) => setFormData({ ...formData, plannedQuantity: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="例如: 100"
            />

            {/* Estimated Material Usage */}
            {estimatedUsage !== null && (
              <Card style={styles.estimateCard}>
                <Card.Content>
                  <View style={styles.estimateRow}>
                    <List.Icon icon="calculator" color="#FF9800" />
                    <View style={styles.estimateContent}>
                      <Text style={styles.estimateLabel}>预估原料用量</Text>
                      <Text style={styles.estimateValue}>
                        约 {estimatedUsage.toFixed(1)} kg
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            )}

            {/* Available Stock Display */}
            {availableStock.length > 0 && (
              <Card style={styles.stockCard}>
                <Card.Content>
                  <Text style={styles.stockTitle}>当前可用库存</Text>
                  {availableStock.map((stock, index) => (
                    <View key={index} style={styles.stockRow}>
                      <Text style={styles.stockCategory}>{stock.category}</Text>
                      <Text style={styles.stockValue}>
                        {stock.available}kg ({stock.batchCount}批次)
                      </Text>
                    </View>
                  ))}
                </Card.Content>
              </Card>
            )}

            {/* 目标商家选择 */}
            <CustomerSelector
              value={formData.customerName}
              onSelect={(id, name) => {
                setFormData({
                  ...formData,
                  customerId: id,
                  customerName: name,
                });
              }}
              label="目标商家(客户)"
              placeholder="选择客户"
            />

            {/* 批次选择器 */}
            {materialTypeId && availableBatches.length > 0 && estimatedUsage && estimatedUsage > 0 && (
              <MaterialBatchSelector
                availableBatches={availableBatches}
                requiredQuantity={estimatedUsage}
                selectedBatches={selectedBatches}
                onSelect={setSelectedBatches}
                mode="fifo"
              />
            )}

            {/* 未配置转换率或无库存提示 */}
            {materialTypeId && availableBatches.length === 0 && (
              <Card style={styles.warningCard}>
                <Card.Content>
                  <View style={styles.warningContent}>
                    <List.Icon icon="alert" color="#F44336" />
                    <View>
                      <Text variant="bodyMedium" style={styles.warningTitle}>
                        无可用{materialTypeName}库存
                      </Text>
                      <Text variant="bodySmall" style={styles.warningHint}>
                        请先入库{materialTypeName}原料
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            )}

            {!materialTypeId && formData.productTypeId && (
              <Card style={styles.warningCard}>
                <Card.Content>
                  <View style={styles.warningContent}>
                    <List.Icon icon="alert-circle-outline" color="#FF9800" />
                    <View>
                      <Text variant="bodyMedium" style={styles.warningTitle}>
                        未配置转换率
                      </Text>
                      <Text variant="bodySmall" style={styles.warningHint}>
                        请先在转换率管理中配置该产品的转换率
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            )}

            {/* Notes */}
            <TextInput
              label="备注"
              value={formData.notes}
              onChangeText={(text) => setFormData({ ...formData, notes: text })}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={3}
              placeholder="可选填写生产计划备注"
            />

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
                创建计划
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* FAB - 只有管理员可以创建 */}
      {canCreatePlan && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={handleAdd}
          label="创建生产计划"
        />
      )}

      {/* 只读模式提示 */}
      {isReadOnly && (
        <Card style={[styles.fab, styles.readOnlyFab]}>
          <Card.Content style={styles.readOnlyFabContent}>
            <Text style={styles.readOnlyFabText}>👁️ 只读模式</Text>
          </Card.Content>
        </Card>
      )}
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
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  filterCard: {
    margin: 16,
    marginBottom: 8,
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
    fontSize: 24,
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
  planCard: {
    margin: 16,
    marginBottom: 8,
  },
  planHeader: {
    marginBottom: 12,
  },
  planTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusChip: {
    height: 28,
    minWidth: 80,
  },
  divider: {
    marginVertical: 12,
  },
  planInfo: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 40,
  },
  icon: {
    margin: 0,
    marginRight: 4,
    width: 32,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
  },
  infoValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  quantitiesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  quantityItem: {
    alignItems: 'center',
  },
  quantityLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  actionButton: {
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  smallActionButton: {
    flex: 1,
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
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
  },
  picker: {
    height: 50,
  },
  input: {
    marginBottom: 16,
  },
  estimateCard: {
    marginBottom: 16,
    backgroundColor: '#FFF3E0',
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  estimateContent: {
    flex: 1,
    marginLeft: -8,
  },
  estimateLabel: {
    fontSize: 12,
    color: '#E65100',
  },
  estimateValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF9800',
    marginTop: 4,
  },
  stockCard: {
    marginBottom: 16,
    backgroundColor: '#E8F5E9',
  },
  stockTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#2E7D32',
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stockCategory: {
    fontSize: 14,
    color: '#666',
  },
  stockValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    minWidth: 100,
  },
  bottomPadding: {
    height: 80,
  },
  readOnlyCard: {
    marginTop: 12,
    backgroundColor: '#FFF3E0',
  },
  readOnlyText: {
    fontSize: 13,
    color: '#E65100',
    textAlign: 'center',
  },
  readOnlyFab: {
    backgroundColor: '#FFE0B2',
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  readOnlyFabContent: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  readOnlyFabText: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: 'bold',
  },
  batchSelectorPlaceholder: {
    marginVertical: 12,
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 4,
    borderLeftColor: '#FFA000',
  },
  placeholderContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  placeholderText: {
    flex: 1,
    marginLeft: 8,
  },
  placeholderTitle: {
    color: '#E65100',
    fontWeight: '600',
    marginBottom: 4,
  },
  placeholderHint: {
    color: '#F57C00',
    marginTop: 2,
  },
  warningCard: {
    marginVertical: 12,
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  warningTitle: {
    color: '#E65100',
    fontWeight: '600',
    marginBottom: 4,
  },
  warningHint: {
    color: '#F57C00',
  },
});
