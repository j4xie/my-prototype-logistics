/**
 * BlueprintCreateScreen - Blueprint creation form with components editor
 *
 * Form to create a new blueprint with all configurations
 *
 * @author Cretas Team
 * @version 1.0.0
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  Button,
  IconButton,
  TextInput,
  Switch,
  Menu,
  ActivityIndicator,
  Avatar,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

// Types
type RootStackParamList = {
  BlueprintList: undefined;
  BlueprintDetail: { blueprintId: string; blueprintName: string };
  BlueprintCreate: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'BlueprintCreate'>;

interface Department {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
}

interface FormTemplate {
  id: string;
  name: string;
  fieldCount: number;
}

const INDUSTRY_OPTIONS = [
  { value: 'seafood', label: '水产加工' },
  { value: 'frozen', label: '速冻食品' },
  { value: 'meat', label: '肉类加工' },
  { value: 'dairy', label: '乳制品' },
  { value: 'vegetable', label: '果蔬加工' },
  { value: 'grain', label: '粮油加工' },
];

const DEFAULT_DEPARTMENTS: Department[] = [
  { id: '1', name: '原料收购部', description: '负责原材料采购入库', color: '#1890ff', icon: '原' },
  { id: '2', name: '加工生产部', description: '负责产品加工生产', color: '#52c41a', icon: '加' },
  { id: '3', name: '质量检测部', description: '负责质量检验', color: '#722ed1', icon: '质' },
  { id: '4', name: '仓储物流部', description: '负责仓储和出货', color: '#faad14', icon: '仓' },
];

const DEFAULT_FORM_TEMPLATES: FormTemplate[] = [
  { id: '1', name: '原材料入库表单', fieldCount: 12 },
  { id: '2', name: '生产加工记录表', fieldCount: 15 },
  { id: '3', name: '质量检验表单', fieldCount: 18 },
  { id: '4', name: '成品出货单', fieldCount: 10 },
];

export function BlueprintCreateScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation('platform');

  // Form state
  const [createMode, setCreateMode] = useState<'manual' | 'template'>('manual');
  const [name, setName] = useState('');
  const [blueprintId, setBlueprintId] = useState('');
  const [industryType, setIndustryType] = useState('');
  const [version, setVersion] = useState('v1.0.0');
  const [description, setDescription] = useState('');
  const [activateOnCreate, setActivateOnCreate] = useState(true);

  // Product types
  const [productTypes, setProductTypes] = useState<string[]>([
    '冰鲜带鱼段',
    '冰鲜黄鱼片',
    '冷冻鱿鱼圈',
  ]);
  const [newProductType, setNewProductType] = useState('');

  // Departments
  const [departments, setDepartments] = useState<Department[]>(DEFAULT_DEPARTMENTS);

  // Form templates
  const [formTemplates] = useState<FormTemplate[]>(DEFAULT_FORM_TEMPLATES);

  // UI state
  const [industryMenuVisible, setIndustryMenuVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAddProductType = () => {
    if (newProductType.trim()) {
      setProductTypes([...productTypes, newProductType.trim()]);
      setNewProductType('');
    }
  };

  const handleRemoveProductType = (index: number) => {
    setProductTypes(productTypes.filter((_, i) => i !== index));
  };

  const handleRemoveDepartment = (id: string) => {
    setDepartments(departments.filter((d) => d.id !== id));
  };

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('验证失败', '请输入蓝图名称');
      return false;
    }
    if (!blueprintId.trim()) {
      Alert.alert('验证失败', '请输入蓝图ID');
      return false;
    }
    if (!industryType) {
      Alert.alert('验证失败', '请选择行业类型');
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert('创建成功', `蓝图 "${name}" 已创建`, [
        {
          text: '确定',
          onPress: () =>
            navigation.navigate('BlueprintDetail', {
              blueprintId: blueprintId,
              blueprintName: name,
            }),
        },
      ]);
    } catch {
      Alert.alert('创建失败', '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    Alert.alert('确认取消', '确定要取消创建吗？已填写的内容将丢失。', [
      { text: '继续编辑', style: 'cancel' },
      { text: '确定取消', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerRow}>
          <IconButton
            icon="arrow-left"
            iconColor="#fff"
            onPress={handleCancel}
          />
          <Text variant="titleLarge" style={styles.headerTitle}>
            创建蓝图
          </Text>
          <View style={{ width: 48 }} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Create Mode Selection */}
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.modeCard}
          >
            <View style={styles.modeHeader}>
              <View style={styles.modeIcon}>
                <IconButton icon="lightbulb-outline" iconColor="#fff" size={24} />
              </View>
              <View>
                <Text style={styles.modeTitle}>选择创建方式</Text>
                <Text style={styles.modeSubtitle}>手动配置或从模板生成</Text>
              </View>
            </View>
            <View style={styles.modeButtons}>
              <Pressable
                style={[
                  styles.modeButton,
                  createMode === 'manual' && styles.modeButtonActive,
                ]}
                onPress={() => setCreateMode('manual')}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    createMode === 'manual' && styles.modeButtonTextActive,
                  ]}
                >
                  手动创建
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modeButton,
                  createMode === 'template' && styles.modeButtonActive,
                ]}
                onPress={() => setCreateMode('template')}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    createMode === 'template' && styles.modeButtonTextActive,
                  ]}
                >
                  从模板复制
                </Text>
              </Pressable>
            </View>
          </LinearGradient>

          {/* Basic Info */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>基本信息</Text>
          </View>
          <Card style={styles.card}>
            <Card.Content>
              <TextInput
                label="蓝图名称 *"
                value={name}
                onChangeText={setName}
                mode="outlined"
                style={styles.input}
                placeholder="请输入蓝图名称"
              />
              <TextInput
                label="蓝图ID *"
                value={blueprintId}
                onChangeText={setBlueprintId}
                mode="outlined"
                style={styles.input}
                placeholder="例如：BP-SEAFOOD-STD"
              />
              <Text style={styles.inputHint}>创建后不可修改，建议使用英文和数字</Text>

              <Menu
                visible={industryMenuVisible}
                onDismiss={() => setIndustryMenuVisible(false)}
                anchor={
                  <Pressable onPress={() => setIndustryMenuVisible(true)}>
                    <TextInput
                      label="行业类型 *"
                      value={
                        INDUSTRY_OPTIONS.find((o) => o.value === industryType)?.label ||
                        ''
                      }
                      mode="outlined"
                      style={styles.input}
                      editable={false}
                      right={<TextInput.Icon icon="chevron-down" />}
                      placeholder="请选择行业类型"
                    />
                  </Pressable>
                }
              >
                {INDUSTRY_OPTIONS.map((option) => (
                  <Menu.Item
                    key={option.value}
                    onPress={() => {
                      setIndustryType(option.value);
                      setIndustryMenuVisible(false);
                    }}
                    title={option.label}
                  />
                ))}
              </Menu>

              <TextInput
                label="初始版本号"
                value={version}
                onChangeText={setVersion}
                mode="outlined"
                style={styles.input}
              />

              <TextInput
                label="描述"
                value={description}
                onChangeText={setDescription}
                mode="outlined"
                style={styles.input}
                multiline
                numberOfLines={3}
                placeholder="请输入蓝图描述，说明适用场景和特点..."
              />
            </Card.Content>
          </Card>

          {/* Product Types */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>产品类型配置</Text>
            <Text style={styles.sectionAction}>批量导入</Text>
          </View>
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.tagsContainer}>
                {productTypes.map((type, index) => (
                  <Chip
                    key={index}
                    mode="flat"
                    style={styles.productChip}
                    closeIcon="close"
                    onClose={() => handleRemoveProductType(index)}
                  >
                    {type}
                  </Chip>
                ))}
              </View>
              <View style={styles.addRow}>
                <TextInput
                  value={newProductType}
                  onChangeText={setNewProductType}
                  mode="outlined"
                  style={styles.addInput}
                  placeholder="输入产品类型名称"
                  dense
                />
                <Button
                  mode="contained"
                  onPress={handleAddProductType}
                  style={styles.addButton}
                >
                  添加
                </Button>
              </View>
            </Card.Content>
          </Card>

          {/* Departments */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>部门模板</Text>
            <Text style={styles.sectionAction}>添加部门</Text>
          </View>
          <Card style={styles.card}>
            <Card.Content>
              {departments.map((dept) => (
                <View key={dept.id} style={styles.deptRow}>
                  <View style={[styles.deptIcon, { backgroundColor: `${dept.color}15` }]}>
                    <Text style={[styles.deptIconText, { color: dept.color }]}>
                      {dept.icon}
                    </Text>
                  </View>
                  <View style={styles.deptInfo}>
                    <Text style={styles.deptName}>{dept.name}</Text>
                    <Text style={styles.deptDesc}>{dept.description}</Text>
                  </View>
                  <IconButton
                    icon="close"
                    size={16}
                    iconColor="#8c8c8c"
                    onPress={() => handleRemoveDepartment(dept.id)}
                  />
                </View>
              ))}
            </Card.Content>
          </Card>

          {/* Form Templates */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>表单模板</Text>
            <Text style={styles.sectionAction}>添加表单</Text>
          </View>
          <Card style={styles.card}>
            <Card.Content>
              {formTemplates.map((template) => (
                <View key={template.id} style={styles.templateRow}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Chip mode="flat" compact style={styles.templateChip}>
                    {template.fieldCount}字段
                  </Chip>
                </View>
              ))}
            </Card.Content>
          </Card>

          {/* Business Rules */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>业务规则</Text>
            <Text style={styles.sectionAction}>添加规则</Text>
          </View>
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.rulesContainer}>
                <Chip mode="flat" style={[styles.ruleChip, { backgroundColor: 'rgba(24,144,255,0.1)' }]}>
                  <Text style={{ color: '#1890ff' }}>验证规则 x4</Text>
                </Chip>
                <Chip mode="flat" style={[styles.ruleChip, { backgroundColor: 'rgba(82,196,26,0.1)' }]}>
                  <Text style={{ color: '#52c41a' }}>工作流规则 x3</Text>
                </Chip>
                <Chip mode="flat" style={[styles.ruleChip, { backgroundColor: 'rgba(114,46,209,0.1)' }]}>
                  <Text style={{ color: '#722ed1' }}>质检规则 x3</Text>
                </Chip>
                <Chip mode="flat" style={[styles.ruleChip, { backgroundColor: 'rgba(255,77,79,0.1)' }]}>
                  <Text style={{ color: '#ff4d4f' }}>告警规则 x2</Text>
                </Chip>
              </View>
              <Pressable style={styles.manageRulesLink}>
                <Text style={styles.manageRulesText}>管理业务规则 {'>'}</Text>
              </Pressable>
            </Card.Content>
          </Card>

          {/* Status Settings */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>状态设置</Text>
          </View>
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>创建后立即激活</Text>
                  <Text style={styles.switchHint}>激活后可被工厂选择绑定</Text>
                </View>
                <Switch
                  value={activateOnCreate}
                  onValueChange={setActivateOnCreate}
                  color="#52c41a"
                />
              </View>
            </Card.Content>
          </Card>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button mode="outlined" style={styles.bottomButton} onPress={handleCancel}>
          取消
        </Button>
        <Button
          mode="contained"
          style={[styles.bottomButton, styles.primaryButton]}
          onPress={handleCreate}
          loading={submitting}
          disabled={submitting}
        >
          创建蓝图
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  headerTitle: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  modeCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modeIcon: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modeSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: '#fff',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  modeButtonTextActive: {
    color: '#fff',
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
  sectionAction: {
    fontSize: 13,
    color: '#667eea',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  inputHint: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: -8,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  productChip: {
    backgroundColor: '#f5f5f5',
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: '#fff',
  },
  addButton: {
    justifyContent: 'center',
    backgroundColor: '#667eea',
  },
  deptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 10,
  },
  deptIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deptIconText: {
    fontSize: 12,
    fontWeight: '500',
  },
  deptInfo: {
    flex: 1,
  },
  deptName: {
    fontSize: 14,
    color: '#262626',
  },
  deptDesc: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  templateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 10,
  },
  templateName: {
    fontSize: 14,
    color: '#262626',
  },
  templateChip: {
    backgroundColor: '#e6f7ff',
  },
  rulesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ruleChip: {
    marginBottom: 4,
  },
  manageRulesLink: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  manageRulesText: {
    fontSize: 13,
    color: '#667eea',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 14,
    color: '#262626',
    marginBottom: 4,
  },
  switchHint: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  bottomPadding: {
    height: 20,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  bottomButton: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#667eea',
  },
});

export default BlueprintCreateScreen;
