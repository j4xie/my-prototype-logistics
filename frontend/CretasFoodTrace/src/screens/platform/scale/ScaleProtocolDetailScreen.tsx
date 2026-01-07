/**
 * ScaleProtocolDetailScreen - 电子秤协议详情/编辑界面
 *
 * 平台管理员查看和编辑电子秤通信协议配置
 * 支持创建新协议和编辑现有协议
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
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
  Menu,
  IconButton,
  ActivityIndicator,
  HelperText,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import scaleApiClient, {
  ScaleProtocol,
  ConnectionType,
  ChecksumType,
  ReadMode,
} from '../../../services/api/scaleApiClient';
import { logger } from '../../../utils/logger';

// Logger for this screen
const protocolDetailLogger = logger.createContextLogger('ScaleProtocolDetail');

// Navigation types
type StackParamList = {
  ScaleProtocolList: undefined;
  ScaleProtocolDetail: { protocolId: string; isNew?: boolean };
};

type NavigationProp = NativeStackNavigationProp<StackParamList, 'ScaleProtocolDetail'>;
type RouteProps = RouteProp<StackParamList, 'ScaleProtocolDetail'>;

// Connection type options
const CONNECTION_TYPE_OPTIONS: { value: ConnectionType; label: string }[] = [
  { value: 'RS232', label: 'RS232 串口' },
  { value: 'RS485', label: 'RS485 串口' },
  { value: 'HTTP_API', label: 'HTTP API' },
  { value: 'MQTT', label: 'MQTT 协议' },
  { value: 'MODBUS_RTU', label: 'Modbus RTU' },
  { value: 'MODBUS_TCP', label: 'Modbus TCP' },
  { value: 'TCP_SOCKET', label: 'TCP Socket' },
];

// Checksum type options
const CHECKSUM_TYPE_OPTIONS: { value: ChecksumType; label: string }[] = [
  { value: 'NONE', label: '无校验' },
  { value: 'XOR', label: 'XOR 异或' },
  { value: 'CRC16', label: 'CRC16' },
  { value: 'CRC32', label: 'CRC32' },
  { value: 'SUM', label: '求和校验' },
  { value: 'MODBUS_CRC', label: 'Modbus CRC' },
];

// Read mode options
const READ_MODE_OPTIONS: { value: ReadMode; label: string }[] = [
  { value: 'CONTINUOUS', label: '连续输出' },
  { value: 'POLL', label: '轮询模式' },
  { value: 'ON_CHANGE', label: '变化上报' },
];

// Form data interface
interface FormData {
  protocolCode: string;
  protocolName: string;
  connectionType: ConnectionType;
  frameFormat: string;
  checksumType: ChecksumType;
  readMode: ReadMode;
  stableThresholdMs: string;
  serialConfig: string;
  description: string;
  isActive: boolean;
}

// Validation errors interface
interface ValidationErrors {
  protocolCode?: string;
  protocolName?: string;
  connectionType?: string;
  frameFormat?: string;
  stableThresholdMs?: string;
  serialConfig?: string;
}

// Theme color
const THEME_COLOR = '#3182ce';

export default function ScaleProtocolDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { protocolId, isNew } = route.params;

  // Loading state
  const [loading, setLoading] = useState(!isNew);
  const [submitting, setSubmitting] = useState(false);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(isNew || false);

  // Original data for change detection
  const [originalData, setOriginalData] = useState<FormData | null>(null);

  // Protocol metadata (for non-editable info)
  const [isBuiltin, setIsBuiltin] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    protocolCode: '',
    protocolName: '',
    connectionType: 'RS232',
    frameFormat: '',
    checksumType: 'NONE',
    readMode: 'CONTINUOUS',
    stableThresholdMs: '500',
    serialConfig: '',
    description: '',
    isActive: true,
  });

  // Menu visibility states
  const [connectionTypeMenuVisible, setConnectionTypeMenuVisible] = useState(false);
  const [checksumTypeMenuVisible, setChecksumTypeMenuVisible] = useState(false);
  const [readModeMenuVisible, setReadModeMenuVisible] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Load protocol data on mount
  useEffect(() => {
    if (!isNew && protocolId) {
      loadProtocolData();
    }
  }, [protocolId, isNew]);

  const loadProtocolData = async () => {
    setLoading(true);
    try {
      protocolDetailLogger.info('Loading protocol data', { protocolId });
      const protocol = await scaleApiClient.getProtocol(protocolId);

      const formDataFromApi: FormData = {
        protocolCode: protocol.protocolCode || '',
        protocolName: protocol.protocolName || '',
        connectionType: protocol.connectionType || 'RS232',
        frameFormat: protocol.frameFormat || '',
        checksumType: protocol.checksumType || 'NONE',
        readMode: protocol.readMode || 'CONTINUOUS',
        stableThresholdMs: String(protocol.stableThresholdMs || 500),
        serialConfig: protocol.serialConfig || '',
        description: protocol.description || '',
        isActive: protocol.isActive ?? true,
      };

      setFormData(formDataFromApi);
      setOriginalData(formDataFromApi);
      setIsBuiltin(protocol.isBuiltin || false);
      setIsVerified(protocol.isVerified || false);

      protocolDetailLogger.info('Protocol data loaded successfully');
    } catch (error) {
      protocolDetailLogger.error('Failed to load protocol data', error as Error);
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401) {
          Alert.alert('错误', '登录已过期，请重新登录');
        } else if (status === 404) {
          Alert.alert('错误', '协议不存在或已被删除');
        } else {
          Alert.alert('加载失败', error.response?.data?.message || '无法加载协议信息');
        }
      } else {
        Alert.alert('加载失败', '网络错误，请检查网络连接');
      }
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Update form field
  const updateField = useCallback(
    <K extends keyof FormData>(field: K, value: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear error when field is updated
      if (errors[field as keyof ValidationErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  // Check if form has changes
  const hasChanges = (): boolean => {
    if (!originalData) return true; // New protocol always has "changes"
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (!formData.protocolCode.trim()) {
      newErrors.protocolCode = '请输入协议编码';
    } else if (!/^[A-Z0-9_]+$/.test(formData.protocolCode)) {
      newErrors.protocolCode = '协议编码只能包含大写字母、数字和下划线';
    }

    if (!formData.protocolName.trim()) {
      newErrors.protocolName = '请输入协议名称';
    }

    if (!formData.connectionType) {
      newErrors.connectionType = '请选择连接类型';
    }

    if (!formData.frameFormat.trim()) {
      newErrors.frameFormat = '请输入帧格式';
    }

    // Validate stableThresholdMs as number
    const thresholdMs = parseInt(formData.stableThresholdMs, 10);
    if (isNaN(thresholdMs) || thresholdMs < 0 || thresholdMs > 10000) {
      newErrors.stableThresholdMs = '稳定阈值必须是 0-10000 之间的数字';
    }

    // Validate serialConfig as JSON if not empty
    if (formData.serialConfig.trim()) {
      try {
        JSON.parse(formData.serialConfig);
      } catch {
        newErrors.serialConfig = '串口配置必须是有效的 JSON 格式';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('验证失败', '请检查表单填写是否正确');
      return;
    }

    if (!isNew && !hasChanges()) {
      Alert.alert('提示', '没有检测到任何更改');
      return;
    }

    setSubmitting(true);
    try {
      const protocolData: Partial<ScaleProtocol> = {
        protocolCode: formData.protocolCode,
        protocolName: formData.protocolName,
        connectionType: formData.connectionType,
        frameFormat: formData.frameFormat,
        checksumType: formData.checksumType,
        readMode: formData.readMode,
        stableThresholdMs: parseInt(formData.stableThresholdMs, 10),
        serialConfig: formData.serialConfig || undefined,
        description: formData.description || undefined,
        isActive: formData.isActive,
      };

      if (isNew) {
        protocolDetailLogger.info('Creating new protocol');
        await scaleApiClient.createProtocol(protocolData);
        Alert.alert('成功', '协议创建成功', [
          { text: '确定', onPress: () => navigation.goBack() },
        ]);
      } else {
        protocolDetailLogger.info('Updating protocol', { protocolId });
        await scaleApiClient.updateProtocol(protocolId, protocolData);
        Alert.alert('成功', '协议更新成功', [
          {
            text: '确定',
            onPress: () => {
              setIsEditMode(false);
              setOriginalData(formData);
            },
          },
        ]);
      }
    } catch (error) {
      protocolDetailLogger.error('Failed to save protocol', error as Error);
      if (isAxiosError(error)) {
        Alert.alert(
          '保存失败',
          error.response?.data?.message || '保存协议时发生错误'
        );
      } else {
        Alert.alert('保存失败', '网络错误，请检查网络连接');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (hasChanges()) {
      Alert.alert('确认取消', '确定要取消吗？未保存的更改将丢失。', [
        { text: '继续编辑', style: 'cancel' },
        {
          text: '确认',
          onPress: () => {
            if (isNew) {
              navigation.goBack();
            } else {
              // Reset to original data
              if (originalData) {
                setFormData(originalData);
              }
              setIsEditMode(false);
              setErrors({});
            }
          },
        },
      ]);
    } else {
      if (isNew) {
        navigation.goBack();
      } else {
        setIsEditMode(false);
      }
    }
  };

  // Get label for dropdown
  const getConnectionTypeLabel = () => {
    const option = CONNECTION_TYPE_OPTIONS.find((o) => o.value === formData.connectionType);
    return option?.label || '请选择连接类型';
  };

  const getChecksumTypeLabel = () => {
    const option = CHECKSUM_TYPE_OPTIONS.find((o) => o.value === formData.checksumType);
    return option?.label || '请选择校验类型';
  };

  const getReadModeLabel = () => {
    const option = READ_MODE_OPTIONS.find((o) => o.value === formData.readMode);
    return option?.label || '请选择读取模式';
  };

  // Render loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME_COLOR} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render view mode (non-edit)
  const renderViewMode = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      {/* Header badges */}
      <View style={styles.headerBadges}>
        {isBuiltin && (
          <View style={[styles.badge, styles.badgeBuiltin]}>
            <Text style={styles.badgeText}>内置协议</Text>
          </View>
        )}
        {isVerified && (
          <View style={[styles.badge, styles.badgeVerified]}>
            <Text style={styles.badgeText}>已验证</Text>
          </View>
        )}
        <View style={[styles.badge, formData.isActive ? styles.badgeActive : styles.badgeInactive]}>
          <Text style={styles.badgeText}>{formData.isActive ? '已启用' : '已禁用'}</Text>
        </View>
      </View>

      {/* Basic Info */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>基本信息</Text>
      </View>
      <Card style={styles.sectionCard} mode="elevated">
        <Card.Content>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>协议编码</Text>
            <Text style={styles.infoValueMono}>{formData.protocolCode}</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>协议名称</Text>
            <Text style={styles.infoValue}>{formData.protocolName}</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>连接类型</Text>
            <Text style={styles.infoValue}>{getConnectionTypeLabel()}</Text>
          </View>
          {formData.description && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>描述</Text>
                <Text style={styles.infoValue}>{formData.description}</Text>
              </View>
            </>
          )}
        </Card.Content>
      </Card>

      {/* Protocol Settings */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>协议设置</Text>
      </View>
      <Card style={styles.sectionCard} mode="elevated">
        <Card.Content>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>帧格式</Text>
            <Text style={styles.infoValueMono}>{formData.frameFormat || '-'}</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>校验类型</Text>
            <Text style={styles.infoValue}>{getChecksumTypeLabel()}</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>读取模式</Text>
            <Text style={styles.infoValue}>{getReadModeLabel()}</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>稳定阈值</Text>
            <Text style={styles.infoValue}>{formData.stableThresholdMs} ms</Text>
          </View>
        </Card.Content>
      </Card>

      {/* Serial Config */}
      {formData.serialConfig && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>串口配置</Text>
          </View>
          <Card style={styles.sectionCard} mode="elevated">
            <Card.Content>
              <Text style={styles.codeBlock}>{formData.serialConfig}</Text>
            </Card.Content>
          </Card>
        </>
      )}

      {/* Edit Button */}
      {!isBuiltin && (
        <View style={styles.viewModeActions}>
          <Button
            mode="contained"
            onPress={() => setIsEditMode(true)}
            style={styles.editButton}
            labelStyle={styles.editButtonLabel}
            icon="pencil"
          >
            编辑协议
          </Button>
        </View>
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );

  // Render edit mode
  const renderEditMode = () => (
    <>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Basic Info Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>基本信息</Text>
        </View>

        <Card style={styles.sectionCard} mode="elevated">
          <Card.Content>
            {/* Protocol Code */}
            <View style={styles.formItem}>
              <Text style={styles.label}>
                协议编码
                <Text style={styles.required}> *</Text>
              </Text>
              <TextInput
                mode="outlined"
                value={formData.protocolCode}
                onChangeText={(text) => updateField('protocolCode', text.toUpperCase())}
                error={!!errors.protocolCode}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                placeholder="如: TOLEDO_STD"
                editable={isNew} // Only editable when creating
                disabled={!isNew}
              />
              {!isNew && (
                <Text style={styles.disabledHint}>协议编码创建后不可修改</Text>
              )}
              {errors.protocolCode && (
                <HelperText type="error" visible>
                  {errors.protocolCode}
                </HelperText>
              )}
            </View>

            {/* Protocol Name */}
            <View style={styles.formItem}>
              <Text style={styles.label}>
                协议名称
                <Text style={styles.required}> *</Text>
              </Text>
              <TextInput
                mode="outlined"
                value={formData.protocolName}
                onChangeText={(text) => updateField('protocolName', text)}
                error={!!errors.protocolName}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                placeholder="如: Toledo 标准协议"
              />
              {errors.protocolName && (
                <HelperText type="error" visible>
                  {errors.protocolName}
                </HelperText>
              )}
            </View>

            {/* Connection Type Dropdown */}
            <View style={styles.formItem}>
              <Text style={styles.label}>
                连接类型
                <Text style={styles.required}> *</Text>
              </Text>
              <Menu
                visible={connectionTypeMenuVisible}
                onDismiss={() => setConnectionTypeMenuVisible(false)}
                anchor={
                  <TouchableOpacity
                    style={[styles.dropdown, errors.connectionType && styles.dropdownError]}
                    onPress={() => setConnectionTypeMenuVisible(true)}
                  >
                    <Text style={styles.dropdownText}>{getConnectionTypeLabel()}</Text>
                    <IconButton icon="chevron-down" size={20} />
                  </TouchableOpacity>
                }
                contentStyle={styles.menuContent}
              >
                {CONNECTION_TYPE_OPTIONS.map((option) => (
                  <Menu.Item
                    key={option.value}
                    onPress={() => {
                      updateField('connectionType', option.value);
                      setConnectionTypeMenuVisible(false);
                    }}
                    title={option.label}
                  />
                ))}
              </Menu>
              {errors.connectionType && (
                <HelperText type="error" visible>
                  {errors.connectionType}
                </HelperText>
              )}
            </View>

            {/* Description */}
            <View style={styles.formItem}>
              <Text style={styles.label}>描述</Text>
              <TextInput
                mode="outlined"
                value={formData.description}
                onChangeText={(text) => updateField('description', text)}
                multiline
                numberOfLines={3}
                style={[styles.input, styles.textArea]}
                outlineStyle={styles.inputOutline}
                placeholder="协议的简要说明..."
              />
            </View>
          </Card.Content>
        </Card>

        {/* Protocol Settings Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>协议设置</Text>
        </View>

        <Card style={styles.sectionCard} mode="elevated">
          <Card.Content>
            {/* Frame Format */}
            <View style={styles.formItem}>
              <Text style={styles.label}>
                帧格式
                <Text style={styles.required}> *</Text>
              </Text>
              <TextInput
                mode="outlined"
                value={formData.frameFormat}
                onChangeText={(text) => updateField('frameFormat', text)}
                error={!!errors.frameFormat}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                placeholder="如: STX DATA ETX CHECKSUM"
              />
              {errors.frameFormat && (
                <HelperText type="error" visible>
                  {errors.frameFormat}
                </HelperText>
              )}
            </View>

            {/* Checksum Type Dropdown */}
            <View style={styles.formItem}>
              <Text style={styles.label}>校验类型</Text>
              <Menu
                visible={checksumTypeMenuVisible}
                onDismiss={() => setChecksumTypeMenuVisible(false)}
                anchor={
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() => setChecksumTypeMenuVisible(true)}
                  >
                    <Text style={styles.dropdownText}>{getChecksumTypeLabel()}</Text>
                    <IconButton icon="chevron-down" size={20} />
                  </TouchableOpacity>
                }
                contentStyle={styles.menuContent}
              >
                {CHECKSUM_TYPE_OPTIONS.map((option) => (
                  <Menu.Item
                    key={option.value}
                    onPress={() => {
                      updateField('checksumType', option.value);
                      setChecksumTypeMenuVisible(false);
                    }}
                    title={option.label}
                  />
                ))}
              </Menu>
            </View>

            {/* Read Mode Dropdown */}
            <View style={styles.formItem}>
              <Text style={styles.label}>读取模式</Text>
              <Menu
                visible={readModeMenuVisible}
                onDismiss={() => setReadModeMenuVisible(false)}
                anchor={
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() => setReadModeMenuVisible(true)}
                  >
                    <Text style={styles.dropdownText}>{getReadModeLabel()}</Text>
                    <IconButton icon="chevron-down" size={20} />
                  </TouchableOpacity>
                }
                contentStyle={styles.menuContent}
              >
                {READ_MODE_OPTIONS.map((option) => (
                  <Menu.Item
                    key={option.value}
                    onPress={() => {
                      updateField('readMode', option.value);
                      setReadModeMenuVisible(false);
                    }}
                    title={option.label}
                  />
                ))}
              </Menu>
            </View>

            {/* Stable Threshold */}
            <View style={styles.formItem}>
              <Text style={styles.label}>稳定阈值 (ms)</Text>
              <TextInput
                mode="outlined"
                value={formData.stableThresholdMs}
                onChangeText={(text) => updateField('stableThresholdMs', text.replace(/[^0-9]/g, ''))}
                error={!!errors.stableThresholdMs}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                keyboardType="numeric"
                placeholder="500"
              />
              <Text style={styles.helperHint}>
                重量稳定判断的时间阈值，单位毫秒 (0-10000)
              </Text>
              {errors.stableThresholdMs && (
                <HelperText type="error" visible>
                  {errors.stableThresholdMs}
                </HelperText>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Serial Config Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>串口配置</Text>
        </View>

        <Card style={styles.sectionCard} mode="elevated">
          <Card.Content>
            <View style={styles.formItem}>
              <Text style={styles.label}>串口配置 (JSON)</Text>
              <TextInput
                mode="outlined"
                value={formData.serialConfig}
                onChangeText={(text) => updateField('serialConfig', text)}
                error={!!errors.serialConfig}
                multiline
                numberOfLines={5}
                style={[styles.input, styles.textAreaCode]}
                outlineStyle={styles.inputOutline}
                placeholder={'{\n  "baudRate": 9600,\n  "dataBits": 8,\n  "stopBits": 1,\n  "parity": "NONE"\n}'}
              />
              {errors.serialConfig && (
                <HelperText type="error" visible>
                  {errors.serialConfig}
                </HelperText>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Status Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>状态设置</Text>
        </View>

        <Card style={styles.sectionCard} mode="elevated">
          <Card.Content>
            <View style={styles.statusRow}>
              <View style={styles.statusInfo}>
                <Text style={styles.statusLabel}>启用状态</Text>
                <Text style={styles.statusHint}>禁用后该协议将无法被选择使用</Text>
              </View>
              <Switch
                value={formData.isActive}
                onValueChange={(value) => updateField('isActive', value)}
                color={THEME_COLOR}
              />
            </View>
          </Card.Content>
        </Card>

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
          取消
        </Button>
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.submitButton}
          labelStyle={styles.submitButtonLabel}
          loading={submitting}
          disabled={submitting}
        >
          {isNew ? '创建协议' : '保存更改'}
        </Button>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {isEditMode || isNew ? renderEditMode() : renderViewMode()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
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
    color: '#718096',
  },
  // Header badges
  headerBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeBuiltin: {
    backgroundColor: '#805ad5',
  },
  badgeVerified: {
    backgroundColor: '#48bb78',
  },
  badgeActive: {
    backgroundColor: THEME_COLOR,
  },
  badgeInactive: {
    backgroundColor: '#a0aec0',
  },
  badgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  // Sections
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  sectionCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  // View mode info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#718096',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#2d3748',
    flex: 2,
    textAlign: 'right',
  },
  infoValueMono: {
    fontSize: 14,
    color: '#2d3748',
    flex: 2,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  divider: {
    backgroundColor: '#edf2f7',
  },
  codeBlock: {
    fontSize: 13,
    color: '#2d3748',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#f7fafc',
    padding: 12,
    borderRadius: 8,
    lineHeight: 20,
  },
  // Form Items
  formItem: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#2d3748',
    marginBottom: 8,
    fontWeight: '500',
  },
  required: {
    color: '#e53e3e',
  },
  input: {
    backgroundColor: '#fff',
  },
  inputOutline: {
    borderRadius: 8,
  },
  disabledHint: {
    fontSize: 12,
    color: '#a0aec0',
    marginTop: 4,
    fontStyle: 'italic',
  },
  helperHint: {
    fontSize: 12,
    color: '#718096',
    marginTop: 4,
  },
  textArea: {
    minHeight: 80,
  },
  textAreaCode: {
    minHeight: 120,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    borderColor: '#cbd5e0',
    borderRadius: 8,
    backgroundColor: '#fff',
    minHeight: 56,
  },
  dropdownError: {
    borderColor: '#e53e3e',
  },
  dropdownText: {
    fontSize: 14,
    color: '#2d3748',
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
    color: '#2d3748',
    marginBottom: 4,
  },
  statusHint: {
    fontSize: 12,
    color: '#718096',
  },
  // View mode actions
  viewModeActions: {
    marginTop: 8,
    marginBottom: 16,
  },
  editButton: {
    backgroundColor: THEME_COLOR,
    borderRadius: 8,
  },
  editButtonLabel: {
    color: '#fff',
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
    borderTopColor: '#edf2f7',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderColor: '#cbd5e0',
    borderRadius: 8,
  },
  cancelButtonLabel: {
    color: '#718096',
  },
  submitButton: {
    flex: 1,
    backgroundColor: THEME_COLOR,
    borderRadius: 8,
  },
  submitButtonLabel: {
    color: '#fff',
  },
});
