/**
 * Blueprint Bindings Screen
 *
 * Manages factory bindings with sync status.
 * Platform admin can view bound factories, sync status, and manage bindings.
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
  Portal,
  Modal,
  ActivityIndicator,
  Divider,
  Switch,
  Badge,
  ProgressBar,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isAxiosError } from 'axios';
import { blueprintVersionApiClient, FactoryBinding as ApiFactoryBinding } from '../../../services/api/blueprintVersionApiClient';
import platformAPI from '../../../services/api/platformApiClient';

// Types
interface BoundFactory {
  id: string;
  name: string;
  code: string;
  boundDate: string;
  currentVersion: string;
  status: 'synced' | 'pending' | 'failed';
  factoryStatus: 'running' | 'stopped' | 'trial';
}

interface AvailableFactory {
  id: string;
  name: string;
  code: string;
  status: 'running' | 'stopped' | 'trial';
}

interface SyncHistory {
  id: string;
  factoryName: string;
  fromVersion: string;
  toVersion: string;
  status: 'success' | 'failed';
  timestamp: string;
  message?: string;
}

// Transform API data to screen interface
const transformBindingData = (apiBindings: ApiFactoryBinding[]): BoundFactory[] => {
  return apiBindings.map((binding): BoundFactory => {
    const defaultDate = new Date().toISOString().split('T')[0] || '';
    const appliedDate = binding.lastAppliedAt?.split('T')[0];
    const boundDate: string = appliedDate ?? defaultDate;
    const status: 'synced' | 'pending' | 'failed' = binding.needsUpgrade ? 'pending' :
            binding.notificationStatus === 'PENDING' ? 'pending' : 'synced';
    return {
      id: binding.factoryId,
      name: binding.factoryName || binding.factoryId,
      code: binding.factoryId,
      boundDate,
      currentVersion: `v${binding.appliedVersion}.0`,
      status,
      factoryStatus: 'running', // Default to running since FactoryBinding doesn't have this field
    };
  });
};

const transformFactoryToAvailable = (factory: any): AvailableFactory => ({
  id: factory.factoryId || factory.id,
  name: factory.factoryName || factory.name,
  code: factory.factoryCode || factory.code || factory.factoryId,
  status: factory.status === 'ACTIVE' ? 'running' :
          factory.status === 'TRIAL' ? 'trial' : 'stopped',
});

type RootStackParamList = {
  BlueprintBindings: { blueprintId: string; blueprintName: string };
  BlueprintApply: { blueprintId: string; blueprintName: string };
};

export function BlueprintBindingsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'BlueprintBindings'>>();
  const { t } = useTranslation('platform');

  const blueprintId = route.params?.blueprintId || 'BP001';
  const blueprintName = route.params?.blueprintName || 'Seafood Processing Standard';
  const currentVersion = 'v2.0.1';

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [boundFactories, setBoundFactories] = useState<BoundFactory[]>([]);
  const [availableFactories, setAvailableFactories] = useState<AvailableFactory[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);

  // Settings state
  const [autoSync, setAutoSync] = useState(false);
  const [notifyOnSync, setNotifyOnSync] = useState(true);

  // Sync modal state
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncingFactory, setSyncingFactory] = useState<BoundFactory | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [batchSyncing, setBatchSyncing] = useState(false);

  // Unbind modal state
  const [unbindModalVisible, setUnbindModalVisible] = useState(false);
  const [unbindingFactory, setUnbindingFactory] = useState<BoundFactory | null>(null);

  // Stats
  const syncedCount = boundFactories.filter((f) => f.status === 'synced').length;
  const pendingCount = boundFactories.filter((f) => f.status === 'pending').length;

  const loadData = useCallback(async () => {
    try {
      // Load bound factories
      const bindings = await blueprintVersionApiClient.getBindingFactories(blueprintId);
      setBoundFactories(transformBindingData(bindings));

      // Load available factories (unbound)
      const factoriesResponse = await platformAPI.getFactories();
      const boundIds = new Set(bindings.map(b => b.factoryId));
      const available = (factoriesResponse.data || [])
        .filter((f: any) => !boundIds.has(f.factoryId || f.id))
        .map(transformFactoryToAvailable);
      setAvailableFactories(available);

      // Sync history - derive from bindings (no separate API)
      const history: SyncHistory[] = bindings
        .filter(b => b.lastAppliedAt)
        .map(b => ({
          id: b.factoryId,
          factoryName: b.factoryName || b.factoryId,
          fromVersion: `v${(b.appliedVersion || 1) - 1}.0`,
          toVersion: `v${b.appliedVersion}.0`,
          status: b.needsUpgrade ? 'failed' as const : 'success' as const,
          timestamp: b.lastAppliedAt?.replace('T', ' ').slice(0, 16) || '',
          message: b.needsUpgrade ? 'Needs upgrade' : undefined,
        }));
      setSyncHistory(history);
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert(t('errors.loadFailed'), error.response?.data?.message || t('blueprint.loadBindingsFailed'));
      } else {
        Alert.alert(t('errors.loadFailed'), t('blueprint.loadBindingsFailed'));
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

  const handleSync = async (factory: BoundFactory) => {
    setSyncing(true);
    try {
      const versionStr = currentVersion.replace('v', '').split('.')[0] ?? '1';
      const result = await blueprintVersionApiClient.upgradeFactory(factory.id, {
        targetVersion: parseInt(versionStr, 10) || 1,
        force: true,
        reason: 'Manual sync from bindings screen',
      });
      if (result) {
        Alert.alert(t('success.title'), t('blueprint.syncSuccess', { name: factory.name }));
        setSyncModalVisible(false);
        loadData();
      } else {
        Alert.alert(t('errors.operationFailed'), t('blueprint.syncFailed'));
      }
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert(t('errors.operationFailed'), error.response?.data?.message || t('blueprint.syncFailed'));
      } else {
        Alert.alert(t('errors.operationFailed'), t('blueprint.syncFailed'));
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleBatchSync = async () => {
    setBatchSyncing(true);
    try {
      const pendingFactories = boundFactories.filter(f => f.status === 'pending');
      let successCount = 0;

      const versionStr = currentVersion.replace('v', '').split('.')[0] ?? '1';
      for (const factory of pendingFactories) {
        const result = await blueprintVersionApiClient.upgradeFactory(factory.id, {
          targetVersion: parseInt(versionStr, 10) || 1,
          force: true,
          reason: 'Batch sync from bindings screen',
        });
        if (result) successCount++;
      }

      Alert.alert(
        t('success.title'),
        t('blueprint.batchSyncSuccess', { count: successCount })
      );
      loadData();
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert(t('errors.operationFailed'), error.response?.data?.message || t('blueprint.syncFailed'));
      } else {
        Alert.alert(t('errors.operationFailed'), t('blueprint.syncFailed'));
      }
    } finally {
      setBatchSyncing(false);
    }
  };

  const handleUnbind = async () => {
    if (!unbindingFactory) return;

    try {
      // Use rollback to unbind (set to version 0)
      const result = await blueprintVersionApiClient.rollbackFactory(
        unbindingFactory.id,
        0,
        'Unbind from blueprint'
      );
      if (result) {
        Alert.alert(t('success.title'), t('blueprint.unbindSuccess'));
        setUnbindModalVisible(false);
        setUnbindingFactory(null);
        loadData();
      } else {
        Alert.alert(t('errors.operationFailed'), t('blueprint.unbindFailed'));
      }
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert(t('errors.operationFailed'), error.response?.data?.message || t('blueprint.unbindFailed'));
      } else {
        Alert.alert(t('errors.operationFailed'), t('blueprint.unbindFailed'));
      }
    }
  };

  const handleBindFactory = (factory: AvailableFactory) => {
    navigation.navigate('BlueprintApply', {
      blueprintId,
      blueprintName,
      preselectedFactory: factory.id,
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'synced':
        return '#52c41a';
      case 'pending':
        return '#faad14';
      case 'failed':
        return '#ff4d4f';
      default:
        return '#8c8c8c';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'synced':
        return t('blueprint.synced');
      case 'pending':
        return t('blueprint.pendingSync');
      case 'failed':
        return t('blueprint.syncFailed');
      default:
        return status;
    }
  };

  const getFactoryStatusColor = (status: string): string => {
    switch (status) {
      case 'running':
        return '#52c41a';
      case 'stopped':
        return '#ff4d4f';
      case 'trial':
        return '#faad14';
      default:
        return '#8c8c8c';
    }
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
        <Appbar.Content title={t('blueprint.factoryBindings')} />
        <Appbar.Action
          icon="plus"
          onPress={() =>
            navigation.navigate('BlueprintApply', { blueprintId, blueprintName })
          }
        />
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
            <View style={styles.blueprintDetails}>
              <Text style={styles.blueprintName}>{blueprintName}</Text>
              <Text style={styles.blueprintVersion}>
                {t('blueprint.version')} {currentVersion}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{boundFactories.length}</Text>
              <Text style={styles.statLabel}>{t('blueprint.bound')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{syncedCount}</Text>
              <Text style={styles.statLabel}>{t('blueprint.synced')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{pendingCount}</Text>
              <Text style={styles.statLabel}>{t('blueprint.pendingSync')}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Bound Factories Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('blueprint.boundFactories')} ({boundFactories.length})
            </Text>
            {pendingCount > 0 && (
              <Pressable onPress={handleBatchSync} disabled={batchSyncing}>
                <Text style={styles.batchSyncText}>
                  {batchSyncing ? t('blueprint.syncing') : t('blueprint.batchSync')}
                </Text>
              </Pressable>
            )}
          </View>

          <Card style={styles.factoriesCard}>
            <Card.Content>
              {boundFactories.map((factory, index) => (
                <View key={factory.id}>
                  {index > 0 && <Divider style={styles.factoryDivider} />}
                  <View style={styles.factoryItem}>
                    <View style={styles.factoryHeader}>
                      <View
                        style={[
                          styles.factoryIcon,
                          {
                            backgroundColor:
                              factory.status === 'synced'
                                ? 'rgba(24, 144, 255, 0.1)'
                                : 'rgba(250, 173, 20, 0.1)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.factoryIconText,
                            {
                              color:
                                factory.status === 'synced' ? '#1890ff' : '#faad14',
                            },
                          ]}
                        >
                          {t('blueprint.factoryChar')}
                        </Text>
                      </View>
                      <View style={styles.factoryDetails}>
                        <View style={styles.factoryTitleRow}>
                          <Text style={styles.factoryName}>{factory.name}</Text>
                          <Chip
                            mode="flat"
                            compact
                            textStyle={{
                              color: '#fff',
                              fontSize: 10,
                            }}
                            style={{
                              backgroundColor: getStatusColor(factory.status),
                              height: 22,
                            }}
                          >
                            {getStatusLabel(factory.status)}
                          </Chip>
                        </View>
                        <Text style={styles.factoryMeta}>
                          {factory.code} - {t('blueprint.boundOn')} {factory.boundDate}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.factoryStats}>
                      <View style={styles.factoryStatItem}>
                        <Text style={styles.factoryStatValue}>
                          {factory.currentVersion}
                        </Text>
                        <Text style={styles.factoryStatLabel}>
                          {t('blueprint.currentVersion')}
                        </Text>
                      </View>
                      <View style={styles.factoryStatItem}>
                        <Text
                          style={[
                            styles.factoryStatValue,
                            { color: getFactoryStatusColor(factory.factoryStatus) },
                          ]}
                        >
                          {factory.factoryStatus === 'running'
                            ? t('blueprint.running')
                            : factory.factoryStatus === 'stopped'
                            ? t('blueprint.stopped')
                            : t('blueprint.trial')}
                        </Text>
                        <Text style={styles.factoryStatLabel}>
                          {t('blueprint.status')}
                        </Text>
                      </View>
                    </View>

                    {factory.status === 'pending' && (
                      <View style={styles.factoryActions}>
                        <Button
                          mode="contained"
                          onPress={() => {
                            setSyncingFactory(factory);
                            setSyncModalVisible(true);
                          }}
                          style={styles.syncButton}
                          buttonColor="#667eea"
                          compact
                        >
                          {t('blueprint.syncNow')}
                        </Button>
                        <Button
                          mode="outlined"
                          onPress={() => {
                            setUnbindingFactory(factory);
                            setUnbindModalVisible(true);
                          }}
                          textColor="#ff4d4f"
                          style={styles.unbindButton}
                          compact
                        >
                          {t('blueprint.unbind')}
                        </Button>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
        </View>

        {/* Available Factories Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('blueprint.availableFactories')}</Text>

          <Card style={styles.factoriesCard}>
            <Card.Content>
              <Text style={styles.availableHint}>
                {t('blueprint.availableFactoriesHint')}
              </Text>

              {availableFactories.map((factory, index) => (
                <View
                  key={factory.id}
                  style={[
                    styles.availableFactoryItem,
                    index > 0 && { marginTop: 8 },
                  ]}
                >
                  <View style={styles.availableFactoryIcon}>
                    <Text style={styles.availableFactoryIconText}>
                      {t('blueprint.factoryChar')}
                    </Text>
                  </View>
                  <View style={styles.availableFactoryDetails}>
                    <Text style={styles.availableFactoryName}>{factory.name}</Text>
                    <Text style={styles.availableFactoryMeta}>
                      {factory.code} - {t('blueprint.noBlueprintBound')}
                    </Text>
                  </View>
                  <Button
                    mode="contained"
                    compact
                    onPress={() => handleBindFactory(factory)}
                    buttonColor="#667eea"
                    style={styles.bindButton}
                  >
                    {t('blueprint.bind')}
                  </Button>
                </View>
              ))}

              <Pressable style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>
                  {t('blueprint.viewAllAvailable', { count: 5 })}
                </Text>
              </Pressable>
            </Card.Content>
          </Card>
        </View>

        {/* Sync Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('blueprint.syncSettings')}</Text>

          <Card style={styles.settingsCard}>
            <Card.Content>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{t('blueprint.autoSync')}</Text>
                  <Text style={styles.settingHint}>
                    {t('blueprint.autoSyncHint')}
                  </Text>
                </View>
                <Switch value={autoSync} onValueChange={setAutoSync} />
              </View>

              <Divider style={styles.settingDivider} />

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>
                    {t('blueprint.notifyOnSync')}
                  </Text>
                  <Text style={styles.settingHint}>
                    {t('blueprint.notifyOnSyncHint')}
                  </Text>
                </View>
                <Switch value={notifyOnSync} onValueChange={setNotifyOnSync} />
              </View>
            </Card.Content>
          </Card>
        </View>

        {/* Sync History Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('blueprint.syncHistory')}</Text>
            <Text style={styles.sectionSubtitle}>{t('blueprint.last7Days')}</Text>
          </View>

          <Card style={styles.historyCard}>
            <Card.Content>
              {syncHistory.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.historyItem,
                    index > 0 && styles.historyItemBorder,
                  ]}
                >
                  <View
                    style={[
                      styles.historyDot,
                      {
                        backgroundColor:
                          item.status === 'success' ? '#52c41a' : '#ff4d4f',
                      },
                    ]}
                  />
                  <View style={styles.historyContent}>
                    <Text style={styles.historyTitle}>
                      {item.factoryName}{' '}
                      {item.status === 'success'
                        ? t('blueprint.syncSucceeded')
                        : t('blueprint.syncFailed')}
                    </Text>
                    <Text
                      style={[
                        styles.historyMeta,
                        item.status === 'failed' && { color: '#ff4d4f' },
                      ]}
                    >
                      {item.status === 'success'
                        ? `${item.fromVersion} -> ${item.toVersion} - ${item.timestamp}`
                        : `${item.message} - ${item.timestamp}`}
                    </Text>
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Sync Confirmation Modal */}
      <Portal>
        <Modal
          visible={syncModalVisible}
          onDismiss={() => setSyncModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>{t('blueprint.confirmSync')}</Text>
          <Text style={styles.modalDescription}>
            {t('blueprint.confirmSyncMessage', {
              name: syncingFactory?.name,
              version: currentVersion,
            })}
          </Text>

          {syncing && (
            <View style={styles.syncProgress}>
              <ProgressBar indeterminate color="#667eea" style={styles.progressBar} />
              <Text style={styles.syncProgressText}>{t('blueprint.syncing')}</Text>
            </View>
          )}

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setSyncModalVisible(false)}
              disabled={syncing}
            >
              {t('common.cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={() => syncingFactory && handleSync(syncingFactory)}
              loading={syncing}
              disabled={syncing}
              buttonColor="#667eea"
            >
              {t('blueprint.confirmSyncBtn')}
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Unbind Confirmation Modal */}
      <Portal>
        <Modal
          visible={unbindModalVisible}
          onDismiss={() => setUnbindModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>{t('blueprint.confirmUnbind')}</Text>
          <Text style={styles.modalDescription}>
            {t('blueprint.confirmUnbindMessage', { name: unbindingFactory?.name })}
          </Text>

          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => setUnbindModalVisible(false)}>
              {t('common.cancel')}
            </Button>
            <Button mode="contained" onPress={handleUnbind} buttonColor="#ff4d4f">
              {t('blueprint.confirmUnbindBtn')}
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
    marginBottom: 12,
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
  blueprintDetails: {
    flex: 1,
  },
  blueprintName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  blueprintVersion: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  section: {
    padding: 16,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  batchSyncText: {
    fontSize: 13,
    color: '#667eea',
  },
  factoriesCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  factoryDivider: {
    marginVertical: 16,
  },
  factoryItem: {},
  factoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  factoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  factoryIconText: {
    fontSize: 16,
    fontWeight: '600',
  },
  factoryDetails: {
    flex: 1,
  },
  factoryTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factoryName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#262626',
    flex: 1,
    marginRight: 8,
  },
  factoryMeta: {
    fontSize: 13,
    color: '#8c8c8c',
    marginTop: 2,
  },
  factoryStats: {
    flexDirection: 'row',
    gap: 8,
  },
  factoryStatItem: {
    flex: 1,
    padding: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    alignItems: 'center',
  },
  factoryStatValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  factoryStatLabel: {
    fontSize: 11,
    color: '#8c8c8c',
    marginTop: 2,
  },
  factoryActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  syncButton: {
    flex: 1,
    borderRadius: 8,
  },
  unbindButton: {
    flex: 1,
    borderRadius: 8,
    borderColor: '#ff4d4f',
  },
  availableHint: {
    fontSize: 13,
    color: '#8c8c8c',
    marginBottom: 12,
  },
  availableFactoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  availableFactoryIcon: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  availableFactoryIconText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  availableFactoryDetails: {
    flex: 1,
  },
  availableFactoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  availableFactoryMeta: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  bindButton: {
    borderRadius: 6,
  },
  viewAllButton: {
    alignItems: 'center',
    paddingTop: 12,
  },
  viewAllText: {
    fontSize: 13,
    color: '#667eea',
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 14,
    color: '#262626',
    marginBottom: 4,
  },
  settingHint: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  settingDivider: {
    marginVertical: 8,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  historyItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyContent: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    color: '#262626',
  },
  historyMeta: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#262626',
  },
  modalDescription: {
    fontSize: 14,
    color: '#595959',
    marginTop: 12,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  syncProgress: {
    marginTop: 16,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
  },
  syncProgressText: {
    fontSize: 13,
    color: '#8c8c8c',
    marginTop: 8,
  },
});

export default BlueprintBindingsScreen;
