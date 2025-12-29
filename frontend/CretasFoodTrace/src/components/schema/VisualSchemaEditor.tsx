/**
 * 可视化 Schema 编辑器
 *
 * 提供无需编写 JSON 的可视化表单字段编辑功能:
 * - 添加/编辑/删除字段
 * - 配置字段类型、组件、验证规则
 * - 管理字段别名
 * - 拖拽排序 (未来版本)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Icon, Switch, Chip } from 'react-native-paper';
import {
  FormilySchema,
  SchemaProperty,
  extractFieldsFromSchema,
  fieldsToSchema,
  getPresetAliases,
} from '../../utils/schemaUtils';
import { SchemaFieldDefinition } from '../../services/api/formAssistantApiClient';

// ========== 类型定义 ==========

interface VisualSchemaEditorProps {
  /** 初始 Schema */
  schema: FormilySchema;
  /** Schema 变更回调 */
  onChange: (schema: FormilySchema) => void;
  /** 是否只读 */
  readonly?: boolean;
}

/**
 * Formily 组件选项
 */
const COMPONENT_OPTIONS = [
  { value: 'Input', label: '文本输入', icon: 'form-textbox' },
  { value: 'Input.TextArea', label: '多行文本', icon: 'text-box-outline' },
  { value: 'NumberPicker', label: '数字输入', icon: 'numeric' },
  { value: 'Select', label: '下拉选择', icon: 'menu-down' },
  { value: 'Radio.Group', label: '单选按钮', icon: 'radiobox-marked' },
  { value: 'Checkbox.Group', label: '复选框', icon: 'checkbox-marked-outline' },
  { value: 'DatePicker', label: '日期选择', icon: 'calendar' },
  { value: 'TimePicker', label: '时间选择', icon: 'clock-outline' },
  { value: 'Switch', label: '开关', icon: 'toggle-switch' },
  { value: 'Upload', label: '文件上传', icon: 'upload' },
  { value: 'Rate', label: '评分', icon: 'star' },
] as const;

/**
 * 字段类型选项
 */
const TYPE_OPTIONS = [
  { value: 'string', label: '文本' },
  { value: 'number', label: '数字' },
  { value: 'boolean', label: '布尔' },
  { value: 'array', label: '数组' },
] as const;

// ========== 子组件 ==========

interface FieldEditorModalProps {
  visible: boolean;
  field: SchemaFieldDefinition | null;
  onSave: (field: SchemaFieldDefinition) => void;
  onCancel: () => void;
  existingFieldNames: string[];
}

/**
 * 字段编辑模态框
 */
function FieldEditorModal({
  visible,
  field,
  onSave,
  onCancel,
  existingFieldNames,
}: FieldEditorModalProps) {
  const [name, setName] = useState(field?.name || '');
  const [title, setTitle] = useState(field?.title || '');
  const [type, setType] = useState<SchemaFieldDefinition['type']>(field?.type || 'string');
  const [component, setComponent] = useState(field?.['x-component'] || 'Input');
  const [description, setDescription] = useState(field?.description || '');
  const [required, setRequired] = useState(field?.required || false);
  const [aliases, setAliases] = useState<string[]>(field?.['x-aliases'] || []);
  const [newAlias, setNewAlias] = useState('');

  // 枚举选项
  const [enumOptions, setEnumOptions] = useState<Array<{ label: string; value: string }>>(
    field?.enum || []
  );
  const [newEnumLabel, setNewEnumLabel] = useState('');
  const [newEnumValue, setNewEnumValue] = useState('');

  // 重置状态
  React.useEffect(() => {
    if (field) {
      setName(field.name);
      setTitle(field.title);
      setType(field.type);
      setComponent(field['x-component']);
      setDescription(field.description || '');
      setRequired(field.required || false);
      setAliases(field['x-aliases'] || []);
      setEnumOptions(field.enum || []);
    } else {
      setName('');
      setTitle('');
      setType('string');
      setComponent('Input');
      setDescription('');
      setRequired(false);
      setAliases([]);
      setEnumOptions([]);
    }
    setNewAlias('');
    setNewEnumLabel('');
    setNewEnumValue('');
  }, [field, visible]);

  const handleSave = () => {
    // 验证
    if (!name.trim()) {
      Alert.alert('错误', '字段名不能为空');
      return;
    }

    if (!title.trim()) {
      Alert.alert('错误', '字段标题不能为空');
      return;
    }

    // 检查字段名是否重复 (编辑时排除自己)
    const isNameDuplicate = existingFieldNames.some(
      (n) => n === name.trim() && n !== field?.name
    );
    if (isNameDuplicate) {
      Alert.alert('错误', '字段名已存在');
      return;
    }

    const savedField: SchemaFieldDefinition = {
      name: name.trim(),
      title: title.trim(),
      type,
      'x-component': component,
      'x-decorator': 'FormItem',
      description: description.trim() || undefined,
      required,
      'x-aliases': aliases.length > 0 ? aliases : undefined,
      enum: enumOptions.length > 0 ? enumOptions : undefined,
    };

    onSave(savedField);
  };

  const addAlias = () => {
    if (newAlias.trim() && !aliases.includes(newAlias.trim())) {
      setAliases([...aliases, newAlias.trim()]);
      setNewAlias('');
    }
  };

  const removeAlias = (aliasToRemove: string) => {
    setAliases(aliases.filter((a) => a !== aliasToRemove));
  };

  const loadPresetAliases = () => {
    const presets = getPresetAliases(name);
    if (presets.length > 0) {
      const newAliases = [...new Set([...aliases, ...presets])];
      setAliases(newAliases);
    } else {
      Alert.alert('提示', '没有找到预设别名');
    }
  };

  const addEnumOption = () => {
    if (newEnumLabel.trim()) {
      const value = newEnumValue.trim() || newEnumLabel.trim();
      if (!enumOptions.some((e) => e.value === value)) {
        setEnumOptions([...enumOptions, { label: newEnumLabel.trim(), value }]);
        setNewEnumLabel('');
        setNewEnumValue('');
      }
    }
  };

  const removeEnumOption = (value: string) => {
    setEnumOptions(enumOptions.filter((e) => e.value !== value));
  };

  const isEnumComponent = component === 'Select' || component === 'Radio.Group' || component === 'Checkbox.Group';

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {field ? '编辑字段' : '添加字段'}
            </Text>
            <TouchableOpacity onPress={onCancel}>
              <Icon source="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* 字段名 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>字段名 (英文) *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="例如: temperature"
                autoCapitalize="none"
              />
            </View>

            {/* 字段标题 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>字段标题 (中文) *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="例如: 温度"
              />
            </View>

            {/* 字段类型 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>数据类型</Text>
              <View style={styles.optionRow}>
                {TYPE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.optionButton,
                      type === opt.value && styles.optionButtonActive,
                    ]}
                    onPress={() => setType(opt.value)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        type === opt.value && styles.optionButtonTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 组件类型 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>组件类型</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.componentRow}>
                  {COMPONENT_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.componentButton,
                        component === opt.value && styles.componentButtonActive,
                      ]}
                      onPress={() => setComponent(opt.value)}
                    >
                      <Icon
                        source={opt.icon}
                        size={20}
                        color={component === opt.value ? '#667eea' : '#666'}
                      />
                      <Text
                        style={[
                          styles.componentButtonText,
                          component === opt.value && styles.componentButtonTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* 枚举选项 (仅选择类组件) */}
            {isEnumComponent && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>选项列表</Text>
                <View style={styles.enumList}>
                  {enumOptions.map((opt) => (
                    <View key={opt.value} style={styles.enumItem}>
                      <Text style={styles.enumLabel}>{opt.label}</Text>
                      <Text style={styles.enumValue}>({opt.value})</Text>
                      <TouchableOpacity onPress={() => removeEnumOption(opt.value)}>
                        <Icon source="close-circle" size={18} color="#ff4d4f" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <View style={styles.addEnumRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={newEnumLabel}
                    onChangeText={setNewEnumLabel}
                    placeholder="显示文本"
                  />
                  <TextInput
                    style={[styles.input, { flex: 1, marginLeft: 8 }]}
                    value={newEnumValue}
                    onChangeText={setNewEnumValue}
                    placeholder="值 (可选)"
                  />
                  <TouchableOpacity style={styles.addButton} onPress={addEnumOption}>
                    <Icon source="plus" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 描述 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>描述 (可选)</Text>
              <TextInput
                style={[styles.input, { height: 60 }]}
                value={description}
                onChangeText={setDescription}
                placeholder="字段描述或提示信息"
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* 必填 */}
            <View style={styles.formGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>必填字段</Text>
                <Switch value={required} onValueChange={setRequired} color="#667eea" />
              </View>
            </View>

            {/* 别名管理 */}
            <View style={styles.formGroup}>
              <View style={styles.aliasHeader}>
                <Text style={styles.label}>字段别名</Text>
                <TouchableOpacity onPress={loadPresetAliases} style={styles.presetButton}>
                  <Icon source="lightbulb-outline" size={16} color="#667eea" />
                  <Text style={styles.presetButtonText}>加载预设</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>
                别名用于 AI 表单解析时匹配用户输入
              </Text>
              <View style={styles.aliasChips}>
                {aliases.map((alias) => (
                  <Chip
                    key={alias}
                    onClose={() => removeAlias(alias)}
                    style={styles.aliasChip}
                    textStyle={styles.aliasChipText}
                  >
                    {alias}
                  </Chip>
                ))}
              </View>
              <View style={styles.addAliasRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={newAlias}
                  onChangeText={setNewAlias}
                  placeholder="输入别名，如：投料重量"
                  onSubmitEditing={addAlias}
                />
                <TouchableOpacity style={styles.addButton} onPress={addAlias}>
                  <Icon source="plus" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ========== 主组件 ==========

export function VisualSchemaEditor({
  schema,
  onChange,
  readonly = false,
}: VisualSchemaEditorProps) {
  const [fields, setFields] = useState<SchemaFieldDefinition[]>(() =>
    extractFieldsFromSchema(schema)
  );
  const [editingField, setEditingField] = useState<SchemaFieldDefinition | null>(null);
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // 同步外部 schema 变化
  React.useEffect(() => {
    setFields(extractFieldsFromSchema(schema));
  }, [schema]);

  const handleFieldsChange = useCallback(
    (newFields: SchemaFieldDefinition[]) => {
      setFields(newFields);
      onChange(fieldsToSchema(newFields));
    },
    [onChange]
  );

  const handleAddField = () => {
    setIsCreating(true);
    setEditingField(null);
    setIsEditorVisible(true);
  };

  const handleEditField = (field: SchemaFieldDefinition) => {
    setIsCreating(false);
    setEditingField(field);
    setIsEditorVisible(true);
  };

  const handleDeleteField = (fieldName: string) => {
    Alert.alert('确认删除', `确定要删除字段 "${fieldName}" 吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const newFields = fields.filter((f) => f.name !== fieldName);
          handleFieldsChange(newFields);
        },
      },
    ]);
  };

  const handleSaveField = (savedField: SchemaFieldDefinition) => {
    let newFields: SchemaFieldDefinition[];

    if (isCreating) {
      newFields = [...fields, savedField];
    } else {
      newFields = fields.map((f) =>
        f.name === editingField?.name ? savedField : f
      );
    }

    handleFieldsChange(newFields);
    setIsEditorVisible(false);
    setEditingField(null);
  };

  const handleCancelEdit = () => {
    setIsEditorVisible(false);
    setEditingField(null);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;

    const newFields = [...fields];
    const currentField = newFields[index];
    const swapField = newFields[newIndex];
    if (currentField && swapField) {
      newFields[index] = swapField;
      newFields[newIndex] = currentField;
      handleFieldsChange(newFields);
    }
  };

  const getComponentLabel = (component: string) => {
    const opt = COMPONENT_OPTIONS.find((o) => o.value === component);
    return opt?.label || component;
  };

  const getComponentIcon = (component: string) => {
    const opt = COMPONENT_OPTIONS.find((o) => o.value === component);
    return opt?.icon || 'form-textbox';
  };

  return (
    <View style={styles.container}>
      {/* 字段列表 */}
      <ScrollView style={styles.fieldList}>
        {fields.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon source="form-select" size={48} color="#ccc" />
            <Text style={styles.emptyText}>暂无字段</Text>
            <Text style={styles.emptyHint}>点击下方按钮添加第一个字段</Text>
          </View>
        ) : (
          fields.map((field, index) => (
            <View key={field.name} style={styles.fieldItem}>
              <View style={styles.fieldIcon}>
                <Icon
                  source={getComponentIcon(field['x-component'])}
                  size={22}
                  color="#667eea"
                />
              </View>

              <View style={styles.fieldInfo}>
                <View style={styles.fieldTitleRow}>
                  <Text style={styles.fieldTitle}>{field.title}</Text>
                  {field.required && (
                    <Text style={styles.requiredBadge}>必填</Text>
                  )}
                </View>
                <Text style={styles.fieldName}>{field.name}</Text>
                <View style={styles.fieldMeta}>
                  <Text style={styles.fieldType}>{field.type}</Text>
                  <Text style={styles.fieldComponent}>
                    {getComponentLabel(field['x-component'])}
                  </Text>
                  {field['x-aliases'] && field['x-aliases'].length > 0 && (
                    <Text style={styles.aliasCount}>
                      {field['x-aliases'].length} 别名
                    </Text>
                  )}
                </View>
              </View>

              {!readonly && (
                <View style={styles.fieldActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => moveField(index, 'up')}
                    disabled={index === 0}
                  >
                    <Icon
                      source="chevron-up"
                      size={20}
                      color={index === 0 ? '#ccc' : '#666'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => moveField(index, 'down')}
                    disabled={index === fields.length - 1}
                  >
                    <Icon
                      source="chevron-down"
                      size={20}
                      color={index === fields.length - 1 ? '#ccc' : '#666'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditField(field)}
                  >
                    <Icon source="pencil" size={18} color="#667eea" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteField(field.name)}
                  >
                    <Icon source="delete" size={18} color="#ff4d4f" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* 添加字段按钮 */}
      {!readonly && (
        <TouchableOpacity style={styles.addFieldButton} onPress={handleAddField}>
          <Icon source="plus" size={24} color="#fff" />
          <Text style={styles.addFieldButtonText}>添加字段</Text>
        </TouchableOpacity>
      )}

      {/* 字段编辑器模态框 */}
      <FieldEditorModal
        visible={isEditorVisible}
        field={editingField}
        onSave={handleSaveField}
        onCancel={handleCancelEdit}
        existingFieldNames={fields.map((f) => f.name)}
      />
    </View>
  );
}

// ========== 样式 ==========

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fieldList: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 13,
    color: '#bbb',
    marginTop: 4,
  },
  fieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#667eea15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fieldTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a202c',
  },
  requiredBadge: {
    fontSize: 10,
    color: '#ff4d4f',
    backgroundColor: '#ff4d4f15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  fieldName: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  fieldMeta: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 6,
  },
  fieldType: {
    fontSize: 11,
    color: '#667eea',
    backgroundColor: '#667eea15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fieldComponent: {
    fontSize: 11,
    color: '#52c41a',
    backgroundColor: '#52c41a15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aliasCount: {
    fontSize: 11,
    color: '#fa8c16',
    backgroundColor: '#fa8c1615',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fieldActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    padding: 6,
  },
  addFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    padding: 14,
    borderRadius: 8,
    margin: 16,
    gap: 8,
  },
  addFieldButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
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
  modalBody: {
    padding: 16,
    maxHeight: 500,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a202c',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1a202c',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  optionButtonActive: {
    borderColor: '#667eea',
    backgroundColor: '#667eea15',
  },
  optionButtonText: {
    fontSize: 13,
    color: '#666',
  },
  optionButtonTextActive: {
    color: '#667eea',
    fontWeight: '500',
  },
  componentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  componentButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 80,
  },
  componentButtonActive: {
    borderColor: '#667eea',
    backgroundColor: '#667eea15',
  },
  componentButtonText: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  componentButtonTextActive: {
    color: '#667eea',
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aliasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  presetButtonText: {
    fontSize: 12,
    color: '#667eea',
  },
  aliasChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  aliasChip: {
    backgroundColor: '#f5f7fa',
  },
  aliasChipText: {
    fontSize: 12,
  },
  addAliasRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    backgroundColor: '#667eea',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enumList: {
    marginBottom: 8,
  },
  enumItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
    gap: 8,
  },
  enumLabel: {
    fontSize: 13,
    color: '#1a202c',
    flex: 1,
  },
  enumValue: {
    fontSize: 12,
    color: '#999',
  },
  addEnumRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#667eea',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VisualSchemaEditor;
