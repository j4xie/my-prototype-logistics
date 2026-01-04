/**
 * 排产设置页面
 *
 * 功能:
 * - 三种自动化模式选择（全自动、人工确认、禁用）
 * - 风险阈值滑块调节（低风险阈值、中风险阈值）
 * - 通知开关
 * - 保存设置
 *
 * @version 1.0.0
 * @since 2026-01-03
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Text,
  Appbar,
  Card,
  RadioButton,
  Switch,
  Button,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { schedulingApiClient } from '../../services/api/schedulingApiClient';
import { useAuthStore } from '../../store/authStore';
import { isAxiosError } from 'axios';
import { logger } from '../../utils/logger';

// 创建专用logger
const settingsLogger = logger.createContextLogger('SchedulingSettings');

// 自动化模式类型
type AutomationMode = 'full_auto' | 'human_confirm' | 'disabled';

// 排产设置接口
export interface SchedulingSettings {
  automationMode: AutomationMode;
  lowRiskThreshold: number;
  mediumRiskThreshold: number;
  notificationsEnabled: boolean;
}

// 默认设置
const DEFAULT_SETTINGS: SchedulingSettings = {
  automationMode: 'human_confirm',
  lowRiskThreshold: 0.3,
  mediumRiskThreshold: 0.6,
  notificationsEnabled: true,
};

// 主题颜色
const THEME = {
  primary: '#722ed1',
  secondary: '#a18cd1',
  success: '#52c41a',
  warning: '#fa8c16',
  danger: '#ff4d4f',
  background: '#f5f5f5',
  cardBackground: '#ffffff',
  textPrimary: '#333333',
  textSecondary: '#666666',
  textMuted: '#999999',
};

export default function SchedulingSettingsScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('dispatcher');
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;

  // 状态
  const [settings, setSettings] = useState<SchedulingSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 加载设置
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await schedulingApiClient.getSchedulingSettings(factoryId);

      if (response.success && response.data) {
        setSettings({
          automationMode: response.data.automationMode || DEFAULT_SETTINGS.automationMode,
          lowRiskThreshold: response.data.lowRiskThreshold ?? DEFAULT_SETTINGS.lowRiskThreshold,
          mediumRiskThreshold: response.data.mediumRiskThreshold ?? DEFAULT_SETTINGS.mediumRiskThreshold,
          notificationsEnabled: response.data.notificationsEnabled ?? DEFAULT_SETTINGS.notificationsEnabled,
        });
        settingsLogger.info('Settings loaded successfully', { factoryId });
      }
    } catch (error) {
      settingsLogger.error('Failed to load settings', error as Error, { factoryId });

      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404) {
          // 如果设置不存在，使用默认值
          settingsLogger.info('Settings not found, using defaults', { factoryId });
        } else {
          Alert.alert(
            t('common.error'),
            t('schedulingSettings.messages.loadFailed', { fallbackValue: '加载设置失败' })
          );
        }
      }
    } finally {
      setLoading(false);
    }
  }, [factoryId, t]);

  // 保存设置
  const saveSettings = async () => {
    try {
      setSaving(true);
      const response = await schedulingApiClient.updateSchedulingSettings(settings, factoryId);

      if (response.success) {
        setHasChanges(false);
        settingsLogger.info('Settings saved successfully', { factoryId, settings });
        Alert.alert(
          t('common.success'),
          t('schedulingSettings.messages.saveSuccess', { fallbackValue: '保存成功' })
        );
      }
    } catch (error) {
      settingsLogger.error('Failed to save settings', error as Error, { factoryId });

      if (isAxiosError(error)) {
        Alert.alert(
          t('common.error'),
          error.response?.data?.message || t('schedulingSettings.messages.saveFailed', { fallbackValue: '保存失败' })
        );
      }
    } finally {
      setSaving(false);
    }
  };

  // 更新设置
  const updateSettings = <K extends keyof SchedulingSettings>(
    key: K,
    value: SchedulingSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // 初始加载
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 渲染加载状态
  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated style={styles.appBar}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={t('schedulingSettings.title', { fallbackValue: '排产设置' })} />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.primary} />
          <Text style={styles.loadingText}>
            {t('schedulingSettings.loading', { fallbackValue: '加载中...' })}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 顶部导航栏 */}
      <Appbar.Header elevated style={styles.appBar}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('schedulingSettings.title', { fallbackValue: '排产设置' })} />
        <Appbar.Action
          icon="content-save"
          onPress={saveSettings}
          disabled={saving || !hasChanges}
        />
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 自动化模式选择 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title
            title={t('schedulingSettings.automationMode.title', { fallbackValue: '自动化模式' })}
            titleVariant="titleMedium"
          />
          <Card.Content>
            <Text style={styles.description}>
              {t('schedulingSettings.automationMode.description', {
                fallbackValue: '选择AI排产的自动化程度',
              })}
            </Text>

            <RadioButton.Group
              onValueChange={value => updateSettings('automationMode', value as AutomationMode)}
              value={settings.automationMode}
            >
              {/* 全自动模式 */}
              <View style={styles.radioOption}>
                <RadioButton.Item
                  label={t('schedulingSettings.automationMode.fullAuto', { fallbackValue: '全自动' })}
                  value="full_auto"
                  style={styles.radioItem}
                  labelStyle={styles.radioLabel}
                />
                <Text style={styles.optionDescription}>
                  {t('schedulingSettings.automationMode.fullAutoDesc', {
                    fallbackValue: 'AI自动生成并执行排产计划，无需人工干预',
                  })}
                </Text>
              </View>

              <Divider style={styles.optionDivider} />

              {/* 人工确认模式（推荐） */}
              <View style={styles.radioOption}>
                <View style={styles.radioWithBadge}>
                  <RadioButton.Item
                    label={t('schedulingSettings.automationMode.humanConfirm', {
                      fallbackValue: '人工确认',
                    })}
                    value="human_confirm"
                    style={styles.radioItem}
                    labelStyle={styles.radioLabel}
                  />
                  <View style={styles.recommendBadge}>
                    <Text style={styles.recommendText}>
                      {t('schedulingSettings.automationMode.recommended', { fallbackValue: '推荐' })}
                    </Text>
                  </View>
                </View>
                <Text style={styles.optionDescription}>
                  {t('schedulingSettings.automationMode.humanConfirmDesc', {
                    fallbackValue: 'AI生成排产建议，需人工审核确认后执行',
                  })}
                </Text>
              </View>

              <Divider style={styles.optionDivider} />

              {/* 禁用模式 */}
              <View style={styles.radioOption}>
                <RadioButton.Item
                  label={t('schedulingSettings.automationMode.disabled', { fallbackValue: '禁用' })}
                  value="disabled"
                  style={styles.radioItem}
                  labelStyle={styles.radioLabel}
                />
                <Text style={styles.optionDescription}>
                  {t('schedulingSettings.automationMode.disabledDesc', {
                    fallbackValue: '完全手动排产，不使用AI辅助',
                  })}
                </Text>
              </View>
            </RadioButton.Group>
          </Card.Content>
        </Card>

        {/* 风险阈值设置 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title
            title={t('schedulingSettings.riskThreshold.title', { fallbackValue: '风险阈值设置' })}
            titleVariant="titleMedium"
          />
          <Card.Content>
            <Text style={styles.description}>
              {t('schedulingSettings.riskThreshold.description', {
                fallbackValue: '设置完成概率的风险等级划分阈值',
              })}
            </Text>

            {/* 低风险阈值 */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>
                  {t('schedulingSettings.riskThreshold.lowRisk', { fallbackValue: '低风险阈值' })}
                </Text>
                <View style={styles.thresholdValueContainer}>
                  <Text style={[styles.thresholdValue, { color: THEME.success }]}>
                    {Math.round(settings.lowRiskThreshold * 100)}%
                  </Text>
                </View>
              </View>
              <Text style={styles.sliderHint}>
                {t('schedulingSettings.riskThreshold.lowRiskHint', {
                  fallbackValue: '完成概率高于此值视为低风险',
                })}
              </Text>
              <View style={styles.sliderWrapper}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={1}
                  step={0.05}
                  value={settings.lowRiskThreshold}
                  onValueChange={value => updateSettings('lowRiskThreshold', value)}
                  minimumTrackTintColor={THEME.success}
                  maximumTrackTintColor="#e0e0e0"
                  thumbTintColor={THEME.success}
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderMinMax}>0%</Text>
                  <Text style={styles.sliderMinMax}>100%</Text>
                </View>
              </View>
            </View>

            <Divider style={styles.sliderDivider} />

            {/* 中风险阈值 */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>
                  {t('schedulingSettings.riskThreshold.mediumRisk', { fallbackValue: '中风险阈值' })}
                </Text>
                <View style={styles.thresholdValueContainer}>
                  <Text style={[styles.thresholdValue, { color: THEME.warning }]}>
                    {Math.round(settings.mediumRiskThreshold * 100)}%
                  </Text>
                </View>
              </View>
              <Text style={styles.sliderHint}>
                {t('schedulingSettings.riskThreshold.mediumRiskHint', {
                  fallbackValue: '完成概率高于此值视为中风险，低于视为高风险',
                })}
              </Text>
              <View style={styles.sliderWrapper}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={1}
                  step={0.05}
                  value={settings.mediumRiskThreshold}
                  onValueChange={value => updateSettings('mediumRiskThreshold', value)}
                  minimumTrackTintColor={THEME.warning}
                  maximumTrackTintColor="#e0e0e0"
                  thumbTintColor={THEME.warning}
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderMinMax}>0%</Text>
                  <Text style={styles.sliderMinMax}>100%</Text>
                </View>
              </View>
            </View>

            {/* 风险等级说明 */}
            <View style={styles.riskLegend}>
              <View style={styles.riskItem}>
                <View style={[styles.riskDot, { backgroundColor: THEME.success }]} />
                <Text style={styles.riskText}>
                  {t('schedulingSettings.riskThreshold.lowRiskLabel', {
                    fallbackValue: '低风险: >{lowRisk}%',
                    lowRisk: Math.round(settings.lowRiskThreshold * 100),
                  })}
                </Text>
              </View>
              <View style={styles.riskItem}>
                <View style={[styles.riskDot, { backgroundColor: THEME.warning }]} />
                <Text style={styles.riskText}>
                  {t('schedulingSettings.riskThreshold.mediumRiskLabel', {
                    fallbackValue: '中风险: {mediumRisk}%-{lowRisk}%',
                    mediumRisk: Math.round(settings.mediumRiskThreshold * 100),
                    lowRisk: Math.round(settings.lowRiskThreshold * 100),
                  })}
                </Text>
              </View>
              <View style={styles.riskItem}>
                <View style={[styles.riskDot, { backgroundColor: THEME.danger }]} />
                <Text style={styles.riskText}>
                  {t('schedulingSettings.riskThreshold.highRiskLabel', {
                    fallbackValue: '高风险: <{mediumRisk}%',
                    mediumRisk: Math.round(settings.mediumRiskThreshold * 100),
                  })}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 通知设置 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title
            title={t('schedulingSettings.notifications.title', { fallbackValue: '通知设置' })}
            titleVariant="titleMedium"
          />
          <Card.Content>
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchLabel}>
                  {t('schedulingSettings.notifications.enable', { fallbackValue: '启用通知' })}
                </Text>
                <Text style={styles.switchDescription}>
                  {t('schedulingSettings.notifications.enableDesc', {
                    fallbackValue: '接收排产相关的推送通知和预警提醒',
                  })}
                </Text>
              </View>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={value => updateSettings('notificationsEnabled', value)}
                color={THEME.primary}
              />
            </View>
          </Card.Content>
        </Card>

        {/* 保存按钮 */}
        <Button
          mode="contained"
          icon="content-save"
          onPress={saveSettings}
          loading={saving}
          disabled={!hasChanges}
          style={styles.saveButton}
          contentStyle={styles.saveButtonContent}
          buttonColor={THEME.primary}
        >
          {t('schedulingSettings.save', { fallbackValue: '保存设置' })}
        </Button>

        {/* 底部填充 */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  appBar: {
    backgroundColor: THEME.primary,
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
    marginTop: 12,
    fontSize: 14,
    color: THEME.textSecondary,
  },
  card: {
    marginBottom: 16,
    backgroundColor: THEME.cardBackground,
  },
  description: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  radioOption: {
    marginBottom: 8,
  },
  radioWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioItem: {
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  radioLabel: {
    fontSize: 15,
    color: THEME.textPrimary,
  },
  recommendBadge: {
    backgroundColor: THEME.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: -8,
  },
  recommendText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 12,
    color: THEME.textMuted,
    marginLeft: 52,
    marginTop: -4,
    lineHeight: 18,
  },
  optionDivider: {
    marginVertical: 8,
    marginHorizontal: 16,
  },
  sliderContainer: {
    marginBottom: 8,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sliderLabel: {
    fontSize: 14,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  thresholdValueContainer: {
    minWidth: 50,
    alignItems: 'flex-end',
  },
  thresholdValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  sliderHint: {
    fontSize: 12,
    color: THEME.textMuted,
    marginBottom: 8,
  },
  sliderWrapper: {
    marginHorizontal: -8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: -8,
  },
  sliderMinMax: {
    fontSize: 11,
    color: THEME.textMuted,
  },
  sliderDivider: {
    marginVertical: 16,
  },
  riskLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    gap: 12,
  },
  riskItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riskDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  riskText: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchInfo: {
    flex: 1,
    paddingRight: 16,
  },
  switchLabel: {
    fontSize: 15,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  switchDescription: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 12,
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
  bottomPadding: {
    height: 40,
  },
});
