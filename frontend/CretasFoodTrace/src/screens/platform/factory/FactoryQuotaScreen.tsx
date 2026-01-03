import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  Button,
  Switch,
  RadioButton,
  Divider,
  Appbar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Slider from '@react-native-community/slider';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Types
interface FactoryInfo {
  id: string;
  name: string;
  industryType: string;
}

interface QuotaSettings {
  weeklyLimit: number;
  overflowPolicy: 'reject' | 'allow_billing' | 'use_reserve';
  warningThreshold: number;
  notifications: {
    system: boolean;
    email: boolean;
    sms: boolean;
  };
}

interface UsageStats {
  usedThisWeek: number;
  totalQuota: number;
  monthlyTotal: number;
  dailyAverage: number;
  weeklyTrend: number[];
}

type RouteParams = {
  FactoryQuota: {
    factoryId?: string;
    factoryName?: string;
  };
};

type NavigationProp = NativeStackNavigationProp<RouteParams, 'FactoryQuota'>;

// Preset quota options
const QUOTA_PRESETS = [
  { label: '小型 (200)', value: 200 },
  { label: '中型 (500)', value: 500 },
  { label: '大型 (1000)', value: 1000 },
  { label: '企业 (2000)', value: 2000 },
];

// Week days for trend chart
const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '今天'];

/**
 * Factory AI Quota Settings Screen
 * Manages AI quota allocation and usage monitoring for a factory
 */
export default function FactoryQuotaScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RouteParams, 'FactoryQuota'>>();
  const { t } = useTranslation('platform');
  const screenWidth = Dimensions.get('window').width;

  const [isSaving, setIsSaving] = useState(false);

  // Factory info
  const [factory] = useState<FactoryInfo>({
    id: route.params?.factoryId || 'F001',
    name: route.params?.factoryName || '海鲜加工一厂',
    industryType: '水产加工',
  });

  // Quota settings state
  const [settings, setSettings] = useState<QuotaSettings>({
    weeklyLimit: 500,
    overflowPolicy: 'reject',
    warningThreshold: 80,
    notifications: {
      system: true,
      email: true,
      sms: false,
    },
  });

  // Usage statistics
  const [usageStats] = useState<UsageStats>({
    usedThisWeek: 286,
    totalQuota: 500,
    monthlyTotal: 1250,
    dailyAverage: 45,
    weeklyTrend: [45, 60, 50, 70, 55, 80, 100], // Percentages
  });

  // Calculated values
  const usagePercentage = useMemo(
    () => Math.round((usageStats.usedThisWeek / usageStats.totalQuota) * 100),
    [usageStats]
  );

  const remainingQuota = useMemo(
    () => usageStats.totalQuota - usageStats.usedThisWeek,
    [usageStats]
  );

  const handlePresetSelect = useCallback((value: number) => {
    setSettings((prev) => ({ ...prev, weeklyLimit: value }));
  }, []);

  const handleSliderChange = useCallback((value: number) => {
    setSettings((prev) => ({ ...prev, weeklyLimit: Math.round(value) }));
  }, []);

  const handleWarningThresholdChange = useCallback((value: number) => {
    setSettings((prev) => ({ ...prev, warningThreshold: Math.round(value) }));
  }, []);

  const handleOverflowPolicyChange = useCallback((value: string) => {
    setSettings((prev) => ({
      ...prev,
      overflowPolicy: value as QuotaSettings['overflowPolicy'],
    }));
  }, []);

  const handleNotificationToggle = useCallback(
    (key: keyof QuotaSettings['notifications']) => {
      setSettings((prev) => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          [key]: !prev.notifications[key],
        },
      }));
    },
    []
  );

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // TODO: Call API to save quota settings
      await new Promise((resolve) => setTimeout(resolve, 1000));
      Alert.alert('成功', '配额设置已保存', [
        { text: '确定', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('错误', '保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  }, [navigation]);

  const handleViewDetailedReport = useCallback(() => {
    Alert.alert('提示', '详细报表功能开发中...');
  }, []);

  const renderNotificationSwitch = (
    title: string,
    subtitle: string,
    key: keyof QuotaSettings['notifications']
  ) => (
    <View style={styles.notificationRow}>
      <View style={styles.notificationInfo}>
        <Text style={styles.notificationTitle}>{title}</Text>
        <Text style={styles.notificationSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={settings.notifications[key]}
        onValueChange={() => handleNotificationToggle(key)}
        color="#52c41a"
      />
    </View>
  );

  const renderTrendBar = (percentage: number, index: number, isToday: boolean) => {
    const barHeight = percentage;
    const opacity = 0.3 + (percentage / 100) * 0.7;

    return (
      <View key={index} style={styles.trendBarContainer}>
        <View
          style={[
            styles.trendBar,
            {
              height: `${barHeight}%`,
              backgroundColor: isToday ? '#667eea' : `rgba(102, 126, 234, ${opacity})`,
            },
          ]}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header elevated style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="AI配额设置" />
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Factory Info & Quota Gauge */}
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerCard}
        >
          <View style={styles.factoryInfoRow}>
            <View style={styles.factoryIconContainer}>
              <Text style={styles.factoryIconText}>厂</Text>
            </View>
            <View style={styles.factoryInfoText}>
              <Text style={styles.factoryName}>{factory.name}</Text>
              <Text style={styles.factoryMeta}>
                {factory.id} · {factory.industryType}
              </Text>
            </View>
          </View>

          {/* Quota Gauge */}
          <View style={styles.gaugeContainer}>
            <View style={styles.gaugeValueContainer}>
              <Text style={styles.gaugeValue}>
                {usageStats.usedThisWeek} / {usageStats.totalQuota}
              </Text>
              <Text style={styles.gaugeLabel}>本周已使用 / 总配额</Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarBackground}>
              <LinearGradient
                colors={['#52c41a', '#73d13d']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBarFill, { width: `${usagePercentage}%` }]}
              />
            </View>

            <View style={styles.gaugeFooter}>
              <Text style={styles.gaugeFooterText}>剩余 {remainingQuota} 次</Text>
              <Text style={styles.gaugeFooterText}>使用率 {usagePercentage}%</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Quota Settings Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>配额设置</Text>
        </View>

        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.cardContent}>
            {/* Weekly Limit Slider */}
            <View style={styles.sliderSection}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>每周调用上限</Text>
                <Text style={styles.sliderValue}>{settings.weeklyLimit} 次</Text>
              </View>

              <Slider
                style={styles.slider}
                minimumValue={100}
                maximumValue={2000}
                value={settings.weeklyLimit}
                onValueChange={handleSliderChange}
                minimumTrackTintColor="#667eea"
                maximumTrackTintColor="#e0e0e0"
                thumbTintColor="#667eea"
              />

              <View style={styles.sliderMarks}>
                <Text style={styles.sliderMark}>100次</Text>
                <Text style={styles.sliderMark}>500次</Text>
                <Text style={styles.sliderMark}>1000次</Text>
                <Text style={styles.sliderMark}>2000次</Text>
              </View>
            </View>

            {/* Preset Options */}
            <View style={styles.presetsContainer}>
              {QUOTA_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.value}
                  onPress={() => handlePresetSelect(preset.value)}
                  style={[
                    styles.presetChip,
                    settings.weeklyLimit === preset.value && styles.presetChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      settings.weeklyLimit === preset.value && styles.presetChipTextActive,
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Advanced Settings Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>高级设置</Text>
        </View>

        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.cardContent}>
            {/* Overflow Policy */}
            <View style={styles.settingSection}>
              <Text style={styles.settingLabel}>超额处理方式</Text>
              <RadioButton.Group
                onValueChange={handleOverflowPolicyChange}
                value={settings.overflowPolicy}
              >
                <View style={styles.radioOptions}>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => handleOverflowPolicyChange('reject')}
                  >
                    <RadioButton value="reject" color="#667eea" />
                    <Text style={styles.radioLabel}>拒绝请求并提示</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => handleOverflowPolicyChange('allow_billing')}
                  >
                    <RadioButton value="allow_billing" color="#667eea" />
                    <Text style={styles.radioLabel}>允许超额（计费）</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => handleOverflowPolicyChange('use_reserve')}
                  >
                    <RadioButton value="use_reserve" color="#667eea" />
                    <Text style={styles.radioLabel}>使用平台储备配额</Text>
                  </TouchableOpacity>
                </View>
              </RadioButton.Group>
            </View>

            <Divider style={styles.divider} />

            {/* Warning Threshold */}
            <View style={styles.settingSection}>
              <View style={styles.sliderHeader}>
                <Text style={styles.settingLabel}>预警阈值</Text>
                <Text style={styles.thresholdValue}>{settings.warningThreshold}%</Text>
              </View>

              <Slider
                style={styles.slider}
                minimumValue={50}
                maximumValue={95}
                value={settings.warningThreshold}
                onValueChange={handleWarningThresholdChange}
                minimumTrackTintColor="#667eea"
                maximumTrackTintColor="#e0e0e0"
                thumbTintColor="#667eea"
              />

              <Text style={styles.thresholdHint}>
                使用达到 {settings.warningThreshold}% 时发送预警通知
              </Text>
            </View>

            <Divider style={styles.divider} />

            {/* Notification Settings */}
            <View style={styles.settingSection}>
              <Text style={styles.settingLabel}>通知方式</Text>
              <View style={styles.notificationsContainer}>
                {renderNotificationSwitch('系统通知', 'App 内消息推送', 'system')}
                {renderNotificationSwitch('邮件通知', '发送到管理员邮箱', 'email')}
                {renderNotificationSwitch('短信通知', '发送到管理员手机', 'sms')}
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Usage Statistics Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>使用统计</Text>
          <TouchableOpacity onPress={handleViewDetailedReport}>
            <Text style={styles.actionLink}>详细报表</Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.cardContent}>
            {/* Stats Summary */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{usageStats.monthlyTotal.toLocaleString()}</Text>
                <Text style={styles.statLabel}>本月累计</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#52c41a' }]}>
                  {usageStats.dailyAverage}
                </Text>
                <Text style={styles.statLabel}>日均使用</Text>
              </View>
            </View>

            {/* Trend Chart */}
            <Text style={styles.trendTitle}>近7天使用趋势</Text>
            <View style={styles.trendChart}>
              {usageStats.weeklyTrend.map((percentage, index) =>
                renderTrendBar(percentage, index, index === usageStats.weeklyTrend.length - 1)
              )}
            </View>
            <View style={styles.trendLabels}>
              {WEEK_DAYS.map((day, index) => (
                <Text key={index} style={styles.trendLabel}>
                  {day}
                </Text>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button
          mode="outlined"
          onPress={handleCancel}
          style={styles.secondaryButton}
          labelStyle={styles.secondaryButtonLabel}
          disabled={isSaving}
        >
          取消
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.primaryButton}
          labelStyle={styles.primaryButtonLabel}
          disabled={isSaving}
          loading={isSaving}
        >
          保存设置
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  headerCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  factoryInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  factoryIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  factoryIconText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  factoryInfoText: {
    flex: 1,
  },
  factoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  factoryMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  gaugeContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
  },
  gaugeValueContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  gaugeValue: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
  },
  gaugeLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  gaugeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  gaugeFooterText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
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
  actionLink: {
    fontSize: 13,
    color: '#667eea',
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
  },
  cardContent: {
    padding: 16,
  },
  sliderSection: {
    marginBottom: 20,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#262626',
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#667eea',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sliderMark: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  presetChipActive: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderWidth: 1,
    borderColor: '#667eea',
  },
  presetChipText: {
    fontSize: 13,
    color: '#595959',
  },
  presetChipTextActive: {
    color: '#667eea',
  },
  settingSection: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 14,
    color: '#262626',
    marginBottom: 8,
  },
  radioOptions: {
    gap: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioLabel: {
    fontSize: 14,
    color: '#595959',
    marginLeft: -4,
  },
  divider: {
    marginVertical: 16,
    backgroundColor: '#f0f0f0',
  },
  thresholdValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  thresholdHint: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 4,
  },
  notificationsContainer: {
    gap: 12,
  },
  notificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    color: '#262626',
  },
  notificationSubtitle: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#262626',
  },
  statLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 4,
  },
  trendTitle: {
    fontSize: 13,
    color: '#8c8c8c',
    marginBottom: 8,
  },
  trendChart: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 4,
  },
  trendBarContainer: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  trendBar: {
    width: '100%',
    borderRadius: 2,
  },
  trendLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  trendLabel: {
    flex: 1,
    fontSize: 11,
    color: '#bfbfbf',
    textAlign: 'center',
  },
  bottomSpacing: {
    height: 20,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
  },
  secondaryButtonLabel: {
    color: '#595959',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#667eea',
    borderRadius: 8,
  },
  primaryButtonLabel: {
    color: '#fff',
  },
});
