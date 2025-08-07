import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  Modal,
  ScrollView,
  StyleSheet,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MockConfigManager, MOCK_CONFIG } from '../../config/mockConfig';
import { MockBiometricManager } from '../../mocks/mockBiometricManager';
import { ServiceFactory } from '../../services/serviceFactory';

/**
 * Mock控制面板 - 仅在开发环境中显示
 */
export const MockControlPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [config, setConfig] = useState(MockConfigManager.getConfig());
  const [serviceStatus, setServiceStatus] = useState(ServiceFactory.getServiceStatus());

  // 只在开发环境中渲染
  if (!__DEV__ || !config.DEBUG.ENABLE_MOCK_CONTROLS) {
    return null;
  }

  const refreshStatus = () => {
    setConfig(MockConfigManager.getConfig());
    setServiceStatus(ServiceFactory.getServiceStatus());
  };

  const toggleMockMode = () => {
    MockConfigManager.toggleMockMode();
    refreshStatus();
  };

  const toggleService = (serviceName: keyof typeof MOCK_CONFIG.SERVICES) => {
    const currentValue = config.SERVICES[serviceName];
    MockConfigManager.updateConfig({
      SERVICES: {
        [serviceName]: !currentValue
      }
    });
    refreshStatus();
  };

  const simulateErrorScenario = (scenario: keyof typeof MOCK_CONFIG.BEHAVIOR.ERROR_SCENARIOS) => {
    Alert.alert(
      '模拟错误场景',
      `是否启用 "${scenario}" 错误场景 30 秒？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: () => {
            MockConfigManager.enableErrorScenario(scenario, 30000);
            refreshStatus();
          }
        }
      ]
    );
  };

  const simulateBiometricScenario = (scenario: 'no_hardware' | 'not_enrolled' | 'locked' | 'normal') => {
    MockBiometricManager.simulateDeviceScenario(scenario);
    Alert.alert('生物识别场景', `已切换到 "${scenario}" 场景`);
  };

  const testQuickLogin = (username: string) => {
    Alert.alert(
      '快速登录测试',
      `测试用户: ${username}\n密码: ${username}`,
      [{ text: '知道了' }]
    );
  };

  return (
    <>
      {/* 浮动按钮 */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setIsVisible(true)}
      >
        <Ionicons name="build" size={24} color="#FFFFFF" />
        <Text style={styles.buttonText}>Mock</Text>
      </TouchableOpacity>

      {/* 控制面板模态框 */}
      <Modal
        visible={isVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsVisible(false)}
      >
        <ScrollView style={styles.modalContent}>
          {/* 头部 */}
          <View style={styles.header}>
            <Text style={styles.title}>Mock 控制面板</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsVisible(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* 全局Mock开关 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>全局设置</Text>
            <View style={styles.switchRow}>
              <Text style={styles.label}>启用 Mock 模式</Text>
              <Switch
                value={config.ENABLE_MOCK}
                onValueChange={toggleMockMode}
                trackColor={{ false: '#767577', true: '#4ECDC4' }}
              />
            </View>
          </View>

          {/* 服务状态 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>服务状态</Text>
            {Object.entries(serviceStatus.services).map(([service, status]) => (
              <View key={service} style={styles.statusRow}>
                <Text style={styles.serviceName}>{service}</Text>
                <View style={[
                  styles.statusBadge,
                  status === 'MOCK' ? styles.mockBadge : styles.realBadge
                ]}>
                  <Text style={styles.statusText}>{status}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* 服务开关 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>服务 Mock 开关</Text>
            {Object.entries(config.SERVICES).map(([serviceName, isEnabled]) => (
              <View key={serviceName} style={styles.switchRow}>
                <Text style={styles.label}>{serviceName}</Text>
                <Switch
                  value={isEnabled && config.ENABLE_MOCK}
                  disabled={!config.ENABLE_MOCK}
                  onValueChange={() => toggleService(serviceName as keyof typeof MOCK_CONFIG.SERVICES)}
                  trackColor={{ false: '#767577', true: '#4ECDC4' }}
                />
              </View>
            ))}
          </View>

          {/* 错误场景模拟 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>错误场景模拟</Text>
            {Object.entries(config.BEHAVIOR.ERROR_SCENARIOS).map(([scenario, isActive]) => (
              <TouchableOpacity
                key={scenario}
                style={[styles.scenarioButton, isActive && styles.activeScenario]}
                onPress={() => simulateErrorScenario(scenario as keyof typeof MOCK_CONFIG.BEHAVIOR.ERROR_SCENARIOS)}
              >
                <Text style={[styles.scenarioText, isActive && styles.activeScenarioText]}>
                  {scenario} {isActive ? '(活跃)' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 生物识别场景 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>生物识别场景</Text>
            <View style={styles.scenarioGrid}>
              {['normal', 'no_hardware', 'not_enrolled', 'locked'].map((scenario) => (
                <TouchableOpacity
                  key={scenario}
                  style={styles.miniButton}
                  onPress={() => simulateBiometricScenario(scenario as any)}
                >
                  <Text style={styles.miniButtonText}>{scenario}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 测试用户快速登录 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>测试用户</Text>
            <View style={styles.userGrid}>
              {config.DATA.TEST_USERS.map((username) => (
                <TouchableOpacity
                  key={username}
                  style={styles.userButton}
                  onPress={() => testQuickLogin(username)}
                >
                  <Text style={styles.userButtonText}>{username}</Text>
                  {config.DATA.BIOMETRIC_USERS.includes(username) && (
                    <Ionicons name="finger-print" size={12} color="#4ECDC4" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 配置重置 */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                MockConfigManager.resetToDefault();
                refreshStatus();
                Alert.alert('重置完成', 'Mock 配置已重置为默认值');
              }}
            >
              <Text style={styles.resetButtonText}>重置为默认配置</Text>
            </TouchableOpacity>
          </View>

          {/* 底部间距 */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#FF9F43',
    borderRadius: 25,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 9999,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  serviceName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mockBadge: {
    backgroundColor: '#FF9F43',
  },
  realBadge: {
    backgroundColor: '#4ECDC4',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  scenarioButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  activeScenario: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FF6B6B',
  },
  scenarioText: {
    fontSize: 14,
    color: '#666',
  },
  activeScenarioText: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  scenarioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  miniButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  miniButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  userGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  userButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  resetButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 50,
  },
});

export default MockControlPanel;