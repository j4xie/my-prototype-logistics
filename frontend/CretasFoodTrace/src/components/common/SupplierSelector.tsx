import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, FlatList, TouchableOpacity, Alert } from 'react-native';
import { TextInput, List, Divider, Button, Text, Searchbar, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { supplierApiClient, Supplier } from '../../services/api/supplierApiClient';
import { handleError, getErrorMsg } from '../../utils/errorHandler';

interface SupplierSelectorProps {
  value: string;
  onSelect: (supplierId: string, supplierName: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
}

/**
 * 供应商选择器
 * 用于选择原材料供应商，支持快捷添加
 */
export const SupplierSelector: React.FC<SupplierSelectorProps> = ({
  value,
  onSelect,
  label = '供应商',
  placeholder = '选择供应商',
  error,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);

  // 快捷添加功能状态
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newContactPerson, setNewContactPerson] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newBusinessType, setNewBusinessType] = useState('水产批发');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (modalVisible) {
      fetchSuppliers();
    }
  }, [modalVisible]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const result = await supplierApiClient.getSuppliers({ isActive: true });
      console.log('✅ Suppliers loaded:', result.data.length);
      setSuppliers(result.data);
    } catch (error) {
      console.error('❌ Failed to fetch suppliers:', error);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contactPerson?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 重置Modal状态到初始状态
  const resetModalState = () => {
    setShowAddForm(false);           // 显示列表而非表单
    setSearchQuery('');               // 清空搜索
    // 清空添加表单
    setNewSupplierName('');
    setNewContactPerson('');
    setNewContactPhone('');
    setNewAddress('');
    setNewBusinessType('水产批发');  // 重置为默认值
  };

  // Modal关闭处理
  const handleModalClose = () => {
    setModalVisible(false);
    resetModalState();  // 关闭时重置
  };

  // Modal打开处理
  const handleModalOpen = () => {
    resetModalState();      // 打开时也重置（确保干净状态）
    setModalVisible(true);
  };

  const handleSelect = (supplier: Supplier) => {
    onSelect(supplier.id, supplier.name);
    handleModalClose();  // 使用统一的关闭函数
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) {
      Alert.alert('验证错误', '请输入供应商名称');
      return;
    }

    try {
      setCreating(true);

      const newSupplier = await supplierApiClient.createSupplier({
        supplierCode: `SUP${Date.now()}`,
        name: newSupplierName.trim(),
        contactPerson: newContactPerson.trim() || undefined,
        phone: newContactPhone.trim() || undefined,
        address: newAddress.trim() || undefined,
        businessType: newBusinessType,
      });

      console.log('✅ Supplier created:', newSupplierName);

      // 刷新列表
      await fetchSuppliers();

      // 自动选中新创建的供应商
      onSelect(newSupplier.data.id, newSupplier.data.name);

      // 关闭弹窗（使用统一函数）
      handleModalClose();
    } catch (error) {
      console.error('❌ Failed to create supplier:', error);
      Alert.alert('创建失败', getErrorMsg(error) || '请重试');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => {
          console.log('🔍 Opening supplier selector');
          handleModalOpen();
        }}
        activeOpacity={1}
      >
        <View pointerEvents="none">
          <TextInput
            label={label + ' *'}
            placeholder={placeholder}
            mode="outlined"
            value={value}
            editable={false}
            error={!!error}
            right={<TextInput.Icon icon="chevron-down" />}
            style={styles.input}
          />
        </View>
      </TouchableOpacity>
      {error && <Text variant="bodySmall" style={styles.errorText}>{error}</Text>}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="titleLarge">选择{label}</Text>
              <Button onPress={handleModalClose}>取消</Button>
            </View>

            <Searchbar
              placeholder="搜索供应商名称、代码、联系人..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchBar}
            />

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
                <Text style={styles.loadingText}>加载中...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredSuppliers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <>
                    <List.Item
                      title={item.name}
                      description={`${item.code}${item.contactPerson ? ' • ' + item.contactPerson : ''}${item.phone ? ' • ' + item.phone : ''}`}
                      onPress={() => handleSelect(item)}
                      right={props => value === item.name ? <List.Icon {...props} icon="check" color="#2196F3" /> : null}
                    />
                    <Divider />
                  </>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text variant="bodyMedium" style={styles.emptyText}>
                      {searchQuery ? `未找到匹配的${label}` : `暂无${label}`}
                    </Text>
                  </View>
                }
                ListFooterComponent={
                  !showAddForm ? (
                    // 添加按钮
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => setShowAddForm(true)}
                    >
                      <Text style={styles.addButtonText}>➕ 找不到？点击添加新{label}</Text>
                    </TouchableOpacity>
                  ) : (
                    // 创建表单
                    <View style={styles.addForm}>
                      <Text variant="titleMedium" style={styles.formTitle}>添加新{label}</Text>

                      <TextInput
                        label="供应商名称 *"
                        value={newSupplierName}
                        onChangeText={setNewSupplierName}
                        mode="outlined"
                        placeholder="例如: 陈老板海鲜批发"
                        style={styles.formInput}
                        autoFocus
                      />

                      <TextInput
                        label="联系人"
                        value={newContactPerson}
                        onChangeText={setNewContactPerson}
                        mode="outlined"
                        placeholder="例如: 陈老板"
                        style={styles.formInput}
                      />

                      <TextInput
                        label="联系电话"
                        value={newContactPhone}
                        onChangeText={setNewContactPhone}
                        mode="outlined"
                        placeholder="例如: +8613800000001"
                        keyboardType="phone-pad"
                        style={styles.formInput}
                      />

                      <TextInput
                        label="地址"
                        value={newAddress}
                        onChangeText={setNewAddress}
                        mode="outlined"
                        placeholder="例如: 深圳市水产批发市场"
                        style={styles.formInput}
                      />

                      <Text variant="bodySmall" style={styles.formLabel}>业务类型</Text>
                      <SegmentedButtons
                        value={newBusinessType}
                        onValueChange={setNewBusinessType}
                        buttons={[
                          { value: '水产批发', label: '批发' },
                          { value: '进口商', label: '进口' },
                          { value: '其他', label: '其他' },
                        ]}
                        style={styles.formSegment}
                      />

                      <View style={styles.formActions}>
                        <Button
                          mode="outlined"
                          onPress={() => {
                            setShowAddForm(false);
                            setNewSupplierName('');
                            setNewContactPerson('');
                            setNewContactPhone('');
                            setNewAddress('');
                          }}
                          disabled={creating}
                        >
                          取消
                        </Button>
                        <Button
                          mode="contained"
                          onPress={handleCreateSupplier}
                          loading={creating}
                          disabled={creating}
                        >
                          保存
                        </Button>
                      </View>
                    </View>
                  )
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    marginBottom: 4,
  },
  errorText: {
    color: '#F44336',
    marginTop: 4,
    marginLeft: 12,
    marginBottom: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchBar: {
    margin: 16,
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#757575',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9E9E9E',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
    marginHorizontal: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  addButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
  },
  addForm: {
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 8,
  },
  formTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  formLabel: {
    color: '#757575',
    marginBottom: 8,
    marginTop: 8,
  },
  formInput: {
    marginBottom: 12,
  },
  formSegment: {
    marginBottom: 16,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
});

export default SupplierSelector;
