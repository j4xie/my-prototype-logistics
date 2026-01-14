/**
 * ModulePropsEditor - 模块属性编辑器
 *
 * 底部弹出式表单，用于编辑模块的配置属性
 * 根据模块类型动态生成表单字段
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  TextInput,
  IconButton,
  Icon,
  Menu,
  Chip,
  Divider,
} from 'react-native-paper';
import { theme } from '../../../../theme';
import type { HomeModule, ModuleConfig } from '../../../../types/decoration';
import {
  getModuleSchema,
  type SchemaField,
  type ModuleSchema,
  type EnumOption,
} from './homeModuleSchemas';

// ============================================
// 类型定义
// ============================================

interface ModulePropsEditorProps {
  visible: boolean;
  module: HomeModule | null;
  onSave: (moduleId: string, config: ModuleConfig) => void;
  onClose: () => void;
}

// ============================================
// 模块图标和颜色映射
// ============================================

const MODULE_ICONS: Record<string, string> = {
  welcome: 'hand-wave',
  ai_insight: 'robot',
  stats_grid: 'chart-box',
  quick_actions: 'lightning-bolt',
  dev_tools: 'tools',
};

const MODULE_COLORS: Record<string, string> = {
  welcome: '#667eea',
  ai_insight: '#8B5CF6',
  stats_grid: '#10B981',
  quick_actions: '#F59E0B',
  dev_tools: '#6B7280',
};

// ============================================
// 字段渲染组件
// ============================================

interface FieldRendererProps {
  field: SchemaField;
  value: unknown;
  onChange: (value: unknown) => void;
}

/**
 * 布尔字段 - Switch
 */
const BooleanField: React.FC<FieldRendererProps> = ({ field, value, onChange }) => {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldLabelContainer}>
        <Text style={styles.fieldLabel}>{field.label}</Text>
        {field.description && (
          <Text style={styles.fieldDescription}>{field.description}</Text>
        )}
      </View>
      <Switch
        value={!!value}
        onValueChange={onChange}
        trackColor={{ false: '#E5E7EB', true: `${theme.colors.primary}50` }}
        thumbColor={value ? theme.colors.primary : '#9CA3AF'}
      />
    </View>
  );
};

/**
 * 数字字段 - NumberInput with +/- buttons
 */
const NumberField: React.FC<FieldRendererProps> = ({ field, value, onChange }) => {
  const numValue = typeof value === 'number' ? value : (field.defaultValue as number) ?? 0;
  const min = field.min ?? 0;
  const max = field.max ?? 100;
  const step = field.step ?? 1;

  const handleIncrement = () => {
    const newValue = Math.min(numValue + step, max);
    onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(numValue - step, min);
    onChange(newValue);
  };

  const handleTextChange = (text: string) => {
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(parsed, max));
      onChange(clamped);
    } else if (text === '') {
      onChange(min);
    }
  };

  return (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldLabelContainer}>
        <Text style={styles.fieldLabel}>{field.label}</Text>
        {field.description && (
          <Text style={styles.fieldDescription}>{field.description}</Text>
        )}
      </View>
      <View style={styles.numberInputRow}>
        <IconButton
          icon="minus"
          mode="contained-tonal"
          size={20}
          disabled={numValue <= min}
          onPress={handleDecrement}
          style={styles.numberButton}
        />
        <TextInput
          mode="outlined"
          value={String(numValue)}
          onChangeText={handleTextChange}
          keyboardType="numeric"
          style={styles.numberInput}
          outlineColor={theme.colors.outline}
          activeOutlineColor={theme.colors.primary}
        />
        <IconButton
          icon="plus"
          mode="contained-tonal"
          size={20}
          disabled={numValue >= max}
          onPress={handleIncrement}
          style={styles.numberButton}
        />
      </View>
    </View>
  );
};

/**
 * 字符串字段 - TextInput
 */
const StringField: React.FC<FieldRendererProps> = ({ field, value, onChange }) => {
  return (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldLabelContainer}>
        <Text style={styles.fieldLabel}>{field.label}</Text>
        {field.description && (
          <Text style={styles.fieldDescription}>{field.description}</Text>
        )}
      </View>
      <TextInput
        mode="outlined"
        value={String(value ?? '')}
        onChangeText={(text) => onChange(text)}
        placeholder={field.label}
        style={styles.textInput}
        outlineColor={theme.colors.outline}
        activeOutlineColor={theme.colors.primary}
      />
    </View>
  );
};

/**
 * 枚举字段 - Picker/Select
 */
const EnumField: React.FC<FieldRendererProps> = ({ field, value, onChange }) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const options = field.options ?? [];

  const selectedOption = options.find((opt) => opt.value === value);
  const displayText = selectedOption?.label ?? '请选择';

  return (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldLabelContainer}>
        <Text style={styles.fieldLabel}>{field.label}</Text>
        {field.description && (
          <Text style={styles.fieldDescription}>{field.description}</Text>
        )}
      </View>
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <Pressable
            onPress={() => setMenuVisible(true)}
            style={styles.selectButton}
          >
            <Text style={styles.selectButtonText}>{displayText}</Text>
            <Icon source="chevron-down" size={20} color="#6B7280" />
          </Pressable>
        }
        contentStyle={styles.menuContent}
      >
        {options.map((option) => (
          <Menu.Item
            key={String(option.value)}
            title={option.label}
            onPress={() => {
              onChange(option.value);
              setMenuVisible(false);
            }}
            leadingIcon={
              value === option.value ? 'radiobox-marked' : 'radiobox-blank'
            }
            style={value === option.value ? styles.selectedMenuItem : undefined}
          />
        ))}
      </Menu>
    </View>
  );
};

/**
 * 多选字段 - Multi-select chips
 */
const MultiSelectField: React.FC<FieldRendererProps> = ({ field, value, onChange }) => {
  const options = field.options ?? [];
  const selectedValues = Array.isArray(value) ? value : [];

  const handleToggle = (optValue: string | number) => {
    if (selectedValues.includes(optValue)) {
      onChange(selectedValues.filter((v) => v !== optValue));
    } else {
      onChange([...selectedValues, optValue]);
    }
  };

  return (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldLabelContainer}>
        <Text style={styles.fieldLabel}>{field.label}</Text>
        {field.description && (
          <Text style={styles.fieldDescription}>{field.description}</Text>
        )}
      </View>
      <View style={styles.chipsContainer}>
        {options.map((option) => {
          const isSelected = selectedValues.includes(option.value);
          return (
            <Chip
              key={String(option.value)}
              mode={isSelected ? 'flat' : 'outlined'}
              selected={isSelected}
              onPress={() => handleToggle(option.value)}
              style={[
                styles.chip,
                isSelected && { backgroundColor: `${theme.colors.primary}15` },
              ]}
              textStyle={isSelected ? { color: theme.colors.primary } : undefined}
              showSelectedCheck={false}
              icon={isSelected ? 'check' : undefined}
            >
              {option.label}
            </Chip>
          );
        })}
      </View>
    </View>
  );
};

/**
 * 根据字段类型渲染对应的输入组件
 */
const FieldRenderer: React.FC<FieldRendererProps> = (props) => {
  switch (props.field.type) {
    case 'boolean':
      return <BooleanField {...props} />;
    case 'number':
      return <NumberField {...props} />;
    case 'string':
      return <StringField {...props} />;
    case 'enum':
      return <EnumField {...props} />;
    case 'multiSelect':
      return <MultiSelectField {...props} />;
    default:
      return null;
  }
};

// ============================================
// ModulePropsEditor 主组件
// ============================================

export const ModulePropsEditor: React.FC<ModulePropsEditorProps> = ({
  visible,
  module,
  onSave,
  onClose,
}) => {
  // 临时配置状态
  const [config, setConfig] = useState<ModuleConfig>({});

  // 获取模块Schema
  const schema = useMemo(() => {
    if (!module) return null;
    return getModuleSchema(module.type);
  }, [module?.type]);

  // 模块颜色
  const moduleColor = module ? MODULE_COLORS[module.type] ?? theme.colors.primary : theme.colors.primary;
  const moduleIcon = module ? MODULE_ICONS[module.type] ?? 'cube' : 'cube';

  // 初始化配置
  useEffect(() => {
    if (module?.config) {
      setConfig({ ...module.config });
    } else {
      setConfig({});
    }
  }, [module]);

  // 更新字段值
  const handleFieldChange = useCallback((fieldKey: string, value: unknown) => {
    setConfig((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
  }, []);

  // 保存配置
  const handleSave = useCallback(() => {
    if (module) {
      onSave(module.id, config);
    }
    onClose();
  }, [module, config, onSave, onClose]);

  // 取消编辑
  const handleCancel = useCallback(() => {
    // 重置为原始配置
    if (module?.config) {
      setConfig({ ...module.config });
    } else {
      setConfig({});
    }
    onClose();
  }, [module, onClose]);

  if (!module || !schema) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCancel}>
          <Pressable
            style={styles.editorPanel}
            onPress={(e) => e.stopPropagation()}
          >
            {/* 拖拽指示条 */}
            <View style={styles.dragIndicator} />

            {/* 头部 */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View
                  style={[
                    styles.headerIconWrapper,
                    { backgroundColor: `${moduleColor}15` },
                  ]}
                >
                  <Icon source={moduleIcon} size={24} color={moduleColor} />
                </View>
                <View style={styles.headerTitleContainer}>
                  <Text style={styles.headerTitle}>{module.name}</Text>
                  <Text style={styles.headerSubtitle}>{schema.description}</Text>
                </View>
              </View>
              <IconButton
                icon="close"
                size={24}
                onPress={handleCancel}
                style={styles.closeButton}
              />
            </View>

            <Divider style={styles.divider} />

            {/* 表单内容 */}
            <ScrollView
              style={styles.formContainer}
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
            >
              {schema.fields.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Icon source="information-outline" size={48} color="#9CA3AF" />
                  <Text style={styles.emptyText}>此模块暂无可配置项</Text>
                </View>
              ) : (
                schema.fields.map((field, index) => (
                  <View key={field.key}>
                    <FieldRenderer
                      field={field}
                      value={config[field.key as keyof ModuleConfig]}
                      onChange={(value) => handleFieldChange(field.key, value)}
                    />
                    {index < schema.fields.length - 1 && (
                      <View style={styles.fieldDivider} />
                    )}
                  </View>
                ))
              )}
            </ScrollView>

            {/* 底部按钮 */}
            <View style={styles.footer}>
              <Pressable
                style={[styles.footerButton, styles.cancelButton]}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.footerButton,
                  styles.saveButton,
                  { backgroundColor: moduleColor },
                ]}
                onPress={handleSave}
              >
                <Icon source="check" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>保存</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ============================================
// 样式
// ============================================

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  editorPanel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },

  // 头部
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  closeButton: {
    margin: -8,
  },

  divider: {
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
  },

  // 表单
  formContainer: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },

  // 字段样式
  fieldContainer: {
    paddingVertical: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  fieldLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  fieldDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },

  // 数字输入
  numberInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  numberButton: {
    margin: 0,
  },
  numberInput: {
    flex: 1,
    marginHorizontal: 8,
    textAlign: 'center',
    backgroundColor: 'transparent',
  },

  // 文本输入
  textInput: {
    marginTop: 12,
    backgroundColor: 'transparent',
  },

  // 选择器
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  selectButtonText: {
    fontSize: 15,
    color: '#374151',
  },
  menuContent: {
    backgroundColor: '#fff',
  },
  selectedMenuItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },

  // 多选chips
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  chip: {
    marginBottom: 4,
  },

  // 底部按钮
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ModulePropsEditor;
