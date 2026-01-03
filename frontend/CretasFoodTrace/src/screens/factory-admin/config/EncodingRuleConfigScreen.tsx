import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Appbar,
  Card,
  ActivityIndicator,
  Surface,
  Divider,
  Chip,
  IconButton,
  FAB,
  Button,
  TextInput,
  Switch,
  SegmentedButtons,
  Portal,
  Dialog,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  encodingRuleApiClient,
  EncodingRule,
  EncodingEntityType,
  ResetCycle,
  CreateEncodingRuleRequest,
  PlaceholderInfo,
  EntityTypeInfo,
} from '../../../services/api/encodingRuleApiClient';
import { useAuthStore } from '../../../store/authStore';
import { getFactoryId } from '../../../types/auth';
import { FAManagementStackParamList } from '../../../types/navigation';
import { logger } from '../../../utils/logger';

const configLogger = logger.createContextLogger('EncodingRuleConfig');

type NavigationProp = NativeStackNavigationProp<FAManagementStackParamList>;

/**
 * 编码规则配置页面
 *
 * 功能:
 * - 查看所有编码规则列表
 * - 创建新的编码规则
 * - 编辑/删除现有规则
 * - 预览编码效果
 * - 重置序列号
 */
export default function EncodingRuleConfigScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation('home');
  const user = useAuthStore((state) => state.user);
  const factoryId = getFactoryId(user);

  // 列表状态
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rules, setRules] = useState<EncodingRule[]>([]);
  const [entityTypes, setEntityTypes] = useState<EntityTypeInfo[]>([]);
  const [placeholders, setPlaceholders] = useState<PlaceholderInfo[]>([]);

  // 表单对话框状态
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingRule, setEditingRule] = useState<EncodingRule | null>(null);
  const [saving, setSaving] = useState(false);

  // 表单字段
  const [formEntityType, setFormEntityType] = useState<EncodingEntityType>('MATERIAL_BATCH');
  const [formRuleName, setFormRuleName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPattern, setFormPattern] = useState('');
  const [formPrefix, setFormPrefix] = useState('');
  const [formResetCycle, setFormResetCycle] = useState<ResetCycle>('DAILY');
  const [formSeqLength, setFormSeqLength] = useState('4');

  // 占位符帮助对话框
  const [placeholderHelpVisible, setPlaceholderHelpVisible] = useState(false);

  // 预览对话框
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewCode, setPreviewCode] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  /**
   * 加载数据
   */
  const loadData = async () => {
    try {
      if (!factoryId) {
        configLogger.warn('工厂ID不存在');
        Alert.alert(t('common.error'), t('encodingRuleConfig.cannotGetFactoryInfo'));
        return;
      }

      configLogger.info('加载编码规则数据', { factoryId });

      const [rulesRes, typesRes, phRes] = await Promise.all([
        encodingRuleApiClient.getRules({}, factoryId),
        encodingRuleApiClient.getEntityTypes(factoryId),
        encodingRuleApiClient.getPlaceholders(factoryId),
      ]);

      setRules(rulesRes.content ?? []);
      setEntityTypes(typesRes);
      setPlaceholders(phRes);

      configLogger.info('数据加载完成', { count: rulesRes.content?.length });
    } catch (error: unknown) {
      configLogger.error('加载数据失败', error);
      const errorMessage = error instanceof Error ? error.message : t('encodingRuleConfig.loadFailed');
      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [factoryId])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  /**
   * 获取实体类型名称
   */
  const getEntityTypeName = (code: string): string => {
    const found = entityTypes.find((t) => t.code === code);
    return found?.name ?? code;
  };

  /**
   * 获取重置周期名称
   */
  const getResetCycleName = (cycle: ResetCycle): string => {
    const names: Record<ResetCycle, string> = {
      DAILY: t('encodingRuleConfig.resetCycles.daily'),
      MONTHLY: t('encodingRuleConfig.resetCycles.monthly'),
      YEARLY: t('encodingRuleConfig.resetCycles.yearly'),
      NEVER: t('encodingRuleConfig.resetCycles.never'),
    };
    return names[cycle] ?? cycle;
  };

  /**
   * 打开创建对话框
   */
  const handleCreate = () => {
    setFormMode('create');
    setEditingRule(null);
    resetForm();
    setFormVisible(true);
  };

  /**
   * 打开编辑对话框
   */
  const handleEdit = (rule: EncodingRule) => {
    setFormMode('edit');
    setEditingRule(rule);
    setFormEntityType(rule.entityType);
    setFormRuleName(rule.ruleName);
    setFormDescription(rule.ruleDescription ?? '');
    setFormPattern(rule.encodingPattern);
    setFormPrefix(rule.prefix ?? '');
    setFormResetCycle(rule.resetCycle);
    setFormSeqLength(String(rule.sequenceLength));
    setFormVisible(true);
  };

  /**
   * 重置表单
   */
  const resetForm = () => {
    setFormEntityType('MATERIAL_BATCH');
    setFormRuleName('');
    setFormDescription('');
    setFormPattern('{PREFIX}-{FACTORY}-{YYYYMMDD}-{SEQ:4}');
    setFormPrefix('MB');
    setFormResetCycle('DAILY');
    setFormSeqLength('4');
  };

  /**
   * 保存规则
   */
  const handleSave = async () => {
    if (!formRuleName.trim()) {
      Alert.alert(t('common.tip'), t('encodingRuleConfig.enterRuleName'));
      return;
    }
    if (!formPattern.trim()) {
      Alert.alert(t('common.tip'), t('encodingRuleConfig.enterEncodingPattern'));
      return;
    }

    try {
      setSaving(true);

      if (formMode === 'create') {
        const request: CreateEncodingRuleRequest = {
          entityType: formEntityType,
          ruleName: formRuleName.trim(),
          ruleDescription: formDescription.trim() || undefined,
          encodingPattern: formPattern.trim(),
          prefix: formPrefix.trim() || undefined,
          resetCycle: formResetCycle,
          sequenceLength: parseInt(formSeqLength, 10) || 4,
        };

        await encodingRuleApiClient.createRule(request, factoryId ?? undefined);
        Alert.alert(t('common.success'), t('encodingRuleConfig.createSuccess'));
      } else if (editingRule) {
        await encodingRuleApiClient.updateRule(
          editingRule.id,
          {
            ruleName: formRuleName.trim(),
            ruleDescription: formDescription.trim() || undefined,
            encodingPattern: formPattern.trim(),
            prefix: formPrefix.trim() || undefined,
            resetCycle: formResetCycle,
            sequenceLength: parseInt(formSeqLength, 10) || 4,
          },
          factoryId ?? undefined
        );
        Alert.alert(t('common.success'), t('encodingRuleConfig.updateSuccess'));
      }

      setFormVisible(false);
      loadData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('encodingRuleConfig.saveFailed');
      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setSaving(false);
    }
  };

  /**
   * 删除规则
   */
  const handleDelete = (rule: EncodingRule) => {
    Alert.alert(t('encodingRuleConfig.confirmDelete'), t('encodingRuleConfig.confirmDeleteMessage', { name: rule.ruleName }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await encodingRuleApiClient.deleteRule(rule.id, factoryId ?? undefined);
            Alert.alert(t('common.success'), t('encodingRuleConfig.ruleDeleted'));
            loadData();
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : t('encodingRuleConfig.deleteFailed');
            Alert.alert(t('common.error'), errorMessage);
          }
        },
      },
    ]);
  };

  /**
   * 切换启用状态
   */
  const handleToggleEnabled = async (rule: EncodingRule) => {
    try {
      await encodingRuleApiClient.toggleEnabled(rule.id, !rule.enabled, factoryId ?? undefined);
      loadData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('encodingRuleConfig.operationFailed');
      Alert.alert(t('common.error'), errorMessage);
    }
  };

  /**
   * 重置序列号
   */
  const handleResetSequence = (rule: EncodingRule) => {
    Alert.alert(
      t('encodingRuleConfig.confirmReset'),
      t('encodingRuleConfig.confirmResetMessage', { name: rule.ruleName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('encodingRuleConfig.reset'),
          style: 'destructive',
          onPress: async () => {
            try {
              await encodingRuleApiClient.resetSequence(rule.id, factoryId ?? undefined);
              Alert.alert(t('common.success'), t('encodingRuleConfig.sequenceReset'));
              loadData();
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : t('encodingRuleConfig.resetFailed');
              Alert.alert(t('common.error'), errorMessage);
            }
          },
        },
      ]
    );
  };

  /**
   * 预览编码
   */
  const handlePreview = async (rule: EncodingRule) => {
    try {
      setPreviewLoading(true);
      setPreviewVisible(true);
      const code = await encodingRuleApiClient.previewCode(
        rule.entityType,
        factoryId ?? undefined
      );
      setPreviewCode(code);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('encodingRuleConfig.previewFailed');
      setPreviewCode(`${t('encodingRuleConfig.previewFailed')}: ${errorMessage}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  /**
   * 渲染规则卡片
   */
  const renderRuleCard = ({ item }: { item: EncodingRule }) => {
    return (
      <Card style={[styles.ruleCard, !item.enabled && styles.disabledCard]} mode="elevated">
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.titleRow}>
              <Chip mode="outlined" compact style={styles.entityChip}>
                {getEntityTypeName(item.entityType)}
              </Chip>
              <Text variant="titleMedium" style={styles.ruleName}>
                {item.ruleName}
              </Text>
            </View>
            <Switch value={item.enabled} onValueChange={() => handleToggleEnabled(item)} />
          </View>

          {item.ruleDescription && (
            <Text style={styles.description}>{item.ruleDescription}</Text>
          )}

          <Divider style={styles.divider} />

          <View style={styles.patternRow}>
            <Text style={styles.patternLabel}>{t('encodingRuleConfig.template')}:</Text>
            <Text style={styles.patternValue}>{item.encodingPattern}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.currentSequence}</Text>
              <Text style={styles.statLabel}>{t('encodingRuleConfig.currentSequence')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{t('encodingRuleConfig.digits', { count: item.sequenceLength })}</Text>
              <Text style={styles.statLabel}>{t('encodingRuleConfig.sequenceLength')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{getResetCycleName(item.resetCycle)}</Text>
              <Text style={styles.statLabel}>{t('encodingRuleConfig.resetCycle')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>v{item.version}</Text>
              <Text style={styles.statLabel}>{t('encodingRuleConfig.version')}</Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <Button
              mode="text"
              compact
              icon="eye"
              onPress={() => handlePreview(item)}
            >
              {t('encodingRuleConfig.preview')}
            </Button>
            <Button
              mode="text"
              compact
              icon="pencil"
              onPress={() => handleEdit(item)}
            >
              {t('common.edit')}
            </Button>
            <Button
              mode="text"
              compact
              icon="restore"
              onPress={() => handleResetSequence(item)}
            >
              {t('encodingRuleConfig.reset')}
            </Button>
            <Button
              mode="text"
              compact
              icon="delete"
              textColor="#F44336"
              onPress={() => handleDelete(item)}
            >
              {t('common.delete')}
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('encodingRuleConfig.title')} subtitle={t('encodingRuleConfig.subtitle')} />
        <Appbar.Action icon="refresh" onPress={handleRefresh} />
      </Appbar.Header>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={rules}
          renderItem={renderRuleCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListHeaderComponent={
            <Surface style={styles.infoCard} elevation={1}>
              <View style={styles.infoRow}>
                <IconButton icon="information" size={20} iconColor="#2196F3" />
                <Text style={styles.infoText}>
                  {t('encodingRuleConfig.infoText')}
                </Text>
              </View>
            </Surface>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconButton icon="file-document-outline" size={64} iconColor="#ccc" />
              <Text style={styles.emptyText}>{t('encodingRuleConfig.noRules')}</Text>
              <Text style={styles.emptySubText}>{t('encodingRuleConfig.createFirst')}</Text>
            </View>
          }
          ListFooterComponent={<View style={styles.bottomPadding} />}
        />
      )}

      <FAB icon="plus" style={styles.fab} onPress={handleCreate} />

      {/* 创建/编辑对话框 */}
      <Portal>
        <Modal visible={formVisible} onDismiss={() => setFormVisible(false)}>
          <View style={styles.modalContainer}>
            <Surface style={styles.modalContent} elevation={5}>
              <ScrollView>
                <View style={styles.modalHeader}>
                  <Text variant="titleLarge">
                    {formMode === 'create' ? t('encodingRuleConfig.createRule') : t('encodingRuleConfig.editRule')}
                  </Text>
                  <IconButton icon="close" onPress={() => setFormVisible(false)} />
                </View>

                <Divider style={styles.modalDivider} />

                {formMode === 'create' && (
                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>{t('encodingRuleConfig.entityType')} *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <SegmentedButtons
                        value={formEntityType}
                        onValueChange={(v) => {
                          setFormEntityType(v as EncodingEntityType);
                          const found = entityTypes.find((t) => t.code === v);
                          if (found) setFormPrefix(found.defaultPrefix);
                        }}
                        buttons={entityTypes.slice(0, 4).map((t) => ({
                          value: t.code,
                          label: t.name,
                        }))}
                        style={styles.segmentedButtons}
                      />
                    </ScrollView>
                  </View>
                )}

                <TextInput
                  label={t('encodingRuleConfig.ruleName') + ' *'}
                  value={formRuleName}
                  onChangeText={setFormRuleName}
                  mode="outlined"
                  style={styles.input}
                  placeholder={t('encodingRuleConfig.ruleNamePlaceholder')}
                />

                <TextInput
                  label={t('encodingRuleConfig.ruleDescription')}
                  value={formDescription}
                  onChangeText={setFormDescription}
                  mode="outlined"
                  style={styles.input}
                  multiline
                  numberOfLines={2}
                  placeholder={t('encodingRuleConfig.ruleDescriptionPlaceholder')}
                />

                <View style={styles.patternInputRow}>
                  <TextInput
                    label={t('encodingRuleConfig.encodingPattern') + ' *'}
                    value={formPattern}
                    onChangeText={setFormPattern}
                    mode="outlined"
                    style={[styles.input, styles.patternInput]}
                    placeholder="{PREFIX}-{FACTORY}-{YYYYMMDD}-{SEQ:4}"
                  />
                  <IconButton
                    icon="help-circle"
                    size={24}
                    onPress={() => setPlaceholderHelpVisible(true)}
                  />
                </View>

                <View style={styles.formRow}>
                  <TextInput
                    label={t('encodingRuleConfig.prefix')}
                    value={formPrefix}
                    onChangeText={setFormPrefix}
                    mode="outlined"
                    style={[styles.input, styles.halfInput]}
                    placeholder="MB"
                  />
                  <TextInput
                    label={t('encodingRuleConfig.sequenceLength')}
                    value={formSeqLength}
                    onChangeText={setFormSeqLength}
                    mode="outlined"
                    style={[styles.input, styles.halfInput]}
                    keyboardType="numeric"
                    placeholder="4"
                  />
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>{t('encodingRuleConfig.resetCycle')}</Text>
                  <SegmentedButtons
                    value={formResetCycle}
                    onValueChange={(v) => setFormResetCycle(v as ResetCycle)}
                    buttons={[
                      { value: 'DAILY', label: t('encodingRuleConfig.resetCycles.daily') },
                      { value: 'MONTHLY', label: t('encodingRuleConfig.resetCycles.monthly') },
                      { value: 'YEARLY', label: t('encodingRuleConfig.resetCycles.yearly') },
                      { value: 'NEVER', label: t('encodingRuleConfig.resetCycles.never') },
                    ]}
                    style={styles.segmentedButtons}
                  />
                </View>

                <View style={styles.modalActions}>
                  <Button
                    mode="outlined"
                    onPress={() => setFormVisible(false)}
                    style={styles.modalButton}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleSave}
                    loading={saving}
                    disabled={saving}
                    style={styles.modalButton}
                  >
                    {t('common.save')}
                  </Button>
                </View>
              </ScrollView>
            </Surface>
          </View>
        </Modal>

        {/* 占位符帮助对话框 */}
        <Dialog
          visible={placeholderHelpVisible}
          onDismiss={() => setPlaceholderHelpVisible(false)}
        >
          <Dialog.Title>{t('encodingRuleConfig.supportedPlaceholders')}</Dialog.Title>
          <Dialog.ScrollArea style={styles.placeholderDialog}>
            <ScrollView>
              {placeholders.map((ph, index) => (
                <View key={index} style={styles.placeholderItem}>
                  <TouchableOpacity
                    onPress={() => {
                      setFormPattern((prev) => prev + ph.placeholder);
                      setPlaceholderHelpVisible(false);
                    }}
                  >
                    <Text style={styles.placeholderCode}>{ph.placeholder}</Text>
                  </TouchableOpacity>
                  <Text style={styles.placeholderDesc}>{ph.description}</Text>
                  <Text style={styles.placeholderExample}>{t('encodingRuleConfig.example')}: {ph.example}</Text>
                </View>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setPlaceholderHelpVisible(false)}>{t('common.close')}</Button>
          </Dialog.Actions>
        </Dialog>

        {/* 预览对话框 */}
        <Dialog visible={previewVisible} onDismiss={() => setPreviewVisible(false)}>
          <Dialog.Title>{t('encodingRuleConfig.codePreview')}</Dialog.Title>
          <Dialog.Content>
            {previewLoading ? (
              <ActivityIndicator />
            ) : (
              <View style={styles.previewContent}>
                <Text style={styles.previewLabel}>{t('encodingRuleConfig.nextCodeWillBe')}:</Text>
                <Text style={styles.previewCode}>{previewCode}</Text>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPreviewVisible(false)}>{t('common.close')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
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
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    marginBottom: 16,
    padding: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1565C0',
    lineHeight: 18,
  },
  ruleCard: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  disabledCard: {
    opacity: 0.6,
    backgroundColor: '#f9f9f9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entityChip: {
    height: 26,
  },
  ruleName: {
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 12,
  },
  patternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
  },
  patternLabel: {
    fontSize: 13,
    color: '#666',
    marginRight: 8,
  },
  patternValue: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  emptySubText: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  bottomPadding: {
    height: 80,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '90%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalDivider: {
    marginVertical: 16,
  },
  formSection: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  segmentedButtons: {
    marginBottom: 8,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  patternInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patternInput: {
    flex: 1,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    minWidth: 100,
  },
  placeholderDialog: {
    maxHeight: 400,
  },
  placeholderItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  placeholderCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  placeholderDesc: {
    fontSize: 13,
    color: '#333',
    marginBottom: 2,
  },
  placeholderExample: {
    fontSize: 12,
    color: '#999',
  },
  previewContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  previewLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  previewCode: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#4CAF50',
    padding: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
});
