/**
 * 摄像头添加方式选择页面
 * 选择：自动发现 or AI识别
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
  CameraAddMethod: undefined;
  DeviceSetupWizard: undefined;
  IsapiDeviceDiscovery: undefined;
  AIDeviceInput: { deviceType: 'CAMERA' | 'SCALE' };
};

type NavigationProp = NativeStackNavigationProp<DeviceStackParamList, 'CameraAddMethod'>;

interface AddMethodOption {
  id: 'auto' | 'ai';
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  recommended?: boolean;
}

const ADD_METHODS: AddMethodOption[] = [
  {
    id: 'auto',
    title: '自动发现',
    subtitle: '推荐 · 同局域网设备',
    description: '扫描局域网内的海康威视设备，自动发现、激活并配置推送',
    icon: 'radar',
    color: '#3182ce',
    bgColor: '#ebf8ff',
    recommended: true,
  },
  {
    id: 'ai',
    title: 'AI 识别',
    subtitle: '拍照/语音 · 远程设备',
    description: '拍摄设备标签或语音描述设备信息，适用于远程或已知参数的设备',
    icon: 'camera-iris',
    color: '#805ad5',
    bgColor: '#faf5ff',
  },
];

export function CameraAddMethodScreen() {
  const navigation = useNavigation<NavigationProp>();

  const handleSelectMethod = (method: 'auto' | 'ai') => {
    if (method === 'auto') {
      // 自动发现 -> SADP + HTTP 双模式设备发现
      navigation.navigate('IsapiDeviceDiscovery');
    } else {
      // AI 识别 -> 进入 AI 输入页面
      navigation.navigate('AIDeviceInput', { deviceType: 'CAMERA' });
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
        <Text style={styles.headerTitle}>添加摄像头</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>选择添加方式</Text>
        <Text style={styles.subtitle}>
          根据您的设备位置和已知信息，选择合适的添加方式
        </Text>

        {/* Method Options */}
        <View style={styles.optionsContainer}>
          {ADD_METHODS.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.optionCard,
                method.recommended && styles.optionCardRecommended,
              ]}
              onPress={() => handleSelectMethod(method.id)}
              activeOpacity={0.7}
            >
              {method.recommended && (
                <View style={styles.recommendedBadge}>
                  <Icon source="star" size={12} color="#ffffff" />
                  <Text style={styles.recommendedText}>推荐</Text>
                </View>
              )}

              <View style={styles.optionHeader}>
                <View style={[styles.iconContainer, { backgroundColor: method.bgColor }]}>
                  <Icon source={method.icon} size={32} color={method.color} />
                </View>
                <View style={styles.optionTitleContainer}>
                  <Text style={styles.optionTitle}>{method.title}</Text>
                  <Text style={styles.optionSubtitle}>{method.subtitle}</Text>
                </View>
              </View>

              <Text style={styles.optionDescription}>{method.description}</Text>

              <View style={styles.optionFooter}>
                <Text style={[styles.selectText, { color: method.color }]}>
                  选择此方式
                </Text>
                <Icon source="arrow-right" size={18} color={method.color} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Comparison */}
        <View style={styles.comparisonContainer}>
          <Text style={styles.comparisonTitle}>方式对比</Text>
          <View style={styles.comparisonTable}>
            <View style={styles.comparisonRow}>
              <Text style={styles.comparisonLabel}>适用场景</Text>
              <Text style={styles.comparisonValue}>同局域网</Text>
              <Text style={styles.comparisonValue}>任意位置</Text>
            </View>
            <View style={styles.comparisonRow}>
              <Text style={styles.comparisonLabel}>需要信息</Text>
              <Text style={styles.comparisonValue}>无需输入</Text>
              <Text style={styles.comparisonValue}>IP+密码</Text>
            </View>
            <View style={styles.comparisonRow}>
              <Text style={styles.comparisonLabel}>可激活设备</Text>
              <Text style={styles.comparisonValue}>✓</Text>
              <Text style={styles.comparisonValue}>✗</Text>
            </View>
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
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  optionCardRecommended: {
    borderWidth: 2,
    borderColor: '#3182ce',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -1,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3182ce',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    gap: 4,
  },
  recommendedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitleContainer: {
    marginLeft: 14,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
  },
  optionSubtitle: {
    fontSize: 13,
    color: '#718096',
    marginTop: 2,
  },
  optionDescription: {
    fontSize: 14,
    color: '#4a5568',
    lineHeight: 21,
    marginBottom: 16,
  },
  optionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  selectText: {
    fontSize: 14,
    fontWeight: '500',
  },
  comparisonContainer: {
    marginTop: 32,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  comparisonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: 12,
  },
  comparisonTable: {
    gap: 8,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonLabel: {
    flex: 1,
    fontSize: 13,
    color: '#718096',
  },
  comparisonValue: {
    flex: 1,
    fontSize: 13,
    color: '#2d3748',
    textAlign: 'center',
  },
});

export default CameraAddMethodScreen;
