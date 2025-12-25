import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Avatar, Icon } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { ModuleConfig } from '../../types/navigation';
import { ModuleCard } from './components/ModuleCard';
import { QuickStatsPanel } from './components/QuickStatsPanel';
import { MainTabParamList } from '../../types/navigation';
import { UserPermissions } from '../../types/auth';
import { ScreenWrapper } from '../../components/ui';
import { theme } from '../../theme';

type HomeScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'HomeTab'>;

/**
 * Home Screen (Neo Minimal Style)
 * 
 * Main dashboard with clean layout and standard components.
 */
export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuthStore();

  // Module Configuration
  const modules: ModuleConfig[] = useMemo(() => {
    if (!user) return [];
    const userPermissions = (user.userType === 'platform'
      ? user.platformUser?.permissions
      : user.factoryUser?.permissions) || [];

    const allModules: ModuleConfig[] = [
      {
        id: 'processing',
        name: '生产模块',
        icon: 'cube-outline',
        description: '批次管理、质检、成本核算',
        status: 'available',
        progress: 27,
        requiredPermissions: ['processing_access'],
        route: 'ProcessingTab',
        color: '#1890FF', // Neo Blue
      },
      {
        id: 'logistics',
        name: '物流模块',
        icon: 'truck-delivery',
        description: '运输管理、配送追踪',
        status: 'coming_soon',
        requiredPermissions: ['logistics_access'],
        color: '#FAAD14', // Neo Orange
      },
      {
        id: 'trace',
        name: '溯源模块',
        icon: 'qrcode-scan',
        description: '产品追溯、信息查询',
        status: 'coming_soon',
        requiredPermissions: ['trace_access'],
        color: '#722ED1', // Neo Purple
      },
      {
        id: 'admin',
        name: '用户管理',
        icon: 'account-cog',
        description: '用户、角色、权限管理',
        status: 'available',
        requiredPermissions: ['admin_access'],
        route: 'AdminTab',
        color: '#13C2C2', // Neo Cyan
      },
      {
        id: 'settings',
        name: '系统设置',
        icon: 'cog',
        description: '个人设置、系统配置',
        status: 'available',
        requiredPermissions: [],
        color: '#595959', // Neo Gray
      },
    ];

    // Filter modules based on permissions
    return allModules.filter(module => {
      if (module.requiredPermissions.length === 0) return true;
      return module.requiredPermissions.some(perm => {
        if (Array.isArray(userPermissions)) {
          return userPermissions.includes(perm);
        }
        if (typeof userPermissions === 'object' && userPermissions !== null && !Array.isArray(userPermissions)) {
          const permsObj = userPermissions as Partial<UserPermissions>;
          if (permsObj.modules && permsObj.modules[perm as keyof typeof permsObj.modules] === true) return true;
          if (Array.isArray(permsObj.features) && permsObj.features.includes(perm)) return true;
        }
        return false;
      });
    });
  }, [user]);

  const handleModulePress = (module: ModuleConfig) => {
    if (module.status === 'coming_soon') {
      Alert.alert('即将上线', `${module.name}正在开发中,敬请期待!`);
      return;
    }

    if (module.status === 'locked') {
      Alert.alert('无权访问', `您没有权限访问${module.name}`);
      return;
    }

    if (module.route) {
      // @ts-ignore - Dynamic routing
      navigation.navigate(module.route as keyof MainTabParamList);
    } else if (module.id === 'settings') {
      Alert.alert('系统设置', '此功能正在完善中');
    }
  };

  // User Display Info
  const displayName = user?.fullName || user?.username || 'User';
  const roleText = user?.userType === 'platform'
    ? '平台管理员'
    : user?.userType === 'factory'
      ? getRoleDisplayName(user.factoryUser?.role || 'viewer')
      : 'User';

  return (
    <ScreenWrapper backgroundColor={theme.colors.background} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Custom Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Avatar.Text 
              size={48} 
              label={displayName.charAt(0).toUpperCase()} 
              style={{ backgroundColor: theme.colors.primaryContainer }}
              color={theme.colors.onPrimaryContainer}
            />
            <View style={styles.userText}>
              <Text variant="titleMedium" style={styles.greeting}>你好, {displayName}</Text>
              <Text variant="bodySmall" style={styles.role}>{roleText}</Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => Alert.alert('通知', '暂无新通知')}
            style={styles.notificationButton}
          >
            <Icon source="bell-outline" size={24} color={theme.colors.onSurface} />
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        {user && (
          <View style={styles.section}>
            <QuickStatsPanel user={user} />
          </View>
        )}

        {/* Modules Grid */}
        <View style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>功能模块</Text>
          <View style={styles.modulesGrid}>
            {modules.map(module => (
              <ModuleCard
                key={module.id}
                module={module}
                onPress={() => handleModulePress(module)}
              />
            ))}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </ScreenWrapper>
  );
}

function getRoleDisplayName(role: string): string {
  const roleMap: Record<string, string> = {
    factory_super_admin: '工厂超级管理员',
    permission_admin: '权限管理员',
    department_admin: '部门管理员',
    operator: '操作员',
    viewer: '查看者',
    unactivated: '未激活用户',
  };
  return roleMap[role] || role;
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 24, // Extra padding for top
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userText: {
    justifyContent: 'center',
  },
  greeting: {
    fontWeight: '700',
    color: theme.colors.text,
    fontSize: 20,
  },
  role: {
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  notificationButton: {
    padding: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.custom.borderRadius.round,
    ...theme.custom.shadows.small,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 16,
    color: theme.colors.text,
    fontSize: 18,
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bottomSpacer: {
    height: 40,
  },
});
