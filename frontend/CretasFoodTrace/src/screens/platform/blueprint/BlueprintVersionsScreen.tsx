/**
 * Blueprint Versions Screen
 *
 * Displays version history with diff view and rollback functionality.
 * Platform admin can view all versions, compare changes, and rollback if needed.
 *
 * @author Cretas Team
 * @version 1.0.0
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
  Chip,
  Button,
  IconButton,
  Menu,
  Portal,
  Modal,
  ActivityIndicator,
  Divider,
  ProgressBar,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isAxiosError } from 'axios';
import { blueprintVersionApiClient, BlueprintVersion as ApiBlueprintVersion } from '../../../services/api/blueprintVersionApiClient';

// Types
interface BlueprintVersion {
  id: string;
  version: string;
  releaseDate: string;
  description: string;
  changeType: 'major' | 'minor' | 'patch' | 'bugfix';
  isCurrent: boolean;
  syncedFactories: number;
  tags: string[];
}

interface VersionCompareResult {
  added: string[];
  modified: string[];
  removed: string[];
}

// 将 API changeType 转换为 UI changeType
const mapChangeType = (apiType: string): 'major' | 'minor' | 'patch' | 'bugfix' => {
  switch (apiType) {
    case 'CREATE':
      return 'major';
    case 'UPDATE':
      return 'minor';
    case 'PUBLISH':
      return 'patch';
    case 'DEPRECATE':
      return 'bugfix';
    default:
      return 'patch';
  }
};

// 将 API 版本数据转换为 UI 格式
const transformVersionData = (
  apiVersions: ApiBlueprintVersion[]
): BlueprintVersion[] => {
  return apiVersions.map((v, index) => ({
    id: v.id,
    version: `v${v.version}.0`,
    releaseDate: v.publishedAt || v.createdAt,
    description: v.changeDescription || '版本更新',
    changeType: mapChangeType(v.changeType),
    isCurrent: index === 0, // 第一个是最新版本
    syncedFactories: 0, // 需从绑定 API 获取
    tags: v.isPublished ? ['Published'] : [],
  }));
};

type RootStackParamList = {
  BlueprintVersions: { blueprintId: string; blueprintName: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'BlueprintVersions'>;

export function BlueprintVersionsScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'BlueprintVersions'>>();
  const { t } = useTranslation('platform');

  const blueprintId = route.params?.blueprintId || 'BP001';
  const blueprintName = route.params?.blueprintName || 'Seafood Processing Standard';

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [versions, setVersions] = useState<BlueprintVersion[]>([]);
  const [showEarlierVersions, setShowEarlierVersions] = useState(false);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);

  // Compare modal state
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [versionA, setVersionA] = useState('v2.0.1');
  const [versionB, setVersionB] = useState('v2.0.0');
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<VersionCompareResult | null>(null);

  // Rollback modal state
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<BlueprintVersion | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const apiVersions = await blueprintVersionApiClient.getVersionHistory(blueprintId);
      const transformedVersions = transformVersionData(apiVersions);
      setVersions(transformedVersions);
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert(t('errors.loadFailed'), error.response?.data?.message || t('blueprint.loadVersionsFailed'));
      } else {
        Alert.alert(t('errors.loadFailed'), t('blueprint.loadVersionsFailed'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [blueprintId, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleCompare = async () => {
    setComparing(true);
    try {
      // 提取版本号数字
      const fromVersion = parseInt(versionA.replace(/[^0-9]/g, '')) || 1;
      const toVersion = parseInt(versionB.replace(/[^0-9]/g, '')) || 1;

      const result = await blueprintVersionApiClient.compareVersions(blueprintId, fromVersion, toVersion);

      if (result) {
        setCompareResult({
          added: result.addedFields || [],
          modified: result.modifiedFields || [],
          removed: result.removedFields || [],
        });
      } else {
        // API 返回空时显示无差异
        setCompareResult({ added: [], modified: [], removed: [] });
      }
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert(t('errors.operationFailed'), error.response?.data?.message || t('blueprint.compareFailed'));
      } else {
        Alert.alert(t('errors.operationFailed'), t('blueprint.compareFailed'));
      }
    } finally {
      setComparing(false);
    }
  };

  const handleRollback = async () => {
    if (!selectedVersion) return;

    setRollingBack(true);
    try {
      const targetVersion = parseInt(selectedVersion.version.replace(/[^0-9]/g, '')) || 1;
      // 使用第一个绑定工厂的 ID 进行回滚（实际应从 context 获取）
      const factoryId = 'F001'; // TODO: 从用户上下文获取实际工厂 ID

      const result = await blueprintVersionApiClient.rollbackFactory(factoryId, targetVersion, '用户手动回滚');

      if (result?.success) {
        Alert.alert(
          t('success.title'),
          t('blueprint.rollbackSuccess', { version: selectedVersion.version })
        );
        setRollbackModalVisible(false);
        loadData();
      } else {
        Alert.alert(t('errors.operationFailed'), result?.summary || t('blueprint.rollbackFailed'));
      }
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert(t('errors.operationFailed'), error.response?.data?.message || t('blueprint.rollbackFailed'));
      } else {
        Alert.alert(t('errors.operationFailed'), t('blueprint.rollbackFailed'));
      }
    } finally {
      setRollingBack(false);
    }
  };

  const getChangeTypeColor = (type: string): string => {
    switch (type) {
      case 'major':
        return '#1890ff';
      case 'minor':
        return '#52c41a';
      case 'patch':
        return '#faad14';
      case 'bugfix':
        return '#ff4d4f';
      default:
        return '#8c8c8c';
    }
  };

  const getChangeTypeLabel = (type: string): string => {
    switch (type) {
      case 'major':
        return t('blueprint.majorVersion');
      case 'minor':
        return t('blueprint.minorVersion');
      case 'patch':
        return t('blueprint.patchVersion');
      case 'bugfix':
        return t('blueprint.bugFix');
      default:
        return type;
    }
  };

  const getTagColor = (tag: string): string => {
    switch (tag) {
      case 'New Feature':
        return '#52c41a';
      case 'Optimization':
        return '#1890ff';
      case 'Bug Fix':
        return '#ff4d4f';
      default:
        return '#8c8c8c';
    }
  };

  const visibleVersions = showEarlierVersions ? versions : versions.slice(0, 5);
  const hiddenCount = versions.length - 5;

  const renderVersionItem = (version: BlueprintVersion, index: number) => {
    const isFirst = index === 0;
    const isLast = index === visibleVersions.length - 1;

    return (
      <View key={version.id} style={styles.timelineItem}>
        {/* Timeline line */}
        <View style={styles.timelineLine}>
          <View
            style={[
              styles.timelineDot,
              { backgroundColor: version.isCurrent ? '#52c41a' : '#d9d9d9' },
            ]}
          />
          {!isLast && (
            <View
              style={[
                styles.timelineConnector,
                { backgroundColor: version.isCurrent ? '#52c41a' : '#d9d9d9' },
              ]}
            />
          )}
        </View>

        {/* Version content */}
        <View style={styles.versionContent}>
          <View style={styles.versionHeader}>
            <View style={styles.versionTitleRow}>
              <Text style={styles.versionNumber}>{version.version}</Text>
              {version.isCurrent && (
                <Chip
                  mode="flat"
                  compact
                  textStyle={{ color: '#fff', fontSize: 10 }}
                  style={{ backgroundColor: '#52c41a', height: 22 }}
                >
                  {t('blueprint.currentVersion')}
                </Chip>
              )}
              {version.changeType === 'major' && !version.isCurrent && (
                <Chip
                  mode="flat"
                  compact
                  textStyle={{ color: '#fff', fontSize: 10 }}
                  style={{ backgroundColor: '#1890ff', height: 22 }}
                >
                  {t('blueprint.majorVersion')}
                </Chip>
              )}
            </View>
            <Menu
              visible={menuVisible === version.id}
              onDismiss={() => setMenuVisible(null)}
              anchor={
                <IconButton
                  icon="dots-horizontal"
                  size={20}
                  onPress={() => setMenuVisible(version.id)}
                />
              }
            >
              <Menu.Item
                onPress={() => {
                  setMenuVisible(null);
                  setVersionA(version.version);
                  setCompareModalVisible(true);
                }}
                title={t('blueprint.compareVersion')}
                leadingIcon="compare"
              />
              {!version.isCurrent && (
                <Menu.Item
                  onPress={() => {
                    setMenuVisible(null);
                    setSelectedVersion(version);
                    setRollbackModalVisible(true);
                  }}
                  title={t('blueprint.rollbackToThis')}
                  leadingIcon="history"
                />
              )}
              <Menu.Item
                onPress={() => setMenuVisible(null)}
                title={t('blueprint.viewDetails')}
                leadingIcon="information-outline"
              />
            </Menu>
          </View>

          <Text style={styles.versionDate}>{version.releaseDate}</Text>
          <Text style={styles.versionDescription}>{version.description}</Text>

          <View style={styles.versionTags}>
            {version.tags.map((tag) => (
              <View
                key={tag}
                style={[styles.tag, { backgroundColor: `${getTagColor(tag)}15` }]}
              >
                <Text style={[styles.tagText, { color: getTagColor(tag) }]}>{tag}</Text>
              </View>
            ))}
            {version.syncedFactories > 0 && (
              <View style={styles.syncedTag}>
                <Text style={styles.syncedTagText}>
                  {t('blueprint.syncedFactories', { count: version.syncedFactories })}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('blueprint.versionHistory')} />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Blueprint Info Header */}
        <LinearGradient
          colors={['#1890ff', '#096dd9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.blueprintInfo}>
            <View style={styles.blueprintIcon}>
              <Text style={styles.blueprintIconText}>
                {blueprintName.charAt(0)}
              </Text>
            </View>
            <View>
              <Text style={styles.blueprintName}>{blueprintName}</Text>
              <Text style={styles.blueprintMeta}>
                {t('blueprint.totalVersions', { count: versions.length })}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Version Timeline Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('blueprint.versionTimeline')}</Text>

          <Card style={styles.timelineCard}>
            <Card.Content>
              {visibleVersions.map((version, index) => renderVersionItem(version, index))}

              {hiddenCount > 0 && !showEarlierVersions && (
                <Pressable
                  style={styles.showMoreButton}
                  onPress={() => setShowEarlierVersions(true)}
                >
                  <Text style={styles.showMoreText}>
                    {t('blueprint.viewEarlierVersions', { count: hiddenCount })}
                  </Text>
                </Pressable>
              )}
            </Card.Content>
          </Card>
        </View>

        {/* Version Compare Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('blueprint.versionCompare')}</Text>

          <Card style={styles.compareCard}>
            <Card.Content>
              <View style={styles.compareRow}>
                <View style={styles.compareSelect}>
                  <Text style={styles.compareLabel}>{t('blueprint.versionA')}</Text>
                  <Pressable
                    style={styles.selectButton}
                    onPress={() => {
                      // In production, show a picker
                    }}
                  >
                    <Text style={styles.selectButtonText}>{versionA} ({t('blueprint.current')})</Text>
                    <IconButton icon="chevron-down" size={16} />
                  </Pressable>
                </View>
                <View style={styles.compareSelect}>
                  <Text style={styles.compareLabel}>{t('blueprint.versionB')}</Text>
                  <Pressable
                    style={styles.selectButton}
                    onPress={() => {
                      // In production, show a picker
                    }}
                  >
                    <Text style={styles.selectButtonText}>{versionB}</Text>
                    <IconButton icon="chevron-down" size={16} />
                  </Pressable>
                </View>
              </View>
              <Button
                mode="contained"
                onPress={() => {
                  setCompareModalVisible(true);
                  handleCompare();
                }}
                style={styles.compareButton}
                buttonColor="#667eea"
              >
                {t('blueprint.startCompare')}
              </Button>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Compare Modal */}
      <Portal>
        <Modal
          visible={compareModalVisible}
          onDismiss={() => {
            setCompareModalVisible(false);
            setCompareResult(null);
          }}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>{t('blueprint.versionCompareResult')}</Text>
          <Text style={styles.modalSubtitle}>
            {versionA} vs {versionB}
          </Text>

          <Divider style={styles.modalDivider} />

          {comparing ? (
            <View style={styles.comparingContainer}>
              <ActivityIndicator size="small" color="#667eea" />
              <Text style={styles.comparingText}>{t('blueprint.comparing')}</Text>
            </View>
          ) : compareResult ? (
            <ScrollView style={styles.compareResultScroll}>
              {compareResult.added.length > 0 && (
                <View style={styles.changeSection}>
                  <View style={styles.changeSectionHeader}>
                    <View style={[styles.changeIndicator, { backgroundColor: '#52c41a' }]} />
                    <Text style={styles.changeSectionTitle}>
                      {t('blueprint.added')} ({compareResult.added.length})
                    </Text>
                  </View>
                  {compareResult.added.map((item, index) => (
                    <Text key={index} style={styles.changeItem}>+ {item}</Text>
                  ))}
                </View>
              )}

              {compareResult.modified.length > 0 && (
                <View style={styles.changeSection}>
                  <View style={styles.changeSectionHeader}>
                    <View style={[styles.changeIndicator, { backgroundColor: '#faad14' }]} />
                    <Text style={styles.changeSectionTitle}>
                      {t('blueprint.modified')} ({compareResult.modified.length})
                    </Text>
                  </View>
                  {compareResult.modified.map((item, index) => (
                    <Text key={index} style={styles.changeItem}>~ {item}</Text>
                  ))}
                </View>
              )}

              {compareResult.removed.length > 0 && (
                <View style={styles.changeSection}>
                  <View style={styles.changeSectionHeader}>
                    <View style={[styles.changeIndicator, { backgroundColor: '#ff4d4f' }]} />
                    <Text style={styles.changeSectionTitle}>
                      {t('blueprint.removed')} ({compareResult.removed.length})
                    </Text>
                  </View>
                  {compareResult.removed.map((item, index) => (
                    <Text key={index} style={styles.changeItem}>- {item}</Text>
                  ))}
                </View>
              )}
            </ScrollView>
          ) : null}

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setCompareModalVisible(false);
                setCompareResult(null);
              }}
            >
              {t('common.close')}
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Rollback Confirmation Modal */}
      <Portal>
        <Modal
          visible={rollbackModalVisible}
          onDismiss={() => setRollbackModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>{t('blueprint.confirmRollback')}</Text>
          <Text style={styles.rollbackWarning}>
            {t('blueprint.rollbackWarning', { version: selectedVersion?.version })}
          </Text>

          {rollingBack && (
            <View style={styles.rollbackProgress}>
              <ProgressBar indeterminate color="#667eea" style={styles.progressBar} />
              <Text style={styles.rollbackProgressText}>{t('blueprint.rollingBack')}</Text>
            </View>
          )}

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setRollbackModalVisible(false)}
              disabled={rollingBack}
            >
              {t('common.cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={handleRollback}
              loading={rollingBack}
              disabled={rollingBack}
              buttonColor="#ff4d4f"
            >
              {t('blueprint.confirmRollbackBtn')}
            </Button>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#8c8c8c',
  },
  scrollView: {
    flex: 1,
  },
  headerGradient: {
    borderRadius: 16,
    padding: 16,
    margin: 16,
    marginBottom: 0,
  },
  blueprintInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  blueprintIcon: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blueprintIconText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  blueprintName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  blueprintMeta: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  section: {
    padding: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 12,
  },
  timelineCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    paddingBottom: 24,
  },
  timelineLine: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  versionContent: {
    flex: 1,
    paddingLeft: 12,
  },
  versionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  versionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  versionNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  versionDate: {
    fontSize: 13,
    color: '#8c8c8c',
    marginTop: 4,
  },
  versionDescription: {
    fontSize: 14,
    color: '#595959',
    marginTop: 8,
    lineHeight: 20,
  },
  versionTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 12,
  },
  syncedTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  syncedTagText: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  showMoreButton: {
    alignItems: 'center',
    paddingTop: 8,
  },
  showMoreText: {
    fontSize: 13,
    color: '#667eea',
  },
  compareCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  compareRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  compareSelect: {
    flex: 1,
  },
  compareLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    marginBottom: 4,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
    paddingLeft: 12,
    paddingVertical: 6,
  },
  selectButtonText: {
    fontSize: 14,
    color: '#262626',
  },
  compareButton: {
    borderRadius: 8,
  },
  bottomPadding: {
    height: 40,
  },
  // Modal styles
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#262626',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8c8c8c',
    marginTop: 4,
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
  comparingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  comparingText: {
    fontSize: 14,
    color: '#8c8c8c',
  },
  compareResultScroll: {
    maxHeight: 300,
  },
  changeSection: {
    marginBottom: 16,
  },
  changeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  changeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  changeSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  changeItem: {
    fontSize: 13,
    color: '#595959',
    marginLeft: 16,
    marginBottom: 4,
    lineHeight: 20,
  },
  rollbackWarning: {
    fontSize: 14,
    color: '#595959',
    marginTop: 12,
    lineHeight: 22,
  },
  rollbackProgress: {
    marginTop: 16,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
  },
  rollbackProgressText: {
    fontSize: 13,
    color: '#8c8c8c',
    marginTop: 8,
  },
});

export default BlueprintVersionsScreen;
