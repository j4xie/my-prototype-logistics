import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  FAB,
  Card,
  Chip,
  Portal,
  Modal,
  TextInput,
  Button,
  ActivityIndicator,
  List,
  SegmentedButtons,
  Menu,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { disposalRecordApiClient, DisposalRecord, CreateDisposalRequest } from '../../services/api/disposalRecordApiClient';
import { useAuthStore } from '../../store/authStore';
import { logger } from '../../utils/logger';

const disposalLogger = logger.createContextLogger('DisposalManagement');

/**
 * 报废记录管理页面
 * 权限：factory_super_admin、platform_admin
 * 功能：报废记录CRUD、审批流程
 */
export default function DisposalRecordManagementScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [disposals, setDisposals] = useState<DisposalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDisposal, setEditingDisposal] = useState<DisposalRecord | null>(null);
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);

  // 权限控制
  const userType = user?.userType || 'factory';
  const roleCode = user?.factoryUser?.role || user?.roleCode || 'viewer';
  const isPlatformAdmin = userType === 'platform';
  const isSuperAdmin = roleCode === 'factory_super_admin';
  const isPermissionAdmin = roleCode === 'permission_admin';
  const isDepartmentAdmin = roleCode === 'department_admin';
  const canManage = isPlatformAdmin || isSuperAdmin || isPermissionAdmin || isDepartmentAdmin;
  const canApprove = isPlatformAdmin || isSuperAdmin;

  // 表单数据
  const [formData, setFormData] = useState<Partial<CreateDisposalRequest>>({
    disposalType: 'raw_material',
    relatedBatchId: '',
    disposalQuantity: 0,
    quantityUnit: 'kg',
    disposalReason: '',
    disposalMethod: '',
    estimatedLoss: 0,
    recoveryValue: 0,
    notes: '',
    isRecyclable: false,
  });

  // 报废类型选项
  const disposalTypeOptions = [
    { label: '原材料', value: 'raw_material' },
    { label: '半成品', value: 'semi_finished' },
    { label: '成品', value: 'finished_product' },
    { label: '包装材料', value: 'package' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await disposalRecordApiClient.getDisposalRecords({
        factoryId: user?.factoryId,
        page: 0,
        size: 100,
      });

      setDisposals(response.data || []);
      disposalLogger.info('报废记录加载成功', {
        count: response.data?.length || 0,
      });
    } catch (error) {
      disposalLogger.error('加载报废记录失败', error as Error);
      Alert.alert('错误', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingDisposal(null);
    setFormData({
      disposalType: 'raw_material',
      relatedBatchId: '',
      disposalQuantity: 0,
      quantityUnit: 'kg',
      disposalReason: '',
      disposalMethod: '',
      estimatedLoss: 0,
      recoveryValue: 0,
      notes: '',
      isRecyclable: false,
    });
    setModalVisible(true);
  };

  const handleEdit = (disposal: DisposalRecord) => {
    if (disposal.isApproved) {
      Alert.alert('提示', '已审批的记录不能修改');
      return;
    }
    setEditingDisposal(disposal);
    setFormData({
      disposalType: disposal.disposalType,
      relatedBatchId: disposal.relatedBatchId || '',
      disposalQuantity: disposal.disposalQuantity,
      quantityUnit: disposal.quantityUnit,
      disposalReason: disposal.disposalReason,
      disposalMethod: disposal.disposalMethod || '',
      estimatedLoss: disposal.estimatedLoss || 0,
      recoveryValue: disposal.recoveryValue || 0,
      notes: disposal.notes || '',
      isRecyclable: disposal.isRecyclable || false,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.disposalReason || !formData.disposalQuantity) {
      Alert.alert('提示', '报废原因和数量不能为空');
      return;
    }

    try {
      if (editingDisposal) {
        await disposalRecordApiClient.updateDisposalRecord(
          editingDisposal.id,
          formData,
          user?.factoryId
        );
        Alert.alert('成功', '报废记录已更新');
      } else {
        await disposalRecordApiClient.createDisposalRecord(
          formData as CreateDisposalRequest,
          user?.factoryId
        );
        Alert.alert('成功', '报废记录创建成功');
      }

      disposalLogger.info(editingDisposal ? '报废记录更新成功' : '报废记录创建成功', {
        type: formData.disposalType,
      });
      setModalVisible(false);
      loadData();
    } catch (error) {
      disposalLogger.error('保存报废记录失败', error as Error);
      Alert.alert('错误', (error as any).response?.data?.message || '操作失败');
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      '确认删除',
      '确定要删除此报废记录吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await disposalRecordApiClient.deleteDisposalRecord(id, user?.factoryId);
              disposalLogger.info('报废记录删除成功', { id });
              Alert.alert('成功', '报废记录已删除');
              loadData();
            } catch (error) {
              disposalLogger.error('删除报废记录失败', error as Error);
              Alert.alert('错误', '删除失败');
            }
          },
        },
      ]
    );
  };

  const handleApprove = async (id: number) => {
    try {
      const userId = (user as any)?.id || 0;
      const userName = (user as any)?.realName || user?.username || '管理员';
      await disposalRecordApiClient.approveDisposalRecord(
        id,
        userId,
        userName,
        user?.factoryId
      );
      disposalLogger.info('报废记录已审批', { id });
      Alert.alert('成功', '报废记录已审批');
      loadData();
    } catch (error) {
      disposalLogger.error('审批报废记录失败', error as Error);
      Alert.alert('错误', '操作失败');
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'raw_material': return '原材料';
      case 'semi_finished': return '半成品';
      case 'finished_product': return '成品';
      case 'package': return '包装材料';
      default: return type;
    }
  };

  // 筛选报废记录
  const filteredDisposals = disposals.filter(d => {
    if (filterStatus === 'pending' && d.isApproved) return false;
    if (filterStatus === 'approved' && !d.isApproved) return false;
    return true;
  });

  // 计算统计
  const stats = {
    total: disposals.length,
    pending: disposals.filter(d => !d.isApproved).length,
    approved: disposals.filter(d => d.isApproved).length,
    totalLoss: disposals.reduce((sum, d) => sum + (d.estimatedLoss || 0), 0),
  };

  if (!canManage) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="报废记录管理" />
        </Appbar.Header>
        <View style={styles.noPermission}>
          <List.Icon icon="lock" color="#999" />
          <Text style={styles.noPermissionText}>您没有权限访问此页面</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="报废记录管理" />
        <Appbar.Action icon="refresh" onPress={loadData} />
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
                { value: 'pending', label: '待审批' },
                { value: 'approved', label: '已审批' },
              ]}
            />
          </Card.Content>
        </Card>

        {/* Stats */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>总数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#E65100' }]}>{stats.pending}</Text>
                <Text style={styles.statLabel}>待审批</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#2E7D32' }]}>{stats.approved}</Text>
                <Text style={styles.statLabel}>已审批</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#C62828' }]}>¥{stats.totalLoss.toFixed(0)}</Text>
                <Text style={styles.statLabel}>估计损失</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : filteredDisposals.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <List.Icon icon="delete-outline" color="#999" />
              <Text style={styles.emptyText}>暂无报废记录</Text>
            </Card.Content>
          </Card>
        ) : (
          filteredDisposals.map((disposal) => (
            <Card key={disposal.id} style={styles.disposalCard}>
              <Card.Content>
                <View style={styles.disposalHeader}>
                  <View style={styles.disposalTitleRow}>
                    <View>
                      <Text style={styles.disposalType}>{getTypeLabel(disposal.disposalType)}</Text>
                      <Text style={styles.disposalReason}>{disposal.disposalReason}</Text>
                    </View>
                    <Chip
                      mode="flat"
                      compact
                      style={[
                        styles.statusChip,
                        { backgroundColor: disposal.isApproved ? '#E8F5E9' : '#FFF3E0' }
                      ]}
                      textStyle={{
                        color: disposal.isApproved ? '#2E7D32' : '#E65100',
                        fontSize: 11
                      }}
                    >
                      {disposal.isApproved ? '已审批' : '待审批'}
                    </Chip>
                  </View>
                </View>

                <View style={styles.infoSection}>
                  <View style={styles.infoRow}>
                    <List.Icon icon="package-variant" style={styles.infoIcon} />
                    <Text style={styles.infoText}>
                      数量: {disposal.disposalQuantity} {disposal.quantityUnit}
                    </Text>
                  </View>
                  {disposal.estimatedLoss && (
                    <View style={styles.infoRow}>
                      <List.Icon icon="currency-cny" style={styles.infoIcon} />
                      <Text style={styles.infoText}>
                        估计损失: ¥{disposal.estimatedLoss.toFixed(2)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    <List.Icon icon="calendar" style={styles.infoIcon} />
                    <Text style={styles.infoText}>{disposal.disposalDate}</Text>
                  </View>
                  {disposal.approverName && (
                    <View style={styles.infoRow}>
                      <List.Icon icon="account-check" style={styles.infoIcon} />
                      <Text style={styles.infoText}>审批人: {disposal.approverName}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.actionRow}>
                  {!disposal.isApproved && (
                    <>
                      <Button
                        mode="outlined"
                        icon="pencil"
                        onPress={() => handleEdit(disposal)}
                        style={styles.actionButton}
                        compact
                      >
                        编辑
                      </Button>
                      {canApprove && (
                        <Button
                          mode="contained"
                          icon="check"
                          onPress={() => handleApprove(disposal.id)}
                          style={styles.actionButton}
                          compact
                        >
                          审批
                        </Button>
                      )}
                      <Button
                        mode="outlined"
                        icon="delete"
                        onPress={() => handleDelete(disposal.id)}
                        style={styles.actionButton}
                        compact
                        textColor="#C62828"
                      >
                        删除
                      </Button>
                    </>
                  )}
                </View>
              </Card.Content>
            </Card>
          ))
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Create/Edit Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>
            {editingDisposal ? '编辑报废记录' : '创建报废记录'}
          </Text>

          <ScrollView style={styles.modalScrollView}>
            {/* Disposal Type */}
            <View style={styles.input}>
              <Text style={styles.selectLabel}>报废类型 *</Text>
              <Menu
                visible={typeMenuVisible}
                onDismiss={() => setTypeMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setTypeMenuVisible(true)}
                    icon="menu-down"
                    style={styles.selectButton}
                  >
                    {disposalTypeOptions.find(o => o.value === formData.disposalType)?.label || '请选择'}
                  </Button>
                }
              >
                {disposalTypeOptions.map(opt => (
                  <Menu.Item
                    key={opt.value}
                    onPress={() => {
                      setFormData({ ...formData, disposalType: opt.value as any });
                      setTypeMenuVisible(false);
                    }}
                    title={opt.label}
                  />
                ))}
              </Menu>
            </View>

            {/* Quantity */}
            <View style={styles.row}>
              <TextInput
                label="数量 *"
                value={formData.disposalQuantity?.toString() || ''}
                onChangeText={(text) => setFormData({ ...formData, disposalQuantity: parseFloat(text) || 0 })}
                mode="outlined"
                style={[styles.input, { flex: 1 }]}
                keyboardType="numeric"
              />
              <TextInput
                label="单位"
                value={formData.quantityUnit}
                onChangeText={(text) => setFormData({ ...formData, quantityUnit: text })}
                mode="outlined"
                style={[styles.input, { flex: 1, marginLeft: 8 }]}
              />
            </View>

            {/* Reason */}
            <TextInput
              label="报废原因 *"
              value={formData.disposalReason}
              onChangeText={(text) => setFormData({ ...formData, disposalReason: text })}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={2}
            />

            {/* Method */}
            <TextInput
              label="处理方式"
              value={formData.disposalMethod}
              onChangeText={(text) => setFormData({ ...formData, disposalMethod: text })}
              mode="outlined"
              style={styles.input}
            />

            {/* Estimated Loss */}
            <TextInput
              label="估计损失 (元)"
              value={formData.estimatedLoss?.toString() || ''}
              onChangeText={(text) => setFormData({ ...formData, estimatedLoss: parseFloat(text) || 0 })}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
            />

            {/* Recovery Value */}
            <TextInput
              label="回收价值 (元)"
              value={formData.recoveryValue?.toString() || ''}
              onChangeText={(text) => setFormData({ ...formData, recoveryValue: parseFloat(text) || 0 })}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
            />

            {/* Notes */}
            <TextInput
              label="备注"
              value={formData.notes}
              onChangeText={(text) => setFormData({ ...formData, notes: text })}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={2}
            />
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
              {editingDisposal ? '保存' : '创建'}
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* FAB */}
      {canManage && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={handleAdd}
          label="创建报废记录"
        />
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
  noPermission: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noPermissionText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
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
  disposalCard: {
    margin: 16,
    marginBottom: 8,
  },
  disposalHeader: {
    marginBottom: 12,
  },
  disposalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  disposalType: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  disposalReason: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusChip: {
    height: 24,
  },
  infoSection: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoIcon: {
    margin: 0,
    marginRight: 4,
    width: 28,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 80,
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
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
  },
  selectLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  selectButton: {
    justifyContent: 'flex-start',
  },
  modalScrollView: {
    flexGrow: 0,
    flexShrink: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    minWidth: 100,
  },
  bottomPadding: {
    height: 80,
  },
});
