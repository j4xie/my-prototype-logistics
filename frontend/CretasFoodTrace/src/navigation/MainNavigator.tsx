import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MainTabParamList } from '../types/navigation';
import { useAuthStore } from '../store/authStore';
import { getPostLoginRoute } from '../utils/navigationHelper';
// ✅ P1-2: 导入类型守卫函数和辅助函数
import {
  getUserRole,
  hasPermission as checkUserPermission,
  isPlatformUser,
  isFactoryUser,
  getDepartment,
} from '../types/auth';

// 导入页面和导航器
import HomeScreen from '../screens/main/HomeScreen';
import ProcessingStackNavigator from './ProcessingStackNavigator';
import ManagementStackNavigator from './ManagementStackNavigator';
import PlatformStackNavigator from './PlatformStackNavigator';
import AttendanceStackNavigator from './AttendanceStackNavigator';
import ProfileStackNavigator from './ProfileStackNavigator'; // Phase 3 P2 - 使用导航器而非单页

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
    hasPlatformUser: isPlatformUser(user),
    hasFactoryUser: isFactoryUser(user),
  } : 'null');

  // ✅ P1-2: 使用类型安全的辅助函数替代 as any
  // 获取用户角色
  const userRole = getUserRole(user);

  // 检查权限的便捷函数
  const hasPermission = (perm: string): boolean => {
    return checkUserPermission(user, perm);
  };

  // ⚠️ 自动导航功能已禁用
  // 原因: React Navigation警告 - 条件渲染 + 手动导航会产生冲突
  // 现在用户登录后停留在首页，需手动点击Tab切换
  //
  // 如需启用自动导航，请取消以下代码的注释，但会看到开发环境警告
  // （警告不影响功能，只是React Navigation的提示）

  /*
  // 使用 ref 跟踪是否已经尝试过导航，避免重复导航
  const navigationAttemptedRef = useRef<Set<string>>(new Set());
  const previousUserIdRef = useRef<string | undefined>(undefined);

  // 当用户改变时，重置导航尝试记录
  useEffect(() => {
    const currentUserId = user?.id || user?.username;
    if (previousUserIdRef.current !== currentUserId) {
      navigationAttemptedRef.current.clear();
      previousUserIdRef.current = currentUserId;
    }
  }, [user]);

  // 登录后根据角色智能跳转
  useLayoutEffect(() => {
    if (user) {
      const route = getPostLoginRoute(user);

      // 如果路由指向非HomeTab的Tab,则导航到对应Tab
      if (route.screen === 'Main' && route.params?.screen && route.params.screen !== 'HomeTab') {
        // 正确的嵌套导航语法
        const targetScreen = route.params.screen;
        const targetParams = route.params.params;

        // 检查权限，确保目标 Tab 会被注册
        const hasTargetPermission = targetScreen === 'ProcessingTab'
          ? hasPermission('processing_access')
          : true; // 其他 Tab 的权限检查在渲染时已经完成

        // 避免重复导航尝试
        const navigationKey = `${targetScreen}-${user?.id || 'unknown'}`;
        if (navigationAttemptedRef.current.has(navigationKey)) {
          return;
        }

        console.log('🔀 Auto-navigate to:', targetScreen, 'with params:', targetParams);
        console.log('🔐 Permission check:', {
          targetScreen,
          hasPermission: hasTargetPermission,
          userRole,
          department: getDepartment(user),
          permissions
        });

        // 如果权限检查失败，不执行导航
        if (!hasTargetPermission) {
          console.warn(`⚠️ Cannot navigate to ${targetScreen}, user lacks required permissions.`);
          return;
        }

        // 标记已尝试导航
        navigationAttemptedRef.current.add(navigationKey);

        // 延迟导航，确保 Tab Navigator 已经完成渲染和注册
        // 使用多次重试机制，确保 Tab 完全注册后再导航
        const performNavigation = (attempt: number = 1) => {
          try {
            // @ts-ignore - React Navigation的嵌套导航
            if (targetParams) {
              // 有嵌套参数，使用完整的导航对象
              navigation.navigate(targetScreen as keyof MainTabParamList, targetParams);
              console.log(`✅ Navigation successful (attempt ${attempt}):`, targetScreen);
            } else {
              // 没有嵌套参数，直接导航
              navigation.navigate(targetScreen as keyof MainTabParamList);
              console.log(`✅ Navigation successful (attempt ${attempt}):`, targetScreen);
            }
          } catch (error: unknown) {
            // 如果导航失败，可能是目标 Tab 还没注册，稍后重试
            const errorMessage = error instanceof Error ? error.message : '';
            if ((errorMessage.includes('not handled') || errorMessage.includes('not found')) && attempt < 5) {
              console.warn(`⚠️ Tab ${targetScreen} not ready yet (attempt ${attempt}/5), retrying...`);
              // 重试多次，每次延迟递增
              setTimeout(() => {
                performNavigation(attempt + 1);
              }, 200 * attempt); // 200ms, 400ms, 600ms, 800ms
            } else {
              console.error(`❌ Navigation error after ${attempt} attempts:`, error);
              console.warn(`⚠️ Cannot navigate to ${targetScreen}. Error:`, error?.message);
              console.warn(`⚠️ This may be due to missing permissions or the Tab not being registered.`);
              // 如果多次重试都失败，移除标记，允许下次重新尝试
              navigationAttemptedRef.current.delete(navigationKey);
            }
          }
        };

        // 延迟执行导航，确保 Tab 已经注册
        // 使用 requestAnimationFrame 确保在下一个渲染周期执行
        requestAnimationFrame(() => {
          setTimeout(() => {
            performNavigation(1);
          }, 300); // 初始延迟 300ms
        });
      }
    }
  }, [user, navigation, permissions, userRole]);
  */

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
      {(userRole === 'factory_super_admin' ||
        userRole === 'permission_admin' ||
        userRole === 'department_admin' ||
        userRole === 'platform_admin') && (
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
        component={ProfileStackNavigator}
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
