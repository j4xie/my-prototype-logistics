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
import { platformAPI, FactoryDTO } from '../../services/api/platformApiClient';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建FactoryManagement专用logger
const factoryMgmtLogger = logger.createContextLogger('FactoryManagement');

/**
 * 工厂管理页面
 * 平台管理员管理所有工厂
 */
export default function FactoryManagementScreen() {
  const navigation = useNavigation();
  const [factories, setFactories] = useState<any[]>([]);
  const [filteredFactories, setFilteredFactories] = useState<any[]>([]);
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
      factoryMgmtLogger.debug('加载工厂列表');
      const response = await platformAPI.getFactories();

      if (response.success && response.data) {
        factoryMgmtLogger.info('工厂列表加载成功', {
          factoryCount: response.data.length,
        });
        // 将后端FactoryDTO映射到前端显示格式
        const mappedFactories = response.data.map((factory: FactoryDTO) => ({
          id: factory.id,
          name: factory.factoryName,
          industry: '食品加工', // 后端暂无此字段
          region: factory.address || '未知',
          status: factory.isActive !== false ? 'active' : 'inactive',
          aiQuota: 100, // 后端暂无此字段
          totalUsers: factory.totalUsers || 0,
          createdAt: factory.createdAt || '',
          address: factory.address || '',
        }));
        setFactories(mappedFactories);
      } else {
        // ✅ GOOD: API返回空数据时，设置为空数组
        factoryMgmtLogger.warn('API返回空数据');
        setFactories([]);
      }
    } catch (error) {
      factoryMgmtLogger.error('加载工厂列表失败', error as Error);

      // ✅ GOOD: 不返回假数据，使用统一错误处理
      handleError(error, {
        title: '加载失败',
        customMessage: '无法加载工厂列表，请稍后重试',
      });
      setFactories([]); // 不显示假数据
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFactories();
    setRefreshing(false);
  };

  const handleFactoryPress = (factory: any) => {
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

  const handleEditFactory = (factory: any) => {
    Alert.alert('编辑工厂', `编辑功能开发中\n工厂: ${factory.name}`);
  };

  const handleViewDetails = (factory: any) => {
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

  const renderFactoryCard = (factory: any) => {
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
