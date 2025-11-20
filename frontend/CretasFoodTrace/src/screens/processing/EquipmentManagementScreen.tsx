import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Chip,
  ActivityIndicator,
  Searchbar,
  FAB,
  Portal,
  Dialog,
  Button,
  TextInput,
  IconButton,
  Menu,
  SegmentedButtons,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProcessingStackParamList } from '../../types/navigation';
import {
  equipmentApiClient,
  type Equipment,
  type EquipmentStatus,
  type EquipmentType,
  type CreateEquipmentRequest,
} from '../../services/api/equipmentApiClient';
import { useAuthStore } from '../../store/authStore';
import { getFactoryId } from '../../types/auth';

type NavigationProp = NativeStackNavigationProp<ProcessingStackParamList, 'EquipmentManagement'>;

/**
 * 设备管理页面
 * P3-设备: 集成设备CRUD、搜索、状态管理API
 *
 * 功能:
 * - 设备列表查询（分页）
 * - 搜索设备（关键字、状态、类型）
 * - 创建设备
 * - 编辑设备
 * - 删除设备
 * - 更新设备状态
 * - 查看设备详情
 */
export default function EquipmentManagementScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();

  // 状态定义
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<EquipmentType | 'all'>('all');

  // P3-设备: CRUD状态
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState<CreateEquipmentRequest>({
    name: '',
    code: '',
    type: 'processing',
    model: '',
    manufacturer: '',
    purchaseDate: '',
    location: '',
    specifications: '',
    purchasePrice: undefined,
    depreciationYears: undefined,
    maintenanceInterval: undefined,
    notes: '',
  });

  /**
   * 获取当前工厂ID
   */
  const getCurrentFactoryId = (): string => {
    return getFactoryId(user) || '';
  };

  /**
   * 加载设备列表
   */
  const loadEquipments = async () => {
    setLoading(true);
    try {
      const factoryId = getCurrentFactoryId();
      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息，请重新登录');
        return;
      }

      console.log('📋 Loading equipments...', { factoryId, statusFilter, typeFilter, searchQuery });

      // 调用API - GET /equipment
      const params: any = {
        factoryId,
        page: 0,
        size: 50,
        sortBy: 'createdAt',
        sortDirection: 'DESC' as const,
      };

      // 添加过滤条件
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }
      if (searchQuery.trim()) {
        params.keyword = searchQuery.trim();
      }

      const response = await equipmentApiClient.getEquipments(params);
      console.log('✅ Equipments loaded:', response.data);

      // 处理响应数据
      const data = response.data;
      let equipmentList: Equipment[] = [];

      if (Array.isArray(data)) {
        equipmentList = data;
      } else if (data && typeof data === 'object') {
        equipmentList = data.content || data.items || [];
      }

      setEquipments(equipmentList);
    } catch (error: any) {
      console.error('❌ Failed to load equipments:', error);
      const errorMessage = error.response?.data?.message || error.message || '加载设备列表失败，请稍后重试';
      Alert.alert('加载失败', errorMessage);
      setEquipments([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 刷新数据
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEquipments();
    setRefreshing(false);
  };

  /**
   * 页面聚焦时加载数据
   */
  useFocusEffect(
    useCallback(() => {
      loadEquipments();
    }, [statusFilter, typeFilter, searchQuery])
  );

  /**
   * P3-设备: 创建设备
   */
  const handleCreateEquipment = async () => {
    try {
      // 验证表单
      if (!formData.name.trim()) {
        Alert.alert('验证错误', '请输入设备名称');
        return;
      }
      if (!formData.code.trim()) {
        Alert.alert('验证错误', '请输入设备编号');
        return;
      }

      setLoading(true);
      console.log('➕ Creating equipment:', formData);

      const response = await equipmentApiClient.createEquipment(formData, getCurrentFactoryId());
      console.log('✅ Equipment created:', response);

      Alert.alert('创建成功', `设备 ${formData.name} 创建成功！`);

      // 重置表单
      setFormData({
        name: '',
        code: '',
        type: 'processing',
        model: '',
        manufacturer: '',
        purchaseDate: '',
        location: '',
        specifications: '',
        purchasePrice: undefined,
        depreciationYears: undefined,
        maintenanceInterval: undefined,
        notes: '',
      });
      setShowCreateDialog(false);

      // 刷新列表
      await loadEquipments();
    } catch (error: any) {
      console.error('❌ Failed to create equipment:', error);
      Alert.alert('创建失败', error.response?.data?.message || error.message || '创建设备失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * P3-设备: 更新设备
   */
  const handleUpdateEquipment = async () => {
    if (!selectedEquipment) return;

    try {
      // 验证表单
      if (!formData.name.trim()) {
        Alert.alert('验证错误', '请输入设备名称');
        return;
      }
      if (!formData.code.trim()) {
        Alert.alert('验证错误', '请输入设备编号');
        return;
      }

      setLoading(true);
      console.log('✏️ Updating equipment:', selectedEquipment.id, formData);

      await equipmentApiClient.updateEquipment(selectedEquipment.id, formData, getCurrentFactoryId());
      console.log('✅ Equipment updated');

      Alert.alert('更新成功', `设备 ${formData.name} 已更新`);

      setShowEditDialog(false);
      setSelectedEquipment(null);

      // 刷新列表
      await loadEquipments();
    } catch (error: any) {
      console.error('❌ Failed to update equipment:', error);
      Alert.alert('更新失败', error.response?.data?.message || error.message || '更新设备失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * P3-设备: 删除设备
   */
  const handleDeleteEquipment = async () => {
    if (!selectedEquipment) return;

    try {
      setLoading(true);
      console.log('🗑️ Deleting equipment:', selectedEquipment.id);

      await equipmentApiClient.deleteEquipment(selectedEquipment.id, getCurrentFactoryId());
      console.log('✅ Equipment deleted');

      Alert.alert('删除成功', `设备 ${selectedEquipment.name} 已删除`);

      setShowDeleteDialog(false);
      setSelectedEquipment(null);

      // 刷新列表
      await loadEquipments();
    } catch (error: any) {
      console.error('❌ Failed to delete equipment:', error);
      Alert.alert('删除失败', error.response?.data?.message || error.message || '删除设备失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * P3-设备: 更新设备状态
   */
  const handleUpdateStatus = async (newStatus: EquipmentStatus) => {
    if (!selectedEquipment) return;

    try {
      setLoading(true);
      console.log('🔄 Updating equipment status:', selectedEquipment.id, newStatus);

      await equipmentApiClient.updateEquipmentStatus(selectedEquipment.id, newStatus, getCurrentFactoryId());
      console.log('✅ Equipment status updated');

      Alert.alert('状态更新成功', `设备 ${selectedEquipment.name} 状态已更新为 ${getStatusLabel(newStatus)}`);

      setShowStatusMenu(false);
      setSelectedEquipment(null);

      // 刷新列表
      await loadEquipments();
    } catch (error: any) {
      console.error('❌ Failed to update equipment status:', error);
      Alert.alert('状态更新失败', error.response?.data?.message || error.message || '更新设备状态失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 打开创建对话框
   */
  const openCreateDialog = () => {
    setFormData({
      name: '',
      code: '',
      type: 'processing',
      model: '',
      manufacturer: '',
      purchaseDate: '',
      location: '',
      specifications: '',
      purchasePrice: undefined,
      depreciationYears: undefined,
      maintenanceInterval: undefined,
      notes: '',
    });
    setShowCreateDialog(true);
  };

  /**
   * 打开编辑对话框
   */
  const openEditDialog = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setFormData({
      name: equipment.name,
      code: equipment.code,
      type: equipment.type,
      model: equipment.model || '',
      manufacturer: equipment.manufacturer || '',
      purchaseDate: equipment.purchaseDate || '',
      location: equipment.location || '',
      specifications: equipment.specifications || '',
      purchasePrice: equipment.purchasePrice,
      depreciationYears: equipment.depreciationYears,
      maintenanceInterval: equipment.maintenanceInterval,
      notes: equipment.notes || '',
    });
    setShowEditDialog(true);
  };

  /**
   * 打开删除确认对话框
   */
  const openDeleteDialog = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setShowDeleteDialog(true);
  };

  /**
   * 打开状态菜单
   */
  const openStatusMenu = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setShowStatusMenu(true);
  };

  /**
   * 获取状态标签
   */
  const getStatusLabel = (status: EquipmentStatus): string => {
    const labels: Record<EquipmentStatus, string> = {
      active: '运行中',
      inactive: '停用',
      maintenance: '维护中',
      scrapped: '已报废',
    };
    return labels[status] || status;
  };

  /**
   * 获取状态颜色
   */
  const getStatusColor = (status: EquipmentStatus): string => {
    const colors: Record<EquipmentStatus, string> = {
      active: '#4CAF50',
      inactive: '#9E9E9E',
      maintenance: '#FF9800',
      scrapped: '#F44336',
    };
    return colors[status] || '#666';
  };

  /**
   * 获取类型标签
   */
  const getTypeLabel = (type: EquipmentType): string => {
    const labels: Record<EquipmentType, string> = {
      processing: '加工设备',
      refrigeration: '冷藏设备',
      packaging: '包装设备',
      transport: '运输设备',
      other: '其他',
    };
    return labels[type] || type;
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="设备管理" />
        <Appbar.Action icon="monitor-dashboard" onPress={() => navigation.navigate('EquipmentMonitoring', {})} />
      </Appbar.Header>

      {/* 搜索栏 */}
      <Searchbar
        placeholder="搜索设备名称、编号、型号..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      {/* 过滤器 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        <Chip
          mode={statusFilter === 'all' ? 'flat' : 'outlined'}
          selected={statusFilter === 'all'}
          onPress={() => setStatusFilter('all')}
          style={styles.filterChip}
        >
          全部状态
        </Chip>
        <Chip
          mode={statusFilter === 'active' ? 'flat' : 'outlined'}
          selected={statusFilter === 'active'}
          onPress={() => setStatusFilter('active')}
          style={styles.filterChip}
        >
          运行中
        </Chip>
        <Chip
          mode={statusFilter === 'maintenance' ? 'flat' : 'outlined'}
          selected={statusFilter === 'maintenance'}
          onPress={() => setStatusFilter('maintenance')}
          style={styles.filterChip}
        >
          维护中
        </Chip>
        <Chip
          mode={statusFilter === 'inactive' ? 'flat' : 'outlined'}
          selected={statusFilter === 'inactive'}
          onPress={() => setStatusFilter('inactive')}
          style={styles.filterChip}
        >
          停用
        </Chip>
      </ScrollView>

      {/* 设备列表 */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {loading && equipments.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : equipments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无设备数据</Text>
            <Button mode="outlined" onPress={openCreateDialog} style={{ marginTop: 16 }}>
              创建设备
            </Button>
          </View>
        ) : (
          equipments.map((equipment) => (
            <Card key={equipment.id} style={styles.equipmentCard} mode="elevated">
              <Card.Content>
                {/* 设备标题 */}
                <View style={styles.headerRow}>
                  <View style={styles.headerLeft}>
                    <Text variant="titleMedium" style={styles.equipmentName}>
                      {equipment.name}
                    </Text>
                    <Chip
                      mode="flat"
                      style={[styles.statusChip, { backgroundColor: getStatusColor(equipment.status) + '20' }]}
                      textStyle={{ color: getStatusColor(equipment.status), fontSize: 12 }}
                    >
                      {getStatusLabel(equipment.status)}
                    </Chip>
                  </View>

                  {/* P3-设备: Edit/Delete/Status Actions */}
                  <View style={styles.actionButtons}>
                    <Menu
                      visible={showStatusMenu && selectedEquipment?.id === equipment.id}
                      onDismiss={() => {
                        setShowStatusMenu(false);
                        setSelectedEquipment(null);
                      }}
                      anchor={
                        <IconButton
                          icon="swap-horizontal"
                          size={20}
                          onPress={() => openStatusMenu(equipment)}
                          style={styles.actionIcon}
                        />
                      }
                    >
                      <Menu.Item
                        leadingIcon="play"
                        onPress={() => handleUpdateStatus('active')}
                        title="运行中"
                      />
                      <Menu.Item
                        leadingIcon="wrench"
                        onPress={() => handleUpdateStatus('maintenance')}
                        title="维护中"
                      />
                      <Menu.Item
                        leadingIcon="pause"
                        onPress={() => handleUpdateStatus('inactive')}
                        title="停用"
                      />
                      <Menu.Item
                        leadingIcon="delete"
                        onPress={() => handleUpdateStatus('scrapped')}
                        title="报废"
                      />
                    </Menu>

                    <IconButton
                      icon="pencil"
                      size={20}
                      onPress={() => openEditDialog(equipment)}
                      style={styles.actionIcon}
                    />
                    <IconButton
                      icon="delete"
                      size={20}
                      onPress={() => openDeleteDialog(equipment)}
                      style={styles.actionIcon}
                      iconColor="#F44336"
                    />
                  </View>
                </View>

                {/* 设备信息 */}
                <View style={styles.infoRow}>
                  <Text variant="bodySmall" style={styles.infoLabel}>
                    编号:
                  </Text>
                  <Text variant="bodySmall" style={styles.infoValue}>
                    {equipment.code}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text variant="bodySmall" style={styles.infoLabel}>
                    类型:
                  </Text>
                  <Text variant="bodySmall" style={styles.infoValue}>
                    {getTypeLabel(equipment.type)}
                  </Text>
                </View>

                {equipment.model && (
                  <View style={styles.infoRow}>
                    <Text variant="bodySmall" style={styles.infoLabel}>
                      型号:
                    </Text>
                    <Text variant="bodySmall" style={styles.infoValue}>
                      {equipment.model}
                    </Text>
                  </View>
                )}

                {equipment.location && (
                  <View style={styles.infoRow}>
                    <Text variant="bodySmall" style={styles.infoLabel}>
                      位置:
                    </Text>
                    <Text variant="bodySmall" style={styles.infoValue}>
                      {equipment.location}
                    </Text>
                  </View>
                )}

                {/* 查看详情按钮 */}
                <Button
                  mode="outlined"
                  onPress={() => navigation.navigate('EquipmentDetail', { equipmentId: equipment.id })}
                  style={{ marginTop: 12 }}
                  icon="arrow-right"
                  contentStyle={{ flexDirection: 'row-reverse' }}
                >
                  查看详情
                </Button>
              </Card.Content>
            </Card>
          ))
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* P3-设备: FAB创建按钮 */}
      <FAB
        icon="plus"
        label="创建设备"
        onPress={openCreateDialog}
        style={styles.fab}
      />

      {/* P3-设备: Create Dialog */}
      <Portal>
        <Dialog visible={showCreateDialog} onDismiss={() => setShowCreateDialog(false)}>
          <Dialog.Title>创建设备</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.dialogContent}>
              <TextInput
                label="设备名称 *"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="设备编号 *"
                value={formData.code}
                onChangeText={(text) => setFormData({ ...formData, code: text })}
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="型号"
                value={formData.model}
                onChangeText={(text) => setFormData({ ...formData, model: text })}
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="制造商"
                value={formData.manufacturer}
                onChangeText={(text) => setFormData({ ...formData, manufacturer: text })}
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="位置"
                value={formData.location}
                onChangeText={(text) => setFormData({ ...formData, location: text })}
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="采购价格 (元)"
                value={formData.purchasePrice?.toString() || ''}
                onChangeText={(text) => setFormData({ ...formData, purchasePrice: text ? Number(text) : undefined })}
                keyboardType="numeric"
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="折旧年限 (年)"
                value={formData.depreciationYears?.toString() || ''}
                onChangeText={(text) => setFormData({ ...formData, depreciationYears: text ? Number(text) : undefined })}
                keyboardType="numeric"
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="维护间隔 (天)"
                value={formData.maintenanceInterval?.toString() || ''}
                onChangeText={(text) => setFormData({ ...formData, maintenanceInterval: text ? Number(text) : undefined })}
                keyboardType="numeric"
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="备注"
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                mode="outlined"
                multiline
                numberOfLines={3}
                style={styles.dialogInput}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowCreateDialog(false)}>取消</Button>
            <Button onPress={handleCreateEquipment} loading={loading} disabled={loading}>
              创建
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* P3-设备: Edit Dialog */}
      <Portal>
        <Dialog visible={showEditDialog} onDismiss={() => setShowEditDialog(false)}>
          <Dialog.Title>编辑设备</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.dialogContent}>
              <TextInput
                label="设备名称 *"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="设备编号 *"
                value={formData.code}
                onChangeText={(text) => setFormData({ ...formData, code: text })}
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="型号"
                value={formData.model}
                onChangeText={(text) => setFormData({ ...formData, model: text })}
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="制造商"
                value={formData.manufacturer}
                onChangeText={(text) => setFormData({ ...formData, manufacturer: text })}
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="位置"
                value={formData.location}
                onChangeText={(text) => setFormData({ ...formData, location: text })}
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="采购价格 (元)"
                value={formData.purchasePrice?.toString() || ''}
                onChangeText={(text) => setFormData({ ...formData, purchasePrice: text ? Number(text) : undefined })}
                keyboardType="numeric"
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="折旧年限 (年)"
                value={formData.depreciationYears?.toString() || ''}
                onChangeText={(text) => setFormData({ ...formData, depreciationYears: text ? Number(text) : undefined })}
                keyboardType="numeric"
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="维护间隔 (天)"
                value={formData.maintenanceInterval?.toString() || ''}
                onChangeText={(text) => setFormData({ ...formData, maintenanceInterval: text ? Number(text) : undefined })}
                keyboardType="numeric"
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="备注"
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                mode="outlined"
                multiline
                numberOfLines={3}
                style={styles.dialogInput}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowEditDialog(false)}>取消</Button>
            <Button onPress={handleUpdateEquipment} loading={loading} disabled={loading}>
              更新
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* P3-设备: Delete Confirmation Dialog */}
      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>确认删除</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              确定要删除设备 <Text style={{ fontWeight: 'bold' }}>{selectedEquipment?.name}</Text> 吗？
            </Text>
            <Text variant="bodySmall" style={{ marginTop: 8, color: '#F44336' }}>
              此操作不可撤销！
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>取消</Button>
            <Button
              onPress={handleDeleteEquipment}
              loading={loading}
              disabled={loading}
              textColor="#F44336"
            >
              删除
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  searchbar: {
    margin: 16,
    marginBottom: 8,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  filterChip: {
    marginRight: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#999',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  equipmentCard: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  equipmentName: {
    fontWeight: '600',
    color: '#212121',
    marginRight: 8,
  },
  statusChip: {
    height: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    margin: 0,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  infoLabel: {
    color: '#666',
    width: 60,
  },
  infoValue: {
    color: '#212121',
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  dialogContent: {
    paddingHorizontal: 24,
  },
  dialogInput: {
    marginBottom: 12,
  },
  bottomPadding: {
    height: 100,
  },
});
