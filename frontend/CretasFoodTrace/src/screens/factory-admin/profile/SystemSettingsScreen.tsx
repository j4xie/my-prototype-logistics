/**
 * 系统设置页面
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
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function SystemSettingsScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('profile');
  const [autoSync, setAutoSync] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [cacheSize, setCacheSize] = useState('12.5 MB');

  const handleClearCache = () => {
    Alert.alert(
      t('systemSettings.clearCacheTitle'),
      t('systemSettings.clearCacheConfirm'),
      [
        { text: t('systemSettings.cancel'), style: 'cancel' },
        {
          text: t('systemSettings.confirm'),
          onPress: async () => {
            try {
              // 清除部分缓存
              const keys = await AsyncStorage.getAllKeys();
              const cacheKeys = keys.filter(key => key.startsWith('cache_'));
              await AsyncStorage.multiRemove(cacheKeys);
              setCacheSize('0 MB');
              Alert.alert(t('messages.saveSuccess'), t('messages.cacheCleared'));
            } catch (error) {
              Alert.alert(t('systemSettings.error'), t('systemSettings.clearCacheFailed'));
            }
          },
        },
      ]
    );
  };

  const SettingSwitch = ({ title, description, value, onValueChange }: {
    title: string;
    description: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#e0e0e0', true: '#667eea' }}
        thumbColor={value ? '#fff' : '#f4f3f4'}
      />
    </View>
  );

  const SettingButton = ({ title, rightText, onPress }: {
    title: string;
    rightText?: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Text style={styles.menuTitle}>{title}</Text>
      <View style={styles.menuRight}>
        {rightText && <Text style={styles.rightText}>{rightText}</Text>}
        <Icon source="chevron-right" size={20} color="#ccc" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('systemSettings.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* 数据同步 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('systemSettings.dataSync')}</Text>
          <View style={styles.settingsCard}>
            <SettingSwitch
              title={t('systemSettings.autoSync')}
              description={t('systemSettings.autoSyncDescription')}
              value={autoSync}
              onValueChange={setAutoSync}
            />
            <View style={styles.divider} />
            <SettingSwitch
              title={t('systemSettings.wifiOnly')}
              description={t('systemSettings.wifiOnlyDescription')}
              value={wifiOnly}
              onValueChange={setWifiOnly}
            />
          </View>
        </View>

        {/* 存储空间 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('systemSettings.storage')}</Text>
          <View style={styles.settingsCard}>
            <SettingButton
              title={t('systemSettings.clearCache')}
              rightText={cacheSize}
              onPress={handleClearCache}
            />
          </View>
        </View>

        {/* 开发者选项 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('systemSettings.advancedSettings')}</Text>
          <View style={styles.settingsCard}>
            <SettingButton
              title={t('systemSettings.serverSettings')}
              rightText={t('systemSettings.productionEnv')}
              onPress={() => Alert.alert(t('systemSettings.tip'), t('systemSettings.connectedToProduction'))}
            />
            <View style={styles.divider} />
            <SettingButton
              title={t('systemSettings.networkDiagnostic')}
              onPress={() => Alert.alert(t('systemSettings.networkStatus'), t('systemSettings.networkNormal'))}
            />
          </View>
        </View>

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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuTitle: {
    fontSize: 16,
    color: '#333',
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightText: {
    fontSize: 14,
    color: '#999',
    marginRight: 4,
  },
});

export default SystemSettingsScreen;
