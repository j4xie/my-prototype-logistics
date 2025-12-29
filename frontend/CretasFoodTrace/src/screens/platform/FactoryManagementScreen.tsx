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
  Dialog,
  Portal,
  Button,
  TextInput,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { platformAPI, FactoryDTO, CreateFactoryRequest } from '../../services/api/platformApiClient';
import { PlatformStackParamList } from '../../navigation/PlatformStackNavigator';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建FactoryManagement专用logger
const factoryMgmtLogger = logger.createContextLogger('FactoryManagement');

/**
 * 工厂管理页面
 * 平台管理员管理所有工厂
 */
type NavigationProp = NativeStackNavigationProp<PlatformStackParamList, 'FactoryManagement'>;

export default function FactoryManagementScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [factories, setFactories] = useState<any[]>([]);
  const [filteredFactories, setFilteredFactories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // 添加/编辑工厂对话框状态
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editMode, setEditMode] = useState(false); // true=编辑, false=添加
  const [editingFactoryId, setEditingFactoryId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    address: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
  });
  const [submitting, setSubmitting] = useState(false);

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

      // 📊 调试日志：查看API响应结构
      factoryMgmtLogger.debug('API响应结构', {
        hasSuccess: !!response.success,
        hasData: !!response.data,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        dataLength: Array.isArray(response.data) ? response.data.length : 0,
        firstItem: Array.isArray(response.data) && response.data.length > 0 ? response.data[0] : null,
      });

      if (response.success && response.data) {
        factoryMgmtLogger.info('工厂列表加载成功', {
          factoryCount: response.data.length,
        });
        // 将后端FactoryDTO映射到前端显示格式
        const mappedFactories = response.data.map((factory: FactoryDTO) => {
          const mapped = {
            id: factory.id,
            name: factory.name || factory.factoryName, // ✅ API返回name字段，factoryName作为后备
            industry: '食品加工', // 后端暂无此字段
            region: factory.address || '未知',
            status: factory.isActive !== false ? 'active' : 'inactive',
            aiQuota: 100, // 后端暂无此字段
            totalUsers: factory.totalUsers || 0,
            createdAt: factory.createdAt || '',
            address: factory.address || '',
          };
          // 📊 调试日志：查看每个工厂的映射
          factoryMgmtLogger.debug('工厂映射', {
            原始: { id: factory.id, name: factory.name, factoryName: factory.factoryName },
            映射后: { id: mapped.id, name: mapped.name },
          });
          return mapped;
        });
        factoryMgmtLogger.info('映射后的工厂列表', { count: mappedFactories.length, factories: mappedFactories });
        setFactories(mappedFactories);
      } else {
        // ✅ GOOD: API返回空数据时，设置为空数组
        factoryMgmtLogger.warn('API返回空数据', { response });
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
        { text: '初始化模板', onPress: () => handleSetupTemplates(factory) },
        { text: '编辑', onPress: () => handleEditFactory(factory) },
      ]
    );
  };

  const handleEditFactory = (factory: any) => {
    setEditMode(true);
    setEditingFactoryId(factory.id);
    setFormData({
      name: factory.name || '',
      industry: factory.industry || '',
      address: factory.address || '',
      contactName: factory.contactName || '',
      contactPhone: factory.contactPhone || '',
      contactEmail: factory.contactEmail || '',
    });
    setDialogVisible(true);
  };

  const handleViewDetails = (factory: any) => {
    Alert.alert('工厂详情', `详情页面开发中\n工厂: ${factory.name}`);
  };

  const handleSetupTemplates = (factory: any) => {
    navigation.navigate('FactorySetup', {
      factoryId: factory.id,
      factoryName: factory.name,
    });
  };

  const handleAddFactory = () => {
    setEditMode(false);
    setEditingFactoryId(null);
    setFormData({
      name: '',
      industry: '',
      address: '',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
    });
    setDialogVisible(true);
  };

  const handleCloseDialog = () => {
    setDialogVisible(false);
    setFormData({
      name: '',
      industry: '',
      address: '',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
    });
  };

  const handleSubmitFactory = async () => {
    // 验证必填字段
    if (!formData.name.trim()) {
      Alert.alert('验证失败', '请输入工厂名称');
      return;
    }

    setSubmitting(true);
    try {
      if (editMode && editingFactoryId) {
        // 编辑模式
        factoryMgmtLogger.info('更新工厂', { factoryId: editingFactoryId, data: formData });
        await platformAPI.updateFactory(editingFactoryId, formData);
        Alert.alert('成功', '工厂信息已更新');
      } else {
        // 添加模式
        factoryMgmtLogger.info('创建工厂', { data: formData });
        await platformAPI.createFactory(formData as CreateFactoryRequest);
        Alert.alert('成功', '工厂已创建');
      }

      handleCloseDialog();
      await loadFactories(); // 重新加载列表
    } catch (error) {
      factoryMgmtLogger.error(editMode ? '更新工厂失败' : '创建工厂失败', error as Error);
      handleError(error, {
        title: editMode ? '更新失败' : '创建失败',
        customMessage: editMode ? '无法更新工厂信息，请重试' : '无法创建工厂，请重试',
      });
    } finally {
      setSubmitting(false);
    }
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
                <List.Icon icon="domain" />
                <Text variant="bodySmall" style={styles.detailText}>
                  {factory.industry}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <List.Icon icon="map-marker" />
                <Text variant="bodySmall" style={styles.detailText}>
                  {factory.region}
                </Text>
              </View>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <List.Icon icon="account-group" />
                <Text variant="bodySmall" style={styles.detailText}>
                  {factory.totalUsers} 用户
                </Text>
              </View>
              <View style={styles.detailItem}>
                <List.Icon icon="robot" />
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
                  icon="file-document-outline"
                  size={20}
                  onPress={() => handleSetupTemplates(factory)}
                />
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

      {/* 添加/编辑工厂对话框 */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={handleCloseDialog} style={styles.dialog}>
          <Dialog.Title>{editMode ? '编辑工厂' : '添加工厂'}</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScroll}>
            <ScrollView>
              <TextInput
                label="工厂名称 *"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="行业类型"
                value={formData.industry}
                onChangeText={(text) => setFormData({ ...formData, industry: text })}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="地址"
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="联系人"
                value={formData.contactName}
                onChangeText={(text) => setFormData({ ...formData, contactName: text })}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="联系电话"
                value={formData.contactPhone}
                onChangeText={(text) => setFormData({ ...formData, contactPhone: text })}
                mode="outlined"
                keyboardType="phone-pad"
                style={styles.input}
              />
              <TextInput
                label="联系邮箱"
                value={formData.contactEmail}
                onChangeText={(text) => setFormData({ ...formData, contactEmail: text })}
                mode="outlined"
                keyboardType="email-address"
                style={styles.input}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={handleCloseDialog} disabled={submitting}>
              取消
            </Button>
            <Button onPress={handleSubmitFactory} loading={submitting} disabled={submitting}>
              {editMode ? '更新' : '创建'}
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
  dialog: {
    maxHeight: '80%',
  },
  dialogScroll: {
    maxHeight: 400,
    paddingHorizontal: 0,
  },
  input: {
    marginBottom: 12,
  },
});
