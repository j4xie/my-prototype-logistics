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
  Searchbar,
  SegmentedButtons,
  Menu,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { customerApiClient, Customer, CreateCustomerRequest } from '../../services/api/customerApiClient';
import { useAuthStore } from '../../store/authStore';
import { handleError } from '../../utils/errorHandler';

/**
 * 客户管理页面
 * 权限：factory_super_admin、platform_admin
 * 功能：客户CRUD、状态管理、搜索筛选
 */
export default function CustomerManagementScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Menu visibility states
  const [customerTypeMenuVisible, setCustomerTypeMenuVisible] = useState(false);
  const [industryMenuVisible, setIndustryMenuVisible] = useState(false);

  // 权限控制
  const userType = user?.userType || 'factory';
  const roleCode = user?.factoryUser?.role || user?.factoryUser?.roleCode || user?.roleCode || 'viewer';
  const isPlatformAdmin = userType === 'platform';
  const isSuperAdmin = roleCode === 'factory_super_admin';
  const isPermissionAdmin = roleCode === 'permission_admin';
  const isDepartmentAdmin = roleCode === 'department_admin';
  const canManage = isPlatformAdmin || isSuperAdmin || isPermissionAdmin || isDepartmentAdmin;

  // 表单数据
  const [formData, setFormData] = useState<Partial<CreateCustomerRequest>>({
    customerCode: '',
    name: '',
    contactPerson: '',
    contactPhone: '',
    email: '',
    address: '',
    businessType: '',
    customerType: 'distributor',
    industry: 'restaurant',
  });

  // 客户类型选项
  const customerTypeOptions = [
    { label: '分销商', value: 'distributor' },
    { label: '零售商', value: 'retailer' },
    { label: '直客', value: 'direct' },
    { label: '其他', value: 'other' },
  ];

  // 行业选项
  const industryOptions = [
    { label: '餐饮', value: 'restaurant' },
    { label: '超市', value: 'supermarket' },
    { label: '电商', value: 'ecommerce' },
    { label: '食品加工', value: 'food_processing' },
    { label: '其他', value: 'other' },
  ];

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await customerApiClient.getCustomers({
        factoryId: user?.factoryId,
        page: 1, // 后端要求 page >= 1
        size: 100,
      });

      if (response.data) {
        setCustomers(response.data);
      }
    } catch (error) {
      console.error('加载客户列表失败:', error);
      Alert.alert('错误', error.response?.data?.message || '加载客户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadCustomers();
      return;
    }

    try {
      setLoading(true);
      const results = await customerApiClient.searchCustomers({
        keyword: searchQuery,
        factoryId: user?.factoryId,
      });
      setCustomers(results);
    } catch (error) {
      console.error('搜索失败:', error);
      Alert.alert('错误', '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCustomer(null);
    setFormData({
      customerCode: '',
      name: '',
      contactPerson: '',
      contactPhone: '',
      email: '',
      address: '',
      businessType: '',
      customerType: 'distributor',
      industry: 'restaurant',
    });
    setModalVisible(true);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      customerCode: customer.customerCode,
      name: customer.name,
      contactPerson: customer.contactPerson || '',
      contactPhone: customer.contactPhone || '',
      email: customer.email || '',
      address: customer.address || '',
      businessType: customer.businessType || '',
      customerType: customer.customerType || 'distributor',
      industry: customer.industry || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    // 验证必填项
    if (!formData.name || !formData.contactPhone) {
      Alert.alert('提示', '客户名称和联系电话不能为空');
      return;
    }

    try {
      if (editingCustomer) {
        // 更新客户
        await customerApiClient.updateCustomer(
          editingCustomer.id,
          formData as Partial<CreateCustomerRequest>,
          user?.factoryId
        );
        Alert.alert('成功', '客户信息已更新');
      } else {
        // 创建客户
        if (!formData.customerCode) {
          Alert.alert('提示', '客户编码不能为空');
          return;
        }
        await customerApiClient.createCustomer(
          formData as CreateCustomerRequest,
          user?.factoryId
        );
        Alert.alert('成功', '客户创建成功');
      }

      setModalVisible(false);
      loadCustomers();
    } catch (error) {
      console.error('保存客户失败:', error);
      Alert.alert('错误', error.response?.data?.message || '操作失败');
    }
  };

  const handleDelete = (customerId: string, customerName: string) => {
    Alert.alert(
      '确认删除',
      `确定要删除客户 "${customerName}" 吗？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await customerApiClient.deleteCustomer(customerId, user?.factoryId);
              Alert.alert('成功', '客户已删除');
              loadCustomers();
            } catch (error) {
              console.error('删除客户失败:', error);
              Alert.alert('错误', error.response?.data?.message || '删除失败');
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (customerId: string, currentStatus: boolean) => {
    try {
      await customerApiClient.toggleCustomerStatus(
        customerId,
        !currentStatus,
        user?.factoryId
      );
      Alert.alert('成功', currentStatus ? '客户已停用' : '客户已启用');
      loadCustomers();
    } catch (error) {
      console.error('切换状态失败:', error);
      Alert.alert('错误', error.response?.data?.message || '操作失败');
    }
  };

  const getCustomerTypeName = (type?: string) => {
    switch (type) {
      case 'distributor': return '分销商';
      case 'retailer': return '零售商';
      case 'direct': return '直客';
      case 'other': return '其他';
      default: return type || '未分类';
    }
  };

  const getIndustryName = (industry?: string) => {
    switch (industry) {
      case 'restaurant': return '餐饮';
      case 'supermarket': return '超市';
      case 'ecommerce': return '电商';
      case 'food_processing': return '食品加工';
      case 'other': return '其他';
      default: return industry || '未分类';
    }
  };

  // 筛选客户
  const filteredCustomers = customers.filter(c => {
    if (filterStatus === 'active' && !c.isActive) return false;
    if (filterStatus === 'inactive' && c.isActive) return false;
    return true;
  });

  if (!canManage) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="客户管理" />
        </Appbar.Header>
        <View style={styles.noPermission}>
          <List.Icon icon="lock" color="#999" />
          <Text style={styles.noPermissionText}>您没有权限访问此页面</Text>
          <Text style={styles.noPermissionHint}>仅限工厂超管和平台管理员</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="客户管理" />
        <Appbar.Action icon="refresh" onPress={loadCustomers} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* Search */}
        <Searchbar
          placeholder="搜索客户名称、编码、联系人"
          onChangeText={setSearchQuery}
          value={searchQuery}
          onSubmitEditing={handleSearch}
          style={styles.searchbar}
        />

        {/* Filter */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <SegmentedButtons
              value={filterStatus}
              onValueChange={setFilterStatus}
              buttons={[
                { value: 'all', label: '全部' },
                { value: 'active', label: '已启用' },
                { value: 'inactive', label: '已停用' },
              ]}
            />
          </Card.Content>
        </Card>

        {/* Stats */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{customers.length}</Text>
                <Text style={styles.statLabel}>总数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {customers.filter(c => c.isActive).length}
                </Text>
                <Text style={styles.statLabel}>启用</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {customers.filter(c => !c.isActive).length}
                </Text>
                <Text style={styles.statLabel}>停用</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Customers List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : filteredCustomers.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <List.Icon icon="account-group-outline" color="#999" />
              <Text style={styles.emptyText}>暂无客户</Text>
              <Text style={styles.emptyHint}>点击右下角"+"按钮创建客户</Text>
            </Card.Content>
          </Card>
        ) : (
          filteredCustomers.map((customer) => (
            <Card key={customer.id} style={styles.customerCard}>
              <Card.Content>
                {/* Header */}
                <View style={styles.customerHeader}>
                  <View style={styles.customerTitleRow}>
                    <View>
                      <Text style={styles.customerName}>{customer.name}</Text>
                      <Text style={styles.customerCode}>编码: {customer.customerCode}</Text>
                    </View>
                    <View style={styles.chips}>
                      <Chip
                        mode="flat"
                        compact
                        style={[
                          styles.statusChip,
                          { backgroundColor: customer.isActive ? '#E8F5E9' : '#FFEBEE' }
                        ]}
                        textStyle={{
                          color: customer.isActive ? '#2E7D32' : '#C62828',
                          fontSize: 11
                        }}
                      >
                        {customer.isActive ? '启用' : '停用'}
                      </Chip>
                      {customer.customerType && (
                        <Chip
                          mode="flat"
                          compact
                          style={[styles.typeChip, { backgroundColor: '#E3F2FD' }]}
                          textStyle={{ color: '#1565C0', fontSize: 11 }}
                        >
                          {getCustomerTypeName(customer.customerType)}
                        </Chip>
                      )}
                    </View>
                  </View>
                </View>

                {/* Info */}
                <View style={styles.customerInfo}>
                  {customer.contactPerson && (
                    <View style={styles.infoRow}>
                      <List.Icon icon="account" style={styles.infoIcon} />
                      <Text style={styles.infoText}>{customer.contactPerson}</Text>
                    </View>
                  )}
                  {customer.contactPhone && (
                    <View style={styles.infoRow}>
                      <List.Icon icon="phone" style={styles.infoIcon} />
                      <Text style={styles.infoText}>{customer.contactPhone}</Text>
                    </View>
                  )}
                  {customer.industry && (
                    <View style={styles.infoRow}>
                      <List.Icon icon="domain" style={styles.infoIcon} />
                      <Text style={styles.infoText}>{getIndustryName(customer.industry)}</Text>
                    </View>
                  )}
                  {customer.address && (
                    <View style={styles.infoRow}>
                      <List.Icon icon="map-marker" style={styles.infoIcon} />
                      <Text style={styles.infoText}>{customer.address}</Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                <View style={styles.actionRow}>
                  <Button
                    mode="outlined"
                    icon="pencil"
                    onPress={() => handleEdit(customer)}
                    style={styles.actionButton}
                    compact
                  >
                    编辑
                  </Button>
                  <Button
                    mode="outlined"
                    icon={customer.isActive ? 'pause' : 'play'}
                    onPress={() => handleToggleStatus(customer.id, customer.isActive)}
                    style={styles.actionButton}
                    compact
                  >
                    {customer.isActive ? '停用' : '启用'}
                  </Button>
                  <Button
                    mode="outlined"
                    icon="delete"
                    onPress={() => handleDelete(customer.id, customer.name)}
                    style={styles.actionButton}
                    compact
                    textColor="#C62828"
                  >
                    删除
                  </Button>
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
            {editingCustomer ? '编辑客户' : '创建客户'}
          </Text>

          <ScrollView style={styles.modalScrollView}>
            {/* Customer Code */}
            <TextInput
              label="客户编码 *"
              value={formData.customerCode}
              onChangeText={(text) => setFormData({ ...formData, customerCode: text })}
              mode="outlined"
              style={styles.input}
              disabled={!!editingCustomer}
              placeholder="例如：CUS001"
            />

            {/* Name */}
            <TextInput
              label="客户名称 *"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              mode="outlined"
              style={styles.input}
              placeholder="例如：XX超市"
            />

            {/* Contact Person */}
            <TextInput
              label="联系人"
              value={formData.contactPerson}
              onChangeText={(text) => setFormData({ ...formData, contactPerson: text })}
              mode="outlined"
              style={styles.input}
              placeholder="例如：李四"
            />

            {/* Contact Phone */}
            <TextInput
              label="联系电话 *"
              value={formData.contactPhone}
              onChangeText={(text) => setFormData({ ...formData, contactPhone: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="phone-pad"
              placeholder="例如：13800138000"
            />

            {/* Email */}
            <TextInput
              label="邮箱"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="email-address"
              placeholder="例如：customer@example.com"
            />

            {/* Address */}
            <TextInput
              label="地址"
              value={formData.address}
              onChangeText={(text) => setFormData({ ...formData, address: text })}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={2}
              placeholder="详细地址"
            />

            {/* Business Type */}
            <TextInput
              label="业务类型"
              value={formData.businessType}
              onChangeText={(text) => setFormData({ ...formData, businessType: text })}
              mode="outlined"
              style={styles.input}
              placeholder="例如：水产品零售"
            />

            {/* Customer Type */}
            <View style={styles.input}>
              <Text style={styles.selectLabel}>客户类型</Text>
              <Menu
                visible={customerTypeMenuVisible}
                onDismiss={() => setCustomerTypeMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setCustomerTypeMenuVisible(true)}
                    icon="menu-down"
                    contentStyle={{ justifyContent: 'space-between' }}
                    style={styles.selectButton}
                  >
                    {customerTypeOptions.find(o => o.value === formData.customerType)?.label || '请选择'}
                  </Button>
                }
              >
                {customerTypeOptions.map(opt => (
                  <Menu.Item
                    key={opt.value}
                    onPress={() => {
                      setFormData({ ...formData, customerType: opt.value });
                      setCustomerTypeMenuVisible(false);
                    }}
                    title={opt.label}
                  />
                ))}
              </Menu>
            </View>

            {/* Industry */}
            <View style={styles.input}>
              <Text style={styles.selectLabel}>行业</Text>
              <Menu
                visible={industryMenuVisible}
                onDismiss={() => setIndustryMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setIndustryMenuVisible(true)}
                    icon="menu-down"
                    contentStyle={{ justifyContent: 'space-between' }}
                    style={styles.selectButton}
                  >
                    {industryOptions.find(o => o.value === formData.industry)?.label || '请选择'}
                  </Button>
                }
              >
                {industryOptions.map(opt => (
                  <Menu.Item
                    key={opt.value}
                    onPress={() => {
                      setFormData({ ...formData, industry: opt.value });
                      setIndustryMenuVisible(false);
                    }}
                    title={opt.label}
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
              {editingCustomer ? '保存' : '创建'}
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
          label="创建客户"
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
  emptyHint: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
  },
  customerCard: {
    margin: 16,
    marginBottom: 8,
  },
  customerHeader: {
    marginBottom: 12,
  },
  customerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  customerCode: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  chips: {
    flexDirection: 'row',
    gap: 4,
  },
  statusChip: {
    height: 24,
  },
  typeChip: {
    height: 24,
  },
  customerInfo: {
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
  },
  actionButton: {
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
