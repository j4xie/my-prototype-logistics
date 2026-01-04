/**
 * Blueprint Apply Screen
 *
 * Apply blueprint to factory with configurable options.
 * Platform admin can select factories and choose what components to apply.
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
  Checkbox,
  TextInput,
  Switch,
  ActivityIndicator,
  Divider,
  ProgressBar,
  Portal,
  Modal,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isAxiosError } from 'axios';
import { platformApiClient } from '../../../services/api/platformApiClient';
import { blueprintVersionApiClient } from '../../../services/api/blueprintVersionApiClient';

// Types
interface Factory {
  id: string;
  name: string;
  code: string;
  industry: string;
  status: 'running' | 'stopped' | 'trial';
  boundBlueprint?: string;
  canBind: boolean;
}

interface ApplyOption {
  id: string;
  key: string;
  title: string;
  description: string;
  checked: boolean;
}

type FilterType = 'all' | 'unbound' | 'seafood' | 'frozen';

// Transform API factory data to screen interface
const transformFactoryData = (apiFactory: any): Factory => ({
  id: apiFactory.factoryId || apiFactory.id,
  name: apiFactory.factoryName || apiFactory.name,
  code: apiFactory.factoryCode || apiFactory.code || apiFactory.factoryId,
  industry: apiFactory.industry || 'Seafood Processing',
  status: apiFactory.status === 'ACTIVE' ? 'running' :
          apiFactory.status === 'TRIAL' ? 'trial' : 'stopped',
  boundBlueprint: apiFactory.boundBlueprintName || undefined,
  canBind: !apiFactory.boundBlueprintId,
});

type RootStackParamList = {
  BlueprintApply: {
    blueprintId: string;
    blueprintName: string;
    preselectedFactory?: string;
  };
  BlueprintBindings: { blueprintId: string; blueprintName: string };
};

export function BlueprintApplyScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'BlueprintApply'>>();
  const { t } = useTranslation('platform');

  const blueprintId = route.params?.blueprintId || 'BP001';
  const blueprintName = route.params?.blueprintName || 'Seafood Processing Standard';
  const preselectedFactory = route.params?.preselectedFactory;
  const currentVersion = 'v2.0.1';

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [factories, setFactories] = useState<Factory[]>([]);
  const [selectedFactories, setSelectedFactories] = useState<string[]>(
    preselectedFactory ? [preselectedFactory] : []
  );

  // Apply options state
  const [applyOptions, setApplyOptions] = useState<ApplyOption[]>([
    {
      id: '1',
      key: 'productTypes',
      title: t('blueprint.applyProductTypes'),
      description: t('blueprint.applyProductTypesDesc'),
      checked: true,
    },
    {
      id: '2',
      key: 'rawMaterials',
      title: t('blueprint.applyRawMaterials'),
      description: t('blueprint.applyRawMaterialsDesc'),
      checked: true,
    },
    {
      id: '3',
      key: 'departments',
      title: t('blueprint.applyDepartments'),
      description: t('blueprint.applyDepartmentsDesc'),
      checked: true,
    },
    {
      id: '4',
      key: 'formTemplates',
      title: t('blueprint.applyFormTemplates'),
      description: t('blueprint.applyFormTemplatesDesc'),
      checked: true,
    },
    {
      id: '5',
      key: 'businessRules',
      title: t('blueprint.applyBusinessRules'),
      description: t('blueprint.applyBusinessRulesDesc'),
      checked: true,
    },
    {
      id: '6',
      key: 'conversionRates',
      title: t('blueprint.applyConversionRates'),
      description: t('blueprint.applyConversionRatesDesc'),
      checked: false,
    },
  ]);

  // Sync settings state
  const [autoSync, setAutoSync] = useState(true);
  const [notifyAdmin, setNotifyAdmin] = useState(true);

  // Apply modal state
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState(0);

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: t('blueprint.allFactories') },
    { key: 'unbound', label: t('blueprint.unboundBlueprint') },
    { key: 'seafood', label: t('blueprint.seafoodProcessing') },
    { key: 'frozen', label: t('blueprint.frozenFoods') },
  ];

  const loadData = useCallback(async () => {
    try {
      const response = await platformApiClient.getFactories();
      const transformedFactories = (response.data || []).map(transformFactoryData);
      setFactories(transformedFactories);
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert(t('errors.loadFailed'), error.response?.data?.message || t('blueprint.loadFactoriesFailed'));
      } else {
        Alert.alert(t('errors.loadFailed'), t('blueprint.loadFactoriesFailed'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Filter factories
  const filteredFactories = factories.filter((factory) => {
    // Search filter
    if (
      searchQuery &&
      !factory.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !factory.code.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Type filter
    switch (activeFilter) {
      case 'unbound':
        return factory.canBind;
      case 'seafood':
        return factory.industry === 'Seafood Processing';
      case 'frozen':
        return factory.industry === 'Frozen Foods';
      default:
        return true;
    }
  });

  const toggleFactorySelection = (factoryId: string) => {
    const factory = factories.find((f) => f.id === factoryId);
    if (!factory?.canBind) return;

    setSelectedFactories((prev) =>
      prev.includes(factoryId)
        ? prev.filter((id) => id !== factoryId)
        : [...prev, factoryId]
    );
  };

  const toggleAllSelection = () => {
    const bindableFactories = filteredFactories.filter((f) => f.canBind);
    if (selectedFactories.length === bindableFactories.length) {
      setSelectedFactories([]);
    } else {
      setSelectedFactories(bindableFactories.map((f) => f.id));
    }
  };

  const toggleOption = (optionId: string) => {
    setApplyOptions((prev) =>
      prev.map((opt) =>
        opt.id === optionId ? { ...opt, checked: !opt.checked } : opt
      )
    );
  };

  const getApplySummary = (): string => {
    const selectedCount = selectedFactories.length;
    const checkedOptions = applyOptions.filter((opt) => opt.checked);
    const optionNames = checkedOptions.map((opt) => opt.title.replace(t('blueprint.apply') + ' ', '')).join(', ');

    return t('blueprint.applySummaryText', {
      blueprint: `${blueprintName} ${currentVersion}`,
      count: selectedCount,
      options: optionNames || t('blueprint.noOptions'),
    });
  };

  const handleApply = async () => {
    if (selectedFactories.length === 0) {
      Alert.alert(t('errors.validationFailed'), t('blueprint.selectAtLeastOne'));
      return;
    }

    const checkedOptions = applyOptions.filter((opt) => opt.checked);
    if (checkedOptions.length === 0) {
      Alert.alert(t('errors.validationFailed'), t('blueprint.selectAtLeastOneOption'));
      return;
    }

    setApplyModalVisible(true);
    setApplying(true);
    setApplyProgress(0);

    try {
      const totalFactories = selectedFactories.length;
      let successCount = 0;

      for (let i = 0; i < totalFactories; i++) {
        const factoryId = selectedFactories[i];
        setApplyProgress((i + 0.5) / totalFactories);

        const result = await blueprintVersionApiClient.upgradeFactory(factoryId, {
          blueprintId,
          targetVersion: parseInt(currentVersion.replace('v', '').split('.')[0]) || 1,
          syncOptions: {
            fullSync: true,
            autoSync,
            notifyAdmin,
            components: checkedOptions.map(opt => opt.key),
          },
        });

        if (result) {
          successCount++;
        }
        setApplyProgress((i + 1) / totalFactories);
      }

      setApplying(false);
      Alert.alert(
        t('success.title'),
        t('blueprint.applySuccess', { count: successCount }),
        [
          {
            text: t('common.confirm'),
            onPress: () => {
              setApplyModalVisible(false);
              navigation.navigate('BlueprintBindings', { blueprintId, blueprintName });
            },
          },
        ]
      );
    } catch (error) {
      setApplying(false);
      if (isAxiosError(error)) {
        Alert.alert(t('errors.operationFailed'), error.response?.data?.message || t('blueprint.applyFailed'));
      } else {
        Alert.alert(t('errors.operationFailed'), t('blueprint.applyFailed'));
      }
    }
  };

  const getStatusColor = (status: string): string => {
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

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'running':
        return t('blueprint.running');
      case 'stopped':
        return t('blueprint.stopped');
      case 'trial':
        return t('blueprint.trial');
      default:
        return status;
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

  const bindableCount = filteredFactories.filter((f) => f.canBind).length;
  const allSelected = selectedFactories.length === bindableCount && bindableCount > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('blueprint.applyBlueprint')} />
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
            <View style={styles.selectBadge}>
              <Text style={styles.selectBadgeText}>{t('blueprint.selectFactory')}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            mode="outlined"
            placeholder={t('blueprint.searchFactoryPlaceholder')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            left={<TextInput.Icon icon="magnify" />}
            style={styles.searchInput}
            outlineStyle={styles.searchOutline}
          />
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {filters.map((filter) => (
            <Pressable
              key={filter.key}
              style={[
                styles.filterChip,
                activeFilter === filter.key && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(filter.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === filter.key && styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Factory Selection Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('blueprint.selectTargetFactory')}</Text>
            <Pressable onPress={toggleAllSelection}>
              <Text style={styles.selectAllText}>
                {allSelected ? t('blueprint.deselectAll') : t('blueprint.selectAll')}
              </Text>
            </Pressable>
          </View>

          <Card style={styles.factoriesCard}>
            <Card.Content>
              {filteredFactories.map((factory, index) => (
                <View key={factory.id}>
                  {index > 0 && <Divider style={styles.factoryDivider} />}
                  <Pressable
                    style={[
                      styles.factoryItem,
                      !factory.canBind && styles.factoryItemDisabled,
                    ]}
                    onPress={() => toggleFactorySelection(factory.id)}
                    disabled={!factory.canBind}
                  >
                    <Checkbox
                      status={
                        selectedFactories.includes(factory.id)
                          ? 'checked'
                          : 'unchecked'
                      }
                      onPress={() => toggleFactorySelection(factory.id)}
                      disabled={!factory.canBind}
                      color="#667eea"
                    />
                    <View
                      style={[
                        styles.factoryIcon,
                        {
                          backgroundColor: factory.canBind
                            ? 'rgba(24, 144, 255, 0.1)'
                            : 'rgba(140, 140, 140, 0.1)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.factoryIconText,
                          { color: factory.canBind ? '#1890ff' : '#8c8c8c' },
                        ]}
                      >
                        {t('blueprint.factoryChar')}
                      </Text>
                    </View>
                    <View style={styles.factoryDetails}>
                      <Text style={styles.factoryName}>{factory.name}</Text>
                      <Text style={styles.factoryMeta}>
                        {factory.code} - {factory.industry} -{' '}
                        {factory.boundBlueprint
                          ? `${t('blueprint.bound')}: ${factory.boundBlueprint}`
                          : t('blueprint.noBlueprintBound')}
                      </Text>
                    </View>
                    <Chip
                      mode="flat"
                      compact
                      textStyle={{
                        color: factory.canBind ? '#fff' : '#8c8c8c',
                        fontSize: 10,
                      }}
                      style={{
                        backgroundColor: factory.canBind
                          ? getStatusColor(factory.status)
                          : '#e0e0e0',
                        height: 22,
                      }}
                    >
                      {factory.canBind
                        ? getStatusLabel(factory.status)
                        : t('blueprint.alreadyBound')}
                    </Chip>
                  </Pressable>
                </View>
              ))}
            </Card.Content>
          </Card>
        </View>

        {/* Apply Options Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('blueprint.applyOptions')}</Text>

          <Card style={styles.optionsCard}>
            <Card.Content>
              {applyOptions.map((option, index) => (
                <View key={option.id}>
                  {index > 0 && <Divider style={styles.optionDivider} />}
                  <Pressable
                    style={styles.optionItem}
                    onPress={() => toggleOption(option.id)}
                  >
                    <Checkbox
                      status={option.checked ? 'checked' : 'unchecked'}
                      onPress={() => toggleOption(option.id)}
                      color="#667eea"
                    />
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionTitle}>{option.title}</Text>
                      <Text style={styles.optionDesc}>{option.description}</Text>
                    </View>
                  </Pressable>
                </View>
              ))}
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
                  <Text style={styles.settingTitle}>{t('blueprint.enableAutoSync')}</Text>
                  <Text style={styles.settingHint}>
                    {t('blueprint.enableAutoSyncHint')}
                  </Text>
                </View>
                <Switch value={autoSync} onValueChange={setAutoSync} />
              </View>

              <Divider style={styles.settingDivider} />

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{t('blueprint.notifyFactoryAdmin')}</Text>
                  <Text style={styles.settingHint}>
                    {t('blueprint.notifyFactoryAdminHint')}
                  </Text>
                </View>
                <Switch value={notifyAdmin} onValueChange={setNotifyAdmin} />
              </View>
            </Card.Content>
          </Card>
        </View>

        {/* Apply Summary */}
        {selectedFactories.length > 0 && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>{t('blueprint.applySummary')}</Text>
            <Text style={styles.summaryText}>{getApplySummary()}</Text>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomActions}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.cancelButton}
        >
          {t('common.cancel')}
        </Button>
        <Button
          mode="contained"
          onPress={handleApply}
          style={styles.applyButton}
          buttonColor="#667eea"
          disabled={selectedFactories.length === 0}
        >
          {t('blueprint.confirmApply')}
        </Button>
      </View>

      {/* Apply Progress Modal */}
      <Portal>
        <Modal
          visible={applyModalVisible}
          onDismiss={() => !applying && setApplyModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
          dismissable={!applying}
        >
          <Text style={styles.modalTitle}>
            {applying ? t('blueprint.applying') : t('blueprint.applyComplete')}
          </Text>

          {applying && (
            <View style={styles.progressContainer}>
              <ProgressBar
                progress={applyProgress}
                color="#667eea"
                style={styles.progressBar}
              />
              <Text style={styles.progressText}>
                {Math.round(applyProgress * 100)}%
              </Text>
            </View>
          )}

          {!applying && (
            <View style={styles.modalActions}>
              <Button
                mode="contained"
                onPress={() => {
                  setApplyModalVisible(false);
                  navigation.navigate('BlueprintBindings', { blueprintId, blueprintName });
                }}
                buttonColor="#667eea"
              >
                {t('blueprint.viewBindings')}
              </Button>
            </View>
          )}
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
  selectBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
  },
  selectBadgeText: {
    fontSize: 12,
    color: '#fff',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchInput: {
    backgroundColor: '#fff',
  },
  searchOutline: {
    borderRadius: 8,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderColor: '#667eea',
  },
  filterChipText: {
    fontSize: 12,
    color: '#595959',
  },
  filterChipTextActive: {
    color: '#667eea',
  },
  section: {
    padding: 16,
    paddingTop: 8,
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
    marginBottom: 12,
  },
  selectAllText: {
    fontSize: 13,
    color: '#667eea',
  },
  factoriesCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  factoryDivider: {
    marginVertical: 12,
  },
  factoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factoryItemDisabled: {
    opacity: 0.6,
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
  factoryName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#262626',
  },
  factoryMeta: {
    fontSize: 13,
    color: '#8c8c8c',
    marginTop: 2,
  },
  optionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  optionDivider: {
    marginVertical: 12,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  optionInfo: {
    flex: 1,
    paddingTop: 6,
  },
  optionTitle: {
    fontSize: 14,
    color: '#262626',
  },
  optionDesc: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
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
  summaryContainer: {
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: 12,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 13,
    color: '#595959',
    lineHeight: 20,
  },
  bottomPadding: {
    height: 100,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 8,
  },
  applyButton: {
    flex: 1,
    borderRadius: 8,
  },
  // Modal styles
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#262626',
    marginBottom: 16,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#8c8c8c',
    marginTop: 8,
  },
  modalActions: {
    marginTop: 16,
  },
});

export default BlueprintApplyScreen;
