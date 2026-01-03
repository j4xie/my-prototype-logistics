import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Switch,
  RadioButton,
  TextInput,
  Button,
  Divider,
  ActivityIndicator,
  List,
  ProgressBar,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { factorySettingsApiClient } from '../../services/api/factorySettingsApiClient';
import { useAuthStore } from '../../store/authStore';
import type { AISettings, AISettingsResponse, AIUsageStats } from '../../types/processing';
import { AI_TONE_OPTIONS, AI_GOAL_OPTIONS, AI_DETAIL_OPTIONS } from '../../types/processing';
import { handleError, getErrorMsg } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建AISettings专用logger
const aiSettingsLogger = logger.createContextLogger('AISettings');

/**
 * AI分析设置界面
 * 仅工厂超级管理员可访问
 */
export default function AISettingsScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('management');
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;

  // 设置状态
  const [settings, setSettings] = useState<AISettings>({
    enabled: true,
    tone: 'professional',
    goal: 'cost_optimization',
    detailLevel: 'standard',
    industryStandards: {
      laborCostPercentage: 30,
      equipmentUtilization: 80,
      profitMargin: 20,
    },
    customPrompt: '',
  });

  const [weeklyQuota, setWeeklyQuota] = useState<number>(20);
  const [usageStats, setUsageStats] = useState<AIUsageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    loadUsageStats();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      if (!factorySettingsApiClient || !factorySettingsApiClient.getAISettings) {
        aiSettingsLogger.error('factorySettingsApiClient未正确初始化', new Error('API client not initialized'), {
          factoryId,
        });
        return;
      }
      const response: any = await factorySettingsApiClient.getAISettings(factoryId);
      if (response && response.success && response.data) {
        // 后端直接返回AI设置对象
        const aiSettings = response.data;
        setSettings({
          enabled: aiSettings.enabled ?? true,
          tone: aiSettings.tone || 'professional',
          goal: aiSettings.goal || 'cost_optimization',
          detailLevel: aiSettings.detailLevel || 'standard',
          industryStandards: aiSettings.industryStandards || {
            laborCostPercentage: 30,
            equipmentUtilization: 80,
            profitMargin: 20,
          },
          customPrompt: aiSettings.customPrompt || '',
        });
        aiSettingsLogger.info('AI设置加载成功', {
          factoryId,
          enabled: aiSettings.enabled,
          tone: aiSettings.tone,
        });
      }
    } catch (error) {
      aiSettingsLogger.error('加载AI设置失败', error as Error, { factoryId });
      // 如果API不存在，使用默认设置，不显示错误提示
      const apiError = error as any;
      if (apiError.response?.status !== 404) {
        Alert.alert(t('common.error'), getErrorMsg(error) || t('aiSettings.messages.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUsageStats = async () => {
    try {
      if (!factorySettingsApiClient || !factorySettingsApiClient.getAIUsageStats) {
        aiSettingsLogger.error('factorySettingsApiClient未正确初始化', new Error('API client not initialized'), {
          factoryId,
        });
        return;
      }
      const response: any = await factorySettingsApiClient.getAIUsageStats(factoryId);
      if (response && response.success && response.data) {
        // 适配后端返回的数据结构
        const backendData = response.data;
        const stats: AIUsageStats = {
          period: 'weekly',
          totalCalls: backendData.weeklyUsed || 0,
          byType: {
            analysis: backendData.weeklyUsed || 0,
            question: 0,
          },
          byUser: {},
          recentLogs: [],
        };
        setUsageStats(stats);
        if (backendData.weeklyQuota) {
          setWeeklyQuota(backendData.weeklyQuota);
        }
        aiSettingsLogger.info('AI使用统计加载成功', {
          factoryId,
          weeklyUsed: backendData.weeklyUsed || 0,
          weeklyQuota: backendData.weeklyQuota,
        });
      }
    } catch (error) {
      aiSettingsLogger.warn('加载使用统计失败', { factoryId, error: (error as Error).message });
      // 静默失败，不显示错误提示（该功能可能未实现）
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response: any = await factorySettingsApiClient.updateAISettings(settings, factoryId);
      if (response.success) {
        aiSettingsLogger.info('AI设置保存成功', {
          factoryId,
          enabled: settings.enabled,
          tone: settings.tone,
        });
        Alert.alert(t('common.success'), t('aiSettings.messages.saveSuccess'));
      }
    } catch (error) {
      aiSettingsLogger.error('保存AI设置失败', error as Error, { factoryId });
      Alert.alert(t('common.error'), (error as any).response?.data?.message || t('aiSettings.messages.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (key: keyof AISettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateIndustryStandard = (key: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setSettings((prev) => ({
      ...prev,
      industryStandards: {
        ...prev.industryStandards,
        [key]: numValue,
      },
    }));
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={t('aiSettings.title')} />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>{t('aiSettings.loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('aiSettings.title')} />
        <Appbar.Action
          icon="content-save"
          onPress={handleSave}
          disabled={saving}
        />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 配额显示卡片（只读） */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title={t('aiSettings.quota.title')} />
          <Card.Content>
            <View style={styles.quotaDisplay}>
              <List.Icon icon="lock" color="#9E9E9E" />
              <View style={styles.quotaInfo}>
                <Text variant="titleMedium" style={styles.quotaValue}>
                  {t('aiSettings.quota.weeklyLimit', { count: weeklyQuota })}
                </Text>
                <Text variant="bodySmall" style={styles.quotaHint}>
                  {t('aiSettings.quota.quotaHint')}
                </Text>
              </View>
            </View>

            {usageStats && (
              <>
                <Divider style={styles.divider} />
                <View style={styles.usageInfo}>
                  <View style={styles.usageRow}>
                    <Text variant="bodyMedium">{t('aiSettings.quota.weeklyUsed')}</Text>
                    <Text variant="titleMedium" style={{ color: '#1976D2' }}>
                      {t('aiSettings.quota.times', { count: usageStats?.totalCalls || 0 })}
                    </Text>
                  </View>
                  <View style={styles.usageRow}>
                    <Text variant="bodyMedium">{t('aiSettings.quota.remaining')}</Text>
                    <Text variant="titleMedium" style={{ color: '#388E3C' }}>
                      {t('aiSettings.quota.times', { count: weeklyQuota - (usageStats?.totalCalls || 0) })}
                    </Text>
                  </View>
                  <ProgressBar
                    progress={(usageStats?.totalCalls || 0) / weeklyQuota}
                    color="#1976D2"
                    style={styles.progressBar}
                  />
                  <Text variant="bodySmall" style={styles.resetHint}>
                    {t('aiSettings.quota.resetHint')}
                  </Text>
                </View>
              </>
            )}
          </Card.Content>
        </Card>

        {/* 基础设置 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title={t('aiSettings.basic.title')} />
          <Card.Content>
            {/* 启用/禁用 */}
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Text variant="bodyLarge">{t('aiSettings.basic.enableAI')}</Text>
                <Text variant="bodySmall" style={styles.settingHint}>
                  {t('aiSettings.basic.enableHint')}
                </Text>
              </View>
              <Switch
                value={settings.enabled}
                onValueChange={(value) => updateSettings('enabled', value)}
              />
            </View>

            <Divider style={styles.divider} />

            {/* 语气风格 */}
            <View style={styles.settingSection}>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                {t('aiSettings.basic.tone')}
              </Text>
              <RadioButton.Group
                onValueChange={(value) => updateSettings('tone', value)}
                value={settings.tone}
              >
                {AI_TONE_OPTIONS.map((option) => (
                  <View key={option.value} style={styles.radioRow}>
                    <RadioButton.Item
                      label={option.label}
                      value={option.value}
                      style={styles.radioItem}
                    />
                    <Text variant="bodySmall" style={styles.optionDescription}>
                      {option.description}
                    </Text>
                  </View>
                ))}
              </RadioButton.Group>
            </View>

            <Divider style={styles.divider} />

            {/* 分析目标 */}
            <View style={styles.settingSection}>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                {t('aiSettings.basic.goal')}
              </Text>
              <RadioButton.Group
                onValueChange={(value) => updateSettings('goal', value)}
                value={settings.goal}
              >
                {AI_GOAL_OPTIONS.map((option) => (
                  <View key={option.value} style={styles.radioRow}>
                    <RadioButton.Item
                      label={option.label}
                      value={option.value}
                      style={styles.radioItem}
                    />
                    <Text variant="bodySmall" style={styles.optionDescription}>
                      {option.description}
                    </Text>
                  </View>
                ))}
              </RadioButton.Group>
            </View>

            <Divider style={styles.divider} />

            {/* 详细程度 */}
            <View style={styles.settingSection}>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                {t('aiSettings.basic.detailLevel')}
              </Text>
              <RadioButton.Group
                onValueChange={(value) => updateSettings('detailLevel', value)}
                value={settings.detailLevel}
              >
                {AI_DETAIL_OPTIONS.map((option) => (
                  <View key={option.value} style={styles.radioRow}>
                    <RadioButton.Item
                      label={option.label}
                      value={option.value}
                      style={styles.radioItem}
                    />
                    <Text variant="bodySmall" style={styles.optionDescription}>
                      {option.description}
                    </Text>
                  </View>
                ))}
              </RadioButton.Group>
            </View>
          </Card.Content>
        </Card>

        {/* 行业标准参数 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title={t('aiSettings.industry.title')} />
          <Card.Content>
            <Text variant="bodySmall" style={styles.cardDescription}>
              {t('aiSettings.industry.description')}
            </Text>

            <View style={styles.parameterRow}>
              <Text variant="bodyMedium" style={styles.parameterLabel}>
                {t('aiSettings.industry.laborCost')}
              </Text>
              <View style={styles.parameterInput}>
                <TextInput
                  mode="outlined"
                  value={settings.industryStandards.laborCostPercentage.toString()}
                  onChangeText={(value) => updateIndustryStandard('laborCostPercentage', value)}
                  keyboardType="numeric"
                  dense
                  style={styles.numberInput}
                />
                <Text variant="bodyMedium">%</Text>
              </View>
            </View>

            <View style={styles.parameterRow}>
              <Text variant="bodyMedium" style={styles.parameterLabel}>
                {t('aiSettings.industry.equipmentUtilization')}
              </Text>
              <View style={styles.parameterInput}>
                <TextInput
                  mode="outlined"
                  value={settings.industryStandards.equipmentUtilization.toString()}
                  onChangeText={(value) => updateIndustryStandard('equipmentUtilization', value)}
                  keyboardType="numeric"
                  dense
                  style={styles.numberInput}
                />
                <Text variant="bodyMedium">%</Text>
              </View>
            </View>

            <View style={styles.parameterRow}>
              <Text variant="bodyMedium" style={styles.parameterLabel}>
                {t('aiSettings.industry.profitMargin')}
              </Text>
              <View style={styles.parameterInput}>
                <TextInput
                  mode="outlined"
                  value={settings.industryStandards.profitMargin.toString()}
                  onChangeText={(value) => updateIndustryStandard('profitMargin', value)}
                  keyboardType="numeric"
                  dense
                  style={styles.numberInput}
                />
                <Text variant="bodyMedium">%</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 自定义提示词 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title={t('aiSettings.custom.title')} />
          <Card.Content>
            <Text variant="bodySmall" style={styles.cardDescription}>
              {t('aiSettings.custom.description')}
            </Text>
            <TextInput
              mode="outlined"
              label={t('aiSettings.custom.label')}
              placeholder={t('aiSettings.custom.placeholder')}
              value={settings.customPrompt}
              onChangeText={(value) => updateSettings('customPrompt', value)}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
          </Card.Content>
        </Card>

        {/* 使用统计 */}
        {usageStats && (
          <Card style={styles.card} mode="elevated">
            <Card.Title title={t('aiSettings.stats.title')} />
            <Card.Content>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    {t('aiSettings.stats.totalCalls')}
                  </Text>
                  <Text variant="headlineMedium" style={styles.statValue}>
                    {usageStats?.totalCalls || 0}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    {t('aiSettings.stats.analysisRequests')}
                  </Text>
                  <Text variant="headlineMedium" style={styles.statValue}>
                    {usageStats?.byType?.analysis || 0}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    {t('aiSettings.stats.followUpQuestions')}
                  </Text>
                  <Text variant="headlineMedium" style={styles.statValue}>
                    {usageStats?.byType?.question || 0}
                  </Text>
                </View>
              </View>

              {usageStats?.byUser && Object.keys(usageStats.byUser).length > 0 && (
                <>
                  <Divider style={styles.divider} />
                  <Text variant="bodySmall" style={styles.userStatsTitle}>
                    {t('aiSettings.stats.byUser')}
                  </Text>
                  {Object.entries(usageStats?.byUser || {}).map(([userName, count]) => (
                    <View key={userName} style={styles.userStatRow}>
                      <Text variant="bodyMedium">{userName}</Text>
                      <Text variant="bodyMedium" style={{ color: '#1976D2' }}>
                        {t('aiSettings.quota.times', { count })}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </Card.Content>
          </Card>
        )}

        {/* 保存按钮 */}
        <Button
          mode="contained"
          icon="content-save"
          onPress={handleSave}
          loading={saving}
          style={styles.saveButton}
          contentStyle={styles.saveButtonContent}
        >
          {t('aiSettings.save')}
        </Button>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#757575',
  },
  card: {
    marginBottom: 16,
  },
  cardDescription: {
    color: '#757575',
    marginBottom: 12,
    lineHeight: 20,
  },
  quotaDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
  },
  quotaInfo: {
    flex: 1,
    marginLeft: 8,
  },
  quotaValue: {
    fontWeight: '600',
    color: '#424242',
    marginBottom: 4,
  },
  quotaHint: {
    color: '#9E9E9E',
    fontStyle: 'italic',
  },
  usageInfo: {
    marginTop: 12,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginVertical: 12,
  },
  resetHint: {
    color: '#757575',
    fontStyle: 'italic',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: {
    flex: 1,
    paddingRight: 16,
  },
  settingHint: {
    color: '#757575',
    marginTop: 4,
  },
  divider: {
    marginVertical: 16,
  },
  settingSection: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 8,
    color: '#1976D2',
  },
  radioRow: {
    marginBottom: 8,
  },
  radioItem: {
    paddingVertical: 4,
  },
  optionDescription: {
    color: '#757575',
    marginLeft: 56,
    marginTop: -8,
    marginBottom: 8,
  },
  parameterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  parameterLabel: {
    flex: 1,
  },
  parameterInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  numberInput: {
    width: 80,
  },
  textArea: {
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statLabel: {
    color: '#757575',
    marginBottom: 4,
  },
  statValue: {
    fontWeight: '700',
    color: '#1976D2',
  },
  userStatsTitle: {
    color: '#757575',
    marginBottom: 8,
  },
  userStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 12,
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
  bottomPadding: {
    height: 20,
  },
});
