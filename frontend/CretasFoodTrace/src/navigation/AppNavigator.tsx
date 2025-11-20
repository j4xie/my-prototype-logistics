import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { useAuthStore } from '../store/authStore';
import { theme } from '../theme';
import EnhancedLoginScreen from '../screens/auth/EnhancedLoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import MainNavigator from './MainNavigator';

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  const { isAuthenticated } = useAuthStore();

  return (
    <PaperProvider theme={theme}>
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
                name="EnhancedLogin"
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
              <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
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