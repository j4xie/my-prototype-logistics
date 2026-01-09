/**
 * UnifiedDeviceManagementScreen - 统一设备管理中心
 * 整合电子秤、摄像头、通用设备三类设备管理
 * 使用 Tab 切换不同设备类型
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, SegmentedButtons } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import {
  ScaleDeviceList,
  CameraDeviceList,
  EquipmentDeviceList,
} from '../../../components/device';
import { FAManagementStackParamList } from '../../../types/navigation';

type NavigationProp = NativeStackNavigationProp<FAManagementStackParamList>;

type DeviceTab = 'scale' | 'camera' | 'equipment';

export function UnifiedDeviceManagementScreen() {
  const { t } = useTranslation('management');
  const navigation = useNavigation<NavigationProp>();
  const [activeTab, setActiveTab] = useState<DeviceTab>('scale');

  const handleTabChange = (value: string) => {
    setActiveTab(value as DeviceTab);
  };

  // 电子秤导航
  const handleScaleDevicePress = (deviceId: number) => {
    navigation.navigate('IotDeviceDetail', { deviceId });
  };

  const handleScaleCreatePress = () => {
    navigation.navigate('AIDeviceInput', { deviceType: 'SCALE' });
  };

  // 摄像头导航
  const handleCameraDevicePress = (deviceId: number) => {
    // IsapiDeviceDetail expects string deviceId
    navigation.navigate('IsapiDeviceDetail', { deviceId: String(deviceId) });
  };

  const handleCameraCreatePress = () => {
    navigation.navigate('CameraAddMethod');
  };

  const handleSetupWizardPress = () => {
    navigation.navigate('DeviceSetupWizard');
  };

  // 通用设备（在组件内部处理详情）
  const handleEquipmentDevicePress = (equipmentId: number) => {
    // EquipmentDeviceList 内部已有详情弹窗，此回调预留扩展
    console.log('Equipment pressed:', equipmentId);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'scale':
        return (
          <ScaleDeviceList
            onDevicePress={handleScaleDevicePress}
            onCreatePress={handleScaleCreatePress}
          />
        );
      case 'camera':
        return (
          <CameraDeviceList
            onDevicePress={handleCameraDevicePress}
            onCreatePress={handleCameraCreatePress}
            onSetupWizardPress={handleSetupWizardPress}
          />
        );
      case 'equipment':
        return (
          <EquipmentDeviceList
            onDevicePress={handleEquipmentDevicePress}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('deviceCenter.title', '设备中心')} />
      </Appbar.Header>

      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={handleTabChange}
          buttons={[
            {
              value: 'scale',
              label: t('deviceCenter.tabs.scale', '电子秤'),
              icon: 'scale',
            },
            {
              value: 'camera',
              label: t('deviceCenter.tabs.camera', '摄像头'),
              icon: 'cctv',
            },
            {
              value: 'equipment',
              label: t('deviceCenter.tabs.equipment', '通用设备'),
              icon: 'cog',
            },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      <View style={styles.content}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  header: {
    backgroundColor: '#fff',
    elevation: 2,
  },
  tabContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  segmentedButtons: {
    backgroundColor: '#f7fafc',
  },
  content: {
    flex: 1,
  },
});

export default UnifiedDeviceManagementScreen;
