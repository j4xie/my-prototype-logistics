import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider } from 'react-native-paper';
import { RootStackParamList } from '../types/navigation';
import { useAuthStore } from '../store/authStore';
import EnhancedLoginScreen from '../screens/auth/EnhancedLoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import MainNavigator from './MainNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * 应用根导航器
 * 根据认证状态切换登录页和主应用
 */
export function AppNavigator() {
  const { isAuthenticated } = useAuthStore();

  return (
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          {!isAuthenticated ? (
            // 未登录 - 显示登录流程
            <>
              <Stack.Screen
                name="Login"
                component={EnhancedLoginScreen}
              />
              <Stack.Screen
                name="LoginScreen"
                component={EnhancedLoginScreen}
              />
              <Stack.Screen
                name="RegisterScreen"
                component={RegisterScreen}
              />
            </>
          ) : (
            // 已登录 - 显示主应用
            <Stack.Screen
              name="Main"
              component={MainNavigator}
            />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

export default AppNavigator;