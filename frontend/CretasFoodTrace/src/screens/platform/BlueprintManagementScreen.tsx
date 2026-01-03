/**
 * 蓝图版本管理界面
 *
 * Sprint 3 任务: S3-8 蓝图管理界面
 *
 * 平台管理员用于管理工厂蓝图版本:
 * - 查看蓝图版本历史
 * - 发布新版本
 * - 管理工厂绑定
 * - 推送版本升级
 * - 批量升级/回滚工厂
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Pressable,
} from 'react-native';
import {
  Appbar,
  Text,
  Card,
  Searchbar,
  Chip,
  Avatar,
  Button,
  IconButton,
  Menu,
  Divider,
  ActivityIndicator,
  FAB,
  Portal,
  Modal,
  List,
  Badge,
  TextInput,
  Switch,
  SegmentedButtons,
  ProgressBar,
  DataTable,
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlatformStackParamList } from '../../navigation/PlatformStackNavigator';
import {
  blueprintVersionApiClient,
  BlueprintVersion,
  FactoryBinding,
  VersionChangeSummary,
  VersionUpgradeResult,
} from '../../services/api/blueprintVersionApiClient';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建专用 logger
const blueprintLogger = logger.createContextLogger('BlueprintManagement');

type NavigationProp = NativeStackNavigationProp<PlatformStackParamList>;
type RouteProps = RouteProp<PlatformStackParamList, 'BlueprintManagement'>;

// Tab 类型
type TabValue = 'versions' | 'factories' | 'upgrade';

// 变更类型颜色映射
const CHANGE_TYPE_COLORS: Record<string, string> = {
  CREATE: '#4CAF50',
  UPDATE: '#2196F3',
  PUBLISH: '#9C27B0',
  DEPRECATE: '#F44336',
};

// Note: CHANGE_TYPE_LABELS and UPDATE_POLICY_LABELS are now handled via i18n
// Use t('blueprint.changeTypeCreate'), t('blueprint.changeTypeUpdate'), etc.

export function BlueprintManagementScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation('platform');
  const { blueprintId, blueprintName } = route.params || {};

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>('versions');

  // 版本数据
  const [versions, setVersions] = useState<BlueprintVersion[]>([]);
  const [latestVersion, setLatestVersion] = useState<BlueprintVersion | null>(null);

  // 工厂绑定数据
  const [bindings, setBindings] = useState<FactoryBinding[]>([]);
  const [outdatedFactories, setOutdatedFactories] = useState<FactoryBinding[]>([]);

  // 搜索
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');

  // 模态框状态
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [publishNotes, setPublishNotes] = useState('');
  const [publishing, setPublishing] = useState(false);

  const [versionDetailModal, setVersionDetailModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<BlueprintVersion | null>(null);

  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [compareFromVersion, setCompareFromVersion] = useState<number | null>(null);
  const [compareToVersion, setCompareToVersion] = useState<number | null>(null);
  const [compareResult, setCompareResult] = useState<VersionChangeSummary | null>(null);
  const [comparing, setComparing] = useState(false);

  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [selectedFactories, setSelectedFactories] = useState<string[]>([]);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeResults, setUpgradeResults] = useState<VersionUpgradeResult[]>([]);

  const [bindingSettingsModal, setBindingSettingsModal] = useState(false);
  const [selectedBinding, setSelectedBinding] = useState<FactoryBinding | null>(null);
  const [bindingAutoUpdate, setBindingAutoUpdate] = useState(false);
  const [bindingPolicy, setBindingPolicy] = useState<string>('MANUAL');

  // 加载数据
  const loadData = useCallback(async () => {
    if (!blueprintId) {
      setLoading(false);
      return;
    }

    try {
      blueprintLogger.debug('加载蓝图版本数据', { blueprintId });

      const [versionsData, bindingsData, outdatedData, latest] = await Promise.all([
        blueprintVersionApiClient.getVersionHistory(blueprintId),
        blueprintVersionApiClient.getBindingFactories(blueprintId),
        blueprintVersionApiClient.getOutdatedFactories(blueprintId),
        blueprintVersionApiClient.getLatestVersion(blueprintId),
      ]);

      setVersions(versionsData);
      setBindings(bindingsData);
      setOutdatedFactories(outdatedData);
      setLatestVersion(latest);

      blueprintLogger.info('数据加载成功', {
        versions: versionsData.length,
        bindings: bindingsData.length,
        outdated: outdatedData.length,
      });
    } catch (error) {
      blueprintLogger.error('加载数据失败', error as Error);
      handleError(error, {
        title: t('errors.loadFailed'),
        customMessage: t('blueprint.loading'),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // 过滤版本
  const filteredVersions = versions.filter((v) => {
    const matchSearch =
      !searchQuery ||
      v.changeDescription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.version.toString().includes(searchQuery);

    const matchFilter =
      filterStatus === 'all' ||
      (filterStatus === 'published' && v.isPublished) ||
      (filterStatus === 'draft' && !v.isPublished);

    return matchSearch && matchFilter;
  });

  // 发布新版本
  const handlePublish = async () => {
    if (!blueprintId || !publishNotes.trim()) {
      Alert.alert(t('dialogs.validationFailed'), t('blueprint.versionNotesPlaceholder'));
      return;
    }

    setPublishing(true);
    try {
      const result = await blueprintVersionApiClient.publishVersion(blueprintId, {
        releaseNotes: publishNotes,
        notify: true,
      });

      if (result) {
        Alert.alert(t('success.title'), t('blueprint.publishSuccess', { version: result.version }));
        setPublishModalVisible(false);
        setPublishNotes('');
        loadData();
      } else {
        Alert.alert(t('errors.updateFailed'), t('blueprint.publishFailed'));
      }
    } catch (error) {
      blueprintLogger.error('发布版本失败', error as Error);
      Alert.alert(t('aiQuota.error'), t('blueprint.publishFailed'));
    } finally {
      setPublishing(false);
    }
  };

  // 比较版本
  const handleCompare = async () => {
    if (!blueprintId || !compareFromVersion || !compareToVersion) {
      return;
    }

    setComparing(true);
    try {
      const result = await blueprintVersionApiClient.compareVersions(
        blueprintId,
        compareFromVersion,
        compareToVersion
      );
      setCompareResult(result);
    } catch (error) {
      blueprintLogger.error('比较版本失败', error as Error);
      Alert.alert(t('aiQuota.error'), t('errors.loadFailed'));
    } finally {
      setComparing(false);
    }
  };

  // 升级工厂
  const handleUpgradeFactories = async () => {
    if (selectedFactories.length === 0) {
      Alert.alert(t('dialogs.validationFailed'), t('blueprint.upgradeFactories'));
      return;
    }

    setUpgrading(true);
    try {
      const results = await blueprintVersionApiClient.batchUpgradeFactories(
        selectedFactories,
        { force: false }
      );

      setUpgradeResults(results);
      const successCount = results.filter((r) => r.success).length;

      Alert.alert(
        t('blueprint.upgradeComplete'),
        t('blueprint.upgradeSuccessCount', { success: successCount, total: results.length })
      );

      if (successCount > 0) {
        loadData();
      }
    } catch (error) {
      blueprintLogger.error('升级工厂失败', error as Error);
      Alert.alert(t('aiQuota.error'), t('errors.updateFailed'));
    } finally {
      setUpgrading(false);
    }
  };

  // 更新绑定设置
  const handleUpdateBindingSettings = async () => {
    if (!selectedBinding) return;

    try {
      await blueprintVersionApiClient.updateBindingSettings(
        selectedBinding.factoryId,
        bindingAutoUpdate,
        bindingPolicy
      );

      Alert.alert(t('success.title'), t('aiQuota.ruleSaved'));
      setBindingSettingsModal(false);
      loadData();
    } catch (error) {
      blueprintLogger.error('更新设置失败', error as Error);
      Alert.alert(t('aiQuota.error'), t('errors.updateFailed'));
    }
  };

  // 回滚工厂
  const handleRollback = (binding: FactoryBinding) => {
    Alert.alert(
      t('blueprint.confirmRollback'),
      t('blueprint.confirmRollbackMessage', { name: binding.factoryName || binding.factoryId }),
      [
        { text: t('aiQuota.cancel'), style: 'cancel' },
        {
          text: t('blueprint.rollback'),
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await blueprintVersionApiClient.rollbackFactory(
                binding.factoryId,
                binding.appliedVersion - 1,
                'Admin manual rollback'
              );

              if (result?.success) {
                Alert.alert(t('success.title'), t('blueprint.rollbackSuccess'));
                loadData();
              } else {
                Alert.alert(t('errors.updateFailed'), result?.summary || t('blueprint.rollbackFailed'));
              }
            } catch (error) {
              blueprintLogger.error('回滚失败', error as Error);
              Alert.alert(t('aiQuota.error'), t('blueprint.rollbackFailed'));
            }
          },
        },
      ]
    );
  };

  // 渲染版本卡片
  const renderVersionCard = (version: BlueprintVersion) => {
    const color = CHANGE_TYPE_COLORS[version.changeType] || '#757575';
    const changeTypeKey = `blueprint.changeType${version.changeType.charAt(0) + version.changeType.slice(1).toLowerCase()}`;
    const label = t(changeTypeKey as 'blueprint.changeTypeCreate');

    return (
      <Card key={version.id} style={styles.versionCard} mode="elevated">
        <Pressable
          onPress={() => {
            setSelectedVersion(version);
            setVersionDetailModal(true);
          }}
        >
          <Card.Content>
            <View style={styles.versionHeader}>
              <View style={styles.versionInfo}>
                <View style={styles.versionTitleRow}>
                  <Text variant="titleMedium" style={styles.versionNumber}>
                    v{version.version}
                  </Text>
                  <Chip
                    mode="flat"
                    compact
                    textStyle={{ color: '#fff', fontSize: 11 }}
                    style={{ backgroundColor: color }}
                  >
                    {label}
                  </Chip>
                  {version.isPublished && (
                    <Chip
                      mode="outlined"
                      compact
                      textStyle={styles.publishedChipText}
                      style={styles.publishedChip}
                      icon="check-circle"
                    >
                      {t('blueprint.published')}
                    </Chip>
                  )}
                </View>
                <Text variant="bodySmall" style={styles.versionDate}>
                  {new Date(version.createdAt).toLocaleString('zh-CN')}
                </Text>
              </View>
              <IconButton
                icon="chevron-right"
                onPress={() => {
                  setSelectedVersion(version);
                  setVersionDetailModal(true);
                }}
              />
            </View>

            {version.changeDescription && (
              <Text
                variant="bodyMedium"
                style={styles.versionDescription}
                numberOfLines={2}
              >
                {version.changeDescription}
              </Text>
            )}

            {version.changeSummary && (
              <View style={styles.changeSummary}>
                {version.changeSummary.formChanges &&
                  version.changeSummary.formChanges.length > 0 && (
                    <Chip
                      mode="outlined"
                      compact
                      textStyle={styles.summaryChipText}
                      style={styles.summaryChip}
                      icon="form-select"
                    >
                      表单 +{version.changeSummary.formChanges.length}
                    </Chip>
                  )}
                {version.changeSummary.ruleChanges &&
                  version.changeSummary.ruleChanges.length > 0 && (
                    <Chip
                      mode="outlined"
                      compact
                      textStyle={styles.summaryChipText}
                      style={styles.summaryChip}
                      icon="cog"
                    >
                      规则 +{version.changeSummary.ruleChanges.length}
                    </Chip>
                  )}
              </View>
            )}
          </Card.Content>
        </Pressable>
      </Card>
    );
  };

  // 渲染工厂绑定卡片
  const renderBindingCard = (binding: FactoryBinding) => {
    const isOutdated = binding.appliedVersion < binding.latestVersion;

    return (
      <Card key={binding.id} style={styles.bindingCard} mode="elevated">
        <Card.Content>
          <View style={styles.bindingHeader}>
            <View style={styles.bindingInfo}>
              <Text variant="titleMedium" style={styles.factoryName}>
                {binding.factoryName || binding.factoryId}
              </Text>
              <View style={styles.versionRow}>
                <Text variant="bodySmall" style={styles.versionLabel}>
                  {t('blueprint.currentVersion', { version: binding.appliedVersion })}
                </Text>
                {isOutdated && (
                  <Badge style={styles.outdatedBadge}>
                    {t('blueprint.behindVersions', { count: binding.latestVersion - binding.appliedVersion })}
                  </Badge>
                )}
              </View>
            </View>

            <View style={styles.bindingActions}>
              {isOutdated && (
                <IconButton
                  icon="arrow-up-circle"
                  iconColor="#4CAF50"
                  onPress={() => {
                    setSelectedFactories([binding.factoryId]);
                    setUpgradeModalVisible(true);
                  }}
                />
              )}
              <IconButton
                icon="cog"
                onPress={() => {
                  setSelectedBinding(binding);
                  setBindingAutoUpdate(binding.autoUpdate);
                  setBindingPolicy(binding.updatePolicy);
                  setBindingSettingsModal(true);
                }}
              />
            </View>
          </View>

          <Divider style={styles.bindingDivider} />

          <View style={styles.bindingMeta}>
            <View style={styles.metaItem}>
              <Text variant="bodySmall" style={styles.metaLabel}>
                {t('blueprint.updatePolicy')}
              </Text>
              <Chip mode="flat" compact style={styles.policyChip}>
                {t(`blueprint.updatePolicy${binding.updatePolicy.charAt(0) + binding.updatePolicy.slice(1).toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase())}` as 'blueprint.updatePolicyManual')}
              </Chip>
            </View>
            {binding.lastAppliedAt && (
              <View style={styles.metaItem}>
                <Text variant="bodySmall" style={styles.metaLabel}>
                  {t('blueprint.lastUpdated')}
                </Text>
                <Text variant="bodySmall">
                  {new Date(binding.lastAppliedAt).toLocaleDateString('zh-CN')}
                </Text>
              </View>
            )}
          </View>

          {binding.appliedVersion > 1 && (
            <Button
              mode="text"
              compact
              onPress={() => handleRollback(binding)}
              textColor="#F44336"
              style={styles.rollbackButton}
            >
              {t('blueprint.rollbackToPrevious')}
            </Button>
          )}
        </Card.Content>
      </Card>
    );
  };

  // 渲染需要升级的工厂列表
  const renderUpgradeTab = () => {
    if (outdatedFactories.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Avatar.Icon
            icon="check-circle"
            size={64}
            color="#4CAF50"
            style={{ backgroundColor: '#E8F5E9' }}
          />
          <Text variant="bodyLarge" style={styles.emptyText}>
            {t('blueprint.allFactoriesUpToDate')}
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.upgradeHeader}>
          <Text variant="titleMedium" style={styles.upgradeTitle}>
            {t('blueprint.factoriesNeedUpgrade', { count: outdatedFactories.length })}
          </Text>
          <Button
            mode="contained"
            onPress={() => {
              setSelectedFactories(outdatedFactories.map((f) => f.factoryId));
              setUpgradeModalVisible(true);
            }}
            icon="arrow-up-circle"
          >
            {t('blueprint.upgradeAll')}
          </Button>
        </View>

        {outdatedFactories.map((binding) => (
          <Card key={binding.id} style={styles.upgradeCard}>
            <Card.Content>
              <View style={styles.upgradeRow}>
                <View style={styles.upgradeInfo}>
                  <Text variant="titleSmall">
                    {binding.factoryName || binding.factoryId}
                  </Text>
                  <Text variant="bodySmall" style={styles.upgradeVersions}>
                    v{binding.appliedVersion} → v{binding.latestVersion}
                  </Text>
                </View>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => {
                    setSelectedFactories([binding.factoryId]);
                    setUpgradeModalVisible(true);
                  }}
                >
                  {t('blueprint.upgrade')}
                </Button>
              </View>
            </Card.Content>
          </Card>
        ))}

        <View style={styles.bottomPadding} />
      </ScrollView>
    );
  };

  // 渲染发布模态框
  const renderPublishModal = () => (
    <Portal>
      <Modal
        visible={publishModalVisible}
        onDismiss={() => setPublishModalVisible(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <Text variant="titleLarge" style={styles.modalTitle}>
          {t('blueprint.publishNewVersion')}
        </Text>

        <Text variant="bodyMedium" style={styles.modalDescription}>
          {t('blueprint.publishHint')}
        </Text>

        <TextInput
          mode="outlined"
          label={t('blueprint.versionNotes')}
          value={publishNotes}
          onChangeText={setPublishNotes}
          multiline
          numberOfLines={4}
          style={styles.publishInput}
          placeholder={t('blueprint.versionNotesPlaceholder')}
        />

        <View style={styles.modalActions}>
          <Button
            mode="outlined"
            onPress={() => setPublishModalVisible(false)}
            disabled={publishing}
          >
            {t('aiQuota.cancel')}
          </Button>
          <Button
            mode="contained"
            onPress={handlePublish}
            loading={publishing}
            disabled={publishing || !publishNotes.trim()}
          >
            {t('blueprint.publish')}
          </Button>
        </View>
      </Modal>
    </Portal>
  );

  // 渲染版本详情模态框
  const renderVersionDetailModal = () => {
    if (!selectedVersion) return null;
    const changeTypeKey = `blueprint.changeType${selectedVersion.changeType.charAt(0) + selectedVersion.changeType.slice(1).toLowerCase()}`;

    return (
      <Portal>
        <Modal
          visible={versionDetailModal}
          onDismiss={() => {
            setVersionDetailModal(false);
            setSelectedVersion(null);
          }}
          contentContainerStyle={styles.modalContainer}
        >
          <ScrollView>
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" style={styles.modalTitle}>
                {t('blueprint.versionDetail', { version: selectedVersion.version })}
              </Text>
              {selectedVersion.isPublished && (
                <Chip mode="flat" icon="check-circle" style={styles.publishedChip}>
                  {t('blueprint.published')}
                </Chip>
              )}
            </View>

            <Divider style={styles.modalDivider} />

            <View style={styles.detailSection}>
              <Text variant="labelLarge" style={styles.sectionLabel}>
                {t('blueprint.changeType')}
              </Text>
              <Chip
                mode="flat"
                style={{
                  backgroundColor:
                    CHANGE_TYPE_COLORS[selectedVersion.changeType] || '#757575',
                  alignSelf: 'flex-start',
                }}
                textStyle={{ color: '#fff' }}
              >
                {t(changeTypeKey as 'blueprint.changeTypeCreate')}
              </Chip>
            </View>

            {selectedVersion.changeDescription && (
              <View style={styles.detailSection}>
                <Text variant="labelLarge" style={styles.sectionLabel}>
                  {t('blueprint.changeDescription')}
                </Text>
                <Text variant="bodyMedium">
                  {selectedVersion.changeDescription}
                </Text>
              </View>
            )}

            <View style={styles.detailSection}>
              <Text variant="labelLarge" style={styles.sectionLabel}>
                {t('blueprint.timeInfo')}
              </Text>
              <Text variant="bodySmall">
                {t('blueprint.createdAt')}: {new Date(selectedVersion.createdAt).toLocaleString('zh-CN')}
              </Text>
              {selectedVersion.publishedAt && (
                <Text variant="bodySmall">
                  {t('blueprint.publishedAt')}:{' '}
                  {new Date(selectedVersion.publishedAt).toLocaleString('zh-CN')}
                </Text>
              )}
            </View>

            {selectedVersion.changeSummary && (
              <View style={styles.detailSection}>
                <Text variant="labelLarge" style={styles.sectionLabel}>
                  {t('blueprint.changeContent')}
                </Text>

                {selectedVersion.changeSummary.formChanges &&
                  selectedVersion.changeSummary.formChanges.length > 0 && (
                    <View style={styles.changeList}>
                      <Text variant="labelMedium">{t('blueprint.formChanges')}</Text>
                      {selectedVersion.changeSummary.formChanges.map(
                        (change, index) => (
                          <Text key={index} variant="bodySmall" style={styles.changeItem}>
                            • {change}
                          </Text>
                        )
                      )}
                    </View>
                  )}

                {selectedVersion.changeSummary.ruleChanges &&
                  selectedVersion.changeSummary.ruleChanges.length > 0 && (
                    <View style={styles.changeList}>
                      <Text variant="labelMedium">{t('blueprint.ruleChanges')}</Text>
                      {selectedVersion.changeSummary.ruleChanges.map(
                        (change, index) => (
                          <Text key={index} variant="bodySmall" style={styles.changeItem}>
                            • {change}
                          </Text>
                        )
                      )}
                    </View>
                  )}
              </View>
            )}

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => {
                  setVersionDetailModal(false);
                  setSelectedVersion(null);
                }}
              >
                {t('industryTemplate.management.close')}
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    );
  };

  // 渲染绑定设置模态框
  const renderBindingSettingsModal = () => {
    if (!selectedBinding) return null;

    return (
      <Portal>
        <Modal
          visible={bindingSettingsModal}
          onDismiss={() => {
            setBindingSettingsModal(false);
            setSelectedBinding(null);
          }}
          contentContainerStyle={styles.modalContainer}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            {t('blueprint.bindingSettings')}
          </Text>

          <Text variant="bodyMedium" style={styles.modalDescription}>
            {selectedBinding.factoryName || selectedBinding.factoryId}
          </Text>

          <Divider style={styles.modalDivider} />

          <View style={styles.settingRow}>
            <View>
              <Text variant="labelLarge">{t('blueprint.autoUpdate')}</Text>
              <Text variant="bodySmall" style={styles.settingHint}>
                {t('blueprint.autoUpdateHint')}
              </Text>
            </View>
            <Switch
              value={bindingAutoUpdate}
              onValueChange={setBindingAutoUpdate}
            />
          </View>

          <View style={styles.settingRow}>
            <Text variant="labelLarge">{t('blueprint.updatePolicy')}</Text>
          </View>
          <SegmentedButtons
            value={bindingPolicy}
            onValueChange={setBindingPolicy}
            buttons={[
              { value: 'MANUAL', label: t('blueprint.manual') },
              { value: 'AUTO_MINOR', label: t('blueprint.autoMinor') },
              { value: 'AUTO_ALL', label: t('blueprint.autoAll') },
            ]}
            style={styles.policyButtons}
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setBindingSettingsModal(false);
                setSelectedBinding(null);
              }}
            >
              {t('aiQuota.cancel')}
            </Button>
            <Button mode="contained" onPress={handleUpdateBindingSettings}>
              {t('aiQuota.save')}
            </Button>
          </View>
        </Modal>
      </Portal>
    );
  };

  // 渲染升级确认模态框
  const renderUpgradeModal = () => (
    <Portal>
      <Modal
        visible={upgradeModalVisible}
        onDismiss={() => {
          setUpgradeModalVisible(false);
          setSelectedFactories([]);
          setUpgradeResults([]);
        }}
        contentContainerStyle={styles.modalContainer}
      >
        <Text variant="titleLarge" style={styles.modalTitle}>
          {t('blueprint.upgradeFactories')}
        </Text>

        {upgradeResults.length === 0 ? (
          <>
            <Text variant="bodyMedium" style={styles.modalDescription}>
              {t('blueprint.upgradeFactoriesMessage', { count: selectedFactories.length, version: latestVersion?.version })}
            </Text>

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => {
                  setUpgradeModalVisible(false);
                  setSelectedFactories([]);
                }}
                disabled={upgrading}
              >
                {t('aiQuota.cancel')}
              </Button>
              <Button
                mode="contained"
                onPress={handleUpgradeFactories}
                loading={upgrading}
                disabled={upgrading}
              >
                {t('blueprint.confirmUpgrade')}
              </Button>
            </View>
          </>
        ) : (
          <>
            <Text variant="bodyMedium" style={styles.modalDescription}>
              {t('blueprint.upgradeComplete')}
            </Text>

            <View style={styles.upgradeResultList}>
              {upgradeResults.map((result, index) => (
                <View key={index} style={styles.upgradeResultItem}>
                  <Avatar.Icon
                    icon={result.success ? 'check-circle' : 'alert-circle'}
                    size={24}
                    color={result.success ? '#4CAF50' : '#F44336'}
                    style={{ backgroundColor: 'transparent' }}
                  />
                  <View style={styles.upgradeResultInfo}>
                    <Text variant="bodyMedium">{result.factoryId}</Text>
                    <Text variant="bodySmall" style={styles.upgradeResultSummary}>
                      {result.summary}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Button
                mode="contained"
                onPress={() => {
                  setUpgradeModalVisible(false);
                  setSelectedFactories([]);
                  setUpgradeResults([]);
                }}
              >
                {t('blueprint.done')}
              </Button>
            </View>
          </>
        )}
      </Modal>
    </Portal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text variant="bodyMedium" style={{ marginTop: 16 }}>
          {t('blueprint.loading')}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content
          title={t('blueprint.title')}
          subtitle={blueprintName || blueprintId}
        />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>

      {/* 概览统计 */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text variant="headlineSmall" style={styles.statValue}>
            {versions.length}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            {t('blueprint.versionCount')}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="headlineSmall" style={styles.statValue}>
            v{latestVersion?.version || 0}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            {t('blueprint.latestVersion')}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="headlineSmall" style={styles.statValue}>
            {bindings.length}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            {t('blueprint.boundFactories')}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text
            variant="headlineSmall"
            style={[
              styles.statValue,
              outdatedFactories.length > 0 && { color: '#FF9800' },
            ]}
          >
            {outdatedFactories.length}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            {t('blueprint.pendingUpgrade')}
          </Text>
        </View>
      </View>

      {/* Tab 切换 */}
      <SegmentedButtons
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
        buttons={[
          { value: 'versions', label: t('blueprint.versionHistory') },
          { value: 'factories', label: t('blueprint.factoryBindings') },
          {
            value: 'upgrade',
            label: `${t('blueprint.pendingUpgradeTab')}${outdatedFactories.length > 0 ? ` (${outdatedFactories.length})` : ''}`,
          },
        ]}
        style={styles.tabButtons}
      />

      <View style={styles.content}>
        {activeTab === 'versions' && (
          <>
            {/* 搜索和筛选 */}
            <View style={styles.filterRow}>
              <Searchbar
                placeholder={t('blueprint.searchPlaceholder')}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchBar}
              />
            </View>

            <View style={styles.chipRow}>
              <Chip
                selected={filterStatus === 'all'}
                onPress={() => setFilterStatus('all')}
                style={styles.filterChip}
                showSelectedCheck={false}
              >
                {t('blueprint.all')}
              </Chip>
              <Chip
                selected={filterStatus === 'published'}
                onPress={() => setFilterStatus('published')}
                style={styles.filterChip}
                showSelectedCheck={false}
              >
                {t('blueprint.published')}
              </Chip>
              <Chip
                selected={filterStatus === 'draft'}
                onPress={() => setFilterStatus('draft')}
                style={styles.filterChip}
                showSelectedCheck={false}
              >
                {t('blueprint.draft')}
              </Chip>
            </View>

            {/* 版本列表 */}
            <ScrollView
              style={styles.scrollView}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              contentContainerStyle={styles.scrollContent}
            >
              {filteredVersions.length > 0 ? (
                filteredVersions.map(renderVersionCard)
              ) : (
                <View style={styles.emptyState}>
                  <Avatar.Icon
                    icon="history"
                    size={64}
                    color="#BDBDBD"
                    style={{ backgroundColor: 'transparent' }}
                  />
                  <Text variant="bodyLarge" style={styles.emptyText}>
                    {t('blueprint.noVersionHistory')}
                  </Text>
                </View>
              )}

              <View style={styles.bottomPadding} />
            </ScrollView>
          </>
        )}

        {activeTab === 'factories' && (
          <ScrollView
            style={styles.scrollView}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={styles.scrollContent}
          >
            {bindings.length > 0 ? (
              bindings.map(renderBindingCard)
            ) : (
              <View style={styles.emptyState}>
                <Avatar.Icon
                  icon="factory"
                  size={64}
                  color="#BDBDBD"
                  style={{ backgroundColor: 'transparent' }}
                />
                <Text variant="bodyLarge" style={styles.emptyText}>
                  {t('blueprint.noFactoryBindings')}
                </Text>
              </View>
            )}

            <View style={styles.bottomPadding} />
          </ScrollView>
        )}

        {activeTab === 'upgrade' && renderUpgradeTab()}
      </View>

      {/* 发布按钮 */}
      {activeTab === 'versions' && (
        <FAB
          icon="publish"
          style={styles.fab}
          onPress={() => setPublishModalVisible(true)}
          label={t('blueprint.publishVersion')}
        />
      )}

      {/* 模态框 */}
      {renderPublishModal()}
      {renderVersionDetailModal()}
      {renderBindingSettingsModal()}
      {renderUpgradeModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontWeight: '700',
    color: '#1976D2',
  },
  statLabel: {
    color: '#757575',
    marginTop: 4,
  },
  tabButtons: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  filterRow: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBar: {
    backgroundColor: '#fff',
  },
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  // 版本卡片
  versionCard: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  versionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionInfo: {
    flex: 1,
  },
  versionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  versionNumber: {
    fontWeight: '700',
  },
  publishedChip: {
    backgroundColor: '#E8F5E9',
  },
  publishedChipText: {
    color: '#4CAF50',
    fontSize: 11,
  },
  versionDate: {
    color: '#757575',
    marginTop: 4,
  },
  versionDescription: {
    marginTop: 12,
    color: '#616161',
  },
  changeSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  summaryChip: {
    height: 28,
  },
  summaryChipText: {
    fontSize: 11,
  },
  // 绑定卡片
  bindingCard: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  bindingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bindingInfo: {
    flex: 1,
  },
  factoryName: {
    fontWeight: '600',
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  versionLabel: {
    color: '#757575',
  },
  outdatedBadge: {
    backgroundColor: '#FF9800',
  },
  bindingActions: {
    flexDirection: 'row',
  },
  bindingDivider: {
    marginVertical: 12,
  },
  bindingMeta: {
    flexDirection: 'row',
    gap: 24,
  },
  metaItem: {
    gap: 4,
  },
  metaLabel: {
    color: '#757575',
  },
  policyChip: {
    backgroundColor: '#E3F2FD',
  },
  rollbackButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  // 升级 Tab
  upgradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  upgradeTitle: {
    fontWeight: '600',
  },
  upgradeCard: {
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  upgradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upgradeInfo: {
    flex: 1,
  },
  upgradeVersions: {
    color: '#757575',
    marginTop: 4,
  },
  // 空状态
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#757575',
    marginTop: 16,
  },
  bottomPadding: {
    height: 80,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#673AB7',
  },
  // 模态框
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontWeight: '700',
  },
  modalDescription: {
    color: '#757575',
    marginTop: 8,
  },
  modalDivider: {
    marginVertical: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  publishInput: {
    marginTop: 16,
    backgroundColor: '#fff',
  },
  // 版本详情
  detailSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    color: '#757575',
    marginBottom: 8,
  },
  changeList: {
    marginTop: 8,
  },
  changeItem: {
    marginLeft: 8,
    marginTop: 4,
    color: '#616161',
  },
  // 绑定设置
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingHint: {
    color: '#9E9E9E',
    marginTop: 2,
  },
  policyButtons: {
    marginTop: 8,
  },
  // 升级结果
  upgradeResultList: {
    marginTop: 16,
  },
  upgradeResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  upgradeResultInfo: {
    flex: 1,
  },
  upgradeResultSummary: {
    color: '#757575',
    marginTop: 2,
  },
});

export default BlueprintManagementScreen;
