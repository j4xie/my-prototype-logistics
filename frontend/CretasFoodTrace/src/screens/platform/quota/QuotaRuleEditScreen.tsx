import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Card,
  Switch,
  TextInput,
  Menu,
  Button,
  Chip,
  Portal,
  Dialog,
  IconButton,
  Avatar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Slider from '@react-native-community/slider';

// Define local navigation type for quota screens
type QuotaStackParamList = {
  QuotaOverview: undefined;
  QuotaRules: undefined;
  QuotaRuleEdit: { ruleId?: string };
  QuotaUsageStats: undefined;
};

type Props = NativeStackScreenProps<QuotaStackParamList, 'QuotaRuleEdit'>;

interface NotificationRecipient {
  id: string;
  name: string;
}

/**
 * QuotaRuleEditScreen - Rule Editor for Platform Admin
 * Allows editing quota rules with condition builder and action configuration
 */
export default function QuotaRuleEditScreen({ navigation, route }: Props) {
  const { t } = useTranslation('platform');
  const { ruleId } = route.params || {};
  const isEditing = !!ruleId;

  // Form state
  const [ruleName, setRuleName] = useState(
    isEditing ? t('quotaRules.rules.warningRule.name', { defaultValue: '配额预警规则' }) : ''
  );
  const [ruleType, setRuleType] = useState<string>('warning');
  const [ruleDescription, setRuleDescription] = useState(
    isEditing
      ? t('quotaRules.rules.warningRule.description', {
          defaultValue: '当工厂配额使用率达到阈值时触发预警通知',
        })
      : ''
  );

  // Trigger conditions
  const [thresholdType, setThresholdType] = useState('percentage');
  const [thresholdValue, setThresholdValue] = useState(80);
  const [checkFrequency, setCheckFrequency] = useState('5min');

  // Notification settings
  const [emailNotification, setEmailNotification] = useState(true);
  const [smsNotification, setSmsNotification] = useState(true);
  const [inAppNotification, setInAppNotification] = useState(false);
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([
    { id: '1', name: t('quotaRuleEdit.recipients.platformAdmin', { defaultValue: '平台管理员' }) },
    { id: '2', name: t('quotaRuleEdit.recipients.factoryAdmin', { defaultValue: '工厂管理员' }) },
  ]);

  // Advanced settings
  const [ruleEnabled, setRuleEnabled] = useState(true);
  const [silentPeriod, setSilentPeriod] = useState('1hour');
  const [applyScope, setApplyScope] = useState('all');

  // Menu states
  const [ruleTypeMenuVisible, setRuleTypeMenuVisible] = useState(false);
  const [thresholdTypeMenuVisible, setThresholdTypeMenuVisible] = useState(false);
  const [frequencyMenuVisible, setFrequencyMenuVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const ruleTypes = [
    { value: 'warning', label: t('quotaRuleEdit.ruleTypes.warning', { defaultValue: '预警规则' }) },
    { value: 'limit', label: t('quotaRuleEdit.ruleTypes.limit', { defaultValue: '限流规则' }) },
    { value: 'auto_scale', label: t('quotaRuleEdit.ruleTypes.autoScale', { defaultValue: '自动扩容' }) },
    { value: 'daily_limit', label: t('quotaRuleEdit.ruleTypes.dailyLimit', { defaultValue: '日限制' }) },
    { value: 'concurrent', label: t('quotaRuleEdit.ruleTypes.concurrent', { defaultValue: '并发限制' }) },
  ];

  const thresholdTypes = [
    { value: 'percentage', label: t('quotaRuleEdit.thresholdTypes.percentage', { defaultValue: '百分比' }) },
    { value: 'absolute', label: t('quotaRuleEdit.thresholdTypes.absolute', { defaultValue: '绝对值' }) },
    { value: 'daily', label: t('quotaRuleEdit.thresholdTypes.daily', { defaultValue: '日用量' }) },
  ];

  const checkFrequencies = [
    { value: 'realtime', label: t('quotaRuleEdit.frequencies.realtime', { defaultValue: '实时检查' }) },
    { value: '5min', label: t('quotaRuleEdit.frequencies.5min', { defaultValue: '每5分钟' }) },
    { value: '15min', label: t('quotaRuleEdit.frequencies.15min', { defaultValue: '每15分钟' }) },
    { value: 'hourly', label: t('quotaRuleEdit.frequencies.hourly', { defaultValue: '每小时' }) },
  ];

  const getSelectedLabel = (items: { value: string; label: string }[], value: string) => {
    return items.find((item) => item.value === value)?.label || '';
  };

  const getRulePreview = useMemo(() => {
    const threshold = thresholdType === 'percentage' ? `0.${thresholdValue.toString().padStart(2, '0')}` : thresholdValue;
    const notifications: string[] = [];
    if (emailNotification) notifications.push('sendEmail(recipients)');
    if (smsNotification) notifications.push('sendSMS(recipients)');
    if (inAppNotification) notifications.push('sendPush(recipients)');

    return `IF quota.usageRate >= ${threshold}
AND lastNotify > 1 hour
THEN
  ${notifications.join('\n  ')}
  updateLastNotify()`;
  }, [thresholdType, thresholdValue, emailNotification, smsNotification, inAppNotification]);

  const removeRecipient = (id: string) => {
    setRecipients(recipients.filter((r) => r.id !== id));
  };

  const handleSave = () => {
    // In production, this would call an API
    navigation.goBack();
  };

  const handleDelete = () => {
    setDeleteDialogVisible(false);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerContent}>
          <IconButton
            icon="arrow-left"
            iconColor="#fff"
            size={24}
            onPress={() => navigation.goBack()}
          />
          <Text style={styles.headerTitle}>
            {isEditing
              ? t('quotaRuleEdit.editTitle', { defaultValue: '编辑规则' })
              : t('quotaRuleEdit.createTitle', { defaultValue: '新建规则' })}
          </Text>
          <Pressable onPress={handleSave}>
            <Text style={styles.headerAction}>
              {t('quotaRuleEdit.save', { defaultValue: '保存' })}
            </Text>
          </Pressable>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Rule Info Header (if editing) */}
          {isEditing && (
            <LinearGradient
              colors={['#faad14', '#d48806']}
              style={styles.ruleInfoBanner}
            >
              <Text style={styles.ruleInfoLabel}>
                {t('quotaRuleEdit.ruleCode', { defaultValue: '规则编号' })}
              </Text>
              <Text style={styles.ruleInfoCode}>{ruleId}</Text>
              <Text style={styles.ruleInfoName}>{ruleName}</Text>
            </LinearGradient>
          )}

          {/* Basic Info Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('quotaRuleEdit.basicInfo', { defaultValue: '基本信息' })}
            </Text>
          </View>

          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>
                  {t('quotaRuleEdit.ruleName', { defaultValue: '规则名称' })}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  mode="outlined"
                  value={ruleName}
                  onChangeText={setRuleName}
                  style={styles.textInput}
                  outlineStyle={styles.textInputOutline}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>
                  {t('quotaRuleEdit.ruleType', { defaultValue: '规则类型' })}
                </Text>
                <Menu
                  visible={ruleTypeMenuVisible}
                  onDismiss={() => setRuleTypeMenuVisible(false)}
                  anchor={
                    <Pressable
                      style={styles.selectButton}
                      onPress={() => setRuleTypeMenuVisible(true)}
                    >
                      <Text style={styles.selectButtonText}>
                        {getSelectedLabel(ruleTypes, ruleType)}
                      </Text>
                      <Avatar.Icon
                        icon="chevron-down"
                        size={24}
                        color="#8c8c8c"
                        style={{ backgroundColor: 'transparent' }}
                      />
                    </Pressable>
                  }
                >
                  {ruleTypes.map((item) => (
                    <Menu.Item
                      key={item.value}
                      onPress={() => {
                        setRuleType(item.value);
                        setRuleTypeMenuVisible(false);
                      }}
                      title={item.label}
                    />
                  ))}
                </Menu>
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>
                  {t('quotaRuleEdit.ruleDescription', { defaultValue: '规则描述' })}
                </Text>
                <TextInput
                  mode="outlined"
                  value={ruleDescription}
                  onChangeText={setRuleDescription}
                  multiline
                  numberOfLines={3}
                  style={[styles.textInput, styles.textArea]}
                  outlineStyle={styles.textInputOutline}
                />
              </View>
            </Card.Content>
          </Card>

          {/* Trigger Conditions Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('quotaRuleEdit.triggerConditions', { defaultValue: '触发条件' })}
            </Text>
          </View>

          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>
                  {t('quotaRuleEdit.thresholdType', { defaultValue: '阈值类型' })}
                </Text>
                <Menu
                  visible={thresholdTypeMenuVisible}
                  onDismiss={() => setThresholdTypeMenuVisible(false)}
                  anchor={
                    <Pressable
                      style={styles.selectButton}
                      onPress={() => setThresholdTypeMenuVisible(true)}
                    >
                      <Text style={styles.selectButtonText}>
                        {getSelectedLabel(thresholdTypes, thresholdType)}
                      </Text>
                      <Avatar.Icon
                        icon="chevron-down"
                        size={24}
                        color="#8c8c8c"
                        style={{ backgroundColor: 'transparent' }}
                      />
                    </Pressable>
                  }
                >
                  {thresholdTypes.map((item) => (
                    <Menu.Item
                      key={item.value}
                      onPress={() => {
                        setThresholdType(item.value);
                        setThresholdTypeMenuVisible(false);
                      }}
                      title={item.label}
                    />
                  ))}
                </Menu>
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>
                  {t('quotaRuleEdit.triggerThreshold', { defaultValue: '触发阈值' })}
                </Text>
                <View style={styles.sliderContainer}>
                  <Slider
                    style={styles.slider}
                    minimumValue={50}
                    maximumValue={100}
                    step={1}
                    value={thresholdValue}
                    onValueChange={setThresholdValue}
                    minimumTrackTintColor="#667eea"
                    maximumTrackTintColor="#d9d9d9"
                    thumbTintColor="#667eea"
                  />
                  <View style={styles.thresholdValueBox}>
                    <Text style={styles.thresholdValueText}>{thresholdValue}%</Text>
                  </View>
                </View>
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>50%</Text>
                  <Text style={styles.sliderLabel}>100%</Text>
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>
                  {t('quotaRuleEdit.checkFrequency', { defaultValue: '检查频率' })}
                </Text>
                <Menu
                  visible={frequencyMenuVisible}
                  onDismiss={() => setFrequencyMenuVisible(false)}
                  anchor={
                    <Pressable
                      style={styles.selectButton}
                      onPress={() => setFrequencyMenuVisible(true)}
                    >
                      <Text style={styles.selectButtonText}>
                        {getSelectedLabel(checkFrequencies, checkFrequency)}
                      </Text>
                      <Avatar.Icon
                        icon="chevron-down"
                        size={24}
                        color="#8c8c8c"
                        style={{ backgroundColor: 'transparent' }}
                      />
                    </Pressable>
                  }
                >
                  {checkFrequencies.map((item) => (
                    <Menu.Item
                      key={item.value}
                      onPress={() => {
                        setCheckFrequency(item.value);
                        setFrequencyMenuVisible(false);
                      }}
                      title={item.label}
                    />
                  ))}
                </Menu>
              </View>
            </Card.Content>
          </Card>

          {/* Notification Settings Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('quotaRuleEdit.notificationSettings', { defaultValue: '通知设置' })}
            </Text>
          </View>

          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>
                  {t('quotaRuleEdit.notificationMethods', { defaultValue: '通知方式' })}
                </Text>

                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <Avatar.Icon
                      icon="email"
                      size={28}
                      color="#1890ff"
                      style={{ backgroundColor: 'transparent' }}
                    />
                    <Text style={styles.switchLabel}>
                      {t('quotaRuleEdit.emailNotification', { defaultValue: '邮件通知' })}
                    </Text>
                  </View>
                  <Switch
                    value={emailNotification}
                    onValueChange={setEmailNotification}
                    color="#1890ff"
                  />
                </View>

                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <Avatar.Icon
                      icon="phone"
                      size={28}
                      color="#52c41a"
                      style={{ backgroundColor: 'transparent' }}
                    />
                    <Text style={styles.switchLabel}>
                      {t('quotaRuleEdit.smsNotification', { defaultValue: '短信通知' })}
                    </Text>
                  </View>
                  <Switch
                    value={smsNotification}
                    onValueChange={setSmsNotification}
                    color="#1890ff"
                  />
                </View>

                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <Avatar.Icon
                      icon="bell"
                      size={28}
                      color="#722ed1"
                      style={{ backgroundColor: 'transparent' }}
                    />
                    <Text style={styles.switchLabel}>
                      {t('quotaRuleEdit.inAppNotification', { defaultValue: '站内通知' })}
                    </Text>
                  </View>
                  <Switch
                    value={inAppNotification}
                    onValueChange={setInAppNotification}
                    color="#1890ff"
                  />
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>
                  {t('quotaRuleEdit.notificationRecipients', { defaultValue: '通知接收人' })}
                </Text>
                <View style={styles.recipientsContainer}>
                  {recipients.map((recipient) => (
                    <Chip
                      key={recipient.id}
                      mode="flat"
                      onClose={() => removeRecipient(recipient.id)}
                      style={styles.recipientChip}
                      textStyle={styles.recipientChipText}
                    >
                      {recipient.name}
                    </Chip>
                  ))}
                  <Pressable onPress={() => {}}>
                    <Text style={styles.addRecipientText}>
                      + {t('quotaRuleEdit.add', { defaultValue: '添加' })}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Advanced Settings Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('quotaRuleEdit.advancedSettings', { defaultValue: '高级设置' })}
            </Text>
          </View>

          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.advancedRow}>
                <View>
                  <Text style={styles.advancedLabel}>
                    {t('quotaRuleEdit.enableRule', { defaultValue: '启用规则' })}
                  </Text>
                  <Text style={styles.advancedHint}>
                    {t('quotaRuleEdit.enableRuleHint', { defaultValue: '关闭后规则将不再生效' })}
                  </Text>
                </View>
                <Switch
                  value={ruleEnabled}
                  onValueChange={setRuleEnabled}
                  color="#1890ff"
                />
              </View>

              <View style={styles.advancedDivider} />

              <Pressable style={styles.advancedRow} onPress={() => {}}>
                <View>
                  <Text style={styles.advancedLabel}>
                    {t('quotaRuleEdit.silentPeriod', { defaultValue: '静默期' })}
                  </Text>
                  <Text style={styles.advancedHint}>
                    {t('quotaRuleEdit.silentPeriodHint', {
                      defaultValue: '同一规则多久内不重复触发',
                    })}
                  </Text>
                </View>
                <View style={styles.advancedValue}>
                  <Text style={styles.advancedValueText}>
                    1 {t('quotaRuleEdit.hour', { defaultValue: '小时' })}
                  </Text>
                  <Avatar.Icon
                    icon="chevron-right"
                    size={20}
                    color="#8c8c8c"
                    style={{ backgroundColor: 'transparent' }}
                  />
                </View>
              </Pressable>

              <View style={styles.advancedDivider} />

              <Pressable style={styles.advancedRow} onPress={() => {}}>
                <View>
                  <Text style={styles.advancedLabel}>
                    {t('quotaRuleEdit.applyScope', { defaultValue: '应用范围' })}
                  </Text>
                  <Text style={styles.advancedHint}>
                    {t('quotaRuleEdit.applyScopeHint', {
                      defaultValue: '规则适用于哪些工厂',
                    })}
                  </Text>
                </View>
                <View style={styles.advancedValue}>
                  <Text style={styles.advancedValueText}>
                    {t('quotaRuleEdit.allFactories', { defaultValue: '全部工厂' })}
                  </Text>
                  <Avatar.Icon
                    icon="chevron-right"
                    size={20}
                    color="#8c8c8c"
                    style={{ backgroundColor: 'transparent' }}
                  />
                </View>
              </Pressable>
            </Card.Content>
          </Card>

          {/* Rule Preview Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('quotaRuleEdit.rulePreview', { defaultValue: '规则预览' })}
            </Text>
          </View>

          <View style={styles.codePreview}>
            <Text style={styles.codeText}>{getRulePreview}</Text>
          </View>

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            {isEditing && (
              <Button
                mode="outlined"
                onPress={() => setDeleteDialogVisible(true)}
                style={styles.deleteButton}
                textColor="#f5222d"
              >
                {t('quotaRuleEdit.deleteRule', { defaultValue: '删除规则' })}
              </Button>
            )}
            <Button
              mode="contained"
              onPress={handleSave}
              style={[styles.saveButton, !isEditing && { flex: 1 }]}
              buttonColor="#667eea"
            >
              {t('quotaRuleEdit.saveRule', { defaultValue: '保存规则' })}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}
        >
          <Dialog.Title>
            {t('quotaRuleEdit.confirmDelete', { defaultValue: '确认删除' })}
          </Dialog.Title>
          <Dialog.Content>
            <Text>
              {t('quotaRuleEdit.confirmDeleteMessage', {
                defaultValue: '确定要删除此规则吗？此操作无法撤销。',
              })}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>
              {t('quotaRuleEdit.cancel', { defaultValue: '取消' })}
            </Button>
            <Button onPress={handleDelete} textColor="#f5222d">
              {t('quotaRuleEdit.delete', { defaultValue: '删除' })}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerAction: {
    fontSize: 14,
    color: '#fff',
    marginRight: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  ruleInfoBanner: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  ruleInfoLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  ruleInfoCode: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  ruleInfoName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  card: {
    marginBottom: 20,
    borderRadius: 12,
  },
  formField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#262626',
    marginBottom: 8,
  },
  required: {
    color: '#f5222d',
  },
  textInput: {
    backgroundColor: '#fff',
  },
  textInputOutline: {
    borderRadius: 8,
    borderColor: '#d9d9d9',
  },
  textArea: {
    minHeight: 80,
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
  },
  selectButtonText: {
    fontSize: 14,
    color: '#262626',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  thresholdValueBox: {
    width: 60,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fafafa',
    borderRadius: 6,
    alignItems: 'center',
  },
  thresholdValueText: {
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
    fontSize: 11,
    color: '#8c8c8c',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    marginBottom: 8,
  },
  switchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchLabel: {
    fontSize: 14,
    color: '#262626',
  },
  recipientsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 8,
  },
  recipientChip: {
    backgroundColor: '#e6f7ff',
  },
  recipientChipText: {
    color: '#1890ff',
    fontSize: 12,
  },
  addRecipientText: {
    fontSize: 12,
    color: '#1890ff',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  advancedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  advancedLabel: {
    fontSize: 14,
    color: '#262626',
  },
  advancedHint: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  advancedValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  advancedValueText: {
    fontSize: 14,
    color: '#262626',
  },
  advancedDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 16,
  },
  codePreview: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 18,
    color: '#d4d4d4',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  deleteButton: {
    flex: 1,
    borderColor: '#f5222d',
  },
  saveButton: {
    flex: 1,
  },
});
