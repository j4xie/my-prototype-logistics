import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
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
  Searchbar,
  SegmentedButtons,
  Switch,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { workTypeApiClient, WorkType, CreateWorkTypeRequest } from '../../services/api/workTypeApiClient';
import { useAuthStore } from '../../store/authStore';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建WorkTypeManagement专用logger
const workTypeLogger = logger.createContextLogger('WorkTypeManagement');

/**
 * 工作类型/工种管理页面
 * 权限：super_admin
 * 功能：工种CRUD、状态管理、部门筛选
 */
export default function WorkTypeManagementScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkType | null>(null);

  // 权限控制
  const userType = user?.userType || 'factory';
  const roleCode = user?.factoryUser?.role || user?.factoryUser?.roleCode || user?.roleCode || 'viewer';
  const isPlatformAdmin = userType === 'platform';
  const isSuperAdmin = roleCode === 'factory_super_admin';
  const isPermissionAdmin = roleCode === 'permission_admin';
  const isDepartmentAdmin = roleCode === 'department_admin';
  const canManage = isPlatformAdmin || isSuperAdmin || isPermissionAdmin || isDepartmentAdmin;

  // 表单状态
  const [formData, setFormData] = useState<Partial<CreateWorkTypeRequest>>({
    code: '',
    name: '',
    description: '',
    hourlyRate: 0,
    overtimeMultiplier: 1.5,
    department: 'processing',
    isActive: true,
  });

  useEffect(() => {
    loadWorkTypes();
  }, []);

  const loadWorkTypes = async () => {
    try {
      setLoading(true);
      const response = await workTypeApiClient.getWorkTypes({
        factoryId: user?.factoryId,
        page: 1, // 后端要求 page >= 1
        size: 100,
      });

      if (response.data) {
        workTypeLogger.info('工种类型列表加载成功', {
          workTypeCount: response.data.length,
          factoryId: user?.factoryId,
        });
        setWorkTypes(response.data);
      }
    } catch (error) {
      workTypeLogger.error('加载工种类型失败', error as Error, {
        factoryId: user?.factoryId,
      });
      Alert.alert('错误', (error as any).response?.data?.message || '加载工种类型失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadWorkTypes();
      return;
    }

    try {
      setLoading(true);
      const results = await workTypeApiClient.searchWorkTypes({
        keyword: searchQuery,
        factoryId: user?.factoryId,
      });
      workTypeLogger.info('工种搜索完成', {
        keyword: searchQuery,
        resultCount: results.length,
      });
      setWorkTypes(results);
    } catch (error) {
      workTypeLogger.error('搜索工种失败', error as Error, {
        keyword: searchQuery,
        factoryId: user?.factoryId,
      });
      Alert.alert('错误', '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      hourlyRate: 0,
      overtimeMultiplier: 1.5,
      department: 'processing',
      isActive: true,
    });
    setModalVisible(true);
  };

  const handleEdit = (item: WorkType) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      description: item.description || '',
      hourlyRate: item.hourlyRate || 0,
      overtimeMultiplier: item.overtimeMultiplier || 1.5,
      department: item.department || 'processing',
      isActive: item.isActive,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      Alert.alert('提示', '工种编码和名称不能为空');
      return;
    }

    try {
      if (editingItem) {
        // 更新
        await workTypeApiClient.updateWorkType(
          editingItem.id,
          formData as Partial<CreateWorkTypeRequest>,
          user?.factoryId
        );
        Alert.alert('成功', '工种更新成功');
      } else {
        // 创建
        await workTypeApiClient.createWorkType(
          formData as CreateWorkTypeRequest,
          user?.factoryId
        );
        Alert.alert('成功', '工种创建成功');
      }
      workTypeLogger.info(editingItem ? '工种更新成功' : '工种创建成功', {
        workTypeCode: formData.code,
        workTypeName: formData.name,
      });
      setModalVisible(false);
      loadWorkTypes();
    } catch (error) {
      workTypeLogger.error('保存工种失败', error as Error, {
        isEdit: !!editingItem,
        workTypeCode: formData.code,
      });
      Alert.alert('错误', (error as any).response?.data?.message || (editingItem ? '更新失败' : '创建失败'));
    }
  };

  const handleDelete = (item: WorkType) => {
    Alert.alert(
      '确认删除',
      `确定要删除工种"${item.name}"吗？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await workTypeApiClient.deleteWorkType(item.id, user?.factoryId);
              workTypeLogger.info('工种删除成功', {
                workTypeId: item.id,
                workTypeName: item.name,
              });
              Alert.alert('成功', '工种删除成功');
              loadWorkTypes();
            } catch (error) {
              workTypeLogger.error('删除工种失败', error as Error, {
                workTypeId: item.id,
                workTypeName: item.name,
              });
              Alert.alert('错误', (error as any).response?.data?.message || '删除失败');
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (item: WorkType) => {
    try {
      await workTypeApiClient.updateWorkType(
        item.id,
        { isActive: !item.isActive },
        user?.factoryId
      );
      workTypeLogger.info('工种状态已切换', {
        workTypeId: item.id,
        workTypeName: item.name,
        newStatus: !item.isActive ? '启用' : '停用',
      });
      Alert.alert('成功', item.isActive ? '已停用' : '已启用');
      loadWorkTypes();
    } catch (error) {
      workTypeLogger.error('切换工种状态失败', error as Error, {
        workTypeId: item.id,
        workTypeName: item.name,
      });
      Alert.alert('错误', (error as any).response?.data?.message || '操作失败');
    }
  };

  const getDepartmentName = (dept?: string) => {
    switch (dept) {
      case 'processing': return '加工部';
      case 'farming': return '养殖部';
      case 'logistics': return '物流部';
      case 'quality': return '质检部';
      case 'management': return '管理层';
      default: return dept || '未分配';
    }
  };

  const getDepartmentColor = (dept?: string) => {
    switch (dept) {
      case 'processing': return '#E3F2FD';
      case 'farming': return '#E8F5E9';
      case 'logistics': return '#FFF3E0';
      case 'quality': return '#F3E5F5';
      case 'management': return '#FCE4EC';
      default: return '#F5F5F5';
    }
  };

  // 筛选工种
  const filteredWorkTypes = workTypes.filter(w => {
    if (filterDepartment !== 'all' && w.department !== filterDepartment) {
      return false;
    }
    return true;
  });

  if (!canManage) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="工种管理" />
        </Appbar.Header>
        <View style={styles.noPermission}>
          <List.Icon icon="lock" color="#999" />
          <Text style={styles.noPermissionText}>您没有权限访问此页面</Text>
          <Text style={styles.noPermissionHint}>仅限工厂超管</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="工种管理" />
        <Appbar.Action icon="refresh" onPress={loadWorkTypes} />
      </Appbar.Header>

      {/* Content */}
      <ScrollView style={styles.content}>
        {/* Search */}
        <Searchbar
          placeholder="搜索工种编码、名称"
          onChangeText={setSearchQuery}
          value={searchQuery}
          onSubmitEditing={handleSearch}
          style={styles.searchbar}
        />

        {/* Department Filter */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <SegmentedButtons
              value={filterDepartment}
              onValueChange={setFilterDepartment}
              buttons={[
                { value: 'all', label: '全部' },
                { value: 'processing', label: '加工部' },
                { value: 'quality', label: '质检部' },
                { value: 'logistics', label: '物流部' },
              ]}
            />
          </Card.Content>
        </Card>

        {/* Stats Card */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{workTypes.length}</Text>
                <Text style={styles.statLabel}>总数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {workTypes.filter(w => w.isActive).length}
                </Text>
                <Text style={styles.statLabel}>启用中</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {new Set(workTypes.map(w => w.department)).size}
                </Text>
                <Text style={styles.statLabel}>部门数</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Work Type List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : filteredWorkTypes.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <List.Icon icon="briefcase-outline" color="#999" />
              <Text style={styles.emptyText}>暂无工种</Text>
              <Text style={styles.emptyHint}>点击右下角"+"按钮添加工种</Text>
            </Card.Content>
          </Card>
        ) : (
          filteredWorkTypes.map((item) => (
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

                {/* Department */}
                {item.department && (
                  <Chip
                    mode="flat"
                    compact
                    style={[
                      styles.departmentChip,
                      { backgroundColor: getDepartmentColor(item.department) }
                    ]}
                  >
                    {getDepartmentName(item.department)}
                  </Chip>
                )}

                {/* Pay Info */}
                <View style={styles.payRow}>
                  <View style={styles.payItem}>
                    <List.Icon icon="currency-cny" style={styles.payIcon} />
                    <Text style={styles.payLabel}>时薪: </Text>
                    <Text style={styles.payValue}>¥{item.hourlyRate?.toFixed(2) || '0.00'}/小时</Text>
                  </View>
                  <View style={styles.payItem}>
                    <List.Icon icon="clock-time-eight" style={styles.payIcon} />
                    <Text style={styles.payLabel}>加班倍率: </Text>
                    <Text style={styles.payValue}>{item.overtimeMultiplier || 1.5}x</Text>
                  </View>
                </View>

                {item.description && (
                  <Text style={styles.itemDescription}>{item.description}</Text>
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
            {editingItem ? '编辑工种' : '添加工种'}
          </Text>

          <ScrollView style={styles.modalScrollView}>
            <TextInput
              label="工种编码 *"
              value={formData.code}
              onChangeText={(text) => setFormData({ ...formData, code: text.toUpperCase() })}
              mode="outlined"
              style={styles.input}
              placeholder="例如: WORK001"
              autoCapitalize="characters"
              disabled={!!editingItem}
            />

            <TextInput
              label="工种名称 *"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              mode="outlined"
              style={styles.input}
              placeholder="例如: 加工工/质检员/仓管员"
            />

            <TextInput
              label="所属部门"
              value={formData.department}
              onChangeText={(text) => setFormData({ ...formData, department: text })}
              mode="outlined"
              style={styles.input}
              placeholder="例如: processing/quality/logistics"
            />

            <TextInput
              label="时薪（元/小时）"
              value={formData.hourlyRate?.toString() || ''}
              onChangeText={(text) => setFormData({ ...formData, hourlyRate: parseFloat(text) || 0 })}
              mode="outlined"
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="例如: 25.00"
            />

            <TextInput
              label="加班倍率"
              value={formData.overtimeMultiplier?.toString() || ''}
              onChangeText={(text) => setFormData({ ...formData, overtimeMultiplier: parseFloat(text) || 1.5 })}
              mode="outlined"
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="例如: 1.5 (表示1.5倍工资)"
            />

            <TextInput
              label="描述"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={3}
              placeholder="工种详细描述"
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>是否启用</Text>
              <Switch
                value={formData.isActive}
                onValueChange={(value) => setFormData({ ...formData, isActive: value })}
              />
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
      </Portal>

      {/* FAB */}
      {canManage && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={handleAdd}
          label="添加工种"
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
  noPermissionHint: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
  },
  searchbar: {
    margin: 16,
    marginBottom: 8,
  },
  filterCard: {
    margin: 16,
    marginBottom: 8,
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
    height: 24,
  },
  itemActions: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  departmentChip: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  payRow: {
    marginBottom: 8,
  },
  payItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  payIcon: {
    margin: 0,
    marginRight: 4,
    width: 24,
  },
  payLabel: {
    fontSize: 13,
    color: '#666',
  },
  payValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    marginBottom: 12,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  statusChip: {
    height: 28,
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
    maxHeight: 800,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
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
