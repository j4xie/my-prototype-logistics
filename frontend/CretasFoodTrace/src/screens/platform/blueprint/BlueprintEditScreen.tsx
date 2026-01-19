/**
 * BlueprintEditScreen - Blueprint editor with drag-drop components
 *
 * Edit existing blueprint configurations
 *
 * @author Cretas Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  Banner,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { apiClient } from '../../../services/api/apiClient';

// Types
type RootStackParamList = {
  BlueprintList: undefined;
  BlueprintDetail: { blueprintId: string; blueprintName: string };
  BlueprintEdit: { blueprintId: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'BlueprintEdit'>;
type RouteProps = RouteProp<RootStackParamList, 'BlueprintEdit'>;

interface Department {
  id: string;
  name: string;
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

export function BlueprintEditScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation('platform');
  const { blueprintId } = route.params;

  // Loading state
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [industryType, setIndustryType] = useState('');
  const [currentVersion, setCurrentVersion] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [autoSync, setAutoSync] = useState(false);

  // Product types
  const [productTypes, setProductTypes] = useState<string[]>([]);
  const [newProductType, setNewProductType] = useState('');

  // Departments and templates
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);

  // Material types
  const [materialTypes, setMaterialTypes] = useState<string[]>([]);

  // UI state
  const [industryMenuVisible, setIndustryMenuVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Load blueprint data
   *
   * TODO: P2 - Replace mock data with real API call
   * Required API: GET /api/platform/blueprints/{blueprintId}
   * Response structure:
   * {
   *   id: string;
   *   name: string;
   *   industryType: string;
   *   currentVersion: string;
   *   description: string;
   *   productTypes: string[];
   *   materialTypes: string[];
   *   departments: Array<{ id, name, color, icon }>;
   *   formTemplates: Array<{ id, name, fieldCount }>;
   *   isActive: boolean;
   *   autoSync: boolean;
   * }
   *
   * API Client needed: blueprintApiClient.getBlueprintById(blueprintId)
   */
  const loadBlueprint = useCallback(async () => {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: {
          id: string;
          name: string;
          industryType: string;
          currentVersion: string;
          description: string;
          productTypes: string[];
          materialTypes: string[];
          departments: Department[];
          formTemplates: FormTemplate[];
          isActive: boolean;
          autoSync: boolean;
        };
      }>(`/api/platform/blueprints/${blueprintId}`);

      if (response.success && response.data) {
        const data = response.data;
        setName(data.name || '');
        setIndustryType(data.industryType || '');
        setCurrentVersion(data.currentVersion || 'v1.0.0');
        setDescription(data.description || '');
        setProductTypes(data.productTypes || []);
        setMaterialTypes(data.materialTypes || []);
        setDepartments(data.departments || []);
        setFormTemplates(data.formTemplates || []);
        setIsActive(data.isActive ?? true);
        setAutoSync(data.autoSync ?? false);
      }
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401) {
          Alert.alert('会话过期', '请重新登录');
        } else if (status === 404) {
          Alert.alert('蓝图不存在', '该蓝图可能已被删除', [
            { text: '返回', onPress: () => navigation.goBack() },
          ]);
        } else {
          console.error('加载蓝图失败:', error.response?.data?.message || error.message);
          Alert.alert('加载失败', '无法获取蓝图数据');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [blueprintId, navigation]);

  useEffect(() => {
    loadBlueprint();
  }, [loadBlueprint]);

  const handleAddProductType = () => {
    if (newProductType.trim()) {
      setProductTypes([...productTypes, newProductType.trim()]);
      setNewProductType('');
    }
  };

  const handleRemoveProductType = (index: number) => {
    setProductTypes(productTypes.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('验证失败', '请输入蓝图名称');
      return false;
    }
    if (!industryType) {
      Alert.alert('验证失败', '请选择行业类型');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert('保存成功', '蓝图已更新为 v2.0.2', [
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
      Alert.alert('保存失败', '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    Alert.alert('确认取消', '确定要取消吗？未保存的更改将丢失。', [
      { text: '继续编辑', style: 'cancel' },
      { text: '确定取消', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={{ marginTop: 16, color: '#666' }}>加载蓝图数据...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const versionParts = currentVersion.split('.');
  const nextVersion = `v${parseInt(versionParts[0]?.slice(1) ?? '1')}.${parseInt(versionParts[1] ?? '0')}.${parseInt(versionParts[2] ?? '0') + 1}`;

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
            编辑蓝图
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
          {/* Version Change Banner */}
          <View style={styles.warningBanner}>
            <IconButton icon="alert-circle" iconColor="#faad14" size={20} />
            <Text style={styles.warningText}>
              修改将创建新版本，已绑定的工厂需要手动同步更新
            </Text>
          </View>

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
              />

              <TextInput
                label="蓝图ID"
                value={blueprintId}
                mode="outlined"
                style={styles.input}
                disabled
              />
              <Text style={styles.inputHint}>蓝图ID创建后不可修改</Text>

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

              <View style={styles.versionRow}>
                <TextInput
                  label="当前版本"
                  value={currentVersion}
                  mode="outlined"
                  style={[styles.input, { flex: 1 }]}
                  disabled
                />
                <Chip mode="flat" style={styles.nextVersionChip}>
                  保存将升级为 {nextVersion}
                </Chip>
              </View>

              <TextInput
                label="描述"
                value={description}
                onChangeText={setDescription}
                mode="outlined"
                style={styles.input}
                multiline
                numberOfLines={3}
              />
            </Card.Content>
          </Card>

          {/* Product Types */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>产品类型 ({productTypes.length})</Text>
            <Text style={styles.sectionAction}>批量管理</Text>
          </View>
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.tagsContainer}>
                {productTypes.slice(0, 5).map((type, index) => (
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
                {productTypes.length > 5 && (
                  <Text style={styles.moreText}>+ {productTypes.length - 5} 更多</Text>
                )}
              </View>
              <View style={styles.addRow}>
                <TextInput
                  value={newProductType}
                  onChangeText={setNewProductType}
                  mode="outlined"
                  style={styles.addInput}
                  placeholder="添加新产品类型"
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

          {/* Material Types */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>原材料类型 ({materialTypes.length})</Text>
            <Text style={styles.sectionAction}>批量管理</Text>
          </View>
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.tagsContainer}>
                {materialTypes.slice(0, 7).map((type, index) => (
                  <Chip key={index} mode="flat" style={styles.materialChip}>
                    {type}
                  </Chip>
                ))}
                {materialTypes.length > 7 && (
                  <Chip mode="flat" style={styles.materialChip}>
                    + {materialTypes.length - 7} 更多
                  </Chip>
                )}
              </View>
            </Card.Content>
          </Card>

          {/* Departments */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>部门模板 ({departments.length})</Text>
            <Text style={styles.sectionAction}>编辑全部</Text>
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
                  </View>
                  <IconButton icon="pencil" size={16} iconColor="#8c8c8c" />
                </View>
              ))}
              <Text style={styles.moreText}>+ 5 个更多部门</Text>
            </Card.Content>
          </Card>

          {/* Form Templates */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>表单模板 ({formTemplates.length})</Text>
            <Text style={styles.sectionAction}>编辑全部</Text>
          </View>
          <Card style={styles.card}>
            <Card.Content>
              {formTemplates.map((template) => (
                <View key={template.id} style={styles.templateRow}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <View style={styles.templateActions}>
                    <Chip mode="flat" compact style={styles.templateChip}>
                      {template.fieldCount}字段
                    </Chip>
                    <IconButton icon="pencil" size={16} iconColor="#8c8c8c" />
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>

          {/* Business Rules */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>业务规则 (15)</Text>
            <Text style={styles.sectionAction}>管理规则</Text>
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
                <Chip mode="flat" style={[styles.ruleChip, { backgroundColor: 'rgba(250,173,20,0.1)' }]}>
                  <Text style={{ color: '#faad14' }}>成本规则 x3</Text>
                </Chip>
                <Chip mode="flat" style={[styles.ruleChip, { backgroundColor: 'rgba(255,77,79,0.1)' }]}>
                  <Text style={{ color: '#ff4d4f' }}>告警规则 x2</Text>
                </Chip>
              </View>
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
                  <Text style={styles.switchLabel}>蓝图状态</Text>
                  <Text style={styles.switchHint}>停用后无法被新工厂绑定</Text>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  color="#52c41a"
                />
              </View>
              <View style={[styles.switchRow, { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' }]}>
                <View>
                  <Text style={styles.switchLabel}>自动同步更新</Text>
                  <Text style={styles.switchHint}>版本更新时自动同步到已绑定工厂</Text>
                </View>
                <Switch
                  value={autoSync}
                  onValueChange={setAutoSync}
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
          onPress={handleSave}
          loading={submitting}
          disabled={submitting}
        >
          保存并发布
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(250,173,20,0.1)',
    borderWidth: 1,
    borderColor: '#faad14',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#595959',
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
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextVersionChip: {
    backgroundColor: '#e6f7ff',
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
  materialChip: {
    backgroundColor: '#f5f5f5',
  },
  moreText: {
    fontSize: 13,
    color: '#8c8c8c',
    paddingVertical: 6,
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
    flex: 1,
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  templateChip: {
    backgroundColor: '#f6ffed',
  },
  rulesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ruleChip: {
    marginBottom: 4,
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

export default BlueprintEditScreen;
