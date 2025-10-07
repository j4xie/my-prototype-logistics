import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Appbar, Avatar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { ModuleConfig } from '../../types/navigation';
import { ModuleCard } from './components/ModuleCard';
import { QuickStatsPanel } from './components/QuickStatsPanel';
import { MainTabParamList } from '../../types/navigation';

type HomeScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'HomeTab'>;

/**
 * 主页 - 模块入口中心
 */
export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuthStore();

  // 模块配置
  const modules: ModuleConfig[] = useMemo(() => {
    if (!user) return [];

    const userPermissions = user.userType === 'platform'
      ? user.platformUser?.permissions || []
      : user.factoryUser?.permissions || [];

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
        color: '#2196F3',
      },
      {
        id: 'farming',
        name: '养殖模块',
        icon: 'fishbowl-outline',
        description: '养殖管理、饲料投喂',
        status: 'coming_soon',
        requiredPermissions: ['farming_access'],
        color: '#4CAF50',
      },
      {
        id: 'logistics',
        name: '物流模块',
        icon: 'truck-delivery',
        description: '运输管理、配送追踪',
        status: 'coming_soon',
        requiredPermissions: ['logistics_access'],
        color: '#FF9800',
      },
      {
        id: 'trace',
        name: '溯源模块',
        icon: 'qrcode-scan',
        description: '产品追溯、信息查询',
        status: 'coming_soon',
        requiredPermissions: ['trace_access'],
        color: '#9C27B0',
      },
      {
        id: 'admin',
        name: '用户管理',
        icon: 'account-cog',
        description: '用户、角色、权限管理',
        status: 'available',
        requiredPermissions: ['admin_access'],
        route: 'AdminTab',
        color: '#607D8B',
      },
      {
        id: 'settings',
        name: '系统设置',
        icon: 'cog',
        description: '个人设置、系统配置',
        status: 'available',
        requiredPermissions: [],
        color: '#795548',
      },
    ];

    // 根据用户权限筛选可见模块
    return allModules.filter(module => {
      if (module.requiredPermissions.length === 0) return true;

      // 检查权限 - 兼容对象和数组格式
      return module.requiredPermissions.some(perm => {
        // 如果是数组格式
        if (Array.isArray(userPermissions)) {
          return userPermissions.includes(perm);
        }

        // 如果是对象格式 (后端返回的格式)
        if (typeof userPermissions === 'object' && userPermissions !== null) {
          const permsObj = userPermissions as any;
          // 检查 modules 对象
          if (permsObj.modules && permsObj.modules[perm] === true) {
            return true;
          }
          // 检查 features 数组
          if (Array.isArray(permsObj.features) && permsObj.features.includes(perm)) {
            return true;
          }
        }

        return false;
      });
    });
  }, [user]);

  // 处理模块点击
  const handleModulePress = (module: ModuleConfig) => {
    if (module.status === 'coming_soon') {
      Alert.alert('即将上线', `${module.name}正在开发中,敬请期待!`);
      return;
    }

    if (module.status === 'locked') {
      Alert.alert('无权访问', `您没有权限访问${module.name}`);
      return;
    }

    // 跳转到对应模块
    if (module.route) {
      // @ts-ignore - 动态路由
      navigation.navigate(module.route as any);
    } else if (module.id === 'settings') {
      // 系统设置暂时显示提示
      Alert.alert('系统设置', '此功能正在完善中');
    }
  };

  // 用户显示名
  const displayName = user?.fullName || user?.username || 'User';
  const roleText = user?.userType === 'platform'
    ? '平台管理员'
    : user?.userType === 'factory'
      ? getRoleDisplayName(user.factoryUser?.role || 'viewer')
      : 'User';

  return (
    <View style={styles.container}>
      {/* 顶部栏 */}
      <Appbar.Header elevated>
        <View style={styles.headerContent}>
          <View style={styles.userInfo}>
            <Avatar.Text size={40} label={displayName.charAt(0)} />
            <View style={styles.userText}>
              <Text variant="titleMedium" style={styles.userName}>{displayName}</Text>
              <Text variant="bodySmall" style={styles.userRole}>{roleText}</Text>
            </View>
          </View>
          <Appbar.Action icon="bell-outline" onPress={() => {
            Alert.alert('通知', '暂无新通知');
          }} />
        </View>
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        {/* 欢迎信息 */}
        <View style={styles.welcomeSection}>
          <Text variant="headlineMedium" style={styles.welcomeTitle}>
            您好,{displayName}
          </Text>
          <Text variant="bodyMedium" style={styles.welcomeSubtitle}>
            欢迎使用白垩纪食品溯源系统
          </Text>
        </View>

        {/* 快捷信息面板 */}
        {user && <QuickStatsPanel user={user} />}

        {/* 模块网格 */}
        <View style={styles.modulesSection}>
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

        {/* 底部留白 */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// 角色显示名称映射
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
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userText: {
    justifyContent: 'center',
  },
  userName: {
    fontWeight: '600',
  },
  userRole: {
    color: '#757575',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  welcomeSection: {
    marginBottom: 24,
  },
  welcomeTitle: {
    fontWeight: '700',
    color: '#212121',
  },
  welcomeSubtitle: {
    color: '#757575',
    marginTop: 4,
  },
  modulesSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 16,
    color: '#212121',
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bottomSpacer: {
    height: 32,
  },
});
