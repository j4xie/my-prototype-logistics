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

// 变更类型标签映射
const CHANGE_TYPE_LABELS: Record<string, string> = {
  CREATE: '创建',
  UPDATE: '更新',
  PUBLISH: '发布',
  DEPRECATE: '废弃',
};

// 更新策略标签映射
const UPDATE_POLICY_LABELS: Record<string, string> = {
  MANUAL: '手动更新',
  AUTO_MINOR: '自动小版本',
  AUTO_ALL: '自动全部',
};

export function BlueprintManagementScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
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
        title: '加载失败',
        customMessage: '无法加载蓝图版本数据',
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
      Alert.alert('提示', '请填写版本说明');
      return;
    }

    setPublishing(true);
    try {
      const result = await blueprintVersionApiClient.publishVersion(blueprintId, {
        releaseNotes: publishNotes,
        notify: true,
      });

      if (result) {
        Alert.alert('成功', `版本 v${result.version} 已发布`);
        setPublishModalVisible(false);
        setPublishNotes('');
        loadData();
      } else {
        Alert.alert('失败', '发布版本失败');
      }
    } catch (error) {
      blueprintLogger.error('发布版本失败', error as Error);
      Alert.alert('错误', '发布版本失败，请稍后重试');
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
      Alert.alert('错误', '比较版本失败');
    } finally {
      setComparing(false);
    }
  };

  // 升级工厂
  const handleUpgradeFactories = async () => {
    if (selectedFactories.length === 0) {
      Alert.alert('提示', '请选择要升级的工厂');
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
        '升级完成',
        `成功: ${successCount}/${results.length} 个工厂`
      );

      if (successCount > 0) {
        loadData();
      }
    } catch (error) {
      blueprintLogger.error('升级工厂失败', error as Error);
      Alert.alert('错误', '升级工厂失败');
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

      Alert.alert('成功', '设置已更新');
      setBindingSettingsModal(false);
      loadData();
    } catch (error) {
      blueprintLogger.error('更新设置失败', error as Error);
      Alert.alert('错误', '更新设置失败');
    }
  };

  // 回滚工厂
  const handleRollback = (binding: FactoryBinding) => {
    Alert.alert(
      '确认回滚',
      `确定要将 ${binding.factoryName || binding.factoryId} 回滚到上一个版本吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定回滚',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await blueprintVersionApiClient.rollbackFactory(
                binding.factoryId,
                binding.appliedVersion - 1,
                '管理员手动回滚'
              );

              if (result?.success) {
                Alert.alert('成功', '回滚完成');
                loadData();
              } else {
                Alert.alert('失败', result?.summary || '回滚失败');
              }
            } catch (error) {
              blueprintLogger.error('回滚失败', error as Error);
              Alert.alert('错误', '回滚失败');
            }
          },
        },
      ]
    );
  };

  // 渲染版本卡片
  const renderVersionCard = (version: BlueprintVersion) => {
    const color = CHANGE_TYPE_COLORS[version.changeType] || '#757575';
    const label = CHANGE_TYPE_LABELS[version.changeType] || version.changeType;

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
                      已发布
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
                  当前版本: v{binding.appliedVersion}
                </Text>
                {isOutdated && (
                  <Badge style={styles.outdatedBadge}>
                    {`落后 ${binding.latestVersion - binding.appliedVersion} 版本`}
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
                更新策略
              </Text>
              <Chip mode="flat" compact style={styles.policyChip}>
                {UPDATE_POLICY_LABELS[binding.updatePolicy]}
              </Chip>
            </View>
            {binding.lastAppliedAt && (
              <View style={styles.metaItem}>
                <Text variant="bodySmall" style={styles.metaLabel}>
                  上次更新
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
              回滚到上一版本
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
            所有工厂都是最新版本
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
            {outdatedFactories.length} 个工厂需要升级
          </Text>
          <Button
            mode="contained"
            onPress={() => {
              setSelectedFactories(outdatedFactories.map((f) => f.factoryId));
              setUpgradeModalVisible(true);
            }}
            icon="arrow-up-circle"
          >
            全部升级
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
                  升级
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
          发布新版本
        </Text>

        <Text variant="bodyMedium" style={styles.modalDescription}>
          将当前蓝图状态发布为正式版本。发布后将通知所有绑定的工厂。
        </Text>

        <TextInput
          mode="outlined"
          label="版本说明"
          value={publishNotes}
          onChangeText={setPublishNotes}
          multiline
          numberOfLines={4}
          style={styles.publishInput}
          placeholder="描述此版本的主要变更..."
        />

        <View style={styles.modalActions}>
          <Button
            mode="outlined"
            onPress={() => setPublishModalVisible(false)}
            disabled={publishing}
          >
            取消
          </Button>
          <Button
            mode="contained"
            onPress={handlePublish}
            loading={publishing}
            disabled={publishing || !publishNotes.trim()}
          >
            发布
          </Button>
        </View>
      </Modal>
    </Portal>
  );

  // 渲染版本详情模态框
  const renderVersionDetailModal = () => {
    if (!selectedVersion) return null;

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
                版本 v{selectedVersion.version}
              </Text>
              {selectedVersion.isPublished && (
                <Chip mode="flat" icon="check-circle" style={styles.publishedChip}>
                  已发布
                </Chip>
              )}
            </View>

            <Divider style={styles.modalDivider} />

            <View style={styles.detailSection}>
              <Text variant="labelLarge" style={styles.sectionLabel}>
                变更类型
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
                {CHANGE_TYPE_LABELS[selectedVersion.changeType]}
              </Chip>
            </View>

            {selectedVersion.changeDescription && (
              <View style={styles.detailSection}>
                <Text variant="labelLarge" style={styles.sectionLabel}>
                  变更说明
                </Text>
                <Text variant="bodyMedium">
                  {selectedVersion.changeDescription}
                </Text>
              </View>
            )}

            <View style={styles.detailSection}>
              <Text variant="labelLarge" style={styles.sectionLabel}>
                时间信息
              </Text>
              <Text variant="bodySmall">
                创建时间: {new Date(selectedVersion.createdAt).toLocaleString('zh-CN')}
              </Text>
              {selectedVersion.publishedAt && (
                <Text variant="bodySmall">
                  发布时间:{' '}
                  {new Date(selectedVersion.publishedAt).toLocaleString('zh-CN')}
                </Text>
              )}
            </View>

            {selectedVersion.changeSummary && (
              <View style={styles.detailSection}>
                <Text variant="labelLarge" style={styles.sectionLabel}>
                  变更内容
                </Text>

                {selectedVersion.changeSummary.formChanges &&
                  selectedVersion.changeSummary.formChanges.length > 0 && (
                    <View style={styles.changeList}>
                      <Text variant="labelMedium">表单变更:</Text>
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
                      <Text variant="labelMedium">规则变更:</Text>
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
                关闭
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
            绑定设置
          </Text>

          <Text variant="bodyMedium" style={styles.modalDescription}>
            {selectedBinding.factoryName || selectedBinding.factoryId}
          </Text>

          <Divider style={styles.modalDivider} />

          <View style={styles.settingRow}>
            <View>
              <Text variant="labelLarge">自动更新</Text>
              <Text variant="bodySmall" style={styles.settingHint}>
                启用后将根据更新策略自动升级
              </Text>
            </View>
            <Switch
              value={bindingAutoUpdate}
              onValueChange={setBindingAutoUpdate}
            />
          </View>

          <View style={styles.settingRow}>
            <Text variant="labelLarge">更新策略</Text>
          </View>
          <SegmentedButtons
            value={bindingPolicy}
            onValueChange={setBindingPolicy}
            buttons={[
              { value: 'MANUAL', label: '手动' },
              { value: 'AUTO_MINOR', label: '自动小版本' },
              { value: 'AUTO_ALL', label: '自动全部' },
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
              取消
            </Button>
            <Button mode="contained" onPress={handleUpdateBindingSettings}>
              保存
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
          升级工厂
        </Text>

        {upgradeResults.length === 0 ? (
          <>
            <Text variant="bodyMedium" style={styles.modalDescription}>
              将 {selectedFactories.length} 个工厂升级到最新版本 (v
              {latestVersion?.version})
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
                取消
              </Button>
              <Button
                mode="contained"
                onPress={handleUpgradeFactories}
                loading={upgrading}
                disabled={upgrading}
              >
                确认升级
              </Button>
            </View>
          </>
        ) : (
          <>
            <Text variant="bodyMedium" style={styles.modalDescription}>
              升级完成
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
                完成
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
          加载蓝图版本数据...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content
          title="蓝图版本管理"
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
            版本总数
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="headlineSmall" style={styles.statValue}>
            v{latestVersion?.version || 0}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            最新版本
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text variant="headlineSmall" style={styles.statValue}>
            {bindings.length}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            绑定工厂
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
            待升级
          </Text>
        </View>
      </View>

      {/* Tab 切换 */}
      <SegmentedButtons
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
        buttons={[
          { value: 'versions', label: '版本历史' },
          { value: 'factories', label: '工厂绑定' },
          {
            value: 'upgrade',
            label: `待升级${outdatedFactories.length > 0 ? ` (${outdatedFactories.length})` : ''}`,
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
                placeholder="搜索版本..."
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
                全部
              </Chip>
              <Chip
                selected={filterStatus === 'published'}
                onPress={() => setFilterStatus('published')}
                style={styles.filterChip}
                showSelectedCheck={false}
              >
                已发布
              </Chip>
              <Chip
                selected={filterStatus === 'draft'}
                onPress={() => setFilterStatus('draft')}
                style={styles.filterChip}
                showSelectedCheck={false}
              >
                草稿
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
                    暂无版本历史
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
                  暂无绑定工厂
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
          label="发布版本"
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
