/**
 * 产品类型表单配置模态框
 *
 * 允许为产品类型配置各种表单的自定义字段:
 * - MATERIAL_BATCH (原料入库表单)
 * - QUALITY_CHECK (质检表单)
 * - PROCESSING_BATCH (生产批次表单)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-08
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Portal,
  Modal,
  Button,
  TextInput,
  Divider,
  List,
  IconButton,
  Chip,
  Menu,
  ActivityIndicator,
  Switch,
} from 'react-native-paper';
import {
  FormSchemaType,
  CustomSchemaOverrides,
  CustomFieldConfig,
  CustomFieldType,
  FormSchemaConfig,
} from '../../services/api/productTypeApiClient';
import { logger } from '../../utils/logger';

const schemaConfigLogger = logger.createContextLogger('ProductTypeSchemaConfig');

// ==================== Constants ====================

/**
 * 表单类型配置
 */
const FORM_TYPE_CONFIG: Record<FormSchemaType, { label: string; icon: string; description: string }> = {
  MATERIAL_BATCH: {
    label: '原料入库表单',
    icon: 'package-variant-closed',
    description: '配置原料入库时需要填写的自定义字段',
  },
  QUALITY_CHECK: {
    label: '质检表单',
    icon: 'clipboard-check-outline',
    description: '配置质检时需要填写的自定义字段',
  },
  PROCESSING_BATCH: {
    label: '生产批次表单',
    icon: 'factory',
    description: '配置生产批次记录时需要填写的自定义字段',
  },
};

/**
 * 字段类型选项
 */
const FIELD_TYPE_OPTIONS: Array<{ value: CustomFieldType; label: string; icon: string }> = [
  { value: 'string', label: '文本', icon: 'form-textbox' },
  { value: 'number', label: '数字', icon: 'numeric' },
  { value: 'boolean', label: '是/否', icon: 'toggle-switch' },
  { value: 'date', label: '日期', icon: 'calendar' },
  { value: 'select', label: '单选', icon: 'menu-down' },
  { value: 'multiSelect', label: '多选', icon: 'checkbox-multiple-marked' },
];

// ==================== Props ====================

interface ProductTypeSchemaConfigModalProps {
  /** 是否可见 */
  visible: boolean;
  /** 产品类型ID */
  productTypeId: string;
  /** 产品类型名称 */
  productTypeName: string;
  /** 初始配置 */
  initialConfig: CustomSchemaOverrides | null;
  /** 关闭回调 */
  onDismiss: () => void;
  /** 保存回调 */
  onSave: (config: CustomSchemaOverrides) => Promise<void>;
}

// ==================== Sub Components ====================

interface FieldEditorProps {
  visible: boolean;
  field: CustomFieldConfig | null;
  fieldKey: string | null;
  onSave: (key: string, field: CustomFieldConfig) => void;
  onCancel: () => void;
  existingKeys: string[];
}

/**
 * 字段编辑模态框
 */
function FieldEditor({
  visible,
  field,
  fieldKey,
  onSave,
  onCancel,
  existingKeys,
}: FieldEditorProps) {
  const [key, setKey] = useState(fieldKey || '');
  const [title, setTitle] = useState(field?.title || '');
  const [type, setType] = useState<CustomFieldType>(field?.type || 'string');
  const [description, setDescription] = useState(field?.description || '');
  const [required, setRequired] = useState(field?.required || false);
  const [enumOptions, setEnumOptions] = useState<string[]>(field?.enum || []);
  const [newEnumOption, setNewEnumOption] = useState('');
  const [minimum, setMinimum] = useState(field?.minimum?.toString() || '');
  const [maximum, setMaximum] = useState(field?.maximum?.toString() || '');
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);

  // Reset state when field changes
  useEffect(() => {
    if (field) {
      setKey(fieldKey || '');
      setTitle(field.title);
      setType(field.type);
      setDescription(field.description || '');
      setRequired(field.required || false);
      setEnumOptions(field.enum || []);
      setMinimum(field.minimum?.toString() || '');
      setMaximum(field.maximum?.toString() || '');
    } else {
      setKey('');
      setTitle('');
      setType('string');
      setDescription('');
      setRequired(false);
      setEnumOptions([]);
      setMinimum('');
      setMaximum('');
    }
    setNewEnumOption('');
  }, [field, fieldKey, visible]);

  const handleAddEnumOption = () => {
    if (newEnumOption.trim() && !enumOptions.includes(newEnumOption.trim())) {
      setEnumOptions([...enumOptions, newEnumOption.trim()]);
      setNewEnumOption('');
    }
  };

  const handleRemoveEnumOption = (option: string) => {
    setEnumOptions(enumOptions.filter(o => o !== option));
  };

  const handleSave = () => {
    // Validation
    if (!key.trim()) {
      Alert.alert('错误', '字段名不能为空');
      return;
    }

    if (!title.trim()) {
      Alert.alert('错误', '字段标题不能为空');
      return;
    }

    // Generate key from title if not provided
    const finalKey = key.trim() || title.trim().replace(/\s+/g, '_').toLowerCase();

    // Check for duplicate keys (excluding current field when editing)
    if (existingKeys.includes(finalKey) && finalKey !== fieldKey) {
      Alert.alert('错误', '字段名已存在');
      return;
    }

    // For select/multiSelect, require at least one option
    if ((type === 'select' || type === 'multiSelect') && enumOptions.length === 0) {
      Alert.alert('错误', '选择类型字段至少需要一个选项');
      return;
    }

    const newField: CustomFieldConfig = {
      type,
      title: title.trim(),
      description: description.trim() || undefined,
      required,
    };

    // Add type-specific properties
    if (type === 'select' || type === 'multiSelect') {
      newField.enum = enumOptions;
    }

    if (type === 'number') {
      if (minimum) newField.minimum = parseFloat(minimum);
      if (maximum) newField.maximum = parseFloat(maximum);
    }

    onSave(finalKey, newField);
  };

  const selectedTypeOption = FIELD_TYPE_OPTIONS.find(o => o.value === type);

  return (
    <Modal
      visible={visible}
      onDismiss={onCancel}
      contentContainerStyle={styles.fieldEditorModal}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.fieldEditorTitle}>
          {field ? '编辑字段' : '添加字段'}
        </Text>

        <TextInput
          label="字段名 (英文) *"
          value={key}
          onChangeText={setKey}
          mode="outlined"
          style={styles.input}
          placeholder="例如: customField1"
          autoCapitalize="none"
        />

        <TextInput
          label="字段标题 *"
          value={title}
          onChangeText={setTitle}
          mode="outlined"
          style={styles.input}
          placeholder="例如: 自定义字段1"
        />

        <View style={styles.dropdownContainer}>
          <Text style={styles.dropdownLabel}>字段类型</Text>
          <Menu
            visible={typeMenuVisible}
            onDismiss={() => setTypeMenuVisible(false)}
            anchor={
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setTypeMenuVisible(true)}
              >
                <View style={styles.dropdownRow}>
                  <List.Icon icon={selectedTypeOption?.icon || 'help'} />
                  <Text style={styles.dropdownButtonText}>
                    {selectedTypeOption?.label || '选择类型'}
                  </Text>
                </View>
                <List.Icon icon="chevron-down" />
              </TouchableOpacity>
            }
          >
            {FIELD_TYPE_OPTIONS.map(option => (
              <Menu.Item
                key={option.value}
                leadingIcon={option.icon}
                onPress={() => {
                  setType(option.value);
                  setTypeMenuVisible(false);
                }}
                title={option.label}
              />
            ))}
          </Menu>
        </View>

        <TextInput
          label="字段描述"
          value={description}
          onChangeText={setDescription}
          mode="outlined"
          style={styles.input}
          placeholder="可选，描述字段用途"
          multiline
          numberOfLines={2}
        />

        <View style={styles.switchRow}>
          <Text>必填</Text>
          <Switch value={required} onValueChange={setRequired} />
        </View>

        {/* Number-specific options */}
        {type === 'number' && (
          <View style={styles.numberOptions}>
            <TextInput
              label="最小值"
              value={minimum}
              onChangeText={setMinimum}
              mode="outlined"
              style={[styles.input, styles.halfInput]}
              keyboardType="numeric"
              placeholder="可选"
            />
            <TextInput
              label="最大值"
              value={maximum}
              onChangeText={setMaximum}
              mode="outlined"
              style={[styles.input, styles.halfInput]}
              keyboardType="numeric"
              placeholder="可选"
            />
          </View>
        )}

        {/* Select/MultiSelect options */}
        {(type === 'select' || type === 'multiSelect') && (
          <View style={styles.enumSection}>
            <Text style={styles.enumTitle}>选项列表</Text>
            <View style={styles.enumInputRow}>
              <TextInput
                value={newEnumOption}
                onChangeText={setNewEnumOption}
                mode="outlined"
                style={styles.enumInput}
                placeholder="输入选项"
                onSubmitEditing={handleAddEnumOption}
              />
              <IconButton
                icon="plus"
                mode="contained"
                onPress={handleAddEnumOption}
              />
            </View>
            <View style={styles.enumChips}>
              {enumOptions.map(option => (
                <Chip
                  key={option}
                  onClose={() => handleRemoveEnumOption(option)}
                  style={styles.enumChip}
                >
                  {option}
                </Chip>
              ))}
              {enumOptions.length === 0 && (
                <Text style={styles.emptyEnumText}>请添加至少一个选项</Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.fieldEditorActions}>
          <Button mode="outlined" onPress={onCancel} style={styles.actionButton}>
            取消
          </Button>
          <Button mode="contained" onPress={handleSave} style={styles.actionButton}>
            保存
          </Button>
        </View>
      </ScrollView>
    </Modal>
  );
}

// ==================== Main Component ====================

export function ProductTypeSchemaConfigModal({
  visible,
  productTypeId,
  productTypeName,
  initialConfig,
  onDismiss,
  onSave,
}: ProductTypeSchemaConfigModalProps) {
  const [config, setConfig] = useState<CustomSchemaOverrides>(initialConfig || {});
  const [activeFormType, setActiveFormType] = useState<FormSchemaType | null>(null);
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<CustomFieldConfig | null>(null);
  const [fieldEditorVisible, setFieldEditorVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setConfig(initialConfig || {});
      setActiveFormType(null);
    }
  }, [visible, initialConfig]);

  const handleFormTypeSelect = (formType: FormSchemaType) => {
    setActiveFormType(formType);
  };

  const handleBackToFormTypes = () => {
    setActiveFormType(null);
  };

  const handleAddField = () => {
    setEditingFieldKey(null);
    setEditingField(null);
    setFieldEditorVisible(true);
  };

  const handleEditField = (key: string, field: CustomFieldConfig) => {
    setEditingFieldKey(key);
    setEditingField(field);
    setFieldEditorVisible(true);
  };

  const handleDeleteField = (key: string) => {
    if (!activeFormType) return;

    Alert.alert(
      '确认删除',
      `确定要删除字段 "${config[activeFormType]?.properties[key]?.title || key}" 吗?`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            setConfig(prev => {
              const newConfig = { ...prev };
              if (newConfig[activeFormType]) {
                const { [key]: removed, ...rest } = newConfig[activeFormType]!.properties;
                newConfig[activeFormType] = {
                  ...newConfig[activeFormType]!,
                  properties: rest,
                };
              }
              return newConfig;
            });
          },
        },
      ]
    );
  };

  const handleSaveField = (key: string, field: CustomFieldConfig) => {
    if (!activeFormType) return;

    setConfig(prev => {
      const newConfig = { ...prev };
      if (!newConfig[activeFormType]) {
        newConfig[activeFormType] = { properties: {} };
      }

      // If editing and key changed, remove old key
      if (editingFieldKey && editingFieldKey !== key) {
        const { [editingFieldKey]: removed, ...rest } = newConfig[activeFormType]!.properties;
        newConfig[activeFormType] = {
          ...newConfig[activeFormType]!,
          properties: { ...rest, [key]: field },
        };
      } else {
        newConfig[activeFormType] = {
          ...newConfig[activeFormType]!,
          properties: {
            ...newConfig[activeFormType]!.properties,
            [key]: field,
          },
        };
      }

      return newConfig;
    });

    setFieldEditorVisible(false);
    setEditingFieldKey(null);
    setEditingField(null);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await onSave(config);
      schemaConfigLogger.info('表单配置保存成功', { productTypeId, productTypeName });
      Alert.alert('成功', '表单配置已保存');
      onDismiss();
    } catch (error) {
      schemaConfigLogger.error('保存表单配置失败', error as Error, { productTypeId });
      Alert.alert('错误', error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const getFieldCount = (formType: FormSchemaType): number => {
    return Object.keys(config[formType]?.properties || {}).length;
  };

  const existingKeys = activeFormType
    ? Object.keys(config[activeFormType]?.properties || {})
    : [];

  // Form type list view
  const renderFormTypeList = () => (
    <View style={styles.formTypeList}>
      {(Object.keys(FORM_TYPE_CONFIG) as FormSchemaType[]).map(formType => {
        const typeConfig = FORM_TYPE_CONFIG[formType];
        const fieldCount = getFieldCount(formType);

        return (
          <TouchableOpacity
            key={formType}
            style={styles.formTypeItem}
            onPress={() => handleFormTypeSelect(formType)}
          >
            <View style={styles.formTypeIcon}>
              <List.Icon icon={typeConfig.icon} color="#1976D2" />
            </View>
            <View style={styles.formTypeInfo}>
              <Text style={styles.formTypeName}>{typeConfig.label}</Text>
              <Text style={styles.formTypeDesc}>{typeConfig.description}</Text>
            </View>
            <View style={styles.formTypeRight}>
              {fieldCount > 0 && (
                <Chip compact style={styles.fieldCountChip}>
                  {fieldCount} 个字段
                </Chip>
              )}
              <List.Icon icon="chevron-right" />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // Field list view for selected form type
  const renderFieldList = () => {
    if (!activeFormType) return null;

    const formConfig = config[activeFormType];
    const fields = formConfig?.properties || {};
    const typeConfig = FORM_TYPE_CONFIG[activeFormType];

    return (
      <View style={styles.fieldListContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToFormTypes}
        >
          <List.Icon icon="arrow-left" />
          <Text style={styles.backButtonText}>返回</Text>
        </TouchableOpacity>

        <View style={styles.fieldListHeader}>
          <View style={styles.fieldListHeaderIcon}>
            <List.Icon icon={typeConfig.icon} color="#1976D2" />
          </View>
          <View>
            <Text style={styles.fieldListTitle}>{typeConfig.label}</Text>
            <Text style={styles.fieldListSubtitle}>{typeConfig.description}</Text>
          </View>
        </View>

        <Divider style={styles.divider} />

        <ScrollView style={styles.fieldList}>
          {Object.entries(fields).length === 0 ? (
            <View style={styles.emptyFieldList}>
              <List.Icon icon="folder-open-outline" color="#999" />
              <Text style={styles.emptyFieldText}>暂无自定义字段</Text>
              <Text style={styles.emptyFieldHint}>点击下方按钮添加字段</Text>
            </View>
          ) : (
            Object.entries(fields).map(([key, field]) => {
              const fieldTypeOption = FIELD_TYPE_OPTIONS.find(o => o.value === field.type);

              return (
                <View key={key} style={styles.fieldItem}>
                  <View style={styles.fieldItemMain}>
                    <View style={styles.fieldItemIcon}>
                      <List.Icon icon={fieldTypeOption?.icon || 'help'} />
                    </View>
                    <View style={styles.fieldItemInfo}>
                      <View style={styles.fieldItemTitleRow}>
                        <Text style={styles.fieldItemTitle}>{field.title}</Text>
                        {field.required && (
                          <Chip compact style={styles.requiredChip}>
                            必填
                          </Chip>
                        )}
                      </View>
                      <Text style={styles.fieldItemKey}>{key}</Text>
                      {field.description && (
                        <Text style={styles.fieldItemDesc}>{field.description}</Text>
                      )}
                      <Text style={styles.fieldItemType}>
                        类型: {fieldTypeOption?.label || field.type}
                        {field.enum && ` (${field.enum.length} 个选项)`}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.fieldItemActions}>
                    <IconButton
                      icon="pencil"
                      size={20}
                      onPress={() => handleEditField(key, field)}
                    />
                    <IconButton
                      icon="delete"
                      size={20}
                      onPress={() => handleDeleteField(key)}
                    />
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <Button
          mode="contained"
          icon="plus"
          onPress={handleAddField}
          style={styles.addFieldButton}
        >
          添加字段
        </Button>
      </View>
    );
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContent}
      >
        <Text style={styles.modalTitle}>
          表单配置: {productTypeName}
        </Text>
        <Text style={styles.modalSubtitle}>
          为该产品类型配置各类表单的自定义字段
        </Text>

        <Divider style={styles.divider} />

        {activeFormType ? renderFieldList() : renderFormTypeList()}

        <View style={styles.modalActions}>
          <Button
            mode="outlined"
            onPress={onDismiss}
            style={styles.actionButton}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            mode="contained"
            onPress={handleSaveConfig}
            style={styles.actionButton}
            loading={saving}
            disabled={saving}
          >
            保存配置
          </Button>
        </View>

        {/* Field Editor */}
        <FieldEditor
          visible={fieldEditorVisible}
          field={editingField}
          fieldKey={editingFieldKey}
          onSave={handleSaveField}
          onCancel={() => {
            setFieldEditorVisible(false);
            setEditingFieldKey(null);
            setEditingField(null);
          }}
          existingKeys={existingKeys}
        />
      </Modal>
    </Portal>
  );
}

// ==================== Styles ====================

const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: 'white',
    margin: 16,
    marginVertical: 40,
    borderRadius: 8,
    padding: 20,
    maxHeight: '90%',
    minHeight: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  divider: {
    marginVertical: 16,
  },
  formTypeList: {
    flex: 1,
  },
  formTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  formTypeIcon: {
    marginRight: 8,
  },
  formTypeInfo: {
    flex: 1,
  },
  formTypeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  formTypeDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  formTypeRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldCountChip: {
    backgroundColor: '#E3F2FD',
    marginRight: 4,
  },
  fieldListContainer: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 14,
    color: '#1976D2',
    marginLeft: -8,
  },
  fieldListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldListHeaderIcon: {
    marginRight: 8,
  },
  fieldListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  fieldListSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  fieldList: {
    flex: 1,
    maxHeight: 300,
  },
  emptyFieldList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyFieldText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  emptyFieldHint: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  fieldItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  fieldItemMain: {
    flexDirection: 'row',
    flex: 1,
  },
  fieldItemIcon: {
    marginTop: 4,
  },
  fieldItemInfo: {
    flex: 1,
    marginLeft: -8,
  },
  fieldItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  requiredChip: {
    backgroundColor: '#FFEBEE',
    height: 22,
  },
  fieldItemKey: {
    fontSize: 12,
    color: '#1976D2',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  fieldItemDesc: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  fieldItemType: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  fieldItemActions: {
    flexDirection: 'row',
  },
  addFieldButton: {
    marginTop: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionButton: {
    minWidth: 100,
  },

  // Field Editor Modal Styles
  fieldEditorModal: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 8,
    maxHeight: '85%',
  },
  fieldEditorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  dropdownContainer: {
    marginBottom: 12,
  },
  dropdownLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: -8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 12,
  },
  numberOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  enumSection: {
    marginBottom: 12,
  },
  enumTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  enumInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  enumInput: {
    flex: 1,
    height: 44,
  },
  enumChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  enumChip: {
    backgroundColor: '#E3F2FD',
  },
  emptyEnumText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  fieldEditorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
});

export default ProductTypeSchemaConfigModal;
