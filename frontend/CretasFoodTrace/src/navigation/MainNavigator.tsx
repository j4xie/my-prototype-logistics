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
    hasPlatformUser: !!user.platformUser,
    hasFactoryUser: !!user.factoryUser,
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

  // 获取用户权限 - 安全访问
  const permissions = user?.userType === 'platform'
    ? user.platformUser?.permissions || []
    : user?.userType === 'factory'
      ? user.factoryUser?.permissions || []
      : [];

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
    ? user.platformUser?.role || 'viewer'
    : user?.userType === 'factory'
      ? user.factoryUser?.role || 'viewer'
      : 'viewer';

  return (
    <Tab.Navigator
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

      {/* TODO: 其他模块根据权限动态添加 */}
      {/*
      {hasPermission('farming_access') && (
        <Tab.Screen
          name="FarmingTab"
          component={FarmingStackNavigator}
          options={{
            title: '养殖',
            tabBarIcon: ({ color, size }) => (
              <Icon source="fishbowl-outline" size={size} color={color} />
            ),
          }}
        />
      )}

      {hasPermission('logistics_access') && (
        <Tab.Screen
          name="LogisticsTab"
          component={LogisticsStackNavigator}
          options={{
            title: '物流',
            tabBarIcon: ({ color, size }) => (
              <Icon source="truck-delivery" size={size} color={color} />
            ),
          }}
        />
      )}

      {hasPermission('trace_access') && (
        <Tab.Screen
          name="TraceTab"
          component={TraceStackNavigator}
          options={{
            title: '溯源',
            tabBarIcon: ({ color, size }) => (
              <Icon source="qrcode-scan" size={size} color={color} />
            ),
          }}
        />
      )}

      {userRole === 'operator' && (
        <Tab.Screen
          name="TimeClockTab"
          component={TimeClockStackNavigator}
          options={{
            title: '打卡',
            tabBarIcon: ({ color, size }) => (
              <Icon source="clock-outline" size={size} color={color} />
            ),
          }}
        />
      )}

      {hasPermission('admin_access') && (
        <Tab.Screen
          name="AdminTab"
          component={AdminStackNavigator}
          options={{
            title: '管理',
            tabBarIcon: ({ color, size }) => (
              <Icon source="cog" size={size} color={color} />
            ),
          }}
        />
      )}
      */}
    </Tab.Navigator>
  );
}

export default MainNavigator;
