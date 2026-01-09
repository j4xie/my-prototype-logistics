/**
 * 智能设备添加入口页面
 * 选择设备类型：摄像头 or 电子秤
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';

type DeviceStackParamList = {
  SmartDeviceAdd: undefined;
  CameraAddMethod: undefined;
  AIDeviceInput: { deviceType: 'SCALE' | 'CAMERA' };
  IotDeviceCreate: undefined;
  DeviceSetupWizard: undefined;
};

type NavigationProp = NativeStackNavigationProp<DeviceStackParamList, 'SmartDeviceAdd'>;

interface DeviceTypeOption {
  type: 'CAMERA' | 'SCALE';
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  bgColor: string;
}

const DEVICE_TYPES: DeviceTypeOption[] = [
  {
    type: 'CAMERA',
    title: '摄像头',
    subtitle: '海康威视 ISAPI 设备',
    icon: 'cctv',
    color: '#3182ce',
    bgColor: '#ebf8ff',
  },
  {
    type: 'SCALE',
    title: '电子秤',
    subtitle: 'MODBUS / TCP 设备',
    icon: 'scale-balance',
    color: '#38a169',
    bgColor: '#f0fff4',
  },
];

export function SmartDeviceAddScreen() {
  const navigation = useNavigation<NavigationProp>();

  const handleSelectDeviceType = (type: 'CAMERA' | 'SCALE') => {
    if (type === 'CAMERA') {
      // 摄像头有多种添加方式，进入选择页面
      navigation.navigate('CameraAddMethod');
    } else {
      // 电子秤直接进入 AI 输入页面
      navigation.navigate('AIDeviceInput', { deviceType: 'SCALE' });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f7fa" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon source="arrow-left" size={24} color="#2d3748" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>添加设备</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>选择设备类型</Text>
        <Text style={styles.subtitle}>
          请选择要添加的设备类型，系统将引导您完成配置
        </Text>

        {/* Device Type Options */}
        <View style={styles.optionsContainer}>
          {DEVICE_TYPES.map((device) => (
            <TouchableOpacity
              key={device.type}
              style={styles.optionCard}
              onPress={() => handleSelectDeviceType(device.type)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: device.bgColor }]}>
                <Icon source={device.icon} size={40} color={device.color} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>{device.title}</Text>
                <Text style={styles.optionSubtitle}>{device.subtitle}</Text>
              </View>
              <Icon source="chevron-right" size={24} color="#a0aec0" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Tips */}
        <View style={styles.tipsContainer}>
          <View style={styles.tipItem}>
            <Icon source="lightbulb-outline" size={20} color="#ed8936" />
            <Text style={styles.tipText}>
              摄像头支持自动发现和AI识别两种添加方式
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Icon source="lightbulb-outline" size={20} color="#ed8936" />
            <Text style={styles.tipText}>
              电子秤支持拍照识别配置标签或语音输入
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2d3748',
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#718096',
    lineHeight: 22,
    marginBottom: 32,
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionInfo: {
    flex: 1,
    marginLeft: 16,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#718096',
  },
  tipsContainer: {
    marginTop: 40,
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#718096',
    lineHeight: 20,
  },
});

export default SmartDeviceAddScreen;
