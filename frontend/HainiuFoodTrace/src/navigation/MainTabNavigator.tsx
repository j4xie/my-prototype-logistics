import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useNavigationStore } from '../store/navigationStore';

// 屏幕组件
import { HomeScreen } from '../screens/main/HomeScreen';
import { FarmingScreen } from '../screens/main/FarmingScreen';
import { ProcessingStackNavigator } from './ProcessingStackNavigator';
import { LogisticsScreen } from '../screens/main/LogisticsScreen';
import { TraceScreen } from '../screens/main/TraceScreen';
import { AdminStackNavigator } from './AdminStackNavigator';
import { PlatformScreen } from '../screens/main/PlatformScreen';
import { DeveloperScreen } from '../screens/main/DeveloperScreen';

export type MainTabParamList = {
  home: undefined;
  farming: undefined;
  processing: undefined;
  logistics: undefined;
  trace: undefined;
  admin: undefined;
  platform: undefined;
  developer: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// 图标映射
const tabIcons: Record<string, string> = {
  home: 'home',
  farming: 'leaf',
  processing: 'cog',
  logistics: 'car',
  trace: 'search',
  admin: 'settings',
  platform: 'server',
  developer: 'code-slash',
};

// 屏幕组件映射
const screenComponents: Record<string, React.ComponentType<any>> = {
  HomeScreen,
  FarmingScreen,
  ProcessingScreen: ProcessingStackNavigator,
  LogisticsScreen,
  TraceScreen,
  AdminScreen: AdminStackNavigator,
  PlatformScreen,
  DeveloperScreen,
};

export const MainTabNavigator: React.FC = () => {
  const { user } = useAuthStore();
  const { 
    availableTabs, 
    currentTab, 
    isTabBarVisible,
    updateAvailableTabs,
    setCurrentTab 
  } = useNavigationStore();

  // 当用户信息变化时更新可用Tab
  useEffect(() => {
    updateAvailableTabs(user);
  }, [user, updateAvailableTabs]);

  return (
    <Tab.Navigator
      initialRouteName="home"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const iconName = tabIcons[route.name] || 'help-circle';
          return (
            <Ionicons 
              name={focused ? iconName as any : `${iconName}-outline` as any} 
              size={size} 
              color={color} 
            />
          );
        },
        tabBarActiveTintColor: '#3182ce',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          display: isTabBarVisible ? 'flex' : 'none',
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: false,
      })}
      screenListeners={{
        tabPress: (e) => {
          setCurrentTab(e.target?.split('-')[0] || 'home');
        },
      }}
    >
      {availableTabs.map((tab) => {
        const Component = screenComponents[tab.component];
        if (!Component) {
          console.warn(`Screen component ${tab.component} not found`);
          return null;
        }

        return (
          <Tab.Screen
            key={tab.name}
            name={tab.name as keyof MainTabParamList}
            component={Component}
            options={{
              tabBarLabel: tab.title,
              tabBarBadge: undefined, // 可以在这里添加徽章逻辑
            }}
          />
        );
      })}
    </Tab.Navigator>
  );
};