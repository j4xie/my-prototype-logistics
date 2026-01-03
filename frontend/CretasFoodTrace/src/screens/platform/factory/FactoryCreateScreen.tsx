/**
 * FactoryCreateScreen - 手动创建工厂页面
 *
 * 平台管理员手动创建新工厂
 * 包含基本信息、联系信息、蓝图配置、AI配额设置、管理员账号等多个表单区域
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
  Chip,
  Menu,
  Divider,
  IconButton,
  ActivityIndicator,
  HelperText,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Slider from '@react-native-community/slider';
import { platformAPI, CreateFactoryRequest } from '../../../services/api/platformApiClient';
import { handleError } from '../../../utils/errorHandler';
import { logger } from '../../../utils/logger';

// Logger for this screen
const factoryCreateLogger = logger.createContextLogger('FactoryCreate');

// Navigation types
type PlatformStackParamList = {
  FactoryManagement: undefined;
  FactoryCreate: undefined;
  FactoryEdit: { factoryId: string };
  BlueprintPreview: { templateId: string };
};

type NavigationProp = NativeStackNavigationProp<PlatformStackParamList, 'FactoryCreate'>;

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

// Blueprint template options
interface BlueprintOption {
  value: string;
  label: string;
  version: string;
}

const BLUEPRINT_OPTIONS: BlueprintOption[] = [
  { value: 'seafood-std', label: '水产加工标准版', version: 'v2.0.1' },
  { value: 'frozen-std', label: '速冻食品标准版', version: 'v2.1.0' },
  { value: 'meat-pro', label: '肉类加工专业版', version: 'v1.5.0' },
  { value: 'dairy-std', label: '乳制品标准版', version: 'v1.0.0' },
];

// AI quota preset chips
const AI_QUOTA_PRESETS = [100, 300, 500, 800, 1000, 2000];

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
  // Blueprint
  blueprintTemplate: string;
  // AI quota
  aiQuota: number;
  // Admin account
  adminUsername: string;
  adminPassword: string;
  confirmPassword: string;
}

// Validation errors interface
interface ValidationErrors {
  factoryName?: string;
  industryType?: string;
  contactName?: string;
  contactPhone?: string;
  address?: string;
  blueprintTemplate?: string;
  adminUsername?: string;
  adminPassword?: string;
  confirmPassword?: string;
}

export default function FactoryCreateScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation('platform');

  // Form state
  const [formData, setFormData] = useState<FormData>({
    factoryName: '',
    factoryCode: 'F008', // Auto-generated
    industryType: '',
    description: '',
    contactName: '',
    contactPhone: '',
    address: '',
    blueprintTemplate: '',
    aiQuota: 500,
    adminUsername: '',
    adminPassword: '',
    confirmPassword: '',
  });

  // UI state
  const [industryMenuVisible, setIndustryMenuVisible] = useState(false);
  const [blueprintMenuVisible, setBlueprintMenuVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Generate factory code on mount
  useEffect(() => {
    generateFactoryCode();
  }, []);

  const generateFactoryCode = async () => {
    try {
      // In production, this would call API to get next available code
      const code = `F${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`;
      setFormData(prev => ({ ...prev, factoryCode: code }));
    } catch (error) {
      factoryCreateLogger.error('Failed to generate factory code', error as Error);
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

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Basic info validation
    if (!formData.factoryName.trim()) {
      newErrors.factoryName = t('factoryCreate.validation.factoryNameRequired', { defaultValue: '请输入工厂名称' });
    }
    if (!formData.industryType) {
      newErrors.industryType = t('factoryCreate.validation.industryTypeRequired', { defaultValue: '请选择行业类型' });
    }

    // Contact info validation
    if (!formData.contactName.trim()) {
      newErrors.contactName = t('factoryCreate.validation.contactNameRequired', { defaultValue: '请输入联系人姓名' });
    }
    if (!formData.contactPhone.trim()) {
      newErrors.contactPhone = t('factoryCreate.validation.contactPhoneRequired', { defaultValue: '请输入联系电话' });
    } else if (!/^1[3-9]\d{9}$/.test(formData.contactPhone.replace(/-/g, ''))) {
      newErrors.contactPhone = t('factoryCreate.validation.invalidPhone', { defaultValue: '请输入有效的手机号码' });
    }
    if (!formData.address.trim()) {
      newErrors.address = t('factoryCreate.validation.addressRequired', { defaultValue: '请输入工厂地址' });
    }

    // Blueprint validation
    if (!formData.blueprintTemplate) {
      newErrors.blueprintTemplate = t('factoryCreate.validation.blueprintRequired', { defaultValue: '请选择蓝图模板' });
    }

    // Admin account validation
    if (!formData.adminUsername.trim()) {
      newErrors.adminUsername = t('factoryCreate.validation.usernameRequired', { defaultValue: '请输入管理员用户名' });
    } else if (formData.adminUsername.length < 4) {
      newErrors.adminUsername = t('factoryCreate.validation.usernameTooShort', { defaultValue: '用户名至少4个字符' });
    }
    if (!formData.adminPassword) {
      newErrors.adminPassword = t('factoryCreate.validation.passwordRequired', { defaultValue: '请输入初始密码' });
    } else if (formData.adminPassword.length < 8) {
      newErrors.adminPassword = t('factoryCreate.validation.passwordTooShort', { defaultValue: '密码至少8个字符' });
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('factoryCreate.validation.confirmPasswordRequired', { defaultValue: '请确认密码' });
    } else if (formData.adminPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = t('factoryCreate.validation.passwordMismatch', { defaultValue: '两次输入的密码不一致' });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert(
        t('dialogs.validationFailed', { defaultValue: '验证失败' }),
        t('factoryCreate.validation.checkForm', { defaultValue: '请检查表单填写是否正确' })
      );
      return;
    }

    setSubmitting(true);
    try {
      factoryCreateLogger.info('Creating factory', { factoryCode: formData.factoryCode });

      const request: CreateFactoryRequest = {
        name: formData.factoryName,
        industry: formData.industryType,
        address: formData.address,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        // Additional fields would be added based on API requirements
      };

      await platformAPI.createFactory(request);

      Alert.alert(
        t('success.title', { defaultValue: '成功' }),
        t('factoryCreate.messages.createSuccess', { defaultValue: '工厂创建成功' }),
        [
          {
            text: t('common.confirm', { defaultValue: '确定' }),
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      factoryCreateLogger.error('Failed to create factory', error as Error);
      handleError(error, {
        title: t('errors.createFailed', { defaultValue: '创建失败' }),
        customMessage: t('factoryCreate.messages.createFailed', { defaultValue: '工厂创建失败，请重试' }),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    Alert.alert(
      t('factoryCreate.cancelConfirm.title', { defaultValue: '确认取消' }),
      t('factoryCreate.cancelConfirm.message', { defaultValue: '确定要取消创建吗？已填写的内容将丢失。' }),
      [
        { text: t('common.buttons.cancel', { defaultValue: '继续编辑' }), style: 'cancel' },
        { text: t('common.confirm', { defaultValue: '确认' }), onPress: () => navigation.goBack() },
      ]
    );
  };

  // Get selected industry label
  const getIndustryLabel = () => {
    const option = INDUSTRY_OPTIONS.find(o => o.value === formData.industryType);
    return option?.label || t('factoryCreate.selectIndustry', { defaultValue: '请选择行业类型' });
  };

  // Get selected blueprint label
  const getBlueprintLabel = () => {
    const option = BLUEPRINT_OPTIONS.find(o => o.value === formData.blueprintTemplate);
    return option ? `${option.label} ${option.version}` : t('factoryCreate.selectBlueprint', { defaultValue: '请选择蓝图模板' });
  };

  // Handle blueprint preview
  const handleBlueprintPreview = () => {
    if (formData.blueprintTemplate) {
      // Navigate to blueprint preview
      Alert.alert(
        t('factoryCreate.blueprintPreview.title', { defaultValue: '蓝图预览' }),
        t('factoryCreate.blueprintPreview.comingSoon', { defaultValue: '蓝图预览功能开发中' })
      );
    } else {
      Alert.alert(
        t('factoryCreate.blueprintPreview.noSelection', { defaultValue: '提示' }),
        t('factoryCreate.blueprintPreview.selectFirst', { defaultValue: '请先选择蓝图模板' })
      );
    }
  };

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
          {/* Info Banner */}
          <Card style={styles.infoBanner} mode="contained">
            <Card.Content style={styles.infoBannerContent}>
              <IconButton icon="information-outline" size={20} iconColor="#667eea" style={styles.infoIcon} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoText}>
                  {t('factoryCreate.manualHint', { defaultValue: '手动创建需要逐项填写配置，推荐使用' })}
                  <Text style={styles.infoLink} onPress={() => Alert.alert('AI', 'AI快速创建功能开发中')}>
                    {' '}{t('factoryCreate.aiQuickCreate', { defaultValue: 'AI快速创建' })}
                  </Text>
                </Text>
              </View>
            </Card.Content>
          </Card>

          {/* Basic Info Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('factoryCreate.sections.basicInfo', { defaultValue: '基本信息' })}
            </Text>
          </View>

          <Card style={styles.sectionCard} mode="elevated">
            <Card.Content>
              {/* Factory Name */}
              <View style={styles.formItem}>
                <Text style={styles.label}>
                  {t('factoryCreate.fields.factoryName', { defaultValue: '工厂名称' })}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  mode="outlined"
                  placeholder={t('factoryCreate.placeholders.factoryName', { defaultValue: '请输入工厂名称' })}
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
                  {t('factoryCreate.fields.factoryCode', { defaultValue: '工厂编号' })}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  mode="outlined"
                  placeholder={t('factoryCreate.placeholders.factoryCode', { defaultValue: '系统自动生成' })}
                  value={formData.factoryCode}
                  editable={false}
                  style={[styles.input, styles.disabledInput]}
                  outlineStyle={styles.inputOutline}
                />
              </View>

              {/* Industry Type Dropdown */}
              <View style={styles.formItem}>
                <Text style={styles.label}>
                  {t('factoryCreate.fields.industryType', { defaultValue: '行业类型' })}
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
                  {t('factoryCreate.fields.description', { defaultValue: '工厂描述' })}
                </Text>
                <TextInput
                  mode="outlined"
                  placeholder={t('factoryCreate.placeholders.description', { defaultValue: '请输入工厂描述（选填）' })}
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
              {t('factoryCreate.sections.contactInfo', { defaultValue: '联系信息' })}
            </Text>
          </View>

          <Card style={styles.sectionCard} mode="elevated">
            <Card.Content>
              {/* Contact Name */}
              <View style={styles.formItem}>
                <Text style={styles.label}>
                  {t('factoryCreate.fields.contactName', { defaultValue: '联系人姓名' })}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  mode="outlined"
                  placeholder={t('factoryCreate.placeholders.contactName', { defaultValue: '请输入联系人姓名' })}
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
                  {t('factoryCreate.fields.contactPhone', { defaultValue: '联系电话' })}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  mode="outlined"
                  placeholder={t('factoryCreate.placeholders.contactPhone', { defaultValue: '请输入联系电话' })}
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
                  {t('factoryCreate.fields.address', { defaultValue: '工厂地址' })}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  mode="outlined"
                  placeholder={t('factoryCreate.placeholders.address', { defaultValue: '请输入详细地址' })}
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

          {/* Blueprint Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('factoryCreate.sections.blueprint', { defaultValue: '蓝图配置' })}
            </Text>
          </View>

          <Card style={styles.sectionCard} mode="elevated">
            <Card.Content>
              {/* Blueprint Template Dropdown */}
              <View style={styles.formItem}>
                <Text style={styles.label}>
                  {t('factoryCreate.fields.blueprint', { defaultValue: '选择蓝图模板' })}
                  <Text style={styles.required}> *</Text>
                </Text>
                <Menu
                  visible={blueprintMenuVisible}
                  onDismiss={() => setBlueprintMenuVisible(false)}
                  anchor={
                    <TouchableOpacity
                      style={[styles.dropdown, errors.blueprintTemplate && styles.dropdownError]}
                      onPress={() => setBlueprintMenuVisible(true)}
                    >
                      <Text style={formData.blueprintTemplate ? styles.dropdownText : styles.dropdownPlaceholder}>
                        {getBlueprintLabel()}
                      </Text>
                      <IconButton icon="chevron-down" size={20} />
                    </TouchableOpacity>
                  }
                  contentStyle={styles.menuContent}
                >
                  {BLUEPRINT_OPTIONS.map((option) => (
                    <Menu.Item
                      key={option.value}
                      onPress={() => {
                        updateField('blueprintTemplate', option.value);
                        setBlueprintMenuVisible(false);
                      }}
                      title={`${option.label} ${option.version}`}
                    />
                  ))}
                </Menu>
                <Text style={styles.helperText}>
                  {t('factoryCreate.blueprintHint', { defaultValue: '蓝图将决定工厂的产品类型、部门结构和业务规则' })}
                </Text>
                {errors.blueprintTemplate && (
                  <HelperText type="error" visible>{errors.blueprintTemplate}</HelperText>
                )}
              </View>

              {/* Preview Button */}
              <TouchableOpacity style={styles.previewButton} onPress={handleBlueprintPreview}>
                <IconButton icon="eye-outline" size={18} iconColor="#667eea" />
                <Text style={styles.previewButtonText}>
                  {t('factoryCreate.previewBlueprint', { defaultValue: '预览蓝图内容' })}
                </Text>
              </TouchableOpacity>
            </Card.Content>
          </Card>

          {/* AI Quota Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('factoryCreate.sections.aiQuota', { defaultValue: 'AI配额设置' })}
            </Text>
          </View>

          <Card style={styles.sectionCard} mode="elevated">
            <Card.Content>
              <View style={styles.formItem}>
                <Text style={styles.label}>
                  {t('factoryCreate.fields.aiQuota', { defaultValue: '每周AI调用次数上限' })}
                </Text>
                <View style={styles.sliderContainer}>
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
                  <Text style={styles.sliderValue}>{formData.aiQuota}{t('factory.weeklyQuota', { defaultValue: '次' })}</Text>
                </View>
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>100{t('factory.weeklyQuota', { defaultValue: '次' })}</Text>
                  <Text style={styles.sliderLabel}>2000{t('factory.weeklyQuota', { defaultValue: '次' })}</Text>
                </View>
              </View>

              {/* Preset Chips */}
              <View style={styles.chipContainer}>
                {AI_QUOTA_PRESETS.map((preset) => (
                  <Chip
                    key={preset}
                    selected={formData.aiQuota === preset}
                    onPress={() => updateField('aiQuota', preset)}
                    style={[
                      styles.chip,
                      formData.aiQuota === preset && styles.chipSelected,
                    ]}
                    textStyle={formData.aiQuota === preset ? styles.chipTextSelected : styles.chipText}
                    mode="outlined"
                  >
                    {preset}
                  </Chip>
                ))}
              </View>

              {/* Recommendation */}
              <View style={styles.recommendationBox}>
                <IconButton icon="check-circle-outline" size={16} iconColor="#52c41a" style={styles.recommendIcon} />
                <Text style={styles.recommendText}>
                  {t('factoryCreate.aiQuotaRecommend', { defaultValue: '建议根据工厂规模设置，中型工厂（50-100人）推荐 500 次/周' })}
                </Text>
              </View>
            </Card.Content>
          </Card>

          {/* Admin Account Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('factoryCreate.sections.adminAccount', { defaultValue: '工厂管理员账号' })}
            </Text>
          </View>

          <Card style={styles.sectionCard} mode="elevated">
            <Card.Content>
              {/* Admin Username */}
              <View style={styles.formItem}>
                <Text style={styles.label}>
                  {t('factoryCreate.fields.adminUsername', { defaultValue: '管理员用户名' })}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  mode="outlined"
                  placeholder={t('factoryCreate.placeholders.adminUsername', { defaultValue: '请输入管理员用户名' })}
                  value={formData.adminUsername}
                  onChangeText={(text) => updateField('adminUsername', text)}
                  autoCapitalize="none"
                  error={!!errors.adminUsername}
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                />
                {errors.adminUsername && (
                  <HelperText type="error" visible>{errors.adminUsername}</HelperText>
                )}
              </View>

              {/* Admin Password */}
              <View style={styles.formItem}>
                <Text style={styles.label}>
                  {t('factoryCreate.fields.adminPassword', { defaultValue: '初始密码' })}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  mode="outlined"
                  placeholder={t('factoryCreate.placeholders.adminPassword', { defaultValue: '请输入初始密码' })}
                  value={formData.adminPassword}
                  onChangeText={(text) => updateField('adminPassword', text)}
                  secureTextEntry={!showPassword}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off' : 'eye'}
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                  error={!!errors.adminPassword}
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                />
                {errors.adminPassword && (
                  <HelperText type="error" visible>{errors.adminPassword}</HelperText>
                )}
              </View>

              {/* Confirm Password */}
              <View style={styles.formItem}>
                <Text style={styles.label}>
                  {t('factoryCreate.fields.confirmPassword', { defaultValue: '确认密码' })}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  mode="outlined"
                  placeholder={t('factoryCreate.placeholders.confirmPassword', { defaultValue: '请再次输入密码' })}
                  value={formData.confirmPassword}
                  onChangeText={(text) => updateField('confirmPassword', text)}
                  secureTextEntry={!showConfirmPassword}
                  right={
                    <TextInput.Icon
                      icon={showConfirmPassword ? 'eye-off' : 'eye'}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    />
                  }
                  error={!!errors.confirmPassword}
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                />
                {errors.confirmPassword && (
                  <HelperText type="error" visible>{errors.confirmPassword}</HelperText>
                )}
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
            {t('factoryCreate.createFactory', { defaultValue: '创建工厂' })}
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
  // Info Banner
  infoBanner: {
    marginBottom: 16,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: 12,
  },
  infoBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoIcon: {
    margin: 0,
    marginRight: 4,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoText: {
    fontSize: 13,
    color: '#667eea',
    lineHeight: 20,
  },
  infoLink: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  // Sections
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
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
  textArea: {
    minHeight: 80,
  },
  textAreaSmall: {
    minHeight: 60,
  },
  helperText: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 8,
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
  // Preview Button
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d9d9d9',
    borderRadius: 8,
    marginTop: 8,
  },
  previewButtonText: {
    fontSize: 14,
    color: '#667eea',
    marginLeft: -4,
  },
  // Slider
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    minWidth: 70,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
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
  // Chips
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: '#fff',
    borderColor: '#d9d9d9',
  },
  chipSelected: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderColor: '#667eea',
  },
  chipText: {
    color: '#8c8c8c',
    fontSize: 12,
  },
  chipTextSelected: {
    color: '#667eea',
    fontSize: 12,
  },
  // Recommendation Box
  recommendationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f6ffed',
    borderWidth: 1,
    borderColor: '#b7eb8f',
    borderRadius: 8,
    padding: 12,
  },
  recommendIcon: {
    margin: 0,
    marginRight: 4,
    marginTop: -2,
  },
  recommendText: {
    flex: 1,
    fontSize: 12,
    color: '#389e0d',
    lineHeight: 18,
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
