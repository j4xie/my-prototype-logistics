import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePermission } from '../hooks/usePermission';
import { AuthService } from '../services/auth/authService';
import { getUserRole } from '../utils/roleMapping';
import { PermissionGuard, DeveloperGuard, PlatformAdminGuard, FactoryAdminGuard } from '../components/auth/PermissionGuard';

interface MainScreenProps {
  navigation: any;
}

export const MainScreen: React.FC<MainScreenProps> = ({ navigation }) => {
  const { user, permissions, isLoading, hasPermission, hasModuleAccess } = usePermission();
  const [deviceInfo, setDeviceInfo] = useState<any>(null);

  useEffect(() => {
    // 获取设备信息
    setDeviceInfo({
      platform: 'Android',
      version: '1.0.0',
      buildNumber: '1',
    });
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      '确认退出',
      '您确定要退出登录吗？',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '退出', 
          style: 'destructive',
          onPress: async () => {
            try {
              await AuthService.logout();
              navigation.replace('Login');
            } catch (error) {
              console.error('退出登录失败:', error);
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>加载中...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>用户信息加载失败</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => navigation.replace('Login')}
        >
          <Text style={styles.retryButtonText}>返回登录</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1a365d" />
      <LinearGradient
        colors={['#1a365d', '#2c5aa0', '#3182ce']}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* 头部用户信息 */}
          <View style={styles.header}>
            <View style={styles.userInfo}>
              <View style={styles.avatarContainer}>
                <Ionicons name="person" size={40} color="#fff" />
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{user.fullName || user.username}</Text>
                <Text style={styles.userRole}>{getUserRole(user)}</Text>
                <Text style={styles.userType}>{user.userType === 'platform' ? '平台用户' : '工厂用户'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* 功能卡片区域 */}
          <View style={styles.cardsContainer}>
            
            {/* 开发者功能 */}
            <DeveloperGuard>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="build" size={24} color="#3182ce" />
                  <Text style={styles.cardTitle}>开发者工具</Text>
                </View>
                <Text style={styles.cardDescription}>系统调试和开发工具</Text>
                <View style={styles.featureList}>
                  <Text style={styles.featureItem}>✅ 全部数据访问权限</Text>
                  <Text style={styles.featureItem}>✅ 系统配置权限</Text>
                  <Text style={styles.featureItem}>✅ 调试工具权限</Text>
                </View>
              </View>
            </DeveloperGuard>

            {/* 平台管理功能 */}
            <PlatformAdminGuard>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="settings" size={24} color="#10b981" />
                  <Text style={styles.cardTitle}>平台管理</Text>
                </View>
                <Text style={styles.cardDescription}>平台级别管理功能</Text>
                <View style={styles.featureList}>
                  <Text style={styles.featureItem}>✅ 工厂管理权限</Text>
                  <Text style={styles.featureItem}>✅ 白名单管理权限</Text>
                  <Text style={styles.featureItem}>✅ 用户管理权限</Text>
                </View>
              </View>
            </PlatformAdminGuard>

            {/* 工厂管理功能 */}
            <FactoryAdminGuard>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="business" size={24} color="#f59e0b" />
                  <Text style={styles.cardTitle}>工厂管理</Text>
                </View>
                <Text style={styles.cardDescription}>工厂内部管理功能</Text>
                <View style={styles.featureList}>
                  <Text style={styles.featureItem}>✅ 员工管理权限</Text>
                  <Text style={styles.featureItem}>✅ 部门管理权限</Text>
                  <Text style={styles.featureItem}>✅ 工厂数据权限</Text>
                </View>
              </View>
            </FactoryAdminGuard>

            {/* 业务模块权限展示 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="apps" size={24} color="#8b5cf6" />
                <Text style={styles.cardTitle}>业务模块权限</Text>
              </View>
              <View style={styles.modulePermissions}>
                <View style={styles.permissionRow}>
                  <Ionicons 
                    name={hasModuleAccess('farming_access') ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={hasModuleAccess('farming_access') ? "#10b981" : "#ef4444"} 
                  />
                  <Text style={styles.permissionText}>种植模块</Text>
                </View>
                <View style={styles.permissionRow}>
                  <Ionicons 
                    name={hasModuleAccess('processing_access') ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={hasModuleAccess('processing_access') ? "#10b981" : "#ef4444"} 
                  />
                  <Text style={styles.permissionText}>加工模块</Text>
                </View>
                <View style={styles.permissionRow}>
                  <Ionicons 
                    name={hasModuleAccess('logistics_access') ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={hasModuleAccess('logistics_access') ? "#10b981" : "#ef4444"} 
                  />
                  <Text style={styles.permissionText}>物流模块</Text>
                </View>
                <View style={styles.permissionRow}>
                  <Ionicons 
                    name={hasModuleAccess('trace_access') ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={hasModuleAccess('trace_access') ? "#10b981" : "#ef4444"} 
                  />
                  <Text style={styles.permissionText}>溯源模块</Text>
                </View>
                <View style={styles.permissionRow}>
                  <Ionicons 
                    name={hasModuleAccess('admin_access') ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={hasModuleAccess('admin_access') ? "#10b981" : "#ef4444"} 
                  />
                  <Text style={styles.permissionText}>管理模块</Text>
                </View>
                <View style={styles.permissionRow}>
                  <Ionicons 
                    name={hasModuleAccess('platform_access') ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={hasModuleAccess('platform_access') ? "#10b981" : "#ef4444"} 
                  />
                  <Text style={styles.permissionText}>平台模块</Text>
                </View>
              </View>
            </View>

            {/* 用户详细信息 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="information-circle" size={24} color="#6366f1" />
                <Text style={styles.cardTitle}>用户详细信息</Text>
              </View>
              <View style={styles.userInfoDetail}>
                <Text style={styles.infoLabel}>用户ID: <Text style={styles.infoValue}>{user.id}</Text></Text>
                <Text style={styles.infoLabel}>用户名: <Text style={styles.infoValue}>{user.username}</Text></Text>
                <Text style={styles.infoLabel}>邮箱: <Text style={styles.infoValue}>{user.email}</Text></Text>
                {user.phone && <Text style={styles.infoLabel}>手机: <Text style={styles.infoValue}>{user.phone}</Text></Text>}
                {'factoryId' in user && <Text style={styles.infoLabel}>工厂ID: <Text style={styles.infoValue}>{user.factoryId}</Text></Text>}
                {'department' in user && user.department && <Text style={styles.infoLabel}>部门: <Text style={styles.infoValue}>{user.department}</Text></Text>}
                <Text style={styles.infoLabel}>权限级别: <Text style={styles.infoValue}>{permissions?.level}</Text></Text>
                <Text style={styles.infoLabel}>功能权限数: <Text style={styles.infoValue}>{permissions?.features.length}</Text></Text>
              </View>
            </View>
          </View>

          {/* 底部版本信息 */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>海牛食品溯源系统 v{deviceInfo?.version}</Text>
            <Text style={styles.footerText}>Phase 1 - 完整数据库对接版本</Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3182ce',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 2,
  },
  userType: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardsContainer: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 12,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  featureList: {
    gap: 6,
  },
  featureItem: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  modulePermissions: {
    gap: 12,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
  },
  userInfoDetail: {
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 10,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
});