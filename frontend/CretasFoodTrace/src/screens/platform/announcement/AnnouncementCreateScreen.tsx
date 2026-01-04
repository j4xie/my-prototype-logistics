/**
 * AnnouncementCreateScreen - 创建/编辑公告页面
 *
 * 支持功能：
 * - 公告标题
 * - 公告类型选择
 * - 公告内容（富文本或 Markdown）
 * - 目标工厂选择（全部/指定工厂）
 * - 目标角色选择（全部/指定角色）
 * - 有效期设置（开始时间、结束时间）
 * - 是否置顶
 * - 预览功能
 * - 保存草稿/立即发布
 *
 * @author Cretas Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from 'react-native';
import { isAxiosError } from 'axios';
import platformApiClient from '../../../services/api/platformApiClient';
import {
  Text,
  Card,
  Chip,
  IconButton,
  TextInput,
  Button,
  Switch,
  Portal,
  Modal,
  Divider,
  ActivityIndicator,
  RadioButton,
  Checkbox,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';

// Types
interface AnnouncementFormData {
  title: string;
  content: string;
  type: 'system' | 'feature' | 'maintenance' | 'urgent';
  isTop: boolean;
  targetFactoryType: 'all' | 'selected';
  selectedFactories: string[];
  targetRoleType: 'all' | 'selected';
  selectedRoles: string[];
  startTime: Date;
  endTime: Date;
}

type RootStackParamList = {
  AnnouncementCenter: undefined;
  AnnouncementCreate: { announcementId?: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AnnouncementCreate'>;
type RouteProps = RouteProp<RootStackParamList, 'AnnouncementCreate'>;

// 公告类型配置
const ANNOUNCEMENT_TYPES = [
  { key: 'system', label: '系统通知', color: '#1890ff', icon: 'information', desc: '系统级别的通知公告' },
  { key: 'feature', label: '功能更新', color: '#52c41a', icon: 'rocket-launch', desc: '新功能发布或功能更新' },
  { key: 'maintenance', label: '维护公告', color: '#faad14', icon: 'wrench', desc: '系统维护或升级通知' },
  { key: 'urgent', label: '紧急通知', color: '#ff4d4f', icon: 'alert', desc: '需要立即关注的紧急事项' },
];

// 工厂和角色类型
interface FactoryOption {
  id: string;
  name: string;
}

interface RoleOption {
  id: string;
  name: string;
}

// TODO: 待后端实现角色列表API后替换
// 预期API: GET /api/platform/roles
// 目前使用静态角色列表
const STATIC_ROLES: RoleOption[] = [
  { id: 'platform_admin', name: '平台管理员' },
  { id: 'factory_super_admin', name: '工厂超级管理员' },
  { id: 'department_admin', name: '部门管理员' },
  { id: 'scheduler', name: '排班调度员' },
  { id: 'operator', name: '操作员' },
  { id: 'quality_inspector', name: '质检员' },
];

export function AnnouncementCreateScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation('platform');

  const announcementId = route.params?.announcementId;
  const isEdit = Boolean(announcementId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [factories, setFactories] = useState<FactoryOption[]>([]);
  const [roles] = useState<RoleOption[]>(STATIC_ROLES);
  const [formData, setFormData] = useState<AnnouncementFormData>({
    title: '',
    content: '',
    type: 'system',
    isTop: false,
    targetFactoryType: 'all',
    selectedFactories: [],
    targetRoleType: 'all',
    selectedRoles: [],
    startTime: new Date(),
    endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 默认30天后
  });

  // Modal states
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [factoryModalVisible, setFactoryModalVisible] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Load factories and existing announcement data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        // 加载工厂列表
        const factoriesResponse = await platformApiClient.getFactories();
        if (factoriesResponse && Array.isArray(factoriesResponse)) {
          setFactories(
            factoriesResponse.map((f) => ({
              id: f.id || f.factoryId,
              name: f.name || f.factoryName,
            }))
          );
        }

        // 如果是编辑模式，加载现有公告数据
        if (isEdit) {
          // TODO: 后端实现公告详情API后启用以下代码
          // const announcementResponse = await announcementApiClient.getAnnouncementById(announcementId);
          // if (announcementResponse.success && announcementResponse.data) {
          //   const ann = announcementResponse.data;
          //   setFormData({
          //     title: ann.title,
          //     content: ann.content,
          //     type: ann.type,
          //     isTop: ann.isTop,
          //     targetFactoryType: ann.targetFactories === 'all' ? 'all' : 'selected',
          //     selectedFactories: ann.targetFactories === 'all' ? [] : ann.targetFactories,
          //     targetRoleType: ann.targetRoles === 'all' ? 'all' : 'selected',
          //     selectedRoles: ann.targetRoles === 'all' ? [] : ann.targetRoles,
          //     startTime: new Date(ann.startTime),
          //     endTime: new Date(ann.endTime),
          //   });
          // }
          // API未实现，保持默认表单数据
        }
      } catch (error) {
        if (isAxiosError(error)) {
          Alert.alert('加载失败', error.response?.data?.message || '获取工厂列表失败');
        } else if (error instanceof Error) {
          Alert.alert('加载失败', error.message);
        }
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [isEdit, announcementId]);

  const updateField = <K extends keyof AnnouncementFormData>(
    field: K,
    value: AnnouncementFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  type TypeConfig = { key: string; label: string; color: string; icon: string; desc: string };
  const defaultTypeConfig: TypeConfig = ANNOUNCEMENT_TYPES[0]!;
  const getTypeConfig = (type: string): TypeConfig => {
    return ANNOUNCEMENT_TYPES.find((t) => t.key === type) ?? defaultTypeConfig;
  };

  const formatDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      Alert.alert('提示', '请输入公告标题');
      return false;
    }
    if (!formData.content.trim()) {
      Alert.alert('提示', '请输入公告内容');
      return false;
    }
    if (formData.targetFactoryType === 'selected' && formData.selectedFactories.length === 0) {
      Alert.alert('提示', '请选择目标工厂');
      return false;
    }
    if (formData.targetRoleType === 'selected' && formData.selectedRoles.length === 0) {
      Alert.alert('提示', '请选择目标角色');
      return false;
    }
    if (formData.endTime <= formData.startTime) {
      Alert.alert('提示', '结束时间必须晚于开始时间');
      return false;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!formData.title.trim()) {
      Alert.alert('提示', '请至少输入公告标题');
      return;
    }

    setSaving(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      Alert.alert('成功', '草稿已保存', [
        { text: '确定', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('错误', '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!validateForm()) return;

    Alert.alert('确认发布', '确定要立即发布此公告吗？发布后将推送给目标用户。', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定发布',
        onPress: async () => {
          setSaving(true);
          try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1000));
            Alert.alert('成功', '公告已发布', [
              { text: '确定', onPress: () => navigation.goBack() },
            ]);
          } catch (error) {
            Alert.alert('错误', '发布失败，请重试');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const toggleFactory = (factoryId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedFactories: prev.selectedFactories.includes(factoryId)
        ? prev.selectedFactories.filter((id) => id !== factoryId)
        : [...prev.selectedFactories, factoryId],
    }));
  };

  const toggleRole = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedRoles: prev.selectedRoles.includes(roleId)
        ? prev.selectedRoles.filter((id) => id !== roleId)
        : [...prev.selectedRoles, roleId],
    }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={{ marginTop: 16, color: '#666' }}>加载公告数据...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const typeConfig = getTypeConfig(formData.type);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerRow}>
          <IconButton
            icon="close"
            iconColor="#fff"
            onPress={() => navigation.goBack()}
          />
          <Text variant="titleLarge" style={styles.headerTitle}>
            {isEdit ? '编辑公告' : '新建公告'}
          </Text>
          <Pressable onPress={() => setPreviewModalVisible(true)}>
            <Text style={styles.headerAction}>预览</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title Input */}
          <Card style={styles.formCard} mode="elevated">
            <Card.Content>
              <Text style={styles.fieldLabel}>公告标题 *</Text>
              <TextInput
                mode="outlined"
                placeholder="请输入公告标题"
                value={formData.title}
                onChangeText={(text) => updateField('title', text)}
                maxLength={100}
                style={styles.textInput}
              />
              <Text style={styles.charCount}>{formData.title.length}/100</Text>
            </Card.Content>
          </Card>

          {/* Type Selection */}
          <Card style={styles.formCard} mode="elevated">
            <Card.Content>
              <Text style={styles.fieldLabel}>公告类型 *</Text>
              <Pressable
                style={styles.selectButton}
                onPress={() => setTypeModalVisible(true)}
              >
                <View style={styles.selectContent}>
                  <IconButton
                    icon={typeConfig.icon}
                    iconColor={typeConfig.color}
                    size={20}
                    style={styles.selectIcon}
                  />
                  <Text style={[styles.selectText, { color: typeConfig.color }]}>
                    {typeConfig.label}
                  </Text>
                </View>
                <IconButton icon="chevron-right" size={20} iconColor="#8c8c8c" />
              </Pressable>
            </Card.Content>
          </Card>

          {/* Content Input */}
          <Card style={styles.formCard} mode="elevated">
            <Card.Content>
              <Text style={styles.fieldLabel}>公告内容 *</Text>
              <TextInput
                mode="outlined"
                placeholder="请输入公告内容，支持Markdown格式"
                value={formData.content}
                onChangeText={(text) => updateField('content', text)}
                multiline
                numberOfLines={8}
                style={[styles.textInput, styles.contentInput]}
              />
              <Text style={styles.charCount}>{formData.content.length}字</Text>
            </Card.Content>
          </Card>

          {/* Target Settings */}
          <Card style={styles.formCard} mode="elevated">
            <Card.Content>
              <Text style={styles.sectionTitle}>推送设置</Text>

              {/* Target Factories */}
              <Text style={styles.fieldLabel}>目标工厂</Text>
              <View style={styles.radioGroup}>
                <Pressable
                  style={styles.radioItem}
                  onPress={() => updateField('targetFactoryType', 'all')}
                >
                  <RadioButton
                    value="all"
                    status={formData.targetFactoryType === 'all' ? 'checked' : 'unchecked'}
                    onPress={() => updateField('targetFactoryType', 'all')}
                    color="#667eea"
                  />
                  <Text style={styles.radioLabel}>全部工厂</Text>
                </Pressable>
                <Pressable
                  style={styles.radioItem}
                  onPress={() => updateField('targetFactoryType', 'selected')}
                >
                  <RadioButton
                    value="selected"
                    status={formData.targetFactoryType === 'selected' ? 'checked' : 'unchecked'}
                    onPress={() => updateField('targetFactoryType', 'selected')}
                    color="#667eea"
                  />
                  <Text style={styles.radioLabel}>指定工厂</Text>
                </Pressable>
              </View>
              {formData.targetFactoryType === 'selected' && (
                <Pressable
                  style={styles.selectButton}
                  onPress={() => setFactoryModalVisible(true)}
                >
                  <Text style={styles.selectPlaceholder}>
                    {formData.selectedFactories.length > 0
                      ? `已选择 ${formData.selectedFactories.length} 个工厂`
                      : '点击选择工厂'}
                  </Text>
                  <IconButton icon="chevron-right" size={20} iconColor="#8c8c8c" />
                </Pressable>
              )}

              <Divider style={styles.divider} />

              {/* Target Roles */}
              <Text style={styles.fieldLabel}>目标角色</Text>
              <View style={styles.radioGroup}>
                <Pressable
                  style={styles.radioItem}
                  onPress={() => updateField('targetRoleType', 'all')}
                >
                  <RadioButton
                    value="all"
                    status={formData.targetRoleType === 'all' ? 'checked' : 'unchecked'}
                    onPress={() => updateField('targetRoleType', 'all')}
                    color="#667eea"
                  />
                  <Text style={styles.radioLabel}>全部角色</Text>
                </Pressable>
                <Pressable
                  style={styles.radioItem}
                  onPress={() => updateField('targetRoleType', 'selected')}
                >
                  <RadioButton
                    value="selected"
                    status={formData.targetRoleType === 'selected' ? 'checked' : 'unchecked'}
                    onPress={() => updateField('targetRoleType', 'selected')}
                    color="#667eea"
                  />
                  <Text style={styles.radioLabel}>指定角色</Text>
                </Pressable>
              </View>
              {formData.targetRoleType === 'selected' && (
                <Pressable
                  style={styles.selectButton}
                  onPress={() => setRoleModalVisible(true)}
                >
                  <Text style={styles.selectPlaceholder}>
                    {formData.selectedRoles.length > 0
                      ? `已选择 ${formData.selectedRoles.length} 个角色`
                      : '点击选择角色'}
                  </Text>
                  <IconButton icon="chevron-right" size={20} iconColor="#8c8c8c" />
                </Pressable>
              )}
            </Card.Content>
          </Card>

          {/* Time Settings */}
          <Card style={styles.formCard} mode="elevated">
            <Card.Content>
              <Text style={styles.sectionTitle}>有效期设置</Text>

              <View style={styles.timeRow}>
                <View style={styles.timeItem}>
                  <Text style={styles.fieldLabel}>开始时间</Text>
                  <Pressable
                    style={styles.dateButton}
                    onPress={() => setShowStartPicker(true)}
                  >
                    <IconButton icon="calendar" size={18} iconColor="#667eea" />
                    <Text style={styles.dateText}>{formatDate(formData.startTime)}</Text>
                  </Pressable>
                </View>
                <View style={styles.timeItem}>
                  <Text style={styles.fieldLabel}>结束时间</Text>
                  <Pressable
                    style={styles.dateButton}
                    onPress={() => setShowEndPicker(true)}
                  >
                    <IconButton icon="calendar" size={18} iconColor="#667eea" />
                    <Text style={styles.dateText}>{formatDate(formData.endTime)}</Text>
                  </Pressable>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Top Setting */}
          <Card style={styles.formCard} mode="elevated">
            <Card.Content>
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>置顶公告</Text>
                  <Text style={styles.switchDesc}>置顶后将在公告列表顶部显示</Text>
                </View>
                <Switch
                  value={formData.isTop}
                  onValueChange={(value) => updateField('isTop', value)}
                  color="#667eea"
                />
              </View>
            </Card.Content>
          </Card>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Button
              mode="outlined"
              onPress={handleSaveDraft}
              loading={saving}
              disabled={saving}
              style={styles.actionButton}
            >
              保存草稿
            </Button>
            <Button
              mode="contained"
              onPress={handlePublish}
              loading={saving}
              disabled={saving}
              style={[styles.actionButton, styles.publishButton]}
              buttonColor="#667eea"
            >
              立即发布
            </Button>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={formData.startTime}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowStartPicker(false);
            if (date) updateField('startTime', date);
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={formData.endTime}
          mode="date"
          display="default"
          minimumDate={formData.startTime}
          onChange={(event, date) => {
            setShowEndPicker(false);
            if (date) updateField('endTime', date);
          }}
        />
      )}

      {/* Type Selection Modal */}
      <Portal>
        <Modal
          visible={typeModalVisible}
          onDismiss={() => setTypeModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            选择公告类型
          </Text>
          <View style={styles.typeList}>
            {ANNOUNCEMENT_TYPES.map((type) => (
              <Pressable
                key={type.key}
                style={[
                  styles.typeItem,
                  formData.type === type.key && styles.typeItemSelected,
                ]}
                onPress={() => {
                  updateField('type', type.key as AnnouncementFormData['type']);
                  setTypeModalVisible(false);
                }}
              >
                <IconButton
                  icon={type.icon}
                  iconColor={type.color}
                  size={24}
                />
                <View style={styles.typeInfo}>
                  <Text style={[styles.typeName, { color: type.color }]}>
                    {type.label}
                  </Text>
                  <Text style={styles.typeDesc}>{type.desc}</Text>
                </View>
                {formData.type === type.key && (
                  <IconButton icon="check" iconColor="#667eea" size={20} />
                )}
              </Pressable>
            ))}
          </View>
        </Modal>
      </Portal>

      {/* Factory Selection Modal */}
      <Portal>
        <Modal
          visible={factoryModalVisible}
          onDismiss={() => setFactoryModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            选择目标工厂
          </Text>
          <ScrollView style={styles.checkboxList}>
            {factories.length === 0 ? (
              <Text style={styles.emptyListText}>暂无工厂数据</Text>
            ) : (
              factories.map((factory) => (
                <Pressable
                  key={factory.id}
                  style={styles.checkboxItem}
                  onPress={() => toggleFactory(factory.id)}
                >
                  <Checkbox
                    status={
                      formData.selectedFactories.includes(factory.id)
                        ? 'checked'
                        : 'unchecked'
                    }
                    onPress={() => toggleFactory(factory.id)}
                    color="#667eea"
                  />
                  <Text style={styles.checkboxLabel}>{factory.name}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setFactoryModalVisible(false)}>
              取消
            </Button>
            <Button mode="contained" onPress={() => setFactoryModalVisible(false)}>
              确定 ({formData.selectedFactories.length})
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Role Selection Modal */}
      <Portal>
        <Modal
          visible={roleModalVisible}
          onDismiss={() => setRoleModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            选择目标角色
          </Text>
          <ScrollView style={styles.checkboxList}>
            {roles.map((role) => (
              <Pressable
                key={role.id}
                style={styles.checkboxItem}
                onPress={() => toggleRole(role.id)}
              >
                <Checkbox
                  status={
                    formData.selectedRoles.includes(role.id)
                      ? 'checked'
                      : 'unchecked'
                  }
                  onPress={() => toggleRole(role.id)}
                  color="#667eea"
                />
                <Text style={styles.checkboxLabel}>{role.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setRoleModalVisible(false)}>
              取消
            </Button>
            <Button mode="contained" onPress={() => setRoleModalVisible(false)}>
              确定 ({formData.selectedRoles.length})
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Preview Modal */}
      <Portal>
        <Modal
          visible={previewModalVisible}
          onDismiss={() => setPreviewModalVisible(false)}
          contentContainerStyle={styles.previewModal}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.previewHeader}>
              {formData.isTop && (
                <View style={styles.topBadge}>
                  <Text style={styles.topBadgeText}>置顶</Text>
                </View>
              )}
              <Chip
                mode="flat"
                compact
                icon={typeConfig.icon}
                textStyle={{ color: typeConfig.color, fontSize: 11 }}
                style={{ backgroundColor: `${typeConfig.color}15`, height: 24 }}
              >
                {typeConfig.label}
              </Chip>
            </View>

            <Text variant="titleLarge" style={styles.previewTitle}>
              {formData.title || '(未填写标题)'}
            </Text>

            <View style={styles.previewMeta}>
              <Text style={styles.previewMetaText}>发布者: 当前用户</Text>
              <Text style={styles.previewMetaText}>
                有效期: {formatDate(formData.startTime)} ~ {formatDate(formData.endTime)}
              </Text>
            </View>

            <Divider style={styles.previewDivider} />

            <Text style={styles.previewContent}>
              {formData.content || '(未填写内容)'}
            </Text>

            <Divider style={styles.previewDivider} />

            <View style={styles.previewInfo}>
              <Text style={styles.previewInfoLabel}>目标工厂:</Text>
              <Text style={styles.previewInfoValue}>
                {formData.targetFactoryType === 'all'
                  ? '全部工厂'
                  : formData.selectedFactories.length > 0
                  ? factories.filter((f) =>
                      formData.selectedFactories.includes(f.id)
                    )
                      .map((f) => f.name)
                      .join('、')
                  : '(未选择)'}
              </Text>
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.previewInfoLabel}>目标角色:</Text>
              <Text style={styles.previewInfoValue}>
                {formData.targetRoleType === 'all'
                  ? '全部角色'
                  : formData.selectedRoles.length > 0
                  ? roles.filter((r) => formData.selectedRoles.includes(r.id))
                      .map((r) => r.name)
                      .join('、')
                  : '(未选择)'}
              </Text>
            </View>

            <Button
              mode="contained"
              onPress={() => setPreviewModalVisible(false)}
              style={styles.previewCloseButton}
            >
              关闭预览
            </Button>
          </ScrollView>
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
  headerAction: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  formCard: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: '#fff',
  },
  contentInput: {
    minHeight: 160,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#8c8c8c',
    textAlign: 'right',
    marginTop: 4,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingLeft: 4,
    paddingVertical: 4,
  },
  selectContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectIcon: {
    margin: 0,
  },
  selectText: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectPlaceholder: {
    fontSize: 14,
    color: '#8c8c8c',
    paddingLeft: 12,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 12,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioLabel: {
    fontSize: 14,
    color: '#262626',
  },
  divider: {
    marginVertical: 16,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 16,
  },
  timeItem: {
    flex: 1,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingRight: 12,
  },
  dateText: {
    fontSize: 14,
    color: '#262626',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  switchDesc: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
  },
  publishButton: {
    flex: 2,
  },
  bottomPadding: {
    height: 40,
  },
  modal: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  typeList: {
    gap: 8,
  },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  typeItemSelected: {
    backgroundColor: '#f0f5ff',
    borderWidth: 1,
    borderColor: '#667eea',
  },
  typeInfo: {
    flex: 1,
    marginLeft: 8,
  },
  typeName: {
    fontSize: 14,
    fontWeight: '500',
  },
  typeDesc: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  checkboxList: {
    maxHeight: 300,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#262626',
    marginLeft: 8,
  },
  emptyListText: {
    fontSize: 14,
    color: '#8c8c8c',
    textAlign: 'center',
    paddingVertical: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  previewModal: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  topBadge: {
    backgroundColor: '#ff4d4f',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  topBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  previewTitle: {
    fontWeight: '600',
    color: '#262626',
    marginBottom: 12,
  },
  previewMeta: {
    gap: 4,
  },
  previewMetaText: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  previewDivider: {
    marginVertical: 16,
  },
  previewContent: {
    fontSize: 14,
    color: '#262626',
    lineHeight: 22,
  },
  previewInfo: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  previewInfoLabel: {
    fontSize: 13,
    color: '#8c8c8c',
    width: 80,
  },
  previewInfoValue: {
    fontSize: 13,
    color: '#262626',
    flex: 1,
  },
  previewCloseButton: {
    marginTop: 20,
  },
});

export default AnnouncementCreateScreen;
