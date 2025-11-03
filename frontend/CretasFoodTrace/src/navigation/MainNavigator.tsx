import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MainTabParamList } from '../types/navigation';
import { useAuthStore } from '../store/authStore';
import { getPostLoginRoute } from '../utils/navigationHelper';

// 导入页面和导航器
import HomeScreen from '../screens/main/HomeScreen';
import ProcessingStackNavigator from './ProcessingStackNavigator';
import ManagementStackNavigator from './ManagementStackNavigator';
import PlatformStackNavigator from './PlatformStackNavigator';
import AttendanceStackNavigator from './AttendanceStackNavigator';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * 主Tab导航器
 * 根据用户权限动态显示不同的Tab
 */
export function MainNavigator() {
  const { user } = useAuthStore();
  const navigation = useNavigation();

  // 调试日志
  console.log('🏠 MainNavigator - User:', user ? {
    userType: user.userType,
    hasPlatformUser: user.userType === 'platform',
    hasFactoryUser: user.userType === 'factory',
  } : 'null');

  // 登录后根据角色智能跳转
  useEffect(() => {
    if (user) {
      const route = getPostLoginRoute(user);

      // 如果路由指向非HomeTab的Tab,则导航到对应Tab
      if (route.screen === 'Main' && route.params?.screen && route.params.screen !== 'HomeTab') {
        // @ts-ignore
        navigation.navigate(route.params.screen, route.params.params);
      }
    }
  }, [user]);

  // 获取用户权限 - 从 user 的顶级 permissions 获取完整权限对象
  // 这个对象包含 modules（权限列表）、features（功能列表）等信息
  const permissions = (user as any)?.permissions || {};

  // 检查是否有某个权限 - 兼容对象和数组格式
  const hasPermission = (perm: string) => {
    // 如果是数组格式
    if (Array.isArray(permissions)) {
      return permissions.includes(perm);
    }

    // 如果是对象格式 (后端返回的格式)
    if (typeof permissions === 'object' && permissions !== null) {
      // 检查 modules 对象
      if ((permissions as any).modules && (permissions as any).modules[perm] === true) {
        return true;
      }
      // 检查 features 数组
      if (Array.isArray((permissions as any).features) && (permissions as any).features.includes(perm)) {
        return true;
      }
    }

    return false;
  };

  // 获取用户角色 - 安全访问
  const userRole = user?.userType === 'platform'
    ? (user as any).platformUser?.role || (user as any).role || 'viewer'
    : user?.userType === 'factory'
      ? (user as any).factoryUser?.role || (user as any).role || 'viewer'
      : 'viewer';

  return (
    <Tab.Navigator
      id="MainTabNavigator"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: '#757575',
      }}
    >
      {/* 首页 - 所有用户可见 */}
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: '首页',
          tabBarIcon: ({ color, size }) => (
            <Icon source="home" size={size} color={color} />
          ),
        }}
      />

      {/* 考勤模块 - 所有工厂用户可见（操作员必用） */}
      {user?.userType === 'factory' && (
        <Tab.Screen
          name="AttendanceTab"
          component={AttendanceStackNavigator}
          options={{
            title: '考勤',
            tabBarIcon: ({ color, size }) => (
              <Icon source="clock-outline" size={size} color={color} />
            ),
          }}
        />
      )}

      {/* 生产模块 - 有生产权限的用户可见 */}
      {hasPermission('processing_access') && (
        <Tab.Screen
          name="ProcessingTab"
          component={ProcessingStackNavigator}
          options={{
            title: '生产',
            tabBarIcon: ({ color, size }) => (
              <Icon source="cube-outline" size={size} color={color} />
            ),
          }}
        />
      )}

      {/* 管理模块 - 管理员可见 */}
      {(userRole === 'factory_super_admin' || userRole === 'permission_admin' || userRole === 'department_admin') && (
        <Tab.Screen
          name="ManagementTab"
          component={ManagementStackNavigator}
          options={{
            title: '管理',
            tabBarIcon: ({ color, size }) => (
              <Icon source="cog" size={size} color={color} />
            ),
          }}
        />
      )}

      {/* 平台管理 - 仅平台管理员可见 */}
      {user?.userType === 'platform' && (
        <Tab.Screen
          name="PlatformTab"
          component={PlatformStackNavigator}
          options={{
            title: '平台',
            tabBarIcon: ({ color, size }) => (
              <Icon source="shield-crown" size={size} color={color} />
            ),
          }}
        />
      )}

      {/* 个人中心 - 所有用户可见 */}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => (
            <Icon source="account" size={size} color={color} />
          ),
        }}
      />

      {/*
        其他模块（农场、物流、溯源等）在 Phase 4+ 中实现
        详见: docs/prd/PRD-Phase3-完善计划.md
      */}
    </Tab.Navigator>
  );
}

export default MainNavigator;
