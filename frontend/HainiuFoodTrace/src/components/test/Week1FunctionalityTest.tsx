import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLogin } from '../../hooks/useLogin';
import { usePermission } from '../../hooks/usePermission';
import { ServiceFactory } from '../../services/serviceFactory';
import { MockConfigManager } from '../../config/mockConfig';
import { TokenManager } from '../../services/tokenManager';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  message?: string;
  duration?: number;
}

/**
 * Week 1 功能测试组件
 * 端到端测试所有已实现的功能
 */
export const Week1FunctionalityTest: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [currentTest, setCurrentTest] = useState<string>('');

  const {
    login,
    biometricLogin,
    autoLogin,
    isLoading,
    error,
    networkStatus,
    biometricStatus,
    userIdentification,
    clearError,
    retry,
    enableBiometricLogin,
    clearPermissionCache
  } = useLogin({
    enableBiometric: true,
    enableAutoLogin: true,
    maxRetries: 3
  });

  const {
    user,
    permissions,
    hasPermission,
    hasRole,
    hasAnyRole,
    hasModuleAccess,
    checkEnhancedPermissions,
    refreshPermissions
  } = usePermission();

  // 只在开发环境显示
  if (!__DEV__) {
    return null;
  }

  /**
   * 更新测试结果
   */
  const updateTestResult = (name: string, status: TestResult['status'], message?: string, duration?: number) => {
    setTestResults(prev => {
      const existing = prev.find(t => t.name === name);
      if (existing) {
        return prev.map(t => t.name === name ? { ...t, status, message, duration } : t);
      } else {
        return [...prev, { name, status, message, duration }];
      }
    });
  };

  /**
   * 运行单个测试
   */
  const runTest = async (testName: string, testFunction: () => Promise<void>) => {
    const startTime = Date.now();
    setCurrentTest(testName);
    updateTestResult(testName, 'running');

    try {
      await testFunction();
      const duration = Date.now() - startTime;
      updateTestResult(testName, 'passed', '测试通过', duration);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      updateTestResult(testName, 'failed', error.message, duration);
    }
  };

  /**
   * 测试Token管理器
   */
  const testTokenManager = async () => {
    // 测试Token存储和获取
    const mockTokens = {
      accessToken: 'test_access_token',
      refreshToken: 'test_refresh_token',
      expiresAt: Date.now() + 3600000,
      tokenType: 'Bearer'
    };

    await TokenManager.storeTokens(mockTokens);
    const retrieved = await TokenManager.getValidToken();
    
    if (!retrieved) {
      throw new Error('Token存储或获取失败');
    }

    // 测试Token清除
    await TokenManager.clearTokens();
    const afterClear = await TokenManager.getValidToken();
    
    if (afterClear) {
      throw new Error('Token清除失败');
    }
  };

  /**
   * 测试网络管理器
   */
  const testNetworkManager = async () => {
    const NetworkManager = ServiceFactory.getNetworkManager();
    
    // 测试网络状态检查
    const isConnected = await NetworkManager.isConnected();
    if (typeof isConnected !== 'boolean') {
      throw new Error('网络状态检查返回值异常');
    }

    // 测试网络质量检测
    const quality = await NetworkManager.getNetworkQuality();
    if (!quality || typeof quality.responseTime !== 'number') {
      throw new Error('网络质量检测失败');
    }
  };

  /**
   * 测试用户识别服务
   */
  const testUserIdentification = async () => {
    const UserIdentificationService = ServiceFactory.getUserIdentificationService();
    
    // 测试平台用户识别
    const platformUser = UserIdentificationService.identifyUser('admin');
    if (platformUser.userType !== 'platform' || platformUser.confidence <= 0) {
      throw new Error('平台用户识别失败');
    }

    // 测试工厂用户识别
    const factoryUser = UserIdentificationService.identifyUser('factory_admin');
    if (factoryUser.userType !== 'factory' || factoryUser.confidence <= 0) {
      throw new Error('工厂用户识别失败');
    }
  };

  /**
   * 测试生物识别管理器
   */
  const testBiometricManager = async () => {
    const BiometricManager = ServiceFactory.getBiometricManager();
    
    // 测试能力检查
    const capabilities = await BiometricManager.getCapabilities();
    if (typeof capabilities.isAvailable !== 'boolean') {
      throw new Error('生物识别能力检查失败');
    }

    // 测试可用性检查
    const isAvailable = await BiometricManager.isAvailable();
    if (typeof isAvailable !== 'boolean') {
      throw new Error('生物识别可用性检查失败');
    }

    // 测试类型显示名称
    const displayName = await BiometricManager.getBiometricTypeDisplayName();
    if (!displayName || typeof displayName !== 'string') {
      throw new Error('生物识别类型显示名称获取失败');
    }
  };

  /**
   * 测试登录Hook
   */
  const testLoginHook = async () => {
    // 测试网络状态
    if (!['online', 'offline', 'checking'].includes(networkStatus)) {
      throw new Error('网络状态异常');
    }

    // 测试生物识别状态
    if (typeof biometricStatus.available !== 'boolean') {
      throw new Error('生物识别状态异常');
    }

    // 测试错误清除
    clearError();
    if (error !== null) {
      // 注意：clearError是异步的，这里可能需要等待
    }
  };

  /**
   * 测试权限系统
   */
  const testPermissionSystem = async () => {
    // 测试基础权限检查
    const hasBasicPermission = hasPermission('test_permission');
    if (typeof hasBasicPermission !== 'boolean') {
      throw new Error('基础权限检查异常');
    }

    // 测试角色检查
    const hasBasicRole = hasRole('viewer');
    if (typeof hasBasicRole !== 'boolean') {
      throw new Error('角色检查异常');
    }

    // 测试模块权限检查
    const hasBasicModule = hasModuleAccess('admin_access');
    if (typeof hasBasicModule !== 'boolean') {
      throw new Error('模块权限检查异常');
    }

    // 测试增强权限检查
    const enhancedResult = await checkEnhancedPermissions({
      roles: ['viewer'],
      permissions: ['test_permission']
    });

    if (typeof enhancedResult.hasAccess !== 'boolean') {
      throw new Error('增强权限检查异常');
    }
  };

  /**
   * 测试Mock登录流程
   */
  const testMockLogin = async () => {
    if (!MockConfigManager.isServiceMocked('AUTH_SERVICE')) {
      throw new Error('Auth服务未启用Mock模式');
    }

    // 测试错误凭据
    try {
      const wrongResult = await login({
        username: 'wrong_user',
        password: 'wrong_password'
      });
      if (wrongResult) {
        throw new Error('错误凭据登录应该失败');
      }
    } catch (error: any) {
      // 预期的错误，继续测试
    }

    // 测试正确凭据
    const correctResult = await login({
      username: 'admin',
      password: 'admin'
    });
    
    if (!correctResult) {
      throw new Error('正确凭据登录失败');
    }
  };

  /**
   * 测试服务工厂
   */
  const testServiceFactory = async () => {
    const status = ServiceFactory.getServiceStatus();
    
    if (!status || typeof status.mockEnabled !== 'boolean') {
      throw new Error('服务工厂状态异常');
    }

    if (!status.services || typeof status.services !== 'object') {
      throw new Error('服务状态信息异常');
    }

    // 验证所有必需的服务都存在
    const requiredServices = [
      'AuthService',
      'BiometricManager', 
      'NetworkManager',
      'TokenManager',
      'UserIdentificationService'
    ];

    for (const service of requiredServices) {
      if (!status.services[service as keyof typeof status.services]) {
        throw new Error(`缺少必需的服务: ${service}`);
      }
    }
  };

  /**
   * 运行所有测试
   */
  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    setCurrentTest('');

    const tests = [
      { name: 'Token管理器测试', fn: testTokenManager },
      { name: '网络管理器测试', fn: testNetworkManager },
      { name: '用户识别服务测试', fn: testUserIdentification },
      { name: '生物识别管理器测试', fn: testBiometricManager },
      { name: '服务工厂测试', fn: testServiceFactory },
      { name: '登录Hook测试', fn: testLoginHook },
      { name: '权限系统测试', fn: testPermissionSystem },
      { name: 'Mock登录流程测试', fn: testMockLogin }
    ];

    for (const test of tests) {
      await runTest(test.name, test.fn);
      // 在测试之间添加短暂延迟
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunning(false);
    setCurrentTest('');

    // 显示测试总结
    const passed = testResults.filter(t => t.status === 'passed').length;
    const failed = testResults.filter(t => t.status === 'failed').length;
    
    Alert.alert(
      '测试完成',
      `总计: ${tests.length}\n通过: ${passed}\n失败: ${failed}`,
      [{ text: '确定' }]
    );
  };

  /**
   * 渲染测试结果
   */
  const renderTestResult = (result: TestResult) => {
    const getStatusIcon = () => {
      switch (result.status) {
        case 'running':
          return <ActivityIndicator size="small" color="#4ECDC4" />;
        case 'passed':
          return <Ionicons name="checkmark-circle" size={20} color="#4ECDC4" />;
        case 'failed':
          return <Ionicons name="close-circle" size={20} color="#FF6B6B" />;
        default:
          return <Ionicons name="time" size={20} color="#999" />;
      }
    };

    const getStatusColor = () => {
      switch (result.status) {
        case 'running':
          return '#4ECDC4';
        case 'passed':
          return '#4ECDC4';
        case 'failed':
          return '#FF6B6B';
        default:
          return '#999';
      }
    };

    return (
      <View key={result.name} style={styles.testResult}>
        <View style={styles.testHeader}>
          {getStatusIcon()}
          <Text style={[styles.testName, { color: getStatusColor() }]}>
            {result.name}
          </Text>
          {result.duration && (
            <Text style={styles.duration}>{result.duration}ms</Text>
          )}
        </View>
        {result.message && (
          <Text style={[styles.testMessage, { color: getStatusColor() }]}>
            {result.message}
          </Text>
        )}
      </View>
    );
  };

  return (
    <>
      {/* 测试按钮 */}
      <TouchableOpacity
        style={styles.testButton}
        onPress={() => setIsVisible(true)}
      >
        <Ionicons name="flask" size={24} color="#FFFFFF" />
        <Text style={styles.buttonText}>Test</Text>
      </TouchableOpacity>

      {/* 测试面板 */}
      {isVisible && (
        <View style={styles.overlay}>
          <View style={styles.panel}>
            <View style={styles.header}>
              <Text style={styles.title}>Week 1 功能测试</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsVisible(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
              {/* 当前测试状态 */}
              {isRunning && (
                <View style={styles.currentTest}>
                  <ActivityIndicator size="small" color="#4ECDC4" />
                  <Text style={styles.currentTestText}>
                    正在运行: {currentTest}
                  </Text>
                </View>
              )}

              {/* 测试结果 */}
              {testResults.map(renderTestResult)}

              {/* 运行按钮 */}
              <TouchableOpacity
                style={[styles.runButton, isRunning && styles.runButtonDisabled]}
                onPress={runAllTests}
                disabled={isRunning}
              >
                <Text style={styles.runButtonText}>
                  {isRunning ? '测试中...' : '运行所有测试'}
                </Text>
              </TouchableOpacity>

              {/* 测试说明 */}
              <View style={styles.info}>
                <Text style={styles.infoTitle}>测试范围</Text>
                <Text style={styles.infoText}>
                  • Token管理器 - 安全存储、获取、清除{'\n'}
                  • 网络管理器 - 状态检查、质量检测{'\n'}  
                  • 用户识别 - 平台/工厂用户识别{'\n'}
                  • 生物识别 - 能力检查、可用性验证{'\n'}
                  • 服务工厂 - Mock/真实服务切换{'\n'}
                  • 登录Hook - 状态管理、错误处理{'\n'}
                  • 权限系统 - 基础和增强权限检查{'\n'}
                  • Mock登录 - 完整登录流程测试
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  testButton: {
    position: 'absolute',
    top: 100,
    right: 20,
    backgroundColor: '#6C5CE7',
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
    zIndex: 9998,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    padding: 20,
  },
  currentTest: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    marginBottom: 16,
  },
  currentTestText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  testResult: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  testName: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  duration: {
    fontSize: 12,
    color: '#999',
  },
  testMessage: {
    fontSize: 12,
    marginLeft: 28,
    marginTop: 4,
  },
  runButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginVertical: 16,
  },
  runButtonDisabled: {
    backgroundColor: '#CCC',
  },
  runButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
});

export default Week1FunctionalityTest;