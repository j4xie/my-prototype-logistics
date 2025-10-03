import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';

interface WhitelistManagementScreenProps {
  navigation: any;
}

interface WhitelistEntry {
  id: string;
  phoneNumber: string;
  status: 'pending' | 'used' | 'expired';
  createdAt: string;
  expiresAt: string | null;
  usedBy: string | null;
}

export const WhitelistManagementScreen: React.FC<WhitelistManagementScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPhoneNumbers, setNewPhoneNumbers] = useState('');
  const [expiryDays, setExpiryDays] = useState('30');

  // 模拟白名单数据
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([
    {
      id: '1',
      phoneNumber: '+8613800138000',
      status: 'pending',
      createdAt: '2024-03-01',
      expiresAt: '2024-04-01',
      usedBy: null,
    },
    {
      id: '2',
      phoneNumber: '+8613800138001',
      status: 'used',
      createdAt: '2024-02-28',
      expiresAt: null,
      usedBy: '张三',
    },
    {
      id: '3',
      phoneNumber: '+8613800138002',
      status: 'expired',
      createdAt: '2024-02-01',
      expiresAt: '2024-03-01',
      usedBy: null,
    },
  ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    // TODO: 调用实际的API刷新白名单
    setTimeout(() => setRefreshing(false), 1500);
  };

  const handleAddWhitelist = () => {
    const phones = newPhoneNumbers
      .split(/[,\n]/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (phones.length === 0) {
      Alert.alert('提示', '请输入至少一个手机号');
      return;
    }

    // 验证手机号格式
    const invalidPhones = phones.filter((p) => !/^\+?[0-9]{11,}$/.test(p));
    if (invalidPhones.length > 0) {
      Alert.alert('格式错误', `以下手机号格式不正确：\n${invalidPhones.join('\n')}`);
      return;
    }

    // 计算过期时间
    const expiresAt = expiryDays
      ? new Date(Date.now() + parseInt(expiryDays) * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0]
      : null;

    // 添加到白名单
    const newEntries: WhitelistEntry[] = phones.map((phone, index) => ({
      id: `new_${Date.now()}_${index}`,
      phoneNumber: phone,
      status: 'pending',
      createdAt: new Date().toISOString().split('T')[0],
      expiresAt,
      usedBy: null,
    }));

    setWhitelist([...newEntries, ...whitelist]);
    setNewPhoneNumbers('');
    setShowAddModal(false);
    Alert.alert('成功', `已添加 ${phones.length} 个手机号到白名单`);
  };

  const handleDeleteEntry = (entry: WhitelistEntry) => {
    Alert.alert(
      '删除白名单',
      `确定要删除手机号 ${entry.phoneNumber} 吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            setWhitelist(whitelist.filter((e) => e.id !== entry.id));
            Alert.alert('成功', '已删除');
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#F39C12';
      case 'used':
        return '#4CAF50';
      case 'expired':
        return '#999';
      default:
        return '#999';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '待使用';
      case 'used':
        return '已使用';
      case 'expired':
        return '已过期';
      default:
        return status;
    }
  };

  const renderWhitelistEntry = ({ item }: { item: WhitelistEntry }) => (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <View style={styles.phoneContainer}>
          <Ionicons name="phone-portrait-outline" size={20} color="#4ECDC4" />
          <Text style={styles.phoneNumber}>{item.phoneNumber}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.entryBody}>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={14} color="#666" />
          <Text style={styles.infoText}>创建：{item.createdAt}</Text>
        </View>
        {item.expiresAt && (
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={14} color="#666" />
            <Text style={styles.infoText}>过期：{item.expiresAt}</Text>
          </View>
        )}
        {item.usedBy && (
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={14} color="#666" />
            <Text style={styles.infoText}>使用者：{item.usedBy}</Text>
          </View>
        )}
      </View>

      {item.status === 'pending' && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteEntry(item)}
        >
          <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
        </TouchableOpacity>
      )}
    </View>
  );

  const filteredWhitelist = whitelist.filter((entry) =>
    entry.phoneNumber.includes(searchQuery)
  );

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>白名单管理</Text>
          <Text style={styles.headerSubtitle}>管理部门人员注册白名单</Text>
        </View>
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButton}>
          <Ionicons name="add-circle" size={28} color="#4ECDC4" />
        </TouchableOpacity>
      </View>

      {/* 搜索栏 */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索手机号..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            keyboardType="phone-pad"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 统计信息 */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{whitelist.filter((e) => e.status === 'pending').length}</Text>
          <Text style={styles.statLabel}>待使用</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{whitelist.filter((e) => e.status === 'used').length}</Text>
          <Text style={styles.statLabel}>已使用</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{whitelist.filter((e) => e.status === 'expired').length}</Text>
          <Text style={styles.statLabel}>已过期</Text>
        </View>
      </View>

      {/* 白名单列表 */}
      <FlatList
        data={filteredWhitelist}
        renderItem={renderWhitelistEntry}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="phone-portrait-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>暂无白名单数据</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.emptyButtonText}>添加白名单</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* 添加白名单弹窗 */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>添加白名单</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>手机号（每行一个或用逗号分隔）</Text>
              <TextInput
                style={styles.multilineInput}
                placeholder="例如：&#10;+8613800138000&#10;+8613800138001&#10;或：+8613800138000,+8613800138001"
                value={newPhoneNumbers}
                onChangeText={setNewPhoneNumbers}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              <Text style={styles.label}>有效期（天数）</Text>
              <TextInput
                style={styles.input}
                placeholder="留空表示永久有效"
                value={expiryDays}
                onChangeText={setExpiryDays}
                keyboardType="number-pad"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.cancelButtonText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleAddWhitelist}
                >
                  <Text style={styles.confirmButtonText}>添加</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  addButton: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  listContent: {
    padding: 20,
  },
  entryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  entryBody: {
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  deleteButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 16,
  },
  multilineInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 16,
    minHeight: 120,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  modalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 12,
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#4ECDC4',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default WhitelistManagementScreen;
