/**
 * 通知设置页面
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from 'react-native-paper';

interface NotificationSetting {
  key: string;
  title: string;
  description: string;
  enabled: boolean;
}

export function NotificationSettingsScreen() {
  const navigation = useNavigation();

  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      key: 'push',
      title: '推送通知',
      description: '接收App推送消息',
      enabled: true,
    },
    {
      key: 'production',
      title: '生产提醒',
      description: '批次状态变更、生产异常等',
      enabled: true,
    },
    {
      key: 'quality',
      title: '质检提醒',
      description: '质检结果、不合格预警等',
      enabled: true,
    },
    {
      key: 'equipment',
      title: '设备告警',
      description: '设备故障、维护提醒等',
      enabled: true,
    },
    {
      key: 'inventory',
      title: '库存提醒',
      description: '库存不足、过期预警等',
      enabled: true,
    },
    {
      key: 'system',
      title: '系统通知',
      description: '系统更新、公告等',
      enabled: false,
    },
  ]);

  const toggleSetting = (key: string) => {
    setSettings(prev =>
      prev.map(item =>
        item.key === key ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>通知设置</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>通知类型</Text>
          <View style={styles.settingsCard}>
            {settings.map((item, index) => (
              <View
                key={item.key}
                style={[
                  styles.settingItem,
                  index < settings.length - 1 && styles.settingItemBorder,
                ]}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{item.title}</Text>
                  <Text style={styles.settingDescription}>{item.description}</Text>
                </View>
                <Switch
                  value={item.enabled}
                  onValueChange={() => toggleSetting(item.key)}
                  trackColor={{ false: '#e0e0e0', true: '#667eea' }}
                  thumbColor={item.enabled ? '#fff' : '#f4f3f4'}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>免打扰时段</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>开启免打扰</Text>
                <Text style={styles.settingDescription}>22:00 - 08:00</Text>
              </View>
              <Icon source="chevron-right" size={20} color="#ccc" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.tipText}>
          关闭推送通知后，您将无法收到任何App消息推送
        </Text>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#999',
    marginLeft: 20,
    marginBottom: 8,
  },
  settingsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  tipText: {
    fontSize: 13,
    color: '#999',
    marginHorizontal: 20,
    marginTop: 16,
    lineHeight: 18,
  },
});

export default NotificationSettingsScreen;
