/**
 * FactoryEditScreen - 编辑工厂页面
 *
 * 平台管理员编辑现有工厂信息
 * 包含基本信息、联系信息、运营状态、蓝图配置、AI配额等编辑区域
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-03
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Card,
  TextInput,
  Button,
  Switch,
  Chip,
  Menu,
  Divider,
  IconButton,
  ActivityIndicator,
  HelperText,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Slider from '@react-native-community/slider';
import { isAxiosError } from 'axios';
import { platformAPI, FactoryDTO, UpdateFactoryRequest } from '../../../services/api/platformApiClient';
import { handleError } from '../../../utils/errorHandler';
import { logger } from '../../../utils/logger';

// Logger for this screen
const factoryEditLogger = logger.createContextLogger('FactoryEdit');

// Navigation types
type PlatformStackParamList = {
  FactoryManagement: undefined;
  FactoryCreate: undefined;
  FactoryEdit: { factoryId: string };
  BlueprintApply: { factoryId: string };
  FactoryQuota: { factoryId: string };
};

type NavigationProp = NativeStackNavigationProp<PlatformStackParamList, 'FactoryEdit'>;
type RouteProps = RouteProp<PlatformStackParamList, 'FactoryEdit'>;

// Industry type options
interface IndustryOption {
  value: string;
  label: string;
}

const INDUSTRY_OPTIONS: IndustryOption[] = [
  { value: 'seafood', label: '水产加工' },
  { value: 'frozen', label: '速冻食品' },
  { value: 'meat', label: '肉类加工' },
  { value: 'dairy', label: '乳制品' },
];

// Form data interface
interface FormData {
  // Basic info
  factoryName: string;
  factoryCode: string;
  industryType: string;
  description: string;
  // Contact info
  contactName: string;
  contactPhone: string;
  address: string;
  // Status
  isActive: boolean;
  // Blueprint
  blueprintName: string;
  blueprintVersion: string;
  autoSyncBlueprint: boolean;
  // AI quota
  aiQuota: number;
  aiQuotaUsed: number;
}

// Validation errors interface
interface ValidationErrors {
  factoryName?: string;
  industryType?: string;
  contactName?: string;
  contactPhone?: string;
  address?: string;
}

export default function FactoryEditScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation('platform');
  const { factoryId } = route.params;

  // Loading state
  const [loading, setLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    factoryName: '',
    factoryCode: '',
    industryType: '',
    description: '',
    contactName: '',
    contactPhone: '',
    address: '',
    isActive: true,
    blueprintName: '',
    blueprintVersion: '',
    autoSyncBlueprint: true,
    aiQuota: 500,
    aiQuotaUsed: 0,
  });

  // Original data for change detection
  const [originalData, setOriginalData] = useState<FormData | null>(null);

  // UI state
  const [industryMenuVisible, setIndustryMenuVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Load factory data on mount
  useEffect(() => {
    loadFactoryData();
  }, [factoryId]);

  /**
   * 将 API 返回的 FactoryDTO 转换为 FormData 格式
   */
  const transformFactoryToFormData = (factory: FactoryDTO): FormData => ({
    factoryName: factory.factoryName || factory.name || '',
    factoryCode: factory.id || '',
    industryType: factory.industry || '',
    description: '', // FactoryDTO 没有 description 字段，默认为空
    contactName: factory.contactName || factory.contactPerson || '',
    contactPhone: factory.contactPhone || '',
    address: factory.address || '',
    isActive: factory.status === 'active' || factory.isActive === true,
    blueprintName: factory.blueprintName || '',
    blueprintVersion: factory.blueprintVersion || '',
    autoSyncBlueprint: factory.blueprintSynced ?? true,
    aiQuota: factory.aiQuotaTotal || 500,
    aiQuotaUsed: factory.aiQuotaUsed || 0,
  });

  const loadFactoryData = async () => {
    setLoading(true);
    try {
      factoryEditLogger.info('Loading factory data', { factoryId });

      const response = await platformAPI.getFactoryById(factoryId);

      if (response.success && response.data) {
        const formDataFromApi = transformFactoryToFormData(response.data);
        setFormData(formDataFromApi);
        setOriginalData(formDataFromApi);
        factoryEditLogger.info('Factory data loaded successfully', { factoryId });
      } else {
        factoryEditLogger.error('API returned error', { message: response.message });
        Alert.alert(
          t('errors.loadFailed', { defaultValue: '加载失败' }),
          response.message || t('factoryEdit.messages.loadFailed', { defaultValue: '无法加载工厂信息' })
        );
        navigation.goBack();
      }
    } catch (error) {
      factoryEditLogger.error('Failed to load factory data', error as Error);
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401) {
          Alert.alert(
            t('common.error', { defaultValue: '错误' }),
            t('common.sessionExpired', { defaultValue: '登录已过期，请重新登录' })
          );
        } else if (status === 404) {
          Alert.alert(
            t('errors.notFound', { defaultValue: '未找到' }),
            t('factoryEdit.messages.factoryNotFound', { defaultValue: '工厂不存在或已被删除' })
          );
        } else {
          Alert.alert(
            t('errors.loadFailed', { defaultValue: '加载失败' }),
            error.response?.data?.message || t('factoryEdit.messages.loadFailed', { defaultValue: '无法加载工厂信息' })
          );
        }
      } else {
        handleError(error, {
          title: t('errors.loadFailed', { defaultValue: '加载失败' }),
          customMessage: t('factoryEdit.messages.loadFailed', { defaultValue: '无法加载工厂信息' }),
        });
      }
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Update form field
  const updateField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is updated
    if (errors[field as keyof ValidationErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  // Check if form has changes
  const hasChanges = (): boolean => {
    if (!originalData) return false;
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Basic info validation
    if (!formData.factoryName.trim()) {
      newErrors.factoryName = t('factoryEdit.validation.factoryNameRequired', { defaultValue: '请输入工厂名称' });
    }
    if (!formData.industryType) {
      newErrors.industryType = t('factoryEdit.validation.industryTypeRequired', { defaultValue: '请选择行业类型' });
    }

    // Contact info validation
    if (!formData.contactName.trim()) {
      newErrors.contactName = t('factoryEdit.validation.contactNameRequired', { defaultValue: '请输入联系人姓名' });
    }
    if (!formData.contactPhone.trim()) {
      newErrors.contactPhone = t('factoryEdit.validation.contactPhoneRequired', { defaultValue: '请输入联系电话' });
    }
    if (!formData.address.trim()) {
      newErrors.address = t('factoryEdit.validation.addressRequired', { defaultValue: '请输入工厂地址' });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert(
        t('dialogs.validationFailed', { defaultValue: '验证失败' }),
        t('factoryEdit.validation.checkForm', { defaultValue: '请检查表单填写是否正确' })
      );
      return;
    }

    if (!hasChanges()) {
      Alert.alert(
        t('factoryEdit.noChanges.title', { defaultValue: '提示' }),
        t('factoryEdit.noChanges.message', { defaultValue: '没有检测到任何更改' })
      );
      return;
    }

    setSubmitting(true);
    try {
      factoryEditLogger.info('Updating factory', { factoryId });

      const request: UpdateFactoryRequest = {
        name: formData.factoryName,
        industry: formData.industryType,
        address: formData.address,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        // Additional fields would be added based on API requirements
      };

      await platformAPI.updateFactory(factoryId, request);

      Alert.alert(
        t('success.title', { defaultValue: '成功' }),
        t('factoryEdit.messages.updateSuccess', { defaultValue: '工厂信息已更新' }),
        [
          {
            text: t('common.confirm', { defaultValue: '确定' }),
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      factoryEditLogger.error('Failed to update factory', error as Error);
      handleError(error, {
        title: t('errors.updateFailed', { defaultValue: '更新失败' }),
        customMessage: t('factoryEdit.messages.updateFailed', { defaultValue: '工厂信息更新失败，请重试' }),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (hasChanges()) {
      Alert.alert(
        t('factoryEdit.cancelConfirm.title', { defaultValue: '确认取消' }),
        t('factoryEdit.cancelConfirm.message', { defaultValue: '确定要取消吗？未保存的更改将丢失。' }),
        [
          { text: t('common.buttons.cancel', { defaultValue: '继续编辑' }), style: 'cancel' },
          { text: t('common.confirm', { defaultValue: '确认' }), onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  // Handle change blueprint
  const handleChangeBlueprint = () => {
    Alert.alert(
      t('factoryEdit.changeBlueprint.title', { defaultValue: '更换蓝图' }),
      t('factoryEdit.changeBlueprint.comingSoon', { defaultValue: '蓝图更换功能开发中' })
    );
  };

  // Handle quota settings
  const handleQuotaSettings = () => {
    Alert.alert(
      t('factoryEdit.quotaSettings.title', { defaultValue: '详细设置' }),
      t('factoryEdit.quotaSettings.comingSoon', { defaultValue: 'AI配额详细设置功能开发中' })
    );
  };

  // Get selected industry label
  const getIndustryLabel = () => {
    const option = INDUSTRY_OPTIONS.find(o => o.value === formData.industryType);
    return option?.label || t('factoryEdit.selectIndustry', { defaultValue: '请选择行业类型' });
  };

  // Calculate quota usage percentage
  const getQuotaUsagePercentage = () => {
    if (formData.aiQuota === 0) return 0;
    return Math.round((formData.aiQuotaUsed / formData.aiQuota) * 100);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>
            {t('factoryEdit.loading', { defaultValue: '加载中...' })}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Basic Info Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('factoryEdit.sections.basicInfo', { defaultValue: '基本信息' })}
            </Text>
          </View>

          <Card style={styles.sectionCard} mode="elevated">
            <Card.Content>
              {/* Factory Name */}
              <View style={styles.formItem}>
                <Text style={styles.label}>
                  {t('factoryEdit.fields.factoryName', { defaultValue: '工厂名称' })}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  mode="outlined"
                  value={formData.factoryName}
                  onChangeText={(text) => updateField('factoryName', text)}
                  error={!!errors.factoryName}
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                />
                {errors.factoryName && (
                  <HelperText type="error" visible>{errors.factoryName}</HelperText>
                )}
              </View>

              {/* Factory Code - Disabled */}
              <View style={styles.formItem}>
                <Text style={styles.label}>
                  {t('factoryEdit.fields.factoryCode', { defaultValue: '工厂编号' })}
                </Text>
                <TextInput
                  mode="outlined"
                  value={formData.factoryCode}
                  editable={false}
                  style={[styles.input, styles.disabledInput]}
                  outlineStyle={styles.inputOutline}
                />
                <Text style={styles.disabledHint}>
                  {t('factoryEdit.codeNotEditable', { defaultValue: '工厂编号创建后不可修改' })}
                </Text>
              </View>

              {/* Industry Type Dropdown */}
              <View style={styles.formItem}>
                <Text style={styles.label}>
                  {t('factoryEdit.fields.industryType', { defaultValue: '行业类型' })}
                  <Text style={styles.required}> *</Text>
                </Text>
                <Menu
                  visible={industryMenuVisible}
                  onDismiss={() => setIndustryMenuVisible(false)}
                  anchor={
                    <TouchableOpacity
                      style={[styles.dropdown, errors.industryType && styles.dropdownError]}
                      onPress={() => setIndustryMenuVisible(true)}
                    >
                      <Text style={formData.industryType ? styles.dropdownText : styles.dropdownPlaceholder}>
                        {getIndustryLabel()}
                      </Text>
                      <IconButton icon="chevron-down" size={20} />
                    </TouchableOpacity>
                  }
                  contentStyle={styles.menuContent}
                >
                  {INDUSTRY_OPTIONS.map((option) => (
                    <Menu.Item
                      key={option.value}
                      onPress={() => {
                        updateField('industryType', option.value);
                        setIndustryMenuVisible(false);
                      }}
                      title={option.label}
                    />
                  ))}
                </Menu>
                {errors.industryType && (
                  <HelperText type="error" visible>{errors.industryType}</HelperText>
                )}
              </View>

              {/* Description */}
              <View style={styles.formItem}>
                <Text style={styles.label}>
                  {t('factoryEdit.fields.description', { defaultValue: '工厂描述' })}
                </Text>
                <TextInput
                  mode="outlined"
                  value={formData.description}
                  onChangeText={(text) => updateField('description', text)}
                  multiline
                  numberOfLines={3}
                  style={[styles.input, styles.textArea]}
                  outlineStyle={styles.inputOutline}
                />
              </View>
            </Card.Content>
          </Card>

          {/* Contact Info Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('factoryEdit.sections.contactInfo', { defaultValue: '联系信息' })}
            </Text>
          </View>

          <Card style={styles.sectionCard} mode="elevated">
            <Card.Content>
              {/* Contact Name */}
              <View style={styles.formItem}>
                <Text style={styles.label}>
                  {t('factoryEdit.fields.contactName', { defaultValue: '联系人姓名' })}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  mode="outlined"
                  value={formData.contactName}
                  onChangeText={(text) => updateField('contactName', text)}
                  error={!!errors.contactName}
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                />
                {errors.contactName && (
                  <HelperText type="error" visible>{errors.contactName}</HelperText>
                )}
              </View>

              {/* Contact Phone */}
              <View style={styles.formItem}>
                <Text style={styles.label}>
                  {t('factoryEdit.fields.contactPhone', { defaultValue: '联系电话' })}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  mode="outlined"
                  value={formData.contactPhone}
                  onChangeText={(text) => updateField('contactPhone', text)}
                  keyboardType="phone-pad"
                  error={!!errors.contactPhone}
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                />
                {errors.contactPhone && (
                  <HelperText type="error" visible>{errors.contactPhone}</HelperText>
                )}
              </View>

              {/* Address */}
              <View style={styles.formItem}>
                <Text style={styles.label}>
                  {t('factoryEdit.fields.address', { defaultValue: '工厂地址' })}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  mode="outlined"
                  value={formData.address}
                  onChangeText={(text) => updateField('address', text)}
                  multiline
                  numberOfLines={2}
                  error={!!errors.address}
                  style={[styles.input, styles.textAreaSmall]}
                  outlineStyle={styles.inputOutline}
                />
                {errors.address && (
                  <HelperText type="error" visible>{errors.address}</HelperText>
                )}
              </View>
            </Card.Content>
          </Card>

          {/* Status Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('factoryEdit.sections.status', { defaultValue: '运营状态' })}
            </Text>
          </View>

          <Card style={styles.sectionCard} mode="elevated">
            <Card.Content>
              <View style={styles.statusRow}>
                <View style={styles.statusInfo}>
                  <Text style={styles.statusLabel}>
                    {t('factoryEdit.fields.status', { defaultValue: '工厂状态' })}
                  </Text>
                  <Text style={styles.statusHint}>
                    {t('factoryEdit.statusHint', { defaultValue: '停用后该工厂将无法登录和使用' })}
                  </Text>
                </View>
                <Switch
                  value={formData.isActive}
                  onValueChange={(value) => updateField('isActive', value)}
                  color="#52c41a"
                />
              </View>
              <View style={styles.statusBadge}>
                <Chip
                  mode="flat"
                  style={[
                    styles.statusChip,
                    formData.isActive ? styles.statusChipActive : styles.statusChipInactive,
                  ]}
                  textStyle={formData.isActive ? styles.statusChipActiveText : styles.statusChipInactiveText}
                >
                  {formData.isActive
                    ? t('factory.status.active', { defaultValue: '运营中' })
                    : t('factory.status.stopped', { defaultValue: '已停用' })
                  }
                </Chip>
              </View>
            </Card.Content>
          </Card>

          {/* Blueprint Section */}
          <View style={styles.sectionHeaderWithAction}>
            <Text style={styles.sectionTitle}>
              {t('factoryEdit.sections.blueprint', { defaultValue: '蓝图配置' })}
            </Text>
            <TouchableOpacity onPress={handleChangeBlueprint}>
              <Text style={styles.sectionAction}>
                {t('factoryEdit.changeBlueprint.action', { defaultValue: '更换蓝图' })}
              </Text>
            </TouchableOpacity>
          </View>

          <Card style={styles.sectionCard} mode="elevated">
            <Card.Content>
              {/* Current Blueprint */}
              <View style={styles.blueprintRow}>
                <View style={styles.blueprintIcon}>
                  <Text style={styles.blueprintIconText}>
                    {t('factoryEdit.blueprint.icon', { defaultValue: '蓝' })}
                  </Text>
                </View>
                <View style={styles.blueprintInfo}>
                  <Text style={styles.blueprintName}>{formData.blueprintName}</Text>
                  <Text style={styles.blueprintVersion}>
                    {t('factoryEdit.blueprint.version', { defaultValue: '版本' })} {formData.blueprintVersion} {t('factoryEdit.blueprint.bound', { defaultValue: '已绑定' })}
                  </Text>
                </View>
                <Chip mode="flat" style={styles.syncChip} textStyle={styles.syncChipText}>
                  {t('factoryEdit.blueprint.synced', { defaultValue: '已同步' })}
                </Chip>
              </View>

              <Divider style={styles.divider} />

              {/* Auto Sync Toggle */}
              <View style={styles.statusRow}>
                <View style={styles.statusInfo}>
                  <Text style={styles.statusLabel}>
                    {t('factoryEdit.blueprint.autoSync', { defaultValue: '自动同步蓝图更新' })}
                  </Text>
                  <Text style={styles.statusHint}>
                    {t('factoryEdit.blueprint.autoSyncHint', { defaultValue: '蓝图更新时自动应用到工厂' })}
                  </Text>
                </View>
                <Switch
                  value={formData.autoSyncBlueprint}
                  onValueChange={(value) => updateField('autoSyncBlueprint', value)}
                  color="#52c41a"
                />
              </View>
            </Card.Content>
          </Card>

          {/* AI Quota Section */}
          <View style={styles.sectionHeaderWithAction}>
            <Text style={styles.sectionTitle}>
              {t('factoryEdit.sections.aiQuota', { defaultValue: 'AI配额' })}
            </Text>
            <TouchableOpacity onPress={handleQuotaSettings}>
              <Text style={styles.sectionAction}>
                {t('factoryEdit.quotaSettings.action', { defaultValue: '详细设置' })}
              </Text>
            </TouchableOpacity>
          </View>

          <Card style={styles.sectionCard} mode="elevated">
            <Card.Content>
              {/* Quota Slider */}
              <View style={styles.formItem}>
                <View style={styles.quotaHeader}>
                  <Text style={styles.label}>
                    {t('factoryEdit.fields.aiQuota', { defaultValue: '每周调用上限' })}
                  </Text>
                  <Text style={styles.quotaValue}>
                    {formData.aiQuota} {t('factory.weeklyQuota', { defaultValue: '次' })}
                  </Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={100}
                  maximumValue={2000}
                  step={50}
                  value={formData.aiQuota}
                  onValueChange={(value) => updateField('aiQuota', value)}
                  minimumTrackTintColor="#667eea"
                  maximumTrackTintColor="#e0e0e0"
                  thumbTintColor="#667eea"
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>100{t('factory.weeklyQuota', { defaultValue: '次' })}</Text>
                  <Text style={styles.sliderLabel}>2000{t('factory.weeklyQuota', { defaultValue: '次' })}</Text>
                </View>
              </View>

              {/* Usage Stats */}
              <View style={styles.usageRow}>
                <Text style={styles.usageLabel}>
                  {t('factoryEdit.quota.thisWeekUsed', { defaultValue: '本周已使用' })}
                </Text>
                <Text style={styles.usageValue}>
                  {formData.aiQuotaUsed} {t('factory.weeklyQuota', { defaultValue: '次' })} ({getQuotaUsagePercentage()}%)
                </Text>
              </View>

              {/* Usage Progress Bar */}
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(getQuotaUsagePercentage(), 100)}%` },
                      getQuotaUsagePercentage() > 80 && styles.progressBarWarning,
                    ]}
                  />
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Bottom padding for action bar */}
          <View style={styles.bottomPadding} />
        </ScrollView>

        {/* Bottom Action Bar */}
        <View style={styles.bottomActions}>
          <Button
            mode="outlined"
            onPress={handleCancel}
            style={styles.cancelButton}
            labelStyle={styles.cancelButtonLabel}
            disabled={submitting}
          >
            {t('common.buttons.cancel', { defaultValue: '取消' })}
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.submitButton}
            labelStyle={styles.submitButtonLabel}
            loading={submitting}
            disabled={submitting}
          >
            {t('factoryEdit.saveChanges', { defaultValue: '保存更改' })}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#8c8c8c',
  },
  // Sections
  sectionHeader: {
    marginBottom: 12,
  },
  sectionHeaderWithAction: {
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
  sectionCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  // Form Items
  formItem: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#262626',
    marginBottom: 8,
  },
  required: {
    color: '#ff4d4f',
  },
  input: {
    backgroundColor: '#fff',
  },
  inputOutline: {
    borderRadius: 8,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
  },
  disabledHint: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 4,
  },
  textArea: {
    minHeight: 80,
  },
  textAreaSmall: {
    minHeight: 60,
  },
  // Dropdown
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
    backgroundColor: '#fff',
    minHeight: 56,
  },
  dropdownError: {
    borderColor: '#ff4d4f',
  },
  dropdownText: {
    fontSize: 14,
    color: '#262626',
    flex: 1,
  },
  dropdownPlaceholder: {
    fontSize: 14,
    color: '#8c8c8c',
    flex: 1,
  },
  menuContent: {
    backgroundColor: '#fff',
    marginTop: 4,
  },
  // Status Section
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
    marginRight: 16,
  },
  statusLabel: {
    fontSize: 14,
    color: '#262626',
    marginBottom: 4,
  },
  statusHint: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  statusBadge: {
    marginTop: 12,
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  statusChipActive: {
    backgroundColor: 'rgba(82, 196, 26, 0.1)',
  },
  statusChipInactive: {
    backgroundColor: 'rgba(158, 158, 158, 0.1)',
  },
  statusChipActiveText: {
    color: '#52c41a',
    fontSize: 12,
  },
  statusChipInactiveText: {
    color: '#8c8c8c',
    fontSize: 12,
  },
  // Blueprint Section
  blueprintRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blueprintIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blueprintIconText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
  blueprintInfo: {
    flex: 1,
    marginLeft: 12,
  },
  blueprintName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  blueprintVersion: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  syncChip: {
    backgroundColor: 'rgba(82, 196, 26, 0.1)',
  },
  syncChipText: {
    color: '#52c41a',
    fontSize: 12,
  },
  divider: {
    marginVertical: 12,
  },
  // AI Quota Section
  quotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quotaValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  usageLabel: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  usageValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#262626',
  },
  progressBarContainer: {
    marginTop: 8,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 3,
  },
  progressBarWarning: {
    backgroundColor: '#faad14',
  },
  // Bottom
  bottomPadding: {
    height: 100,
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
  },
  cancelButtonLabel: {
    color: '#8c8c8c',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#667eea',
    borderRadius: 8,
  },
  submitButtonLabel: {
    color: '#fff',
  },
});
