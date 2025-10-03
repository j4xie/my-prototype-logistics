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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FactoryListScreenProps {
  navigation: any;
  route: {
    params: {
      mode: 'view' | 'manage'; // view: 只读查看, manage: 完整CRUD操作
    };
  };
}

interface Factory {
  id: string;
  factoryId: string;
  name: string;
  industry: string;
  region: string;
  status: 'active' | 'inactive' | 'suspended';
  employeeCount: number;
  createdAt: string;
}

export const FactoryListScreen: React.FC<FactoryListScreenProps> = ({ navigation, route }) => {
  const { mode } = route.params;
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');

  // 模拟工厂数据
  const [factories, setFactories] = useState<Factory[]>([
    {
      id: '1',
      factoryId: 'FAC001',
      name: '白垩纪食品加工厂',
      industry: 'processing',
      region: 'jiangsu',
      status: 'active',
      employeeCount: 45,
      createdAt: '2024-01-15',
    },
    {
      id: '2',
      factoryId: 'FAC002',
      name: '白垩纪养殖场',
      industry: 'farming',
      region: 'shandong',
      status: 'active',
      employeeCount: 32,
      createdAt: '2024-02-01',
    },
    {
      id: '3',
      factoryId: 'FAC003',
      name: '白垩纪物流中心',
      industry: 'logistics',
      region: 'zhejiang',
      status: 'inactive',
      employeeCount: 28,
      createdAt: '2024-02-20',
    },
  ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    // TODO: 调用实际的API刷新工厂列表
    setTimeout(() => setRefreshing(false), 1500);
  };

  const handleViewFactory = (factory: Factory) => {
    // 跳转到工厂详情页（只读模式）
    navigation.navigate('FactoryDetail', { factoryId: factory.id, mode: 'view' });
  };

  const handleEditFactory = (factory: Factory) => {
    if (mode !== 'manage') {
      Alert.alert('权限不足', '当前为查看模式，无法编辑工厂信息');
      return;
    }
    navigation.navigate('FactoryEdit', { factoryId: factory.id });
  };

  const handleDeleteFactory = (factory: Factory) => {
    if (mode !== 'manage') {
      Alert.alert('权限不足', '当前为查看模式，无法删除工厂');
      return;
    }

    Alert.alert(
      '删除工厂',
      `确定要删除工厂 "${factory.name}" 吗？此操作无法撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            setFactories(factories.filter((f) => f.id !== factory.id));
            Alert.alert('成功', '工厂已删除');
          },
        },
      ]
    );
  };

  const handleCreateFactory = () => {
    if (mode !== 'manage') {
      Alert.alert('权限不足', '当前为查看模式，无法创建新工厂');
      return;
    }
    navigation.navigate('FactoryCreate');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#4CAF50';
      case 'inactive':
        return '#999';
      case 'suspended':
        return '#FF6B6B';
      default:
        return '#999';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '活跃';
      case 'inactive':
        return '未激活';
      case 'suspended':
        return '已暂停';
      default:
        return status;
    }
  };

  const getIndustryText = (industry: string) => {
    switch (industry) {
      case 'farming':
        return '养殖';
      case 'processing':
        return '加工';
      case 'logistics':
        return '物流';
      default:
        return industry;
    }
  };

  const renderFactoryCard = ({ item }: { item: Factory }) => (
    <TouchableOpacity
      style={styles.factoryCard}
      onPress={() => handleViewFactory(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.factoryName}>{item.name}</Text>
          <Text style={styles.factoryId}>ID: {item.factoryId}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Ionicons name="business-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{getIndustryText(item.industry)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{item.region}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="people-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{item.employeeCount} 名员工</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.infoText}>创建于 {item.createdAt}</Text>
        </View>
      </View>

      {mode === 'manage' && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEditFactory(item)}
          >
            <Ionicons name="create-outline" size={18} color="#3182CE" />
            <Text style={[styles.actionButtonText, { color: '#3182CE' }]}>编辑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteFactory(item)}
          >
            <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
            <Text style={[styles.actionButtonText, { color: '#FF6B6B' }]}>删除</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  const filteredFactories = factories.filter((factory) => {
    const matchesSearch = factory.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      factory.factoryId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || factory.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {mode === 'view' ? '查看所有工厂' : '管理所有工厂'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {mode === 'view' ? '只读模式' : '完整管理权限'}
          </Text>
        </View>
        {mode === 'manage' && (
          <TouchableOpacity onPress={handleCreateFactory} style={styles.addButton}>
            <Ionicons name="add-circle" size={28} color="#4ECDC4" />
          </TouchableOpacity>
        )}
      </View>

      {/* 搜索栏 */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索工厂名称或ID..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 状态筛选 */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['all', 'active', 'inactive', 'suspended'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                filterStatus === status && styles.filterChipActive,
              ]}
              onPress={() => setFilterStatus(status as any)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterStatus === status && styles.filterChipTextActive,
                ]}
              >
                {status === 'all' ? '全部' : getStatusText(status)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 工厂列表 */}
      <FlatList
        data={filteredFactories}
        renderItem={renderFactoryCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>暂无工厂数据</Text>
          </View>
        }
      />
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
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#4ECDC4',
  },
  filterChipText: {
    fontSize: 14,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  listContent: {
    padding: 20,
  },
  factoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitleContainer: {
    flex: 1,
  },
  factoryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  factoryId: {
    fontSize: 12,
    color: '#999',
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
  cardBody: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  editButton: {
    backgroundColor: '#E3F2FD',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
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
  },
});

export default FactoryListScreen;
