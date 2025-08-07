import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { StatusBar, Alert, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 导航类型
import { 
  RootStackParamList, 
  MainTabParamList,
  AuthStackParamList,
  NavigationTheme,
  NAVIGATION_CONSTANTS,
  ROLE_ROUTE_MAPPING 
} from './types';

// Hooks和服务
import { usePermission } from '../hooks/usePermission';
import { useLogin } from '../hooks/useLogin';
import { TokenManager } from '../services/tokenManager';

// 屏幕组件
import EnhancedLoginScreen from '../screens/auth/EnhancedLoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { RegisterPhaseOneScreen } from '../screens/auth/RegisterPhaseOneScreen';
import { RegisterPhaseTwoScreen } from '../screens/auth/RegisterPhaseTwoScreen';
import { ActivationScreen } from '../screens/auth/ActivationScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { EnhancedPermissionGuard } from '../components/auth/EnhancedPermissionGuard';

// 创建导航器实例
const RootStack = createStackNavigator<RootStackParamList>();
const AuthStack = createStackNavigator<AuthStackParamList>();

// 临时屏幕组件
const NotFoundScreen: React.FC = () => (
  <View style={styles.tempScreen}>
    <Text style={styles.tempText}>404 - 页面未找到</Text>
  </View>
);

const UnauthorizedScreen: React.FC = () => (
  <View style={styles.tempScreen}>
    <Text style={styles.tempText}>403 - 权限不足</Text>
  </View>
);

const LoadingScreen: React.FC = () => (
  <View style={styles.tempScreen}>
    <ActivityIndicator size="large" color="#4ECDC4" />
    <Text style={styles.tempText}>加载中...</Text>
  </View>
);

// 应用主题配置
const AppTheme: NavigationTheme = {
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: '#4ECDC4',
    background: '#F8F9FA',
    card: '#FFFFFF',
    text: '#333333',
    border: '#E9ECEF',
    notification: '#FF6B6B',
    tabBar: {
      active: '#4ECDC4',
      inactive: '#95A5A6',
      background: '#FFFFFF'
    },
    drawer: {
      active: '#4ECDC4',
      inactive: '#666666',
      background: '#FFFFFF'
    }
  }
};

/**
 * 认证栈导航器
 * 处理登录、注册、激活等认证流程
 */
const AuthNavigator: React.FC = () => {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animationEnabled: true
      }}
    >
      <AuthStack.Screen 
        name="Login" 
        component={EnhancedLoginScreen}
        options={{
          animationTypeForReplace: 'pop'
        }}
      />
      <AuthStack.Screen 
        name="Register" 
        component={RegisterPhaseOneScreen}
        options={{
          headerShown: false
        }}
      />
      <AuthStack.Screen 
        name="RegisterPhaseTwo" 
        component={RegisterPhaseTwoScreen}
        options={{
          headerShown: false
        }}
      />
      <AuthStack.Screen 
        name="Activation" 
        component={ActivationScreen}
        options={{
          title: '激活账户',
          headerShown: true,
          headerStyle: {
            backgroundColor: AppTheme.colors.primary,
          },
          headerTintColor: '#FFFFFF'
        }}
      />
    </AuthStack.Navigator>
  );
};

/**
 * 主应用导航器
 * 管理应用的导航状态和权限验证
 */
export const AppNavigator: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>('Auth');
  
  const { 
    autoLogin, 
    isLoading: authLoading,
    networkStatus 
  } = useLogin({
    enableBiometric: true,
    enableAutoLogin: true,
    maxRetries: 3
  });
  
  const { user, isAuthenticated, refreshPermissions } = usePermission();

  // 应用初始化
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 检查是否有有效Token
        const hasValidToken = await TokenManager.getValidToken();
        
        if (hasValidToken) {
          // 尝试自动登录
          const autoLoginSuccess = await autoLogin();
          
          if (autoLoginSuccess) {
            // 刷新权限数据
            await refreshPermissions();
            
            // 设置主应用为初始路由
            setInitialRoute('Main');
          } else {
            setInitialRoute('Auth');
          }
        } else {
          setInitialRoute('Auth');
        }
      } catch (error) {
        console.error('App initialization error:', error);
        setInitialRoute('Auth');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, [autoLogin, refreshPermissions]);

  // 监听网络状态变化
  useEffect(() => {
    if (networkStatus === 'offline') {
      Alert.alert(
        '网络连接异常',
        '请检查您的网络连接。应用将在离线模式下运行。',
        [{ text: '确定' }]
      );
    }
  }, [networkStatus]);

  // 显示加载屏幕
  if (isInitializing || authLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={AppTheme.colors.primary}
        translucent
      />
      
      <NavigationContainer theme={AppTheme}>
        <RootStack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            animationEnabled: true
          }}
        >
          {/* 认证流程 */}
          <RootStack.Screen 
            name="Auth" 
            component={AuthNavigator}
            options={{
              animationTypeForReplace: isAuthenticated ? 'pop' : 'push'
            }}
          />
          
          {/* 主应用 */}
          <RootStack.Screen name="Main">
            {(props) => (
              <EnhancedPermissionGuard
                requiredAuth={true}
                fallback={<UnauthorizedScreen />}
              >
                <MainTabNavigator {...props} />
              </EnhancedPermissionGuard>
            )}
          </RootStack.Screen>
          
          {/* 错误和特殊页面 */}
          <RootStack.Screen 
            name="NotFound" 
            component={NotFoundScreen}
            options={{ 
              title: '页面未找到',
              headerShown: true,
              headerStyle: {
                backgroundColor: AppTheme.colors.card,
              },
              headerTintColor: AppTheme.colors.text
            }}
          />
          
          <RootStack.Screen 
            name="Unauthorized" 
            component={UnauthorizedScreen}
            options={{ 
              title: '权限不足',
              headerShown: true,
              headerStyle: {
                backgroundColor: AppTheme.colors.card,
              },
              headerTintColor: AppTheme.colors.text
            }}
          />
        </RootStack.Navigator>
      </NavigationContainer>
    </>
  );
};

const styles = StyleSheet.create({
  tempScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  tempText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 8,
  },
  tempSubtext: {
    fontSize: 16,
    color: '#666',
  },
});