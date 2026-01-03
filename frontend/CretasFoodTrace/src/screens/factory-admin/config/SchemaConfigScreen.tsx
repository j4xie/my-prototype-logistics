/**
 * Schema 配置屏幕
 *
 * AI 对话创建字段 + 版本管理 + 模板预览
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  formTemplateApiClient,
  FormTemplate,
  EntityType,
  TemplateStatistics,
  TemplateVersion,
} from '../../../services/api/formTemplateApiClient';
import {
  formAssistantApiClient,
  SchemaFieldDefinition,
  SchemaGenerateRequest,
} from '../../../services/api/formAssistantApiClient';

// 实体类型代码列表（用于映射翻译key）
const ENTITY_TYPE_CODES: EntityType[] = [
  'QUALITY_CHECK',
  'MATERIAL_BATCH',
  'PROCESSING_BATCH',
  'SHIPMENT',
  'EQUIPMENT',
  'DISPOSAL_RECORD',
];

// 实体类型图标映射
const ENTITY_TYPE_ICONS: Record<EntityType, string> = {
  QUALITY_CHECK: 'clipboard-check-outline',
  MATERIAL_BATCH: 'package-variant',
  PROCESSING_BATCH: 'cog-outline',
  SHIPMENT: 'truck-delivery-outline',
  EQUIPMENT: 'wrench-outline',
  DISPOSAL_RECORD: 'delete-outline',
};

// 实体类型颜色映射
const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
  QUALITY_CHECK: '#1890ff',
  MATERIAL_BATCH: '#52c41a',
  PROCESSING_BATCH: '#fa8c16',
  SHIPMENT: '#eb2f96',
  EQUIPMENT: '#722ed1',
  DISPOSAL_RECORD: '#f5222d',
};

interface FieldPreviewProps {
  field: SchemaFieldDefinition;
  onRemove: () => void;
}

function FieldPreview({ field, onRemove }: FieldPreviewProps) {
  return (
    <View style={styles.fieldPreviewItem}>
      <View style={styles.fieldPreviewContent}>
        <Text style={styles.fieldPreviewTitle}>{field.title}</Text>
        <Text style={styles.fieldPreviewName}>{field.name}</Text>
        <View style={styles.fieldPreviewMeta}>
          <Text style={styles.fieldPreviewType}>{field.type}</Text>
          <Text style={styles.fieldPreviewComponent}>{field['x-component']}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onRemove} style={styles.fieldPreviewRemove}>
        <Icon source="close" size={20} color="#ff4d4f" />
      </TouchableOpacity>
    </View>
  );
}

// 获取实体类型翻译key
const getEntityTypeKey = (entityType: EntityType): string => {
  const keys: Record<EntityType, string> = {
    QUALITY_CHECK: 'schemaConfig.entityTypes.qualityCheck',
    MATERIAL_BATCH: 'schemaConfig.entityTypes.materialBatch',
    PROCESSING_BATCH: 'schemaConfig.entityTypes.processingBatch',
    SHIPMENT: 'schemaConfig.entityTypes.shipment',
    EQUIPMENT: 'schemaConfig.entityTypes.equipment',
    DISPOSAL_RECORD: 'schemaConfig.entityTypes.disposalRecord',
  };
  return keys[entityType];
};

export function SchemaConfigScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('home');

  // 状态
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statistics, setStatistics] = useState<TemplateStatistics | null>(null);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);

  // AI 生成对话
  const [dialogVisible, setDialogVisible] = useState(false);
  const [selectedEntityType, setSelectedEntityType] = useState<EntityType | null>(null);
  const [userInput, setUserInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedFields, setGeneratedFields] = useState<SchemaFieldDefinition[]>([]);
  const [saving, setSaving] = useState(false);

  // 版本历史
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      const [stats, templateList] = await Promise.all([
        formTemplateApiClient.getStatistics(),
        formTemplateApiClient.getTemplateList({ page: 1, size: 20 }),
      ]);
      setStatistics(stats);
      setTemplates(templateList.content || []);
    } catch (error) {
      console.error('加载数据失败:', error);
      Alert.alert(t('schemaConfig.loadFailed'), t('schemaConfig.loadFailedMessage'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // 打开 AI 对话
  const openAIDialog = (entityType: EntityType) => {
    setSelectedEntityType(entityType);
    setUserInput('');
    setGeneratedFields([]);
    setDialogVisible(true);
  };

  // AI 生成字段
  const handleGenerateFields = async () => {
    if (!userInput.trim() || !selectedEntityType) {
      Alert.alert(t('common.tip'), t('schemaConfig.enterFieldDescription'));
      return;
    }

    setGenerating(true);
    try {
      // 获取现有字段名
      const template = templates.find((t) => t.entityType === selectedEntityType);
      let existingFields: string[] = [];
      if (template?.schemaJson) {
        try {
          const schema = JSON.parse(template.schemaJson);
          existingFields = Object.keys(schema.properties || {});
        } catch {
          // 忽略解析错误
        }
      }

      const request: SchemaGenerateRequest = {
        userInput: userInput.trim(),
        entityType: selectedEntityType,
        existingFields,
      };

      const response = await formAssistantApiClient.generateSchema(request);

      if (response.success && response.fields.length > 0) {
        setGeneratedFields(response.fields);
      } else {
        Alert.alert(t('schemaConfig.generateFailed'), response.message || t('schemaConfig.aiNoValidFields'));
      }
    } catch (error) {
      console.error('AI生成失败:', error);
      Alert.alert(t('schemaConfig.generateFailed'), t('schemaConfig.aiServiceError'));
    } finally {
      setGenerating(false);
    }
  };

  // 移除预览字段
  const removePreviewField = (index: number) => {
    setGeneratedFields((prev) => prev.filter((_, i) => i !== index));
  };

  // 保存生成的字段
  const handleSaveFields = async () => {
    if (generatedFields.length === 0 || !selectedEntityType) {
      Alert.alert(t('common.tip'), t('schemaConfig.noFieldsToSave'));
      return;
    }

    setSaving(true);
    try {
      // 获取现有模板
      const template = templates.find((t) => t.entityType === selectedEntityType);
      let existingSchema: { type: string; properties: Record<string, unknown> } = {
        type: 'object',
        properties: {},
      };

      if (template?.schemaJson) {
        try {
          existingSchema = JSON.parse(template.schemaJson);
        } catch {
          // 使用默认空schema
        }
      }

      // 合并新字段
      for (const field of generatedFields) {
        existingSchema.properties[field.name] = {
          type: field.type,
          title: field.title,
          'x-component': field['x-component'],
          'x-component-props': field['x-component-props'],
          'x-decorator': field['x-decorator'] || 'FormItem',
          'x-validator': field['x-validator'],
          'x-reactions': field['x-reactions'],
          description: field.description,
          required: field.required,
          enum: field.enum,
        };
      }

      // 保存到后端
      await formTemplateApiClient.createOrUpdateTemplate(selectedEntityType, {
        name: t(getEntityTypeKey(selectedEntityType)) + ' (AI)',
        schemaJson: JSON.stringify(existingSchema),
        description: `AI: ${generatedFields.map((f) => f.title).join(', ')}`,
      });

      Alert.alert(t('schemaConfig.saveSuccess'), t('schemaConfig.fieldsAdded', { count: generatedFields.length, type: t(getEntityTypeKey(selectedEntityType)) }));
      setDialogVisible(false);
      setGeneratedFields([]);
      setUserInput('');
      loadData();
    } catch (error) {
      console.error('保存失败:', error);
      Alert.alert(t('schemaConfig.saveFailed'), t('schemaConfig.saveFailedMessage'));
    } finally {
      setSaving(false);
    }
  };

  // 查看版本历史
  const openVersionHistory = async (template: FormTemplate) => {
    setSelectedTemplate(template);
    setVersionModalVisible(true);
    setLoadingVersions(true);

    try {
      const history = await formTemplateApiClient.getVersionHistory(template.id);
      setVersions(history.content || []);
    } catch (error) {
      console.error('加载版本历史失败:', error);
      Alert.alert(t('schemaConfig.loadFailed'), t('schemaConfig.versionHistoryLoadFailed'));
    } finally {
      setLoadingVersions(false);
    }
  };

  // 回滚版本
  const handleRollback = async (version: number) => {
    if (!selectedTemplate) return;

    Alert.alert(
      t('schemaConfig.confirmRollback'),
      t('schemaConfig.rollbackConfirmMessage', { version }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('schemaConfig.confirmRollbackBtn'),
          style: 'destructive',
          onPress: async () => {
            try {
              await formTemplateApiClient.rollbackToVersion(
                selectedTemplate.id,
                version,
                t('schemaConfig.userManualRollback')
              );
              Alert.alert(t('schemaConfig.rollbackSuccess'), t('schemaConfig.rolledBackTo', { version }));
              setVersionModalVisible(false);
              loadData();
            } catch (error) {
              console.error('回滚失败:', error);
              Alert.alert(t('schemaConfig.rollbackFailed'), t('schemaConfig.rollbackFailedMessage'));
            }
          },
        },
      ]
    );
  };

  // 渲染实体类型卡片
  const renderEntityCard = (entityType: EntityType) => {
    const template = templates.find((tp) => tp.entityType === entityType);
    const isConfigured = statistics?.configuredEntityTypes.includes(entityType);
    const color = ENTITY_TYPE_COLORS[entityType];

    return (
      <View key={entityType} style={styles.entityCard}>
        <View style={styles.entityHeader}>
          <View style={[styles.entityIcon, { backgroundColor: color + '20' }]}>
            <Icon source={ENTITY_TYPE_ICONS[entityType]} size={24} color={color} />
          </View>
          <View style={styles.entityInfo}>
            <Text style={styles.entityTitle}>{t(getEntityTypeKey(entityType))}</Text>
            <Text style={styles.entityStatus}>
              {isConfigured ? t('schemaConfig.version', { version: template?.version || 1 }) : t('schemaConfig.usingDefault')}
            </Text>
          </View>
          {isConfigured && (
            <View style={styles.configuredBadge}>
              <Icon source="check-circle" size={16} color="#52c41a" />
            </View>
          )}
        </View>

        <View style={styles.entityActions}>
          <TouchableOpacity
            style={[styles.entityButton, { backgroundColor: color + '15' }]}
            onPress={() => openAIDialog(entityType)}
          >
            <Icon source="robot" size={18} color={color} />
            <Text style={[styles.entityButtonText, { color }]}>{t('schemaConfig.aiAddFields')}</Text>
          </TouchableOpacity>

          {template && (
            <TouchableOpacity
              style={[styles.entityButton, { backgroundColor: '#f0f0f0' }]}
              onPress={() => openVersionHistory(template)}
            >
              <Icon source="history" size={18} color="#666" />
              <Text style={[styles.entityButtonText, { color: '#666' }]}>{t('schemaConfig.versionHistory')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('schemaConfig.title')}</Text>
          <Text style={styles.subtitle}>{t('schemaConfig.subtitle')}</Text>
        </View>

        {/* 统计卡片 */}
        {statistics && (
          <View style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{statistics.totalCount}</Text>
                <Text style={styles.statLabel}>{t('schemaConfig.stats.configured')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{statistics.aiGeneratedCount}</Text>
                <Text style={styles.statLabel}>{t('schemaConfig.stats.aiGenerated')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{Math.round(statistics.coverageRate * 100)}%</Text>
                <Text style={styles.statLabel}>{t('schemaConfig.stats.coverage')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* 实体类型列表 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('schemaConfig.formTypes')}</Text>
          {statistics?.supportedEntityTypes.map((entityType) =>
            renderEntityCard(entityType as EntityType)
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* AI 生成对话框 */}
      <Modal visible={dialogVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('schemaConfig.aiAddFieldsFor', { type: selectedEntityType ? t(getEntityTypeKey(selectedEntityType)) : '' })}
              </Text>
              <TouchableOpacity onPress={() => setDialogVisible(false)}>
                <Icon source="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* 输入区域 */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>{t('schemaConfig.describeFields')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={t('schemaConfig.fieldDescriptionPlaceholder')}
                placeholderTextColor="#999"
                value={userInput}
                onChangeText={setUserInput}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.generateButton, generating && styles.buttonDisabled]}
                onPress={handleGenerateFields}
                disabled={generating}
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon source="robot" size={20} color="#fff" />
                    <Text style={styles.generateButtonText}>{t('schemaConfig.aiGenerate')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* 预览区域 */}
            {generatedFields.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewTitle}>{t('schemaConfig.generatedFields', { count: generatedFields.length })}</Text>
                <ScrollView style={styles.previewList}>
                  {generatedFields.map((field, index) => (
                    <FieldPreview
                      key={field.name + index}
                      field={field}
                      onRemove={() => removePreviewField(index)}
                    />
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.buttonDisabled]}
                  onPress={handleSaveFields}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon source="content-save" size={20} color="#fff" />
                      <Text style={styles.saveButtonText}>{t('schemaConfig.saveFields')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 版本历史模态框 */}
      <Modal visible={versionModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('schemaConfig.versionHistoryFor', { type: selectedTemplate ? t(getEntityTypeKey(selectedTemplate.entityType as EntityType)) : '' })}
              </Text>
              <TouchableOpacity onPress={() => setVersionModalVisible(false)}>
                <Icon source="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {loadingVersions ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#667eea" />
              </View>
            ) : versions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon source="history" size={48} color="#ccc" />
                <Text style={styles.emptyText}>{t('schemaConfig.noVersionHistory')}</Text>
              </View>
            ) : (
              <ScrollView style={styles.versionList}>
                {versions.map((ver) => (
                  <View key={ver.id} style={styles.versionItem}>
                    <View style={styles.versionInfo}>
                      <Text style={styles.versionNumber}>{t('schemaConfig.versionLabel', { version: ver.version })}</Text>
                      <Text style={styles.versionDate}>
                        {new Date(ver.createdAt).toLocaleString('zh-CN')}
                      </Text>
                      {ver.changeSummary && (
                        <Text style={styles.versionSummary}>{ver.changeSummary}</Text>
                      )}
                    </View>
                    {ver.version !== selectedTemplate?.version && (
                      <TouchableOpacity
                        style={styles.rollbackButton}
                        onPress={() => handleRollback(ver.version)}
                      >
                        <Icon source="restore" size={16} color="#667eea" />
                        <Text style={styles.rollbackButtonText}>{t('schemaConfig.rollback')}</Text>
                      </TouchableOpacity>
                    )}
                    {ver.version === selectedTemplate?.version && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>{t('schemaConfig.current')}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a202c',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statsCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 12,
  },
  entityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  entityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  entityIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entityInfo: {
    flex: 1,
    marginLeft: 12,
  },
  entityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
  entityStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  configuredBadge: {
    marginLeft: 8,
  },
  entityActions: {
    flexDirection: 'row',
    gap: 8,
  },
  entityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  entityButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  inputSection: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a202c',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1a202c',
    minHeight: 80,
    marginBottom: 12,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  previewSection: {
    paddingHorizontal: 16,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 12,
  },
  previewList: {
    maxHeight: 200,
  },
  fieldPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  fieldPreviewContent: {
    flex: 1,
  },
  fieldPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a202c',
  },
  fieldPreviewName: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  fieldPreviewMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  fieldPreviewType: {
    fontSize: 11,
    color: '#667eea',
    backgroundColor: '#667eea20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fieldPreviewComponent: {
    fontSize: 11,
    color: '#52c41a',
    backgroundColor: '#52c41a20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fieldPreviewRemove: {
    padding: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#52c41a',
    padding: 14,
    borderRadius: 8,
    gap: 8,
    marginTop: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  versionList: {
    padding: 16,
  },
  versionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  versionInfo: {
    flex: 1,
  },
  versionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a202c',
  },
  versionDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  versionSummary: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  rollbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  rollbackButtonText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
  },
  currentBadge: {
    backgroundColor: '#52c41a20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 12,
    color: '#52c41a',
    fontWeight: '500',
  },
});

export default SchemaConfigScreen;
