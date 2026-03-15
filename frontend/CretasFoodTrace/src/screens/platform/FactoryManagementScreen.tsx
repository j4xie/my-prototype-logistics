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
import { useTranslation } from 'react-i18next';
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

// Extended factory type for UI display (includes computed fields not in FactoryDTO)
interface DisplayFactory extends FactoryDTO {
  industry: string;
  region: string;
  aiQuota: number;
  totalUsers: number;
  createdAt: string;
}

export default function FactoryManagementScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation('platform');
  const [factories, setFactories] = useState<DisplayFactory[]>([]);
  const [filteredFactories, setFilteredFactories] = useState<DisplayFactory[]>([]);
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
          (factory.name || '').toLowerCase().includes(query) ||
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
        const mappedFactories = response.data.map((factory: FactoryDTO): DisplayFactory => {
          const mapped: DisplayFactory = {
            ...factory,
            name: factory.name || factory.factoryName, // ✅ API返回name字段，factoryName作为后备
            industry: factory.industry || t('factory.foodProcessing'), // 后端暂无此字段
            region: factory.address || t('factory.unknown'),
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
        title: t('errors.loadFailed'),
        customMessage: t('factoryManagement.messages.loadFailed'),
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

  const handleFactoryPress = (factory: DisplayFactory) => {
    Alert.alert(
      factory.name || factory.factoryName,
      `ID: ${factory.id}\n${t('factory.industry')}: ${factory.industry}\n${t('factory.region')}: ${factory.region}\n${t('factory.usersCount')}: ${factory.totalUsers}\nAI${t('common.buttons.quota', { defaultValue: '配额' })}: ${factory.aiQuota}${t('factory.weeklyQuota')}`,
      [
        { text: t('common.buttons.cancel'), style: 'cancel' },
        { text: t('factoryManagement.actions.setupTemplates'), onPress: () => handleSetupTemplates(factory) },
        { text: t('common.buttons.edit'), onPress: () => handleEditFactory(factory) },
      ]
    );
  };

  const handleEditFactory = (factory: DisplayFactory) => {
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

  const handleViewDetails = (factory: DisplayFactory) => {
    Alert.alert(t('factoryManagement.viewDetails'), t('factoryManagement.detailsInDevelopment', { name: factory.name }));
  };

  const handleSetupTemplates = (factory: DisplayFactory) => {
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
      Alert.alert(t('dialogs.validationFailed'), t('factoryManagement.validation.nameRequired'));
      return;
    }

    setSubmitting(true);
    try {
      if (editMode && editingFactoryId) {
        // 编辑模式
        factoryMgmtLogger.info('更新工厂', { factoryId: editingFactoryId, data: formData });
        await platformAPI.updateFactory(editingFactoryId, formData);
        Alert.alert(t('success.title'), t('factoryManagement.messages.updateSuccess'));
      } else {
        // 添加模式
        factoryMgmtLogger.info('创建工厂', { data: formData });
        await platformAPI.createFactory(formData as CreateFactoryRequest);
        Alert.alert(t('success.title'), t('factoryManagement.messages.createSuccess'));
      }

      handleCloseDialog();
      await loadFactories(); // 重新加载列表
    } catch (error) {
      factoryMgmtLogger.error(editMode ? '更新工厂失败' : '创建工厂失败', error as Error);
      handleError(error, {
        title: editMode ? t('errors.updateFailed') : t('errors.createFailed'),
        customMessage: editMode ? t('factoryManagement.messages.updateFailed') : t('factoryManagement.messages.createFailed'),
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
        return t('factory.status.active');
      case 'inactive':
        return t('factory.status.inactive');
      case 'suspended':
        return t('factory.status.suspended');
      default:
        return status;
    }
  };

  const renderFactoryCard = (factory: DisplayFactory) => {
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
                  {factory.totalUsers} {t('factory.users')}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <List.Icon icon="robot" />
                <Text variant="bodySmall" style={styles.detailText}>
                  {factory.aiQuota}{t('factory.weeklyQuota')}
                </Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            {/* 底部操作 */}
            <View style={styles.actionsRow}>
              <Text variant="bodySmall" style={styles.createdText}>
                {t('factory.createdAt')}: {factory.createdAt}
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
          <Appbar.Content title={t('factoryManagement.title')} />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>{t('factoryManagement.loadingFactories')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('factoryManagement.title')} />
        <Appbar.Action icon="refresh" onPress={handleRefresh} />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 搜索栏 */}
        <Searchbar
          placeholder={t('factoryManagement.searchPlaceholder')}
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
                  {t('stats.totalFactories')}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={[styles.statValue, { color: '#4CAF50' }]}>
                  {factories.filter((f) => f.status === 'active').length}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  {t('stats.activeFactories')}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={styles.statValue}>
                  {factories.reduce((sum, f) => sum + f.totalUsers, 0)}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  {t('stats.totalUserCount')}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 工厂列表 */}
        <View style={styles.listHeader}>
          <Text variant="titleMedium" style={styles.listTitle}>
            {t('factoryManagement.factoryList')} ({filteredFactories.length})
          </Text>
        </View>

        {filteredFactories.length === 0 ? (
          <Card style={styles.emptyCard} mode="elevated">
            <Card.Content>
              <Text variant="bodyLarge" style={styles.emptyText}>
                {searchQuery ? t('factoryManagement.noFactoriesFound') : t('factoryManagement.noFactoryData')}
              </Text>
            </Card.Content>
          </Card>
        ) : (
          filteredFactories.map(renderFactoryCard)
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* 添加工厂按钮 */}
      <FAB icon="plus" style={styles.fab} onPress={handleAddFactory} label={t('factoryManagement.addFactory')} />

      {/* 添加/编辑工厂对话框 */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={handleCloseDialog} style={styles.dialog}>
          <Dialog.Title>{editMode ? t('factoryManagement.editFactory') : t('factoryManagement.addFactory')}</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScroll}>
            <ScrollView>
              <TextInput
                label={t('factoryManagement.form.factoryName')}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label={t('factoryManagement.form.industryType')}
                value={formData.industry}
                onChangeText={(text) => setFormData({ ...formData, industry: text })}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label={t('factoryManagement.form.address')}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label={t('factoryManagement.form.contactName')}
                value={formData.contactName}
                onChangeText={(text) => setFormData({ ...formData, contactName: text })}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label={t('factoryManagement.form.contactPhone')}
                value={formData.contactPhone}
                onChangeText={(text) => setFormData({ ...formData, contactPhone: text })}
                mode="outlined"
                keyboardType="phone-pad"
                style={styles.input}
              />
              <TextInput
                label={t('factoryManagement.form.contactEmail')}
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
              {t('factoryManagement.actions.cancel')}
            </Button>
            <Button onPress={handleSubmitFactory} loading={submitting} disabled={submitting}>
              {editMode ? t('factoryManagement.actions.update') : t('factoryManagement.actions.create')}
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
