import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EnhancedPermissionGuard } from '../auth/EnhancedPermissionGuard';
import { PermissionGuard, RoleGuard, ModuleGuard, DeveloperGuard } from '../auth/PermissionGuard';
import { usePermission } from '../../hooks/usePermission';

/**
 * 权限系统使用示例组件
 * 演示各种权限检查场景的使用方法
 */
export const PermissionExamples: React.FC = () => {
  const { 
    user, 
    permissions, 
    checkEnhancedPermissions, 
    getPermissionCacheStats,
    clearPermissionCache 
  } = usePermission();

  const handleTestEnhancedPermissions = async () => {
    // 测试复杂权限检查
    const result = await checkEnhancedPermissions({
      roles: ['platform_super_admin', 'factory_super_admin'],
      permissions: ['user_manage_all'],
      modules: ['admin_access'],
      minimumLevel: 10,
      dataAccess: {
        level: 'factory',
        department: '生产部门'
      }
    }, {
      requireAll: false,
      checkLevel: true,
      checkDepartment: true,
      cacheResult: true
    });

    console.log('Enhanced Permission Check Result:', result);
  };

  const handleShowCacheStats = () => {
    const stats = getPermissionCacheStats();
    console.log('Permission Cache Stats:', stats);
  };

  return (
    <ScrollView style={styles.container}>
      {/* 用户信息显示 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>当前用户信息</Text>
        <View style={styles.userInfo}>
          <Text style={styles.infoText}>用户ID: {user?.id || 'N/A'}</Text>
          <Text style={styles.infoText}>用户类型: {user?.userType || 'N/A'}</Text>
          <Text style={styles.infoText}>角色: {permissions?.role || 'N/A'}</Text>
        </View>
      </View>

      {/* 基础权限守卫示例 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>基础权限守卫示例</Text>
        
        {/* 角色守卫 */}
        <RoleGuard 
          allowedRoles={['system_developer', 'platform_super_admin']}
          fallback={<Text style={styles.deniedText}>需要开发者或平台管理员权限</Text>}
        >
          <View style={styles.exampleCard}>
            <Ionicons name="shield-checkmark" size={20} color="#4ECDC4" />
            <Text style={styles.cardText}>管理员专用功能</Text>
          </View>
        </RoleGuard>

        {/* 模块守卫 */}
        <ModuleGuard 
          module="admin_access"
          fallback={<Text style={styles.deniedText}>需要管理模块权限</Text>}
        >
          <View style={styles.exampleCard}>
            <Ionicons name="settings" size={20} color="#4ECDC4" />
            <Text style={styles.cardText}>管理模块功能</Text>
          </View>
        </ModuleGuard>

        {/* 开发者守卫 */}
        <DeveloperGuard fallback={<Text style={styles.deniedText}>仅开发者可见</Text>}>
          <View style={styles.exampleCard}>
            <Ionicons name="code-slash" size={20} color="#FF9F43" />
            <Text style={styles.cardText}>开发者调试工具</Text>
          </View>
        </DeveloperGuard>
      </View>

      {/* 增强权限守卫示例 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>增强权限守卫示例</Text>
        
        {/* 复杂权限组合检查 */}
        <EnhancedPermissionGuard
          roles={['platform_super_admin', 'factory_super_admin']}
          permissions={['user_manage_all', 'user_manage_factory']}
          modules={['admin_access']}
          options={{ requireAll: false, checkLevel: true, cacheResult: true }}
          fallback={<Text style={styles.deniedText}>需要管理员权限和管理模块访问权</Text>}
          onPermissionGranted={() => console.log('复杂权限检查通过')}
          onPermissionDenied={(reason) => console.log('权限被拒绝:', reason)}
        >
          <View style={[styles.exampleCard, styles.enhancedCard]}>
            <Ionicons name="people" size={20} color="#4ECDC4" />
            <Text style={styles.cardText}>用户管理功能</Text>
          </View>
        </EnhancedPermissionGuard>

        {/* 权限级别检查 */}
        <EnhancedPermissionGuard
          minimumLevel={10}
          options={{ checkLevel: true }}
          fallback={<Text style={styles.deniedText}>权限级别不足</Text>}
        >
          <View style={[styles.exampleCard, styles.enhancedCard]}>
            <Ionicons name="star" size={20} color="#FF9F43" />
            <Text style={styles.cardText}>高级功能 (需要权限级别 ≤10)</Text>
          </View>
        </EnhancedPermissionGuard>

        {/* 部门权限检查 */}
        <EnhancedPermissionGuard
          department="生产部门"
          options={{ checkDepartment: true }}
          fallback={<Text style={styles.deniedText}>需要生产部门权限</Text>}
        >
          <View style={[styles.exampleCard, styles.enhancedCard]}>
            <Ionicons name="factory" size={20} color="#4ECDC4" />
            <Text style={styles.cardText}>生产部门数据</Text>
          </View>
        </EnhancedPermissionGuard>

        {/* 数据访问权限检查 */}
        <EnhancedPermissionGuard
          dataLevel="factory"
          dataDepartment="质量控制部"
          options={{ cacheResult: true }}
          fallback={<Text style={styles.deniedText}>需要工厂级别数据权限</Text>}
        >
          <View style={[styles.exampleCard, styles.enhancedCard]}>
            <Ionicons name="analytics" size={20} color="#4ECDC4" />
            <Text style={styles.cardText}>工厂数据分析</Text>
          </View>
        </EnhancedPermissionGuard>

        {/* 个人数据权限检查 */}
        <EnhancedPermissionGuard
          dataLevel="own"
          dataOwner={user?.id}
          fallback={<Text style={styles.deniedText}>只能访问自己的数据</Text>}
        >
          <View style={[styles.exampleCard, styles.enhancedCard]}>
            <Ionicons name="person-circle" size={20} color="#4ECDC4" />
            <Text style={styles.cardText}>个人数据</Text>
          </View>
        </EnhancedPermissionGuard>
      </View>

      {/* 权限测试工具 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>权限测试工具</Text>
        
        <TouchableOpacity 
          style={styles.testButton} 
          onPress={handleTestEnhancedPermissions}
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={styles.testButtonText}>测试复杂权限检查</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.testButton, styles.cacheButton]} 
          onPress={handleShowCacheStats}
        >
          <Ionicons name="stats-chart" size={20} color="#FFFFFF" />
          <Text style={styles.testButtonText}>查看缓存统计</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.testButton, styles.clearButton]} 
          onPress={clearPermissionCache}
        >
          <Ionicons name="trash" size={20} color="#FFFFFF" />
          <Text style={styles.testButtonText}>清除权限缓存</Text>
        </TouchableOpacity>
      </View>

      {/* 自定义权限组件示例 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>自定义权限组件</Text>
        
        <EnhancedPermissionGuard
          roles={['platform_super_admin']}
          loadingComponent={
            <View style={styles.customLoadingContainer}>
              <Ionicons name="hourglass" size={24} color="#4ECDC4" />
              <Text style={styles.customLoadingText}>正在验证权限...</Text>
            </View>
          }
          errorComponent={
            <View style={styles.customErrorContainer}>
              <Ionicons name="warning" size={24} color="#FF6B6B" />
              <Text style={styles.customErrorText}>权限验证失败</Text>
            </View>
          }
          fallback={
            <View style={styles.customDeniedContainer}>
              <Ionicons name="lock-closed" size={24} color="#FF9F43" />
              <Text style={styles.customDeniedText}>您需要平台管理员权限才能访问此功能</Text>
              <Text style={styles.customDeniedSubtext}>请联系系统管理员获取权限</Text>
            </View>
          }
        >
          <View style={[styles.exampleCard, styles.customCard]}>
            <Ionicons name="construct" size={20} color="#4ECDC4" />
            <Text style={styles.cardText}>平台管理功能</Text>
          </View>
        </EnhancedPermissionGuard>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  userInfo: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  exampleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  enhancedCard: {
    borderLeftColor: '#FF9F43',
  },
  customCard: {
    borderLeftColor: '#9B59B6',
  },
  cardText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  deniedText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ECDC4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  cacheButton: {
    backgroundColor: '#FF9F43',
  },
  clearButton: {
    backgroundColor: '#FF6B6B',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  customLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderRadius: 8,
    marginBottom: 8,
  },
  customLoadingText: {
    marginLeft: 8,
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '500',
  },
  customErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 8,
    marginBottom: 8,
  },
  customErrorText: {
    marginLeft: 8,
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '500',
  },
  customDeniedContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 159, 67, 0.1)',
    borderRadius: 8,
    marginBottom: 8,
  },
  customDeniedText: {
    marginTop: 8,
    color: '#FF9F43',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  customDeniedSubtext: {
    marginTop: 4,
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default PermissionExamples;