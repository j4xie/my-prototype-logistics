/**
 * 设置页面
 * Quality Inspector - Settings Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QI_COLORS } from '../../types/qualityInspector';

interface SettingItem {
  id: string;
  icon: string;
  label: string;
  type: 'toggle' | 'action' | 'value';
  value?: boolean | string;
  onToggle?: (value: boolean) => void;
  onPress?: () => void;
}

export default function QISettingsScreen() {
  const insets = useSafeAreaInsets();

  const [settings, setSettings] = useState({
    voiceAssistant: true,
    autoNextBatch: false,
    soundEffect: true,
    vibration: true,
    pushNotification: true,
    autoSync: true,
    darkMode: false,
    biometricLock: false,
  });

  const handleToggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleClearCache = () => {
    Alert.alert('清除缓存', '确定要清除应用缓存吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: () => {
          Alert.alert('成功', '缓存已清除');
        },
      },
    ]);
  };

  const settingsGroups: { title: string; items: SettingItem[] }[] = [
    {
      title: '质检设置',
      items: [
        {
          id: 'voiceAssistant',
          icon: 'mic-outline',
          label: '语音助手',
          type: 'toggle',
          value: settings.voiceAssistant,
          onToggle: () => handleToggle('voiceAssistant'),
        },
        {
          id: 'autoNextBatch',
          icon: 'arrow-forward-circle-outline',
          label: '自动跳转下一批次',
          type: 'toggle',
          value: settings.autoNextBatch,
          onToggle: () => handleToggle('autoNextBatch'),
        },
        {
          id: 'defaultSampleSize',
          icon: 'layers-outline',
          label: '默认抽样数量',
          type: 'value',
          value: '5 件',
          onPress: () => Alert.alert('设置抽样数量', '功能开发中'),
        },
      ],
    },
    {
      title: '通知设置',
      items: [
        {
          id: 'pushNotification',
          icon: 'notifications-outline',
          label: '推送通知',
          type: 'toggle',
          value: settings.pushNotification,
          onToggle: () => handleToggle('pushNotification'),
        },
        {
          id: 'soundEffect',
          icon: 'volume-medium-outline',
          label: '提示音',
          type: 'toggle',
          value: settings.soundEffect,
          onToggle: () => handleToggle('soundEffect'),
        },
        {
          id: 'vibration',
          icon: 'phone-portrait-outline',
          label: '振动反馈',
          type: 'toggle',
          value: settings.vibration,
          onToggle: () => handleToggle('vibration'),
        },
      ],
    },
    {
      title: '数据同步',
      items: [
        {
          id: 'autoSync',
          icon: 'sync-outline',
          label: '自动同步',
          type: 'toggle',
          value: settings.autoSync,
          onToggle: () => handleToggle('autoSync'),
        },
        {
          id: 'syncNow',
          icon: 'cloud-upload-outline',
          label: '立即同步',
          type: 'action',
          onPress: () => Alert.alert('同步', '数据同步中...'),
        },
        {
          id: 'lastSync',
          icon: 'time-outline',
          label: '上次同步',
          type: 'value',
          value: '今天 14:30',
        },
      ],
    },
    {
      title: '安全与隐私',
      items: [
        {
          id: 'biometricLock',
          icon: 'finger-print-outline',
          label: '生物识别解锁',
          type: 'toggle',
          value: settings.biometricLock,
          onToggle: () => handleToggle('biometricLock'),
        },
        {
          id: 'changePassword',
          icon: 'key-outline',
          label: '修改密码',
          type: 'action',
          onPress: () => Alert.alert('修改密码', '功能开发中'),
        },
      ],
    },
    {
      title: '其他',
      items: [
        {
          id: 'darkMode',
          icon: 'moon-outline',
          label: '深色模式',
          type: 'toggle',
          value: settings.darkMode,
          onToggle: () => handleToggle('darkMode'),
        },
        {
          id: 'clearCache',
          icon: 'trash-outline',
          label: '清除缓存',
          type: 'action',
          onPress: handleClearCache,
        },
        {
          id: 'version',
          icon: 'information-circle-outline',
          label: '版本号',
          type: 'value',
          value: 'v1.0.0',
        },
      ],
    },
  ];

  const renderSettingItem = (item: SettingItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.settingItem}
      onPress={item.type === 'action' || item.type === 'value' ? item.onPress : undefined}
      activeOpacity={item.type === 'toggle' ? 1 : 0.7}
      disabled={item.type === 'toggle'}
    >
      <View style={styles.settingLeft}>
        <Ionicons name={item.icon as any} size={22} color={QI_COLORS.textSecondary} />
        <Text style={styles.settingLabel}>{item.label}</Text>
      </View>
      <View style={styles.settingRight}>
        {item.type === 'toggle' && (
          <Switch
            value={item.value as boolean}
            onValueChange={item.onToggle}
            trackColor={{ false: QI_COLORS.border, true: '#81C784' }}
            thumbColor={item.value ? QI_COLORS.primary : '#f4f3f4'}
            ios_backgroundColor={QI_COLORS.border}
          />
        )}
        {item.type === 'value' && (
          <>
            <Text style={styles.settingValue}>{item.value}</Text>
            {item.onPress && (
              <Ionicons name="chevron-forward" size={20} color={QI_COLORS.disabled} />
            )}
          </>
        )}
        {item.type === 'action' && (
          <Ionicons name="chevron-forward" size={20} color={QI_COLORS.disabled} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
    >
      {settingsGroups.map((group) => (
        <View key={group.title} style={styles.settingGroup}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <View style={styles.groupCard}>
            {group.items.map(renderSettingItem)}
          </View>
        </View>
      ))}

      {/* 重置设置 */}
      <TouchableOpacity
        style={styles.resetBtn}
        onPress={() =>
          Alert.alert('重置设置', '确定要恢复默认设置吗？', [
            { text: '取消', style: 'cancel' },
            {
              text: '确定',
              style: 'destructive',
              onPress: () => {
                setSettings({
                  voiceAssistant: true,
                  autoNextBatch: false,
                  soundEffect: true,
                  vibration: true,
                  pushNotification: true,
                  autoSync: true,
                  darkMode: false,
                  biometricLock: false,
                });
                Alert.alert('成功', '设置已重置');
              },
            },
          ])
        }
      >
        <Text style={styles.resetText}>恢复默认设置</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QI_COLORS.background,
  },
  content: {
    padding: 16,
  },

  // 设置组
  settingGroup: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  groupCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // 设置项
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: QI_COLORS.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 15,
    color: QI_COLORS.text,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValue: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },

  // 重置按钮
  resetBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  resetText: {
    fontSize: 14,
    color: QI_COLORS.danger,
  },
});
