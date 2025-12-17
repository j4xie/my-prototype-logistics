import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  TextInput,
  Button,
  Divider,
  ActivityIndicator,
  Switch,
  Chip,
  HelperText,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { factoryApiClient } from '../../services/api/factoryApiClient';
import { useAuthStore } from '../../store/authStore';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建FactorySettings专用logger
const factorySettingsLogger = logger.createContextLogger('FactorySettings');

interface WorkingHours {
  startTime: string; // "08:00"
  endTime: string;   // "17:00"
}

interface FactorySettings {
  // 基本信息
  factoryName: string;
  factoryAddress: string;
  contactPhone: string;
  contactEmail: string;

  // 工作时间配置
  workingHours: WorkingHours;
  lunchBreakStart: string;
  lunchBreakEnd: string;

  // 工作日配置
  workingDays: boolean[]; // [周一, 周二, ...周日]

  // 考勤配置
  lateThresholdMinutes: number;
  earlyLeaveThresholdMinutes: number;

  // 其他配置
  enableOvertimeTracking: boolean;
  enableGPSChecking: boolean;
}

/**
 * 工厂设置页面
 * 功能：
 * - 基本信息管理
 * - 工作时间配置
 * - 工作日设置
 * - 考勤规则配置
 */
export default function FactorySettingsScreen() {
  const navigation = useNavigation();
  const factoryId = useAuthStore((state) => state.user?.factoryId);

  // 表单状态
  const [settings, setSettings] = useState<FactorySettings>({
    factoryName: '',
    factoryAddress: '',
    contactPhone: '',
    contactEmail: '',
    workingHours: { startTime: '08:00', endTime: '17:00' },
    lunchBreakStart: '12:00',
    lunchBreakEnd: '13:00',
    workingDays: [true, true, true, true, true, false, false],
    lateThresholdMinutes: 10,
    earlyLeaveThresholdMinutes: 10,
    enableOvertimeTracking: true,
    enableGPSChecking: true,
  });

  // UI状态
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 时间选择器状态
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  /**
   * 加载工厂设置
   */
  useEffect(() => {
    loadFactorySettings();
  }, []);

  const loadFactorySettings = async () => {
    setLoading(true);
    try {
      factorySettingsLogger.debug('加载工厂设置', { factoryId });

      const response = await factoryApiClient.getFactorySettings(factoryId);
      console.log(response)
      factorySettingsLogger.info('工厂设置加载成功', {
          factoryName: response.factoryName,
          hasWorkingHours: !!response.workingHours,
        });
        setSettings(response);
      /* if (response.success && response.data) {
        factorySettingsLogger.info('工厂设置加载成功', {
          factoryName: response.data.factoryName,
          hasWorkingHours: !!response.data.workingHours,
        });
        setSettings(response.data);
      } else {
        throw new Error(response.message || '加载失败');
      } */
    } catch (error) {
      factorySettingsLogger.error('加载工厂设置失败', error, { factoryId });
      Alert.alert('加载失败', error.response?.data?.message || error.message || '无法加载工厂设置，请重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 更新设置
   */
  const updateSetting = <K extends keyof FactorySettings>(
    key: K,
    value: FactorySettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  /**
   * 切换工作日
   */
  const toggleWorkingDay = (index: number) => {
    const newWorkingDays = [...settings.workingDays];
    newWorkingDays[index] = !newWorkingDays[index];
    updateSetting('workingDays', newWorkingDays);
  };

  /**
   * 保存设置
   */
  const handleSave = async () => {
    // 验证必填字段
    if (!settings.factoryName || !settings.factoryAddress) {
      Alert.alert('验证错误', '请填写工厂名称和地址');
      return;
    }

    // 验证电话号码格式
    if (settings.contactPhone && !/^0\d{2,3}-?\d{7,8}$/.test(settings.contactPhone.replace(/\s/g, ''))) {
      Alert.alert('验证错误', '请输入有效的电话号码');
      return;
    }

    // 验证邮箱格式
    if (settings.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contactEmail)) {
      Alert.alert('验证错误', '请输入有效的邮箱地址');
      return;
    }

    setSaving(true);

    try {
      factorySettingsLogger.debug('保存工厂设置', {
        factoryId,
        factoryName: settings.factoryName,
        hasChanges,
      });

      const response = await factoryApiClient.updateFactorySettings(settings, factoryId);

      if (response.success) {
        factorySettingsLogger.info('工厂设置保存成功', {
          factoryId,
          factoryName: settings.factoryName,
        });
        Alert.alert('保存成功', response.message || '工厂设置已更新');
        setHasChanges(false);
        // 重新加载设置以获取最新数据
        await loadFactorySettings();
      } else {
        throw new Error(response.message || '保存失败');
      }
    } catch (error) {
      factorySettingsLogger.error('保存工厂设置失败', error, { factoryId });
      Alert.alert('保存失败', error.response?.data?.message || error.message || '保存设置时出现错误，请重试');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 重置设置
   */
  const handleReset = () => {
    Alert.alert(
      '确认重置',
      '确定要放弃所有修改吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: () => {
            loadFactorySettings();
            setHasChanges(false);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="工厂设置" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="工厂设置" />
        {hasChanges && (
          <Appbar.Action icon="restore" onPress={handleReset} />
        )}
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* 基本信息 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="基本信息" titleVariant="titleMedium" />
          <Card.Content>
            <TextInput
              label="工厂名称 *"
              value={settings.factoryName}
              onChangeText={(value) => updateSetting('factoryName', value)}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="工厂地址 *"
              value={settings.factoryAddress}
              onChangeText={(value) => updateSetting('factoryAddress', value)}
              mode="outlined"
              multiline
              numberOfLines={2}
              style={styles.input}
            />

            <TextInput
              label="联系电话"
              value={settings.contactPhone}
              onChangeText={(value) => updateSetting('contactPhone', value)}
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
            />

            <TextInput
              label="联系邮箱"
              value={settings.contactEmail}
              onChangeText={(value) => updateSetting('contactEmail', value)}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
          </Card.Content>
        </Card>

        {/* 工作时间配置 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="工作时间配置" titleVariant="titleMedium" />
          <Card.Content>
            <View style={styles.timeRow}>
              <Text variant="bodyMedium" style={styles.timeLabel}>
                上班时间
              </Text>
              <Chip
                icon="clock-outline"
                onPress={() => setShowStartTimePicker(true)}
                style={styles.timeChip}
              >
                {settings.workingHours.startTime}
              </Chip>
            </View>

            <View style={styles.timeRow}>
              <Text variant="bodyMedium" style={styles.timeLabel}>
                下班时间
              </Text>
              <Chip
                icon="clock-outline"
                onPress={() => setShowEndTimePicker(true)}
                style={styles.timeChip}
              >
                {settings.workingHours.endTime}
              </Chip>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.timeRow}>
              <Text variant="bodyMedium" style={styles.timeLabel}>
                午休开始
              </Text>
              <Chip style={styles.timeChip}>
                {settings.lunchBreakStart}
              </Chip>
            </View>

            <View style={styles.timeRow}>
              <Text variant="bodyMedium" style={styles.timeLabel}>
                午休结束
              </Text>
              <Chip style={styles.timeChip}>
                {settings.lunchBreakEnd}
              </Chip>
            </View>
          </Card.Content>
        </Card>

        {/* 工作日设置 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="工作日设置" titleVariant="titleMedium" />
          <Card.Content>
            <View style={styles.weekDaysContainer}>
              {weekDays.map((day, index) => (
                <Chip
                  key={day}
                  mode={settings.workingDays[index] ? 'flat' : 'outlined'}
                  selected={settings.workingDays[index]}
                  onPress={() => toggleWorkingDay(index)}
                  style={[
                    styles.dayChip,
                    settings.workingDays[index] && styles.dayChipActive,
                  ]}
                  textStyle={
                    settings.workingDays[index]
                      ? styles.dayChipTextActive
                      : styles.dayChipText
                  }
                >
                  {day}
                </Chip>
              ))}
            </View>
            <HelperText type="info">
              点击选择工作日（已选择 {settings.workingDays.filter(Boolean).length} 天）
            </HelperText>
          </Card.Content>
        </Card>

        {/* 考勤规则 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="考勤规则" titleVariant="titleMedium" />
          <Card.Content>
            <TextInput
              label="迟到判定（分钟）"
              value={settings.lateThresholdMinutes.toString()}
              onChangeText={(value) => {
                const num = parseInt(value) || 0;
                updateSetting('lateThresholdMinutes', num);
              }}
              mode="outlined"
              keyboardType="number-pad"
              style={styles.input}
            />
            <HelperText type="info">
              超过上班时间 {settings.lateThresholdMinutes} 分钟视为迟到
            </HelperText>

            <TextInput
              label="早退判定（分钟）"
              value={settings.earlyLeaveThresholdMinutes.toString()}
              onChangeText={(value) => {
                const num = parseInt(value) || 0;
                updateSetting('earlyLeaveThresholdMinutes', num);
              }}
              mode="outlined"
              keyboardType="number-pad"
              style={styles.input}
            />
            <HelperText type="info">
              提前下班时间 {settings.earlyLeaveThresholdMinutes} 分钟视为早退
            </HelperText>
          </Card.Content>
        </Card>

        {/* 其他配置 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="其他配置" titleVariant="titleMedium" />
          <Card.Content>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text variant="bodyMedium">启用加班追踪</Text>
                <Text variant="bodySmall" style={styles.switchHint}>
                  记录超过规定工作时间的加班
                </Text>
              </View>
              <Switch
                value={settings.enableOvertimeTracking}
                onValueChange={(value) => updateSetting('enableOvertimeTracking', value)}
              />
            </View>

            <Divider style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text variant="bodyMedium">启用GPS打卡</Text>
                <Text variant="bodySmall" style={styles.switchHint}>
                  打卡时验证GPS位置
                </Text>
              </View>
              <Switch
                value={settings.enableGPSChecking}
                onValueChange={(value) => updateSetting('enableGPSChecking', value)}
              />
            </View>
          </Card.Content>
        </Card>

        {/* 保存按钮 */}
        <Button
          mode="contained"
          icon="content-save"
          onPress={handleSave}
          loading={saving}
          disabled={saving || !hasChanges}
          style={styles.saveButton}
          contentStyle={styles.saveButtonContent}
        >
          {saving ? '保存中...' : '保存设置'}
        </Button>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* 时间选择器 */}
      {showStartTimePicker && (
        <DateTimePicker
          value={new Date(`2000-01-01T${settings.workingHours.startTime}:00`)}
          mode="time"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartTimePicker(false);
            if (selectedDate) {
              const hours = selectedDate.getHours().toString().padStart(2, '0');
              const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
              updateSetting('workingHours', {
                ...settings.workingHours,
                startTime: `${hours}:${minutes}`,
              });
            }
          }}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={new Date(`2000-01-01T${settings.workingHours.endTime}:00`)}
          mode="time"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndTimePicker(false);
            if (selectedDate) {
              const hours = selectedDate.getHours().toString().padStart(2, '0');
              const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
              updateSetting('workingHours', {
                ...settings.workingHours,
                endTime: `${hours}:${minutes}`,
              });
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    margin: 16,
    marginBottom: 0,
  },
  input: {
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeLabel: {
    fontWeight: '500',
  },
  timeChip: {
    backgroundColor: '#E3F2FD',
  },
  divider: {
    marginVertical: 16,
  },
  weekDaysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  dayChip: {
    minWidth: 60,
  },
  dayChipActive: {
    backgroundColor: '#2196F3',
  },
  dayChipText: {
    color: '#666',
  },
  dayChipTextActive: {
    color: 'white',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  switchHint: {
    color: '#666',
    marginTop: 4,
  },
  saveButton: {
    margin: 16,
  },
  saveButtonContent: {
    height: 50,
  },
  bottomPadding: {
    height: 40,
  },
});
