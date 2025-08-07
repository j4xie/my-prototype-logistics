import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert
} from 'react-native';
import { RoleSelector, USER_ROLE_CONFIG, EnhancedUserRole } from '../components/permissions/RoleSelector';
import { PermissionSettingsPanel } from '../components/permissions/PermissionSettingsPanel';

/**
 * Week 2 组件测试界面
 * 用于测试权限UI组件和导航系统的集成
 */
export const Week2ComponentTest: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<EnhancedUserRole | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<EnhancedUserRole[]>([]);
  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (message: string, success: boolean = true) => {
    const timestamp = new Date().toLocaleTimeString();
    const status = success ? '✅' : '❌';
    setTestResults(prev => [`${status} ${timestamp}: ${message}`, ...prev.slice(0, 9)]);
  };

  // 测试1: RoleSelector单选功能
  const testRoleSelectorSingle = () => {
    addTestResult('开始测试RoleSelector单选功能');
    
    // 检查所有角色是否正确定义
    const roles = Object.values(USER_ROLE_CONFIG);
    if (roles.length === 7) {
      addTestResult(`角色定义正确: ${roles.length}个角色`);
    } else {
      addTestResult(`角色定义错误: 期望7个，实际${roles.length}个`, false);
    }

    // 检查角色数据完整性
    let isDataComplete = true;
    roles.forEach(role => {
      if (!role.key || !role.displayName || !role.color || !role.icon) {
        isDataComplete = false;
        addTestResult(`角色${role.key}数据不完整`, false);
      }
    });
    
    if (isDataComplete) {
      addTestResult('所有角色数据完整');
    }
  };

  // 测试2: 角色权限级别验证
  const testRolePermissionLevels = () => {
    addTestResult('开始测试角色权限级别');
    
    const roles = Object.values(USER_ROLE_CONFIG);
    const platformRoles = roles.filter(r => r.userType === 'platform');
    const factoryRoles = roles.filter(r => r.userType === 'factory');
    
    addTestResult(`平台角色数量: ${platformRoles.length}`);
    addTestResult(`工厂角色数量: ${factoryRoles.length}`);
    
    // 验证system_developer是最高权限
    const developer = roles.find(r => r.key === 'system_developer');
    if (developer && developer.level === -1) {
      addTestResult('system_developer权限级别正确(-1)');
    } else {
      addTestResult('system_developer权限级别错误', false);
    }
    
    // 验证viewer是最低权限
    const viewer = roles.find(r => r.key === 'viewer');
    if (viewer && viewer.level === 50) {
      addTestResult('viewer权限级别正确(50)');
    } else {
      addTestResult('viewer权限级别错误', false);
    }
  };

  // 测试3: 导航集成测试
  const testNavigationIntegration = () => {
    addTestResult('开始测试导航集成');
    
    try {
      // 这里只是验证导入是否正常
      import('../navigation/SmartNavigationService').then(service => {
        addTestResult('SmartNavigationService导入成功');
      }).catch(err => {
        addTestResult('SmartNavigationService导入失败', false);
      });
      
      import('../navigation/PermissionBasedMenu').then(menu => {
        addTestResult('PermissionBasedMenu导入成功');
      }).catch(err => {
        addTestResult('PermissionBasedMenu导入失败', false);
      });
      
      import('../navigation/NavigationGuard').then(guard => {
        addTestResult('NavigationGuard导入成功');
      }).catch(err => {
        addTestResult('NavigationGuard导入失败', false);
      });
      
    } catch (error) {
      addTestResult(`导航组件导入错误: ${error}`, false);
    }
  };

  // 测试4: API客户端测试
  const testApiClientIntegration = () => {
    addTestResult('开始测试API客户端集成');
    
    try {
      import('../services/api/enhancedApiClient').then(apiClient => {
        addTestResult('EnhancedApiClient导入成功');
        
        // 测试客户端实例
        if (apiClient.apiClient) {
          addTestResult('API客户端实例化成功');
          
          // 测试统计方法
          const stats = apiClient.apiClient.getStats();
          addTestResult(`API客户端状态: 队列${stats.queueSize}, 离线队列${stats.offlineQueueSize}`);
        }
        
      }).catch(err => {
        addTestResult(`API客户端导入失败: ${err.message}`, false);
      });
      
    } catch (error) {
      addTestResult(`API客户端集成错误: ${error}`, false);
    }
  };

  // 运行所有测试
  const runAllTests = () => {
    setTestResults([]);
    setTimeout(() => testRoleSelectorSingle(), 100);
    setTimeout(() => testRolePermissionLevels(), 200);
    setTimeout(() => testNavigationIntegration(), 300);
    setTimeout(() => testApiClientIntegration(), 400);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Week 2 组件测试</Text>
        <Text style={styles.subtitle}>验证权限组件、导航系统和API客户端</Text>
      </View>

      {/* 测试控制 */}
      <View style={styles.testControls}>
        <TouchableOpacity style={styles.testButton} onPress={runAllTests}>
          <Text style={styles.testButtonText}>运行所有测试</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.testButton, styles.clearButton]} 
          onPress={() => setTestResults([])}
        >
          <Text style={styles.clearButtonText}>清空结果</Text>
        </TouchableOpacity>
      </View>

      {/* RoleSelector单选测试 */}
      <View style={styles.testSection}>
        <Text style={styles.sectionTitle}>1. RoleSelector 单选测试</Text>
        <RoleSelector
          selectedRole={selectedRole?.key}
          onRoleChange={(role) => {
            setSelectedRole(role);
            if (role) {
              addTestResult(`选择角色: ${role.displayName} (${role.key})`);
            } else {
              addTestResult('清除角色选择');
            }
          }}
          placeholder="选择测试角色"
          showDescription={true}
          allowClear={true}
        />
        {selectedRole && (
          <View style={styles.roleInfo}>
            <Text style={styles.roleInfoText}>
              角色: {selectedRole.displayName}
            </Text>
            <Text style={styles.roleInfoText}>
              级别: {selectedRole.level}
            </Text>
            <Text style={styles.roleInfoText}>
              类型: {selectedRole.userType === 'platform' ? '平台' : '工厂'}
            </Text>
            <Text style={styles.roleInfoText}>
              权限数量: {selectedRole.permissions.length}
            </Text>
          </View>
        )}
      </View>

      {/* RoleSelector多选测试 */}
      <View style={styles.testSection}>
        <Text style={styles.sectionTitle}>2. RoleSelector 多选测试</Text>
        <RoleSelector
          multiSelect={true}
          selectedRoles={selectedRoles.map(r => r.key)}
          onMultiRoleChange={(roles) => {
            setSelectedRoles(roles);
            addTestResult(`多选角色: ${roles.map(r => r.displayName).join(', ')}`);
          }}
          placeholder="选择多个测试角色"
          showDescription={false}
          allowClear={true}
        />
        {selectedRoles.length > 0 && (
          <View style={styles.multiRoleInfo}>
            <Text style={styles.roleInfoText}>
              已选择 {selectedRoles.length} 个角色
            </Text>
            {selectedRoles.map(role => (
              <Text key={role.key} style={styles.roleInfoText}>
                • {role.displayName} ({role.userType})
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* 测试结果 */}
      <View style={styles.testResults}>
        <Text style={styles.sectionTitle}>测试结果 ({testResults.length}/10)</Text>
        {testResults.length === 0 ? (
          <Text style={styles.noResults}>点击"运行所有测试"开始测试</Text>
        ) : (
          <View style={styles.resultsList}>
            {testResults.map((result, index) => (
              <Text key={index} style={styles.resultText}>
                {result}
              </Text>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#4ECDC4',
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 5,
    opacity: 0.9,
  },
  testControls: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#4ECDC4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#95A5A6',
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  testSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  roleInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  multiRoleInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F0FDFC',
    borderRadius: 8,
  },
  roleInfoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  testResults: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    minHeight: 200,
  },
  noResults: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },
  resultsList: {
    marginTop: 8,
  },
  resultText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});

export default Week2ComponentTest;