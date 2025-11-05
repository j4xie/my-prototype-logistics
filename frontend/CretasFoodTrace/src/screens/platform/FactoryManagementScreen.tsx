import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  List,
  Avatar,
  Chip,
  Searchbar,
  FAB,
  ActivityIndicator,
  Divider,
  IconButton,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

// Mock工厂数据
const MOCK_FACTORIES = [
  {
    id: 'FISH_2025_001',
    name: '白垩纪鱼肉加工厂',
    industry: '水产加工',
    region: '华东',
    status: 'active',
    aiQuota: 100,
    totalUsers: 12,
    createdAt: '2025-01-15',
    address: '江苏省南京市',
  },
  {
    id: 'MEAT_2025_001',
    name: '白垩纪肉类加工厂',
    industry: '肉制品',
    region: '华北',
    status: 'active',
    aiQuota: 80,
    totalUsers: 8,
    createdAt: '2025-02-01',
    address: '北京市朝阳区',
  },
  {
    id: 'VEG_2025_001',
    name: '白垩纪蔬菜加工厂',
    industry: '蔬菜加工',
    region: '华南',
    status: 'active',
    aiQuota: 50,
    totalUsers: 6,
    createdAt: '2025-02-20',
    address: '广东省广州市',
  },
];

/**
 * 工厂管理页面
 * 平台管理员管理所有工厂
 */
export default function FactoryManagementScreen() {
  const navigation = useNavigation();
  const [factories, setFactories] = useState(MOCK_FACTORIES);
  const [filteredFactories, setFilteredFactories] = useState(MOCK_FACTORIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFactories();
  }, []);

  useEffect(() => {
    // 搜索过滤
    if (searchQuery.trim() === '') {
      setFilteredFactories(factories);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = factories.filter(
        (factory) =>
          factory.name.toLowerCase().includes(query) ||
          factory.id.toLowerCase().includes(query) ||
          factory.industry.toLowerCase().includes(query) ||
          factory.region.toLowerCase().includes(query)
      );
      setFilteredFactories(filtered);
    }
  }, [searchQuery, factories]);

  const loadFactories = async () => {
    setLoading(true);
    try {
      // TODO: 调用后端API获取工厂列表
      // const response = await platformAPI.getFactories();
      // setFactories(response.data);

      // 当前使用Mock数据
      console.log('📦 使用Mock数据 - 工厂列表');
      setFactories(MOCK_FACTORIES);
    } catch (error) {
      console.error('加载工厂列表失败:', error);
      Alert.alert('错误', '加载工厂列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFactories();
    setRefreshing(false);
  };

  const handleFactoryPress = (factory: typeof MOCK_FACTORIES[0]) => {
    Alert.alert(
      factory.name,
      `ID: ${factory.id}\n行业: ${factory.industry}\n地区: ${factory.region}\n用户数: ${factory.totalUsers}\nAI配额: ${factory.aiQuota}次/周`,
      [
        { text: '取消', style: 'cancel' },
        { text: '编辑', onPress: () => handleEditFactory(factory) },
        { text: '查看详情', onPress: () => handleViewDetails(factory) },
      ]
    );
  };

  const handleEditFactory = (factory: typeof MOCK_FACTORIES[0]) => {
    Alert.alert('编辑工厂', `编辑功能开发中\n工厂: ${factory.name}`);
  };

  const handleViewDetails = (factory: typeof MOCK_FACTORIES[0]) => {
    Alert.alert('工厂详情', `详情页面开发中\n工厂: ${factory.name}`);
  };

  const handleAddFactory = () => {
    Alert.alert('添加工厂', '添加工厂功能开发中');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#4CAF50';
      case 'inactive':
        return '#9E9E9E';
      case 'suspended':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '运营中';
      case 'inactive':
        return '未激活';
      case 'suspended':
        return '已暂停';
      default:
        return status;
    }
  };

  const renderFactoryCard = (factory: typeof MOCK_FACTORIES[0]) => {
    return (
      <Card key={factory.id} style={styles.factoryCard} mode="elevated">
        <Pressable onPress={() => handleFactoryPress(factory)}>
          <Card.Content>
            {/* 工厂头部 */}
            <View style={styles.factoryHeader}>
              <View style={styles.factoryTitleRow}>
                <Avatar.Icon icon="factory" size={40} style={{ backgroundColor: '#2196F3' }} />
                <View style={styles.factoryInfo}>
                  <Text variant="titleMedium" style={styles.factoryName}>
                    {factory.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.factoryId}>
                    {factory.id}
                  </Text>
                </View>
              </View>
              <Chip
                mode="flat"
                textStyle={{ color: getStatusColor(factory.status), fontSize: 12 }}
                style={[styles.statusChip, { backgroundColor: `${getStatusColor(factory.status)}20` }]}
              >
                {getStatusText(factory.status)}
              </Chip>
            </View>

            <Divider style={styles.divider} />

            {/* 工厂详情 */}
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <List.Icon icon="domain" size={20} />
                <Text variant="bodySmall" style={styles.detailText}>
                  {factory.industry}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <List.Icon icon="map-marker" size={20} />
                <Text variant="bodySmall" style={styles.detailText}>
                  {factory.region}
                </Text>
              </View>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <List.Icon icon="account-group" size={20} />
                <Text variant="bodySmall" style={styles.detailText}>
                  {factory.totalUsers} 用户
                </Text>
              </View>
              <View style={styles.detailItem}>
                <List.Icon icon="robot" size={20} />
                <Text variant="bodySmall" style={styles.detailText}>
                  {factory.aiQuota}次/周
                </Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            {/* 底部操作 */}
            <View style={styles.actionsRow}>
              <Text variant="bodySmall" style={styles.createdText}>
                创建: {factory.createdAt}
              </Text>
              <View style={styles.actionButtons}>
                <IconButton
                  icon="pencil"
                  size={20}
                  onPress={() => handleEditFactory(factory)}
                />
                <IconButton
                  icon="eye"
                  size={20}
                  onPress={() => handleViewDetails(factory)}
                />
              </View>
            </View>
          </Card.Content>
        </Pressable>
      </Card>
    );
  };

  if (loading && factories.length === 0) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="工厂管理" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载工厂数据中...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="工厂管理" />
        <Appbar.Action icon="refresh" onPress={handleRefresh} />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 搜索栏 */}
        <Searchbar
          placeholder="搜索工厂名称、ID、行业..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />

        {/* 统计卡片 */}
        <Card style={styles.statsCard} mode="elevated">
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={styles.statValue}>
                  {factories.length}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  工厂总数
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={[styles.statValue, { color: '#4CAF50' }]}>
                  {factories.filter((f) => f.status === 'active').length}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  运营中
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={styles.statValue}>
                  {factories.reduce((sum, f) => sum + f.totalUsers, 0)}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  总用户数
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 工厂列表 */}
        <View style={styles.listHeader}>
          <Text variant="titleMedium" style={styles.listTitle}>
            工厂列表 ({filteredFactories.length})
          </Text>
        </View>

        {filteredFactories.length === 0 ? (
          <Card style={styles.emptyCard} mode="elevated">
            <Card.Content>
              <Text variant="bodyLarge" style={styles.emptyText}>
                {searchQuery ? '未找到匹配的工厂' : '暂无工厂数据'}
              </Text>
            </Card.Content>
          </Card>
        ) : (
          filteredFactories.map(renderFactoryCard)
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* 添加工厂按钮 */}
      <FAB icon="plus" style={styles.fab} onPress={handleAddFactory} label="添加工厂" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#757575',
  },
  searchBar: {
    marginBottom: 16,
  },
  statsCard: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontWeight: '700',
    color: '#2196F3',
  },
  statLabel: {
    marginTop: 4,
    color: '#757575',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
  listHeader: {
    marginBottom: 12,
  },
  listTitle: {
    fontWeight: '600',
    color: '#1976D2',
  },
  factoryCard: {
    marginBottom: 12,
  },
  factoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  factoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  factoryInfo: {
    marginLeft: 12,
    flex: 1,
  },
  factoryName: {
    fontWeight: '600',
  },
  factoryId: {
    color: '#757575',
    marginTop: 2,
  },
  statusChip: {
    height: 24,
  },
  divider: {
    marginVertical: 12,
  },
  detailsGrid: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    color: '#757575',
    marginLeft: -8,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createdText: {
    color: '#9E9E9E',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: -8,
  },
  emptyCard: {
    padding: 32,
  },
  emptyText: {
    textAlign: 'center',
    color: '#757575',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
  },
  bottomPadding: {
    height: 80,
  },
});
